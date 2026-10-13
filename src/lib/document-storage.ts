/**
 * Penyimpanan dokumen privat — Tahap 4 (P0.4).
 *
 * Prinsip:
 *   1. Dokumen sensitif TIDAK berada di `public/` sehingga tidak dapat disajikan
 *      oleh lapisan file statis Next.js tanpa melalui endpoint ber-otorisasi.
 *   2. Referensi berkas disimpan di kolom `Document.filePath` dengan awalan
 *      `private:<kunci>`; format lama (`/uploads/...` dan `data:...;base64,...`)
 *      masih dibaca untuk kompatibilitas selama migrasi berjalan.
 *   3. Validasi tipe berkas memakai magic bytes (signature), bukan ekstensi
 *      atau Content-Type dari klien.
 *   4. Kunci acak + penamaan berbasis waktu; nama berkas asli TIDAK pernah
 *      dipakai sebagai nama penyimpanan.
 *
 * Pilihan infrastruktur: direktori privat di luar web root
 * (`storage/private/documents`, dapat dioverride lewat `PRIVATE_DOCUMENT_DIR`).
 * Bila kelak tersedia object storage privat (S3/GCS/dll.), cukup ganti
 * implementasi `savePrivateDocument`/`readPrivateDocument` di berkas ini tanpa
 * mengubah pemanggil.
 */

import { createHash, randomBytes } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";

/** Batas ukuran unggahan dokumen (10 MB). */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Ekstensi yang diizinkan beserta signature yang harus ditemukan di awal berkas. */
export const DOCUMENT_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "docx"] as const;
export type AllowedDocumentExtension = (typeof DOCUMENT_ALLOWED_EXTENSIONS)[number];

/** Awalan referensi penyimpanan privat pada kolom `Document.filePath`. */
export const PRIVATE_REF_PREFIX = "private:";

/** Tipe yang aman disajikan secara inline; selain itu diunduh sebagai lampiran. */
const INLINE_SAFE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "gif"]);

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

export interface SniffedDocumentType {
  ext: AllowedDocumentExtension;
  mimeType: string;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  bytes.every((b, i) => buffer[offset + i] === b);

const asciiAt = (buffer: Buffer, text: string, offset = 0): boolean =>
  buffer.length >= offset + text.length && buffer.toString("ascii", offset, offset + text.length) === text;

/**
 * Mengenali tipe berkas dari signature/magic bytes.
 * Mengembalikan null bila tidak dikenali atau tidak diizinkan.
 */
export function sniffDocumentType(buffer: Buffer): SniffedDocumentType | null {
  if (buffer.length < 8) return null;

  // PDF: "%PDF-"
  if (asciiAt(buffer, "%PDF-", 0)) return { ext: "pdf", mimeType: MIME_BY_EXT.pdf };

  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { ext: "jpg", mimeType: MIME_BY_EXT.jpg };

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: "png", mimeType: MIME_BY_EXT.png };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (asciiAt(buffer, "RIFF", 0) && asciiAt(buffer, "WEBP", 8)) {
    return { ext: "webp", mimeType: MIME_BY_EXT.webp };
  }

  // GIF87a / GIF89a
  if (asciiAt(buffer, "GIF87a", 0) || asciiAt(buffer, "GIF89a", 0)) {
    return { ext: "gif", mimeType: MIME_BY_EXT.gif };
  }

  // DOCX = arsip OOXML (ZIP): "PK\x03\x04". Signature ZIP juga dipakai berkas
  // .zip lain, sehingga ekstensi deklarasi tetap harus docx (dicek pemanggil).
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return { ext: "docx", mimeType: MIME_BY_EXT.docx };
  }

  return null;
}

/** Apakah signature cocok dengan ekstensi yang diklaim pengguna. */
function extensionMatchesSignature(declaredExt: string, sniffed: SniffedDocumentType): boolean {
  const declared = declaredExt.toLowerCase();
  if (declared === sniffed.ext) return true;
  if (declared === "jpeg" && sniffed.ext === "jpg") return true;
  if (declared === "jpg" && sniffed.ext === "jpeg") return true;
  // ZIP container: hanya docx yang diizinkan (xlsx/pptx/zip ditolak).
  if (sniffed.ext === "docx") return declared === "docx";
  return false;
}

/** Ekstensi dari nama berkas deklaratif pengguna (bila ada). */
export function extensionOfFileName(fileName: string): string {
  const base = path.basename(fileName || "").replace(/\\/g, "/");
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

/**
 * Validasi unggahan dokumen: ukuran, magic bytes, dan kecocokan ekstensi.
 * Melempar `DocumentValidationError` bila berkas ditolak.
 */
export function validateDocumentUpload(
  buffer: Buffer,
  options: { fileName: string; declaredMime?: string | null }
): SniffedDocumentType {
  if (buffer.length === 0) {
    throw new DocumentValidationError("Berkas kosong tidak dapat diunggah.");
  }
  if (buffer.length > DOCUMENT_MAX_BYTES) {
    throw new DocumentValidationError(
      `Ukuran berkas melebihi batas maksimum ${Math.floor(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`
    );
  }

  const sniffed = sniffDocumentType(buffer);
  if (!sniffed) {
    throw new DocumentValidationError(
      `Tipe berkas tidak dikenali atau tidak diizinkan. Format yang diterima: ${DOCUMENT_ALLOWED_EXTENSIONS.join(", ").toUpperCase()}.`
    );
  }

  const declaredExt = extensionOfFileName(options.fileName);
  if (declaredExt && !extensionMatchesSignature(declaredExt, sniffed)) {
    throw new DocumentValidationError(
      `Ekstensi ".${declaredExt}" tidak sesuai dengan isi berkas. Unggah berkas sesuai format aslinya.`
    );
  }
  if (declaredExt && !(DOCUMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(declaredExt)) {
    throw new DocumentValidationError(
      `Format ".${declaredExt}" tidak didukung. Format yang diterima: ${DOCUMENT_ALLOWED_EXTENSIONS.join(", ").toUpperCase()}.`
    );
  }

  // Content-Type dari klien tidak pernah dipercaya, hanya dicocokkan bila ada.
  const declaredMime = (options.declaredMime || "").split(";")[0].trim().toLowerCase();
  if (declaredMime && declaredMime !== "application/octet-stream") {
    const expected = MIME_BY_EXT[sniffed.ext];
    const aliases: Record<string, string[]> = {
      "image/jpeg": ["image/jpg", "image/pjpeg"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        "application/msword",
        "application/octet-stream",
      ],
    };
    const allowed = [expected, ...(aliases[expected] || [])];
    if (!allowed.includes(declaredMime)) {
      throw new DocumentValidationError(
        `Content-Type "${declaredMime}" tidak sesuai dengan isi berkas.`
      );
    }
  }

  return sniffed;
}

/** Akar penyimpanan privat (di luar web root). */
export function privateDocumentRoot(): string {
  const configured = (process.env.PRIVATE_DOCUMENT_DIR || "").trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), "storage", "private", "documents");
}

const KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Apakah string merupakan referensi penyimpanan privat (`private:<kunci>`). */
export function isPrivateRef(ref: string): boolean {
  return typeof ref === "string" && ref.startsWith(PRIVATE_REF_PREFIX);
}

/** Membentuk referensi privat dari kunci penyimpanan. */
export function toPrivateRef(key: string): string {
  return `${PRIVATE_REF_PREFIX}${key}`;
}

/** Kunci penyimpanan dari referensi privat, atau null bila bukan referensi privat. */
export function privateKeyOf(ref: string): string | null {
  if (!isPrivateRef(ref)) return null;
  const key = ref.slice(PRIVATE_REF_PREFIX.length);
  return key.length > 0 ? key : null;
}

/**
 * Pola kunci penyimpanan: satu tingkat (boleh berjenjang), tanpa segmen kosong,
 * tanpa slash ganda, tanpa absolut, tanpa backslash, tanpa "." / "..".
 * Pola ini membuat seluruh kunci sah berada di dalam akar penyimpanan.
 */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/**
 * Mengubah kunci penyimpanan menjadi path absolut, sekaligus menolak traversal.
 * Melempar `DocumentValidationError` bila kunci tidak sah.
 */
export function resolvePrivateDocumentPath(key: string): string {
  if (typeof key !== "string" || !KEY_PATTERN.test(key) || key.includes("\\") || key.includes("..")) {
    throw new DocumentValidationError("Kunci penyimpanan tidak sah.");
  }
  const root = privateDocumentRoot();
  const resolved = path.resolve(root, ...key.split("/"));
  if (!resolved.startsWith(root + path.sep)) {
    throw new DocumentValidationError("Kunci penyimpanan di luar area yang diizinkan.");
  }
  return resolved;
}

/** Menyimpan berkas ke penyimpanan privat dan mengembalikan kunci + checksum. */
export async function savePrivateDocument(buffer: Buffer, ext: string): Promise<{ key: string; sha256: string }> {
  const normalizedExt = /^[a-z0-9]{1,8}$/.test(ext.toLowerCase()) ? ext.toLowerCase() : "bin";
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const unique = `${Date.now().toString(36)}_${randomBytes(12).toString("hex")}`;
  const key = `${yyyy}/${mm}/${unique}.${normalizedExt}`;
  const target = resolvePrivateDocumentPath(key);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer, { mode: 0o600 });

  return { key, sha256: createHash("sha256").update(buffer).digest("hex") };
}

/** Membaca isi berkas privat berdasarkan kunci. */
export async function readPrivateDocument(key: string): Promise<Buffer> {
  return readFile(resolvePrivateDocumentPath(key));
}

/** Apakah kunci penyimpanan menunjuk ke berkas yang ada. */
export async function privateDocumentExists(key: string): Promise<boolean> {
  try {
    const fileStat = await stat(resolvePrivateDocumentPath(key));
    return fileStat.isFile();
  } catch {
    return false;
  }
}

/** Menghapus berkas privat (best effort). Mengembalikan true bila terhapus. */
export async function deletePrivateDocument(key: string): Promise<boolean> {
  try {
    await rm(resolvePrivateDocumentPath(key), { force: false });
    return true;
  } catch {
    return false;
  }
}

export type DocumentRef =
  | { kind: "private"; key: string }
  | { kind: "inline"; mimeType: string; buffer: Buffer }
  | { kind: "legacy-public"; publicPath: string }
  | { kind: "empty" }
  | { kind: "unknown"; raw: string };

/** Menganalisis nilai `Document.filePath` (format baru maupun lama). */
export function parseDocumentRef(raw: string | null | undefined): DocumentRef {
  const value = (raw || "").trim();
  if (!value) return { kind: "empty" };

  if (isPrivateRef(value)) {
    const key = privateKeyOf(value);
    if (!key) return { kind: "empty" };
    return { kind: "private", key };
  }

  if (value.startsWith("data:")) {
    const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(value);
    if (match) {
      const mimeType = (match[1] || "application/octet-stream").toLowerCase();
      const isBase64 = Boolean(match[2]);
      try {
        const buffer = isBase64
          ? Buffer.from(match[3], "base64")
          : Buffer.from(decodeURIComponent(match[3]), "utf8");
        return { kind: "inline", mimeType, buffer };
      } catch {
        return { kind: "unknown", raw: value.slice(0, 64) };
      }
    }
    return { kind: "unknown", raw: value.slice(0, 64) };
  }

  if (value.startsWith("/uploads/")) {
    return { kind: "legacy-public", publicPath: value };
  }

  return { kind: "unknown", raw: value.slice(0, 64) };
}

/** Membaca isi berkas dari referensi apa pun (privat / inline / legacy publik). */
export async function readDocumentBytes(
  raw: string | null | undefined
): Promise<{ buffer: Buffer; mimeType?: string } | null> {
  const ref = parseDocumentRef(raw);

  if (ref.kind === "private") {
    try {
      return { buffer: await readPrivateDocument(ref.key) };
    } catch {
      return null;
    }
  }

  if (ref.kind === "inline") {
    return { buffer: ref.buffer, mimeType: ref.mimeType };
  }

  if (ref.kind === "legacy-public") {
    // Hanya untuk masa transisi sebelum migrasi dijalankan.
    const root = path.join(process.cwd(), "public");
    const segments = ref.publicPath.split("/").filter(Boolean);
    if (segments.some((s) => !KEY_SEGMENT.test(s))) return null;
    const resolved = path.resolve(root, ...segments);
    if (!resolved.startsWith(root + path.sep)) return null;
    try {
      return { buffer: await readFile(resolved) };
    } catch {
      return null;
    }
  }

  return null;
}

/** URL unduh terotorisasi untuk sebuah dokumen. */
export function documentDownloadUrl(documentId: string): string {
  return `/api/documents/${documentId}/download`;
}

/** Nama berkas yang aman untuk header Content-Disposition. */
export function safeDownloadFileName(fileName: string, fallbackExt = "bin"): string {
  const base = path.basename((fileName || "").replace(/\\/g, "/")).trim();
  const cleaned = base
    // buang karakter kontrol dan karakter yang berbahaya untuk header
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\;]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
  return cleaned || `dokumen.${fallbackExt}`;
}

/** Header Content-Disposition yang aman (RFC 5987 untuk nama non-ASCII). */
export function contentDisposition(
  fileName: string,
  disposition: "inline" | "attachment",
  fallbackExt = "bin"
): string {
  const safe = safeDownloadFileName(fileName, fallbackExt);
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(safe);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/** Apakah tipe ini aman disajikan secara inline (bukan HTML/SVG yang bisa menjalankan skrip). */
export function isInlineSafeExtension(ext: string): boolean {
  return INLINE_SAFE_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Bentuk DTO untuk respons API: tidak membocorkan kunci penyimpanan internal,
 * tetapi menyediakan URL unduh terotorisasi.
 */
export function toDocumentDto<T extends { id: string; filePath?: string | null }>(doc: T): Omit<T, "filePath"> & {
  downloadUrl: string;
} {
  const { filePath: _ignored, ...rest } = doc;
  return { ...rest, downloadUrl: documentDownloadUrl(doc.id) };
}
