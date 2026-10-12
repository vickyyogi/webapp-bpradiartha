/**
 * Utilitas kata sandi — Tahap 1A (P0.1 Autentikasi).
 *
 * Aturan yang dipegang di sini:
 * - Sandi pegawai SELALU disimpan sebagai hash bcrypt (cost 12), tidak pernah teks polos.
 * - Nilai NULL pada kolom passwordHash berarti akun tidak punya sandi dan TIDAK DAPAT login
 *   (dipakai untuk akun pemohon/debitur yang bukan akun pegawai).
 * - Sandi default statis dari kode lama selalu ditolak, walaupun nilainya masih tertinggal di database.
 * - Tidak ada fungsi di berkas ini yang mencatat sandi ke console/log.
 */
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** Cost bcrypt. 12 sesuai anjuran OWASP untuk bcrypt pada perangkat server biasa. */
export const BCRYPT_COST = 12;

export const MIN_PASSWORD_LENGTH = 10;

/** bcrypt hanya membaca 72 byte pertama, jadi sandi yang lebih panjang harus ditolak eksplisit. */
export const MAX_PASSWORD_BYTES = 72;

/** Nilai statis yang pernah dipakai kode lama; tidak boleh pernah diterima sebagai sandi. */
export const KNOWN_STATIC_DEFAULTS = [
  "DEBITUR_DEFAULT_PASS",
  "admin123",
  "password",
  "Password123",
  "12345678",
  "bpr12345",
] as const;

/** Cuplikan daftar sandi lemah yang paling sering dipakai (bukan daftar lengkap). */
const WEAK_PASSWORDS = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop",
  "123456789", "1234567890", "12345678910", "iloveyou", "admin1234", "administrator",
  "letmein123", "welcome123", "bismillah", "bismillah1", "jakarta123", "denpasar123",
  "bri123456", "bpr123456", "bank12345", "rahasia123", "kredit1234", "slik123456",
]);

export function isBcryptHash(value?: string | null): boolean {
  return typeof value === "string" && /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/** Panjang byte sesungguhnya (bukan jumlah karakter) karena bcrypt membatasi 72 byte. */
export function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/** Membuat hash bcrypt. Melempar bila sandi melewati batas 72 byte. */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error("Sandi tidak boleh kosong.");
  if (byteLength(plain) > MAX_PASSWORD_BYTES) {
    throw new Error(`Sandi melebihi ${MAX_PASSWORD_BYTES} byte sehingga akan dipotong bcrypt.`);
  }
  return bcrypt.hash(plain, BCRYPT_COST);
}

export type VerifyReason = "empty" | "static_default" | "mismatch" | "ok";

export interface VerifyResult {
  ok: boolean;
  /** true bila hash lama perlu diganti (cost lebih rendah) ATAU nilai lama masih teks polos. */
  needsUpgrade: boolean;
  reason: VerifyReason;
}

/** Perbandingan waktu-konstan untuk nilai berukuran berbeda (panjang tidak bocor lewat waktu eksekusi). */
function constantTimeEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Memeriksa sandi terhadap nilai tersimpan.
 * - nilai null/kosong  -> akun tanpa sandi (terkunci), selalu gagal
 * - teks polos (legacy)-> dibandingkan waktu-konstan, dan bila cocok ditandai needsUpgrade
 *                        agar pemanggil segera menggantinya dengan hash
 * - hash bcrypt        -> dibandingkan dengan bcrypt.compare
 */
export async function verifyPassword(
  plain: string | undefined | null,
  stored: string | undefined | null
): Promise<VerifyResult> {
  if (!plain || !stored) {
    return { ok: false, needsUpgrade: false, reason: "empty" };
  }

  // Jangan pernah menerima sandi default statis, walaupun barisnya belum ikut dimigrasikan.
  if ((KNOWN_STATIC_DEFAULTS as readonly string[]).includes(stored)) {
    return { ok: false, needsUpgrade: true, reason: "static_default" };
  }

  if (isBcryptHash(stored)) {
    const ok = await bcrypt.compare(plain, stored);
    const cost = Number.parseInt(stored.split("$")[2] ?? "0", 10);
    return {
      ok,
      needsUpgrade: ok && cost < BCRYPT_COST,
      reason: ok ? "ok" : "mismatch",
    };
  }

  // Nilai lama masih teks polos (sebelum backfill). Cocok -> wajib di-hash ulang segera.
  const ok = constantTimeEquals(plain, stored);
  return { ok, needsUpgrade: ok, reason: ok ? "ok" : "mismatch" };
}

/**
 * Menghabiskan waktu setara satu verifikasi bcrypt. Dipakai saat email tidak ditemukan
 * agar penyerang tidak dapat membedakan "email belum terdaftar" dari "sandi salah" lewat timing.
 */
let dummyHashCache: string | null = null;
export async function burnPasswordTime(plain: string): Promise<void> {
  if (!dummyHashCache) {
    dummyHashCache = await bcrypt.hash(randomBytes(24).toString("hex"), BCRYPT_COST);
  }
  await bcrypt.compare(plain ?? "", dummyHashCache);
}

export interface PolicyResult {
  ok: boolean;
  message?: string;
}

/**
 * Kebijakan kata sandi. Sengaja tidak terlalu kaku (mengikuti anjuran NIST):
 * panjang minimum, wajib huruf dan angka, bukan sandi lemah/default, tidak memuat email pengguna.
 */
export function validatePasswordPolicy(plain: string, context?: { email?: string }): PolicyResult {
  if (!plain) return { ok: false, message: "Kata sandi wajib diisi." };
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.` };
  }
  if (byteLength(plain) > MAX_PASSWORD_BYTES) {
    return { ok: false, message: `Kata sandi terlalu panjang (maksimal ${MAX_PASSWORD_BYTES} byte).` };
  }
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) {
    return { ok: false, message: "Kata sandi harus memuat huruf dan angka." };
  }
  if (new Set(plain).size < 4) {
    return { ok: false, message: "Kata sandi terlalu mudah ditebak (variasi karakter terlalu sedikit)." };
  }
  const lower = plain.toLowerCase();
  if (WEAK_PASSWORDS.has(lower) || (KNOWN_STATIC_DEFAULTS as readonly string[]).includes(plain)) {
    return { ok: false, message: "Kata sandi termasuk daftar sandi lemah/default yang dilarang." };
  }
  const localPart = context?.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    return { ok: false, message: "Kata sandi tidak boleh memuat nama pengguna/email." };
  }
  return { ok: true };
}

/** Sandi acak kuat untuk keperluan seed/placeholder (dijamin memuat huruf dan angka). */
export function generateRandomPassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  // Pastikan selalu memenuhi kebijakan (huruf + angka) tanpa mengurangi keacakan berarti.
  if (!/[0-9]/.test(out)) out = `${out.slice(0, -1)}${(bytes[0] % 10)}`;
  if (!/[A-Za-z]/.test(out)) out = `${out.slice(0, -1)}${alphabet[bytes[1] % 26]}`;
  return out;
}
