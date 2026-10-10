import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse-fork";
import { requireAuthAndPermission } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSecureErrorResponse } from "@/lib/security";
import { extractClientInfo, logAudit } from "@/lib/audit";
import {
  analyzeSlikDocuments,
  MAX_PROMPT_DOC_CHARS,
  SlikAnalyzerError,
  type SlikSourceText,
} from "@/lib/slik/openrouter";

/**
 * POST /api/analyze-slik
 *
 * Menerima banyak file PDF laporan SLIK OJK (IDEB), mengekstrak teksnya secara
 * lokal (pdf-parse-fork — tidak ada PDF yang dikirim ke pihak ketiga), lalu
 * meminta OpenRouter menyusun ringkasan + rekomendasi komite dalam bentuk JSON.
 * PDF laporan akhir dibuat di sisi klien (src/lib/slik/generateSlikReport.ts).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB per permintaan
const MIN_TEXT_CHARS = 50;
/** Batas teks per dokumen sebelum digabung ke prompt. */
const MAX_CHARS_PER_DOC = Math.min(MAX_PROMPT_DOC_CHARS, 150_000);

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
      maxFiles: MAX_FILES,
      maxFileMb: Math.round(MAX_FILE_BYTES / (1024 * 1024)),
      maxTotalMb: Math.round(MAX_TOTAL_BYTES / (1024 * 1024)),
      maxPromptChars: MAX_PROMPT_DOC_CHARS,
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

    // 1. Ekstraksi teks lokal per berkas.
    const warnings: string[] = [];
    const sources: SlikSourceText[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      let parsed: Awaited<ReturnType<typeof pdfParse>>;
      try {
        parsed = await pdfParse(buffer);
      } catch (error) {
        warnings.push(
          `Berkas "${file.name}" gagal dibaca: ${
            error instanceof Error ? error.message : "format PDF tidak dikenali"
          }.`
        );
        continue;
      }

      const text = (parsed.text || "").replace(/\u0000/g, " ").trim();
      if (text.length < MIN_TEXT_CHARS) {
        warnings.push(
          `Berkas "${file.name}" hampir tidak mengandung teks (kemungkinan hasil scan/gambar). ` +
            `Perlu OCR terlebih dahulu agar datanya terbaca.`
        );
        continue;
      }

      const truncated = text.length > MAX_CHARS_PER_DOC;
      sources.push({
        fileName: file.name,
        pages: parsed.numpages || 0,
        text: truncated ? `${text.slice(0, MAX_CHARS_PER_DOC)}\n[... teks dipotong ...]` : text,
        truncated,
      });
    }

    if (sources.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada teks yang berhasil diekstrak dari berkas yang diunggah. " +
            "Pastikan PDF laporan SLIK OJK memiliki lapisan teks (bukan hasil scan).",
          warnings,
        },
        { status: 422 }
      );
    }

    // 2. Analisa lewat OpenRouter.
    const result = await analyzeSlikDocuments(sources);
    result.warnings = [...warnings, ...result.warnings];

    // 3. Jejak audit (mengandung data debitur, jadi hanya ringkasan yang dicatat).
    const { ipAddress, userAgent } = extractClientInfo(req);
    await logAudit({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      action: "CREATE",
      entityType: "SLIK_ANALYSIS",
      entityId: result.data.header.nomor_laporan || `SLIK-${Date.now()}`,
      newValues: {
        model: result.model,
        scannedFiles: files.map((file) => file.name),
        analyzedFiles: sources.map((source) => source.fileName),
        debitur: result.data.data_pribadi.nama_lengkap,
        rekomendasi: result.data.analisis_dan_rekomendasi.keputusan_komite.rekomendasi,
        riskRating: result.data.analisis_dan_rekomendasi.keputusan_komite.risk_rating,
        totalBakiDebet: result.data.ringkasan_eksposur.total_baki_debet,
      },
      notes: `Analisa SLIK OJK memakai model ${result.model} atas ${sources.length} berkas PDF.`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, data: result.data, meta: result });
  } catch (error) {
    if (error instanceof SlikAnalyzerError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status });
    }
    return createSecureErrorResponse(error, "POST /api/analyze-slik", 500);
  }
}
