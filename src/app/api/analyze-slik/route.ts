import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuthAndPermission } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSecureErrorResponse } from "@/lib/security";
import { extractClientInfo, logAudit } from "@/lib/audit";
import { isBranchAllowed, toScopeUser } from "@/lib/access-scope";
import { extractPdfText } from "@/lib/slik/pdfText";
import {
  analyzeSlikDocuments,
  analyzeSlikPerDocument,
  applyTextBudget,
  MAX_PROMPT_DOC_CHARS,
  SlikAnalyzerError,
  TRUNCATION_MARKER,
  type SlikDocumentAnalysis,
  type SlikSourceText,
} from "@/lib/slik/openrouter";

/**
 * POST /api/analyze-slik
 *
 * Menerima banyak file PDF laporan SLIK OJK (IDEB), mengekstrak teksnya secara
 * lokal (pdf-parse-fork — tidak ada PDF yang dikirim ke pihak ketiga), lalu
 * meminta OpenRouter menyusun ringkasan + rekomendasi komite dalam bentuk JSON.
 * PDF laporan akhir dibuat di sisi klien (src/lib/slik/generateSlikReport.ts).
 *
 * Dua mode analisa (field `mode` pada FormData):
 * - "per-file" (default): satu berkas = satu debitur. Setiap berkas dikirim pada
 *   panggilan model tersendiri dan menghasilkan JSON serta laporan PDF tersendiri.
 *   Kegagalan satu berkas tidak menggagalkan berkas lain.
 * - "merge": seluruh berkas dianggap milik satu debitur, digabung menjadi satu
 *   prompt → satu JSON → satu laporan.
 *
 * Tahap 5A (P0.5): setiap analisa WAJIB memilih debitur yang terdaftar pada
 * pengajuan kredit (field `customerId`, opsional `creditApplicationId`), dan
 * hasilnya disimpan ke tabel `slik_analysis_records` agar dapat dilihat ulang
 * serta diunduh ulang — tidak hilang saat analisa baru dimasukkan.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB per permintaan
const MIN_TEXT_CHARS = 50;
/** Batas teks per dokumen (juga jadi kuota per berkas pada mode per berkas). */
const MAX_CHARS_PER_DOC = Math.min(MAX_PROMPT_DOC_CHARS, 150_000);
/** Jumlah berkas yang dianalisa bersamaan pada mode per berkas. */
const PER_FILE_CONCURRENCY = 3;

type SlikMode = "per-file" | "merge";

/** Status ekstraksi satu berkas — dikirim ke UI agar terlihat berkas mana yang terbaca. */
interface FileExtractionStatus {
  index: number;
  fileName: string;
  pages: number;
  chars: number;
  truncated: boolean;
  status: "analyzed" | "skipped" | "failed";
  reason?: string;
}

/** Berkas yang siap dianalisa (teksnya memadai). */
interface SlikEntry {
  index: number;
  source: SlikSourceText;
}

function isPdf(file: File): boolean {
  const name = (file.name || "").toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

export async function GET() {
  const authCheck = await requireAuthAndPermission("credit.analysis.view");
  if (!authCheck.authorized) {
    return authCheck.response!;
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  return NextResponse.json({
    success: true,
    data: {
      configured: Boolean(apiKey),
      model: process.env.OPENROUTER_MODEL?.trim() || "qwen/qwen3.7-flash",
      fallbackModel: process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "deepseek/deepseek-v4.1-flash",
      modes: ["per-file", "merge"],
      defaultMode: "per-file",
      maxFiles: MAX_FILES,
      maxFileMb: Math.round(MAX_FILE_BYTES / (1024 * 1024)),
      maxTotalMb: Math.round(MAX_TOTAL_BYTES / (1024 * 1024)),
      maxPerFileChars: MAX_CHARS_PER_DOC,
      maxTotalMergeChars: MAX_PROMPT_DOC_CHARS,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, "analyze-slik", { limit: 6, windowMs: 5 * 60 * 1000 });
    if (!rateLimit.isAllowed) {
      return rateLimit.response!;
    }

    const authCheck = await requireAuthAndPermission("credit.analysis.create");
    if (!authCheck.authorized) {
      return authCheck.response!;
    }
    const currentUser = authCheck.user!;

    const formData = await req.formData();
    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter((entry): entry is File => entry instanceof File);
    const mode: SlikMode = formData.get("mode") === "merge" ? "merge" : "per-file";

    // Tahap 5A (P0.5): analisa WAJIB terkait debitur yang terdaftar pada
    // pengajuan kredit. Pemilihan diverifikasi di server, bukan hanya di UI.
    const customerIdRaw = formData.get("customerId");
    const customerId = typeof customerIdRaw === "string" ? customerIdRaw.trim() : "";
    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "Pilih data debitur yang terdaftar pada pengajuan kredit sebelum menjalankan analisa SLIK. " +
            "Hasil analisa akan disimpan dan dihubungkan ke debitur tersebut.",
        },
        { status: 400 }
      );
    }

    const creditApplicationIdRaw = formData.get("creditApplicationId");
    const creditApplicationId =
      typeof creditApplicationIdRaw === "string" && creditApplicationIdRaw.trim()
        ? creditApplicationIdRaw.trim()
        : null;

    const scopeUser = toScopeUser(currentUser);
    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        organizationId: currentUser.organizationId,
        isActive: true,
        // Hanya nasabah yang memiliki minimal satu pengajuan kredit.
        creditApplications: { some: {} },
      },
      select: { id: true, legalName: true, customerNumber: true, branchId: true },
    });
    if (!customer) {
      return NextResponse.json(
        {
          error:
            "Debitur tidak ditemukan, tidak aktif, atau tidak terdaftar pada pengajuan kredit di organisasi Anda.",
        },
        { status: 400 }
      );
    }
    if (!isBranchAllowed(scopeUser, customer.branchId)) {
      return NextResponse.json(
        { error: "Debitur berada di luar cakupan cabang Anda." },
        { status: 403 }
      );
    }
    if (creditApplicationId) {
      const application = await db.creditApplication.findFirst({
        where: {
          id: creditApplicationId,
          customerId: customer.id,
          organizationId: currentUser.organizationId,
        },
        select: { id: true },
      });
      if (!application) {
        return NextResponse.json(
          { error: "Pengajuan kredit terpilih tidak cocok dengan debitur yang dipilih." },
          { status: 400 }
        );
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada berkas PDF yang dikirim. Pilih minimal satu laporan SLIK OJK." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_FILES} berkas PDF dalam satu analisa (diterima ${files.length}).` },
        { status: 400 }
      );
    }

    const invalid = files.find((file) => !isPdf(file));
    if (invalid) {
      return NextResponse.json(
        { error: `Berkas "${invalid.name}" bukan PDF. Hanya laporan SLIK dalam format PDF yang dapat dianalisa.` },
        { status: 400 }
      );
    }

    const tooLarge = files.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) {
      return NextResponse.json(
        {
          error: `Berkas "${tooLarge.name}" melebihi batas ${
            MAX_FILE_BYTES / (1024 * 1024)
          } MB per file.`,
        },
        { status: 400 }
      );
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: `Total ukuran berkas melebihi batas ${MAX_TOTAL_BYTES / (1024 * 1024)} MB.` },
        { status: 400 }
      );
    }

    // 1. Ekstraksi teks lokal per berkas, sekaligus mencatat status tiap berkas
    //    supaya UI dapat menampilkan berkas mana yang terbaca dan mana yang tidak.
    const warnings: string[] = [];
    const entries: SlikEntry[] = [];
    const fileStatus: FileExtractionStatus[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const rawBytes = await file.arrayBuffer();

      let parsed: { text: string; pages: number; attempts: number };
      try {
        // Pembacaan berulang di dalam helper: pustaka pdf-parse-fork terbukti gagal
        // acak pada berkas yang sehat (lihat catatan di src/lib/slik/pdfText.ts).
        parsed = await extractPdfText(rawBytes);
      } catch (error) {
        const reason = `Gagal dibaca: ${
          error instanceof Error ? error.message : "format PDF tidak dikenali"
        }`;
        warnings.push(`Berkas "${file.name}" ${reason.toLowerCase()}.`);
        fileStatus.push({
          index,
          fileName: file.name,
          pages: 0,
          chars: 0,
          truncated: false,
          status: "failed",
          reason,
        });
        continue;
      }

      const pages = parsed.pages;
      const text = parsed.text.replace(/\u0000/g, " ").trim();

      if (text.length < MIN_TEXT_CHARS) {
        const reason = "Hampir tidak mengandung teks (kemungkinan hasil scan/gambar) — perlu OCR";
        warnings.push(`Berkas "${file.name}": ${reason}.`);
        fileStatus.push({
          index,
          fileName: file.name,
          pages,
          chars: text.length,
          truncated: false,
          status: "skipped",
          reason,
        });
        continue;
      }

      // Batas per berkas: pada mode "merge" ini menjaga agar satu berkas besar tidak
      // menghabiskan kuota total; pada mode "per-file" ini kuota utama berkas tersebut.
      const truncated = text.length > MAX_CHARS_PER_DOC;
      const source: SlikSourceText = {
        fileName: file.name,
        pages,
        text: truncated ? `${text.slice(0, MAX_CHARS_PER_DOC)}${TRUNCATION_MARKER}` : text,
        truncated,
      };

      if (truncated) {
        warnings.push(
          `Teks berkas "${file.name}" dipotong pada ${MAX_CHARS_PER_DOC.toLocaleString("id-ID")} karakter.`
        );
      }

      entries.push({ index, source });
      fileStatus.push({
        index,
        fileName: file.name,
        pages,
        chars: source.text.length,
        truncated,
        status: "analyzed",
      });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada teks yang berhasil diekstrak dari berkas yang diunggah. " +
            "Pastikan PDF laporan SLIK OJK memiliki lapisan teks (bukan hasil scan).",
          warnings,
          meta: { mode, files: fileStatus },
        },
        { status: 422 }
      );
    }

    const { ipAddress, userAgent } = extractClientInfo(req);
    const startedAt = Date.now();

    // 2a. Mode gabung: seluruh berkas = satu debitur → satu prompt → satu JSON.
    if (mode === "merge") {
      // Batas TOTAL teks antar berkas (menghormati SLIK_MAX_DOC_CHARS).
      const budgeted = applyTextBudget(entries.map((entry) => entry.source));
      warnings.push(...budgeted.warnings);

      const result = await analyzeSlikDocuments(budgeted.sources);
      result.warnings = [...warnings, ...result.warnings];

      // Tahap 5A (P0.5): simpan hasil analisa terkait debitur terpilih.
      const record = await db.slikAnalysisRecord.create({
        data: {
          organizationId: currentUser.organizationId,
          branchId: customer.branchId ?? currentUser.branchId ?? null,
          customerId: customer.id,
          creditApplicationId,
          customerName: customer.legalName,
          sourceFileNames: budgeted.sources.map((source) => source.fileName),
          mode,
          rekomendasi: result.data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi,
          riskRating: result.data.analisis_dan_rekomendasi.keputusan_komite.risk_rating,
          modelUsed: result.model,
          elapsedMs: result.elapsedMs,
          result: result.data as unknown as Prisma.InputJsonValue,
          meta: {
            warnings: result.warnings,
            sources: result.sources,
            fileStatus,
          } as unknown as Prisma.InputJsonValue,
          createdById: currentUser.id,
        },
      });

      await logAudit({
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        action: "CREATE",
        entityType: "SLIK_ANALYSIS",
        entityId: record.id,
        newValues: {
          mode,
          customerId: customer.id,
          customerName: customer.legalName,
          creditApplicationId,
          model: result.model,
          scannedFiles: files.map((file) => file.name),
          analyzedFiles: budgeted.sources.map((source) => source.fileName),
          debitur: result.data.data_pribadi.nama_lengkap,
          rekomendasi: result.data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi,
          riskRating: result.data.analisis_dan_rekomendasi.keputusan_komite.risk_rating,
          totalBakiDebet: result.data.ringkasan_eksposur.total_baki_debet,
        },
        notes: `Analisa SLIK OJK (mode gabung) memakai model ${result.model} atas ${budgeted.sources.length} berkas PDF.`,
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        mode,
        recordId: record.id,
        data: result.data,
        meta: { ...result, files: fileStatus },
      });
    }

    // 2b. Mode per berkas: satu berkas = satu debitur → panggilan terpisah per berkas.
    const analyzed = await analyzeSlikPerDocument(
      entries.map((entry) => entry.source),
      PER_FILE_CONCURRENCY
    );

    // Susun ulang mengikuti urutan unggah: berkas yang tidak bisa dianalisa tetap
    // muncul di daftar sebagai kegagalan, bukan hilang diam-diam.
    const results: SlikDocumentAnalysis[] = [];
    let cursor = 0;

    for (const status of fileStatus) {
      const entry = entries[cursor];
      if (status.status === "analyzed" && entry && entry.index === status.index) {
        results.push(analyzed[cursor]);
        cursor += 1;
        continue;
      }

      results.push({
        fileName: status.fileName,
        ok: false,
        data: null,
        model: null,
        warnings: [],
        error: status.reason || "Berkas tidak dapat dianalisa.",
        elapsedMs: 0,
        source: {
          fileName: status.fileName,
          pages: status.pages,
          chars: status.chars,
          truncated: status.truncated,
        },
      });
    }

    const okCount = results.filter((item) => item.ok).length;
    const failed = results.length - okCount;

    // Tahap 5A (P0.5): simpan setiap hasil yang berhasil terkait debitur terpilih.
    const savedRecords: Array<{ fileName: string; recordId: string }> = [];
    for (const item of results) {
      if (!item.ok || !item.data) continue;
      const record = await db.slikAnalysisRecord.create({
        data: {
          organizationId: currentUser.organizationId,
          branchId: customer.branchId ?? currentUser.branchId ?? null,
          customerId: customer.id,
          creditApplicationId,
          customerName: customer.legalName,
          sourceFileNames: [item.fileName],
          mode,
          rekomendasi: item.data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi,
          riskRating: item.data.analisis_dan_rekomendasi.keputusan_komite.risk_rating,
          modelUsed: item.model,
          elapsedMs: item.elapsedMs,
          result: item.data as unknown as Prisma.InputJsonValue,
          meta: {
            warnings: item.warnings,
            sources: [item.source],
            fileStatus: fileStatus.filter((status) => status.fileName === item.fileName),
          } as unknown as Prisma.InputJsonValue,
          createdById: currentUser.id,
        },
      });
      savedRecords.push({ fileName: item.fileName, recordId: record.id });

      await logAudit({
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        action: "CREATE",
        entityType: "SLIK_ANALYSIS",
        entityId: record.id,
        newValues: {
          mode,
          customerId: customer.id,
          customerName: customer.legalName,
          creditApplicationId,
          sourceFile: item.fileName,
          model: item.model,
          debitur: item.data.data_pribadi.nama_lengkap,
          rekomendasi: item.data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi,
          riskRating: item.data.analisis_dan_rekomendasi.keputusan_komite.risk_rating,
        },
        notes: `Analisa SLIK OJK (mode per berkas) memakai model ${item.model}.`,
        ipAddress,
        userAgent,
      });
    }

    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "SLIK_ANALYSIS",
      entityId: `SLIK-BATCH-${Date.now()}`,
      newValues: {
        mode,
        customerId: customer.id,
        customerName: customer.legalName,
        debitur: results.filter((item) => item.ok).map((item) => item.data!.data_pribadi.nama_lengkap),
        rekomendasi: results
          .filter((item) => item.ok)
          .map((item) => item.data!.analisis_dan_rekomendasi.keputusan_komite.rekomendasi),
        scannedFiles: files.map((file) => file.name),
        analyzedFiles: results.filter((item) => item.ok).map((item) => item.fileName),
        models: [...new Set(results.filter((item) => item.ok).map((item) => item.model))],
        recordIds: savedRecords.map((saved) => saved.recordId),
      },
      notes: `Analisa SLIK OJK (mode per berkas): ${okCount} berkas berhasil, ${failed} gagal.`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      mode,
      results: results.map((item) => ({
        ...item,
        recordId: savedRecords.find((saved) => saved.fileName === item.fileName)?.recordId ?? null,
      })),
      meta: {
        mode,
        files: fileStatus,
        analyzed: okCount,
        failed,
        elapsedMs: Date.now() - startedAt,
        warnings,
      },
    });
  } catch (error) {
    if (error instanceof SlikAnalyzerError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status });
    }
    return createSecureErrorResponse(error, "POST /api/analyze-slik", 500);
  }
}
