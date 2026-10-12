/**
 * Tahap 1B — P0.1: autentikasi dua faktor (TOTP) untuk peran berisiko tinggi.
 *
 * Isi modul ini murni kriptografi dan aturan, tanpa akses basis data, supaya
 * bisa diuji langsung oleh skrip verifikasi (npm run verify:mfa).
 *
 * Keputusan penting:
 * - Rahasia TOTP TIDAK pernah disimpan apa adanya: selalu lewat encryptTotpSecret().
 * - Kode cadangan disimpan sebagai hash satu arah (SHA-256) dan sekali pakai.
 * - Verifikasi memakai toleransi +-1 langkah (30 detik) untuk selisih jam yang
 *   wajar, tetapi langkah waktu (time step) terakhir dicatat untuk mencegah
 *   kode yang sama dipakai dua kali (replay) pada jendela yang sama.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";

/** Nama penerbit yang tampil di aplikasi authenticator. */
export const MFA_ISSUER = process.env.MFA_ISSUER?.trim() || "BPR Adiartha Reksacitra";

/**
 * Peran yang WAJIB memakai MFA. Bawaannya hanya ADMIN (peran berisiko tertinggi);
 * dapat diperluas lewat MFA_REQUIRED_ROLE_CODES (dipisah koma), mis.
 * MFA_REQUIRED_ROLE_CODES="ADMIN,DIRECTOR".
 */
export const MFA_REQUIRED_ROLE_CODES: string[] = (process.env.MFA_REQUIRED_ROLE_CODES?.trim() || "ADMIN")
  .split(",")
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

/** Apakah salah satu kode peran ini mewajibkan MFA. */
export function roleCodesRequireMfa(roleCodes: Iterable<string>): boolean {
  for (const code of roleCodes) {
    if (MFA_REQUIRED_ROLE_CODES.includes(String(code).toUpperCase())) {
      return true;
    }
  }
  return false;
}

/** Panjang satu langkah TOTP dalam detik (standar RFC 6238). */
export const MFA_PERIOD_SECONDS = 30;

/** Toleransi selisih jam: 30 detik berarti +-1 langkah waktu. */
export const MFA_EPOCH_TOLERANCE_SECONDS = 30;

/** Jumlah kode cadangan yang dibuat saat pendaftaran MFA. */
export const MFA_BACKUP_CODE_COUNT = 10;

/** Batas percobaan memasukkan kode pada satu tantangan login. */
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;

/** Umur tantangan langkah kedua (menit). */
export const MFA_CHALLENGE_TTL_MINUTES = 5;

// ---------------------------------------------------------------------------
// Enkripsi rahasia TOTP (AES-256-GCM)
// ---------------------------------------------------------------------------

/**
 * Kunci enkripsi 32 byte. Sumber utama MFA_ENCRYPTION_KEY; bila tidak diisi,
 * kunci diturunkan dari NEXTAUTH_SECRET memakai HKDF sehingga tidak ada rahasia
 * baru yang wajib diisi operator. Mengganti salah satunya membuat rahasia TOTP
 * lama tidak terbaca (pengguna harus mendaftar MFA ulang / memakai kode cadangan).
 */
function encryptionKey(): Buffer {
  const explicit = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (explicit) {
    return createHash("sha256").update(explicit, "utf8").digest();
  }

  const fallback = process.env.NEXTAUTH_SECRET?.trim();
  if (!fallback) {
    throw new Error(
      "MFA tidak dapat dipakai: isi MFA_ENCRYPTION_KEY (disarankan) atau NEXTAUTH_SECRET di .env terlebih dahulu."
    );
  }

  return Buffer.from(hkdfSync("sha256", fallback, "bpr-mfa-secret", "totp-v1", 32));
}

/** Mengenkripsi rahasia TOTP (base32) menjadi teks aman untuk kolom mfa_secret. */
export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/** Membaca kembali rahasia TOTP; melempar bila rusak, diubah, atau kunci berbeda. */
export function decryptTotpSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Rahasia MFA tersimpan dalam format tak dikenal.");
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  try {
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Rahasia MFA tidak dapat dibuka (kunci enkripsi berubah atau data rusak).");
  }
}

// ---------------------------------------------------------------------------
// TOTP
// ---------------------------------------------------------------------------

/** Membuat rahasia TOTP baru (base32, 160 bit). */
export function createTotpSecret(): string {
  return generateSecret();
}

/** URI otpauth:// untuk dipindai aplikasi authenticator. */
export function buildOtpAuthUri(secret: string, accountLabel: string): string {
  return generateURI({ issuer: MFA_ISSUER, label: accountLabel, secret });
}

/** Langkah waktu (time step) TOTP saat ini. */
export function currentTimeStep(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000 / MFA_PERIOD_SECONDS);
}

/** Kode TOTP yang berlaku sekarang — hanya dipakai oleh skrip verifikasi. */
export async function generateTotpNow(secret: string): Promise<string> {
  const { generate } = await import("otplib");
  return generate({ secret });
}

export type TotpVerifyResult = { valid: boolean; timeStep: number };

/**
 * Memverifikasi kode TOTP enam digit.
 *
 * @param afterTimeStep langkah waktu yang sudah terpakai; kode pada langkah <= nilai
 *   ini ditolak supaya satu kode tidak bisa dipakai dua kali (anti replay).
 */
export async function verifyTotpCode(
  secret: string,
  token: string,
  afterTimeStep?: number | null
): Promise<TotpVerifyResult> {
  const candidate = token.replace(/\D/g, "");
  const timeStep = currentTimeStep();

  if (candidate.length !== 6) {
    return { valid: false, timeStep };
  }

  let result: { valid?: boolean };
  try {
    result = (await verify({
      secret,
      token: candidate,
      epochTolerance: MFA_EPOCH_TOLERANCE_SECONDS,
      ...(afterTimeStep ? { afterTimeStep } : {}),
    })) as { valid?: boolean };
  } catch {
    return { valid: false, timeStep };
  }

  return { valid: result?.valid === true, timeStep };
}

// ---------------------------------------------------------------------------
// Kode cadangan
// ---------------------------------------------------------------------------

/** Menormalkan kode cadangan agar huruf besar/kecil dan tanda hubung tidak penting. */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Membuat kode cadangan sekali pakai. Alfabet tanpa huruf/angka yang mudah
 * tertukar (0/O, 1/I/L) supaya aman disalin manual dari kertas.
 */
export function generateBackupCodes(count = MFA_BACKUP_CODE_COUNT): string[] {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];

  while (codes.length < count) {
    const raw = randomBytes(10);
    let body = "";
    for (let i = 0; i < 10; i += 1) {
      body += alphabet[raw[i] % alphabet.length];
    }
    const formatted = `${body.slice(0, 5)}-${body.slice(5)}`;
    if (!codes.includes(formatted)) {
      codes.push(formatted);
    }
  }

  return codes;
}

/** Hash satu arah untuk penyimpanan kode cadangan. */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code), "utf8").digest("hex");
}

/** Perbandingan waktu-tetap antara kode yang dimasukkan dan hash tersimpan. */
export function backupCodeMatches(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashBackupCode(code), "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

// ---------------------------------------------------------------------------
// Tantangan login langkah kedua
// ---------------------------------------------------------------------------

/** Token acak yang dikirim ke klien; yang disimpan hanya hash-nya. */
export function createChallengeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashChallengeToken(token) };
}

export function hashChallengeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function challengeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MFA_CHALLENGE_TTL_MINUTES * 60 * 1000);
}
