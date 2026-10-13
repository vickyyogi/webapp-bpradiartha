/**
 * Migrasi dokumen ke penyimpanan privat — Tahap 4 (P0.4).
 *
 * Memindahkan berkas dokumen dari jalur publik `public/uploads/documents/*`
 * (dan baris base64 lama di database) ke penyimpanan privat di luar web root,
 * lalu memperbarui `Document.filePath` menjadi referensi `private:<kunci>`.
 *
 * Aturan keamanan:
 *   - Mode default adalah LAPORAN (dry-run); perubahan hanya terjadi dengan `--apply`.
 *   - Berkas sumber TIDAK dihapus sebelum isi yang tersalin diverifikasi
 *     (ukuran + SHA-256 harus sama persis).
 *   - Berkas sumber yang tidak ditemukan TIDAK dihapus/diubah apa pun
 *     (dilaporkan sebagai MISSING_SOURCE dan menunggu keputusan manusia).
 *
 *   npm run migrate:documents           # laporan saja
 *   npm run migrate:documents -- --apply
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { existsSync, readdirSync } from "fs";
import { mkdir, readFile, rm } from "fs/promises";
import path from "path";
import {
  DOCUMENT_ALLOWED_EXTENSIONS,
  parseDocumentRef,
  privateDocumentRoot,
  resolvePrivateDocumentPath,
  savePrivateDocument,
  sniffDocumentType,
} from "../src/lib/document-storage";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

let failures = 0;

type Row = {
  id: string;
  fileName: string;
  filePath: string;
  fileExt: string | null;
  fileSize: number;
};

function log(label: string, detail = ""): void {
  console.log(`${label}${detail ? ` — ${detail}` : ""}`);
}

function pickExt(buffer: Buffer, declared: string | null): string {
  const sniffed = sniffDocumentType(buffer);
  if (sniffed) return sniffed.ext;
  const normalized = (declared || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if ((DOCUMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  // Tipe tidak dikenal: tetap dipindahkan agar data tidak hilang, tetapi
  // disimpan dengan ekstensi netral sehingga tidak pernah dirender inline.
  return "bin";
}

/** Menyalin buffer ke penyimpanan privat lalu memverifikasi hasil tulis. */
async function storeAndVerify(buffer: Buffer, declaredExt: string | null): Promise<string | null> {
  try {
    const saved = await savePrivateDocument(buffer, pickExt(buffer, declaredExt));
    const written = await readFile(resolvePrivateDocumentPath(saved.key));
    const sourceHash = createHash("sha256").update(buffer).digest("hex");
    const writtenHash = createHash("sha256").update(written).digest("hex");
    if (written.length !== buffer.length || writtenHash !== sourceHash) {
      failures += 1;
      log("GAGAL", "verifikasi isi berkas hasil salinan tidak cocok");
      return null;
    }
    return saved.key;
  } catch (error) {
    failures += 1;
    log("GAGAL", `menulis berkas privat: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function migrateRow(row: Row): Promise<void> {
  const ref = parseDocumentRef(row.filePath);

  if (ref.kind === "private") {
    return; // sudah benar
  }

  if (ref.kind === "empty" || ref.kind === "unknown") {
    failures += 1;
    log("GAGAL", `${row.fileName} — referensi tidak dikenal (${ref.kind}); perlu keputusan manual`);
    return;
  }

  if (ref.kind === "inline") {
    // Berkas lama tersimpan sebagai base64 di database.
    if (!APPLY) {
      log("AKAN MIGRASI", `${row.fileName} (base64 di database → penyimpanan privat)`);
      return;
    }
    const key = await storeAndVerify(ref.buffer, row.fileExt);
    if (!key) return;
    await prisma.document.update({
      where: { id: row.id },
      data: { filePath: `private:${key}` },
    });
    log("MIGRASI", `${row.fileName} (base64 di database → ${key})`);
    return;
  }

  // ref.kind === "legacy-public"
  const publicPath = path.join(process.cwd(), "public", ref.publicPath.replace(/^\//, ""));
  if (!existsSync(publicPath)) {
    failures += 1;
    log(
      "SUMBER HILANG",
      `${row.fileName} (${ref.publicPath}) — berkas tidak ada; record TIDAK diubah. Putuskan: hapus record atau pulihkan berkas.`
    );
    return;
  }

  if (!APPLY) {
    log("AKAN MIGRASI", `${row.fileName} (${ref.publicPath} → penyimpanan privat)`);
    return;
  }

  const source = await readFile(publicPath);
  const key = await storeAndVerify(source, row.fileExt);
  if (!key) return;

  await prisma.document.update({
    where: { id: row.id },
    data: { filePath: `private:${key}` },
  });

  // Hapus berkas publik HANYA setelah baris database menunjuk ke salinan yang
  // sudah diverifikasi.
  try {
    await rm(publicPath, { force: false });
  } catch (error) {
    failures += 1;
    log("GAGAL", `menghapus berkas publik lama ${ref.publicPath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  log("MIGRASI", `${row.fileName} → ${key} (berkas publik lama dihapus)`);
}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? "APPLY (memperubahan data)" : "LAPORAN (dry-run)"}\n`);
  await mkdir(privateDocumentRoot(), { recursive: true });
  log("Penyimpanan privat", privateDocumentRoot());

  const rows = (await prisma.document.findMany({
    select: { id: true, fileName: true, filePath: true, fileExt: true, fileSize: true },
    orderBy: { createdAt: "asc" },
  })) as Row[];

  const counts = { private: 0, legacy: 0, inline: 0, unknown: 0 };
  for (const row of rows) {
    const ref = parseDocumentRef(row.filePath);
    if (ref.kind === "private") counts.private += 1;
    else if (ref.kind === "inline") counts.inline += 1;
    else if (ref.kind === "unknown" || ref.kind === "empty") counts.unknown += 1;
    else counts.legacy += 1;
    if (ref.kind !== "private") await migrateRow(row);
  }

  const orphans = await sweepOrphanPublicFiles(rows);

  console.log("\nRingkasan:");
  console.log(`  total dokumen      : ${rows.length}`);
  console.log(`  sudah privat       : ${counts.private}`);
  console.log(`  jalur publik lama  : ${counts.legacy}`);
  console.log(`  base64 di database : ${counts.inline}`);
  console.log(`  referensi tak dikenal: ${counts.unknown}`);
  console.log(`  berkas yatim di public/uploads/documents: ${orphans}`);
  if (!APPLY) {
    console.log("\nIni hanya laporan. Jalankan dengan --apply untuk benar-benar memindahkan berkas.");
  }
  console.log(
    "\nCatatan: aset CMS (`/uploads/hero/*`, `/uploads/reports/*`) tetap publik secara sengaja — itu konten website resmi, bukan dokumen privat."
  );

  if (failures > 0) {
    console.log(`\n${failures} baris memerlukan penanganan manual (lihat di atas).`);
    process.exitCode = 1;
  }
}

/**
 * Berkas di `public/uploads/documents/` yang tidak dirujuk record manapun
 * ("yatim") tetap dipindahkan ke penyimpanan privat agar tidak berada di web
 * root, TETAPI tidak dihapus catatannya (tidak ada) — butuh keputusan manusia
 * untuk mengaitkannya ke dokumen atau memusnahkannya sesuai kebijakan retensi.
 */
async function sweepOrphanPublicFiles(rows: Row[]): Promise<number> {
  const publicDir = path.join(process.cwd(), "public", "uploads", "documents");
  if (!existsSync(publicDir)) return 0;

  const referenced = new Set(
    rows
      .map((row) => parseDocumentRef(row.filePath))
      .filter((ref): ref is { kind: "legacy-public"; publicPath: string } => ref.kind === "legacy-public")
      .map((ref) => path.basename(ref.publicPath).toLowerCase())
  );

  const names = readdirSync(publicDir).filter((name) => !name.startsWith("."));
  const orphans = names.filter((name) => !referenced.has(name.toLowerCase()));

  for (const name of orphans) {
    if (!KEY_NAME.test(name)) {
      failures += 1;
      log("GAGAL", `berkas yatim dengan nama tak aman: ${name}`);
      continue;
    }

    const sourcePath = path.join(publicDir, name);
    if (!existsSync(sourcePath)) continue;

    if (!APPLY) {
      log("AKAN PINDAHKAN (yatim)", `${name} → penyimpanan privat (tanpa record dokumen)`);
      continue;
    }

    let source: Buffer;
    try {
      source = await readFile(sourcePath);
    } catch (error) {
      failures += 1;
      log("GAGAL", `membaca berkas yatim ${name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const key = await storeAndVerify(source, path.extname(name).replace(".", ""));
    if (!key) continue;

    try {
      await rm(sourcePath, { force: false });
    } catch (error) {
      failures += 1;
      log("GAGAL", `menghapus berkas yatim ${name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    log("ORPHAN → PRIVAT", `${name} → ${key} (tanpa record dokumen; putuskan: kaitkan atau musnahkan)`);
  }

  return orphans.length;
}

const KEY_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
