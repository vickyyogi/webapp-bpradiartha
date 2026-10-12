/**
 * Pembatas laju login & penguncian akun — Tahap 1A (P0.1).
 *
 * Dua lapis pertahanan:
 * 1. Per alamat IP (penyimpanan di memori proses): 10 percobaan / 5 menit.
 * 2. Per akun (disimpan di database pada kolom failed_login_attempts & locked_until):
 *    5 kegagalan berturut-turut mengunci akun 15 menit, sehingga tetap berlaku
 *    walau proses server dijalankan ulang.
 *
 * Catatan keterbatasan yang harus dibawa ke Tahap 13: penyimpanan per-IP masih
 * di memori proses (tidak berlaku lintas instance) dan IP diambil dari header
 * X-Forwarded-For yang hanya boleh dipercaya jika ada reverse proxy terpercaya.
 */
// Impor relatif (bukan alias @/) agar berkas ini juga dapat dimuat oleh skrip
// verifikasi/backfill yang dijalankan dengan ts-node.
import { db } from "./db";

export const LOGIN_IP_LIMIT = 10;
export const LOGIN_IP_WINDOW_MS = 5 * 60 * 1000;

export const MAX_FAILED_ATTEMPTS = 5;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

interface Bucket {
  count: number;
  resetTime: number;
}

const ipBuckets = new Map<string, Bucket>();

/** Membersihkan bucket kedaluwarsa agar map tidak tumbuh terus. */
function sweep(now: number): void {
  for (const [key, bucket] of ipBuckets) {
    if (bucket.resetTime < now) ipBuckets.delete(key);
  }
}

export interface IpRateResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

/**
 * Membaca IP klien dari header. Menerima bentuk NextRequest maupun
 * objek header biasa (yang dipakai NextAuth v4 pada authorize()).
 */
export function readClientIp(headers?: unknown): string {
  const get = (name: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name);
    }
    const bag = headers as Record<string, unknown>;
    const value = bag[name] ?? bag[name.toLowerCase()];
    return typeof value === "string" ? value : null;
  };

  const forwarded = get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = get("x-real-ip");
  if (real) return real.trim();
  return "127.0.0.1";
}

export function checkLoginIpRate(ip: string): IpRateResult {
  const now = Date.now();
  if (ipBuckets.size > 500) sweep(now);

  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetTime < now) {
    ipBuckets.set(ip, { count: 1, resetTime: now + LOGIN_IP_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0, remaining: LOGIN_IP_LIMIT - 1 };
  }

  bucket.count += 1;
  if (bucket.count > LOGIN_IP_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetTime - now) / 1000),
      remaining: 0,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: LOGIN_IP_LIMIT - bucket.count };
}

/** Dipanggil setelah login berhasil supaya pengguna sah tidak terhitung kena limit. */
export function clearLoginIpRate(ip: string): void {
  ipBuckets.delete(ip);
}

export interface LockState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export function isAccountLocked(state: LockState, now: Date = new Date()): boolean {
  return Boolean(state.lockedUntil && state.lockedUntil.getTime() > now.getTime());
}

/**
 * Mencatat satu kegagalan login pada akun dan mengunci akun bila melewati ambang.
 * Mengembalikan status setelah pencatatan (tanpa pernah menyentuh nilai sandi).
 */
export async function registerFailedLogin(userId: string): Promise<{ failedLoginAttempts: number; locked: boolean }> {
  const current = await db.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });

  const failedLoginAttempts = (current?.failedLoginAttempts ?? 0) + 1;
  const shouldLock = failedLoginAttempts >= MAX_FAILED_ATTEMPTS;

  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts,
      ...(shouldLock ? { lockedUntil: new Date(Date.now() + ACCOUNT_LOCK_MS) } : {}),
    },
  });

  return { failedLoginAttempts, locked: shouldLock };
}

/** Mengosongkan penghitung kegagalan dan mencatat waktu login terakhir. */
export async function registerSuccessfulLogin(userId: string, ip: string): Promise<void> {
  clearLoginIpRate(ip);
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
}

/** Dipakai skrip verifikasi/backfill untuk mengosongkan kunci akun secara sengaja. */
export async function clearAccountLock(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
