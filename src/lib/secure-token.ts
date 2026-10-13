/**
 * Token acak satu arah (Tahap 1B-2).
 *
 * Dipakai untuk tautan reset kata sandi. Prinsipnya sama seperti tantangan MFA:
 * nilai yang dikirim ke pengguna hanya disimpan sebagai hash, sehingga bocornya
 * isi database tidak langsung memberi akses.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token acak 32 byte sebagai teks heksadesimal (64 karakter). */
export function createToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Hash satu arah untuk penyimpanan token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export interface HashedToken {
  token: string;
  tokenHash: string;
}

/** Membuat token beserta hash-nya sekaligus. */
export function createHashedToken(bytes = 32): HashedToken {
  const token = createToken(bytes);
  return { token, tokenHash: hashToken(token) };
}

/** Perbandingan waktu-tetap antara token yang dimasukkan dan hash tersimpan. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashToken(token), "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

/** Umur token dalam milidetik. */
export function expiryFromMinutes(minutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + minutes * 60 * 1000);
}
