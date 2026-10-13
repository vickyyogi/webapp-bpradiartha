/**
 * Verifikasi Tahap 4 (P0.4) — penyimpanan dokumen privat & endpoint akses.
 * Tidak memerlukan server aplikasi, tetapi memerlukan koneksi database.
 *
 *   npm run verify:documents
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, readdirSync } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import {
  DOCUMENT_MAX_BYTES,
  DocumentValidationError,
  contentDisposition,
  deletePrivateDocument,
  isInlineSafeExtension,
  parseDocumentRef,
  privateDocumentRoot,
  readDocumentBytes,
  resolvePrivateDocumentPath,
  safeDownloadFileName,
  savePrivateDocument,
  toDocumentDto,
  validateDocumentUpload,
} from "../src/lib/document-storage";

const prisma = new PrismaClient();

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", "latin1");
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 0x42),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 0x42)]);
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32, 0x42)]);
const EXE = Buffer.from("MZ\x90\x00This program cannot be run in DOS mode.", "latin1");

function rejects(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof DocumentValidationError;
  }
}

function logicTests(): void {
  console.log("== 1. Magic bytes & validasi unggahan ==");
  check("PDF diterima", validateDocumentUpload(PDF, { fileName: "laporan.pdf" }).ext === "pdf");
  check("JPEG diterima", validateDocumentUpload(JPEG, { fileName: "ktp.jpg" }).ext === "jpg");
  check("PNG diterima", validateDocumentUpload(PNG, { fileName: "foto.png" }).ext === "png");
  check("DOCX (container ZIP) diterima", validateDocumentUpload(DOCX, { fileName: "proposal.docx" }).ext === "docx");
  check(
    "Content-Type tidak dipercaya: isi EXE dengan nama .pdf ditolak",
    rejects(() => validateDocumentUpload(EXE, { fileName: "berkas.pdf", declaredMime: "application/pdf" }))
  );
  check(
    "Ekstensi tidak cocok isi (PNG bernama .pdf) ditolak",
    rejects(() => validateDocumentUpload(PNG, { fileName: "berkas.pdf", declaredMime: "image/png" }))
  );
  check(
    "Berkas tanpa signature dikenali ditolak",
    rejects(() => validateDocumentUpload(Buffer.from("ini teks biasa", "utf8"), { fileName: "catatan.txt" }))
  );
  const oversize = Buffer.alloc(DOCUMENT_MAX_BYTES + 1, 0x41);
  oversize.write("%PDF-", 0, "latin1");
  check("Ukuran > 10MB ditolak", rejects(() => validateDocumentUpload(oversize, { fileName: "besar.pdf" })));
  check("Berkas kosong ditolak", rejects(() => validateDocumentUpload(Buffer.alloc(0), { fileName: "kosong.pdf" })));
  check(
    "Content-Type palsu (EXE dilabeli image/jpeg) ditolak",
    rejects(() => validateDocumentUpload(EXE, { fileName: "foto.jpeg", declaredMime: "image/jpeg" }))
  );

  console.log("\n== 2. Penyimpanan privat & anti-traversal ==");
  const root = privateDocumentRoot();
  const webRoot = join(process.cwd(), "public");
  check("akar penyimpanan berada di luar web root (public/)", !root.startsWith(webRoot), root);
  const traversal = ["../etc/passwd", "..", "/etc/passwd", "a/../../b", "", "a//b", "dir/../file.pdf", "C:\\secret.pdf"];
  for (const key of traversal) {
    let threw = false;
    try {
      resolvePrivateDocumentPath(key);
    } catch {
      threw = true;
    }
    check(`kunci traversal ditolak: ${key || "(kosong)"}`, threw);
  }
  const okKey = resolvePrivateDocumentPath("2026/10/abc123.pdf");
  check("kunci sah berada di dalam akar", okKey.startsWith(root));

  console.log("\n== 3. Referensi penyimpanan ==");
  check("referensi privat dikenali", parseDocumentRef("private:2026/10/a.pdf").kind === "private");
  check("referensi base64 lama dikenali", parseDocumentRef("data:image/png;base64,AAAA").kind === "inline");
  check("referensi jalur publik lama dikenali", parseDocumentRef("/uploads/documents/x.jpg").kind === "legacy-public");
  check("referensi sampah ditandai tak dikenal", parseDocumentRef("../../../etc/passwd").kind === "unknown");
  check("referensi kosong ditandai kosong", parseDocumentRef("").kind === "empty");
  const inline = parseDocumentRef("data:image/png;base64," + PNG.toString("base64"));
  check(
    "base64 terdekripsi menjadi byte asli",
    inline.kind === "inline" && inline.buffer.subarray(0, 8).equals(PNG.subarray(0, 8))
  );

  console.log("\n== 4. Header & DTO ==");
  const disposition = contentDisposition('mal\nicious".pdf', "attachment", "pdf");
  check("Content-Disposition bebas CR/LF", !/[\r\n]/.test(disposition));
  check("Content-Disposition bebas tanda kutip liar", !disposition.includes('mal\nicious'));
  check("nama berkas berbahaya dibersihkan", !/[\r\n\"]/g.test(safeDownloadFileName('a"; rm -rf /.pdf')));
  const dto = toDocumentDto({ id: "abc", filePath: "private:2026/10/x.pdf", fileName: "x.pdf" });
  check("DTO tidak membocorkan kunci penyimpanan", !("filePath" in dto) && !(JSON.stringify(dto).includes("private:")));
  check("DTO menyediakan URL unduh terotorisasi", dto.downloadUrl === "/api/documents/abc/download");
  check("tipe aman untuk inline: pdf", isInlineSafeExtension("pdf"));
  check("tipe tidak aman untuk inline: html", !isInlineSafeExtension("html"));
  check("tipe tidak aman untuk inline: svg", !isInlineSafeExtension("svg"));
}

async function storageTests(): Promise<void> {
  console.log("\n== 5. Baca berkas dari berbagai referensi ==");
  const saved = await savePrivateDocument(PDF, "pdf");
  try {
    const fromPrivate = await readDocumentBytes(`private:${saved.key}`);
    check("berkas privat terbaca utuh", Boolean(fromPrivate) && fromPrivate!.buffer.equals(PDF));
  } finally {
    await deletePrivateDocument(saved.key);
  }

  const fromInline = await readDocumentBytes("data:image/png;base64," + PNG.toString("base64"));
  check("referensi inline (base64 lama) terbaca", Boolean(fromInline) && fromInline!.buffer.equals(PNG));

  const missingLegacy = await readDocumentBytes("/uploads/documents/tidak-ada.pdf");
  check("referensi jalur publik lama yang hilang menghasilkan null", missingLegacy === null);

  const unknown = await readDocumentBytes("bukan-referensi");
  check("referensi tidak dikenal menghasilkan null", unknown === null);

  const traversal = await readDocumentBytes("private:../../../../etc/passwd");
  check("kunci traversal tidak dapat dibaca", traversal === null);
}

function sourceTests(): void {
  console.log("\n== 6. Penjagaan sumber ==");
  const read = (relative: string): string => readFileSync(join(process.cwd(), relative), "utf8");

  const proxy = read("src/proxy.ts");
  check("proxy menolak /uploads/documents", proxy.includes('path.startsWith("/uploads/documents")'));
  check(
    "penolakan berada sebelum pengecualian /uploads",
    proxy.indexOf('path.startsWith("/uploads/documents")') < proxy.indexOf('path.startsWith("/uploads")')
  );

  const uploadsRoute = read("src/app/uploads/[...path]/route.ts");
  check("handler /uploads memakai allowlist folder publik", uploadsRoute.includes("PUBLIC_UPLOAD_DIRS"));
  check("handler /uploads menolak segmen traversal", uploadsRoute.includes("KEY_SEGMENT"));
  check("handler /uploads tidak menyajikan SVG sebagai HTML", !uploadsRoute.includes("image/svg+xml"));

  const documentsRoute = read("src/app/api/documents/route.ts");
  check("unggah memakai validasi magic bytes", documentsRoute.includes("validateDocumentUpload"));
  check("unggah menyimpan ke penyimpanan privat", documentsRoute.includes("savePrivateDocument"));
  check("unggah tidak lagi menulis ke public/uploads", !documentsRoute.includes('"public", "uploads"'));
  check("unggah mencatat audit", documentsRoute.includes("logAudit"));

  const downloadRoute = read("src/app/api/documents/[id]/download/route.ts");
  check("endpoint unduh ada", existsSync(join(process.cwd(), "src/app/api/documents/[id]/download/route.ts")));
  check("endpoint unduh menuntut permission document.download", downloadRoute.includes('requireAuthAndPermission("document.download")'));
  check("endpoint unduh memakai pemeriksaan cakupan", downloadRoute.includes("evaluateDocumentAccess"));
  check("endpoint unduh mencatat audit", downloadRoute.includes('"DOWNLOAD"'));
  check("endpoint unduh tidak menyimpan di cache publik", downloadRoute.includes("private, no-store"));
  check("endpoint unduh menentukan tipe dari isi berkas", downloadRoute.includes("sniffDocumentType"));

  const creditRoute = read("src/app/api/credit/applications/route.ts");
  check("KTP tidak lagi disimpan sebagai base64 di database", !creditRoute.includes("filePath: ktpDocument.fileData"));
  check("KTP divalidasi sebelum data dibuat", creditRoute.indexOf("validateDocumentUpload") < creditRoute.indexOf("db.creditApplication.create"));

  const files = [
    "src/app/(dashboard)/documents/DocumentsClientView.tsx",
    "src/app/(dashboard)/credit/applications/[id]/CreditApplicationDetailClientView.tsx",
  ];
  for (const file of files) {
    const source = read(file);
    check(`${file.split("/").pop()} memakai URL unduh terotorisasi`, source.includes("downloadUrl"));
    check(`${file.split("/").pop()} tidak lagi memakai jalur filePath publik`, !source.includes("doc.filePath"));
  }

  const gitignore = read(".gitignore");
  check(".gitignore mengabaikan penyimpanan privat (/storage/)", gitignore.includes("/storage/"));

  const schema = read("prisma/schema.prisma");
  check("model Document tetap ada (tanpa perubahan skema)", schema.includes("model Document"));
  const migrationCount = readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory()
  ).length;
  check(`jumlah migrasi tidak berubah (${migrationCount})`, migrationCount === 20, "perubahan skema memerlukan migrasi baru");
}

async function databaseTests(): Promise<void> {
  console.log("\n== 7. Data di database ==");
  const rows = await prisma.document.findMany({
    select: { id: true, fileName: true, filePath: true, fileExt: true },
  });

  const buckets = { private: 0, inline: 0, legacy: 0, unknown: 0 };
  const reachableLegacy: string[] = [];
  const missingPrivate: string[] = [];

  for (const row of rows) {
    const ref = parseDocumentRef(row.filePath);
    if (ref.kind === "private") {
      buckets.private += 1;
      let exists = false;
      try {
        exists = (await stat(resolvePrivateDocumentPath(ref.key))).isFile();
      } catch {
        exists = false;
      }
      if (!exists) missingPrivate.push(row.fileName);
      continue;
    }
    if (ref.kind === "inline") buckets.inline += 1;
    else if (ref.kind === "legacy-public") {
      buckets.legacy += 1;
      const publicPath = join(process.cwd(), "public", ref.publicPath.replace(/^\//, ""));
      if (existsSync(publicPath)) reachableLegacy.push(ref.publicPath);
    } else buckets.unknown += 1;
  }

  check(
    `tidak ada dokumen yang masih menunjuk berkas publik yang dapat diakses (${buckets.legacy} baris referensi lama, ${reachableLegacy.length} berkas masih ada di public/)`,
    reachableLegacy.length === 0,
    reachableLegacy.join(", ")
  );
  check(
    `tidak ada referensi privat yang menunjuk berkas hilang (${missingPrivate.length})`,
    missingPrivate.length === 0,
    missingPrivate.join(", ")
  );
  check(
    `tidak ada berkas base64 tersisa di database (${buckets.inline})`,
    buckets.inline === 0
  );

  const uploads = await prisma.auditLog.count({
    where: { entityType: "DOCUMENT", action: { in: ["UPLOAD", "DOWNLOAD", "DELETE"] } },
  });
  console.log(`INFO  catatan audit dokumen (UPLOAD/DOWNLOAD/DELETE): ${uploads}`);
}

async function main(): Promise<void> {
  logicTests();
  await storageTests();
  sourceTests();
  await databaseTests();

  console.log(`\n${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) {
    console.log(`${failures} pemeriksaan GAGAL.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
