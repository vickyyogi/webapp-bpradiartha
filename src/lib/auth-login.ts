/**
 * Inti verifikasi login — Tahap 1A/1B (P0.1).
 *
 * Dipakai bersama oleh:
 * - provider "credentials" NextAuth (login normal, kompatibel dengan klien lama), dan
 * - rute POST /api/auth/prelogin (menentukan apakah langkah kedua MFA diperlukan).
 *
 * Semua pencatatan kegagalan terjadi di SATU tempat ini supaya percobaan tidak
 * terhitung dua kali (dulu sempat berisiko mengunci akun lebih cepat dari 5 kali).
 *
 * Tidak ada nilai sandi yang pernah ditulis ke console, log, atau audit.
 */
import { db } from "./db";
import { logAudit } from "./audit";
import { burnPasswordTime, hashPassword, validatePasswordPolicy, verifyPassword } from "./password";
import {
  checkLoginIpRate,
  isAccountLocked,
  registerFailedLogin,
  registerSuccessfulLogin,
} from "./auth-lockout";

export const AUTH_AUDIT_NOTES = {
  SUCCESS: "Login berhasil",
  MFA_PENDING: "Login tahap 1 (sandi) benar; menunggu kode MFA",
  MFA_SUCCESS: "Login berhasil (langkah kedua MFA)",
  MFA_FAILED: "Login ditolak: kode MFA/ kode cadangan salah",
  MFA_CHALLENGE_EXPIRED: "Login ditolak: tantangan MFA kedaluwarsa atau sudah dipakai",
  MFA_CHALLENGE_LIMIT: "Login ditolak: batas percobaan kode MFA terlampaui",
  WRONG_PASSWORD: "Login gagal: kata sandi salah",
  STATIC_DEFAULT: "Login ditolak: akun masih memakai kata sandi default statis",
  UNKNOWN_EMAIL: "Login gagal: email tidak terdaftar",
  INACTIVE: "Login ditolak: akun tidak aktif",
  LOCKED: "Login ditolak: akun terkunci sementara",
  RATE_LIMITED: "Login ditolak: batas percobaan per IP terlampaui",
  NO_PASSWORD: "Login ditolak: akun tidak memiliki kata sandi (bukan akun pegawai)",
  UPGRADED: "Kata sandi ditingkatkan ke hash bcrypt saat login",
  UPGRADED_WEAK_POLICY: "Kata sandi lama di-hash ulang; wajib diganti (tidak memenuhi kebijakan baru)",
} as const;

export interface LoginUser {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  passwordChangedAt: Date | null;
}

export type LoginOutcome =
  | { status: "ok"; user: LoginUser }
  | { status: "mfa_required"; user: LoginUser }
  | { status: "rejected"; reason: string };

export interface VerifyLoginInput {
  email: string | null | undefined;
  password: string | null | undefined;
  ip: string;
  userAgent: string | null;
}

function writeLoginAudit(
  user: { id: string; organizationId: string },
  notes: string,
  ip: string,
  userAgent: string | null,
  extra?: Record<string, unknown>
) {
  return logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LOGIN",
    entityType: "USER",
    entityId: user.id,
    newValues: extra,
    ipAddress: ip,
    userAgent,
    notes,
  });
}

/** Verifikasi sandi + seluruh aturan penguncian, tanpa membuat sesi apa pun. */
export async function verifyLoginCredentials(input: VerifyLoginInput): Promise<LoginOutcome> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return { status: "rejected", reason: "missing_credentials" };
  }

  const { ip, userAgent } = input;

  // Lapis 1: pembatas laju per IP, diperiksa SEBELUM pencarian akun.
  const ipRate = checkLoginIpRate(ip);

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      organizationId: true,
      email: true,
      fullName: true,
      passwordHash: true,
      isActive: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      passwordChangedAt: true,
      mfaEnabled: true,
      mfaSecret: true,
    },
  });

  if (!user) {
    await burnPasswordTime(password);
    console.warn(
      `[auth] ${AUTH_AUDIT_NOTES.UNKNOWN_EMAIL} — ip=${ip}${ipRate.allowed ? "" : " (batas per IP terlampaui)"}`
    );
    return { status: "rejected", reason: "unknown_email" };
  }

  const auditUser = { id: user.id, organizationId: user.organizationId };

  if (!ipRate.allowed) {
    await writeLoginAudit(auditUser, `${AUTH_AUDIT_NOTES.RATE_LIMITED} (retry ${ipRate.retryAfterSeconds}s)`, ip, userAgent);
    return { status: "rejected", reason: "ip_rate_limited" };
  }

  // Lapis 2: penguncian akun berbasis database.
  if (isAccountLocked(user)) {
    await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.LOCKED, ip, userAgent);
    return { status: "rejected", reason: "locked" };
  }

  if (!user.isActive) {
    await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.INACTIVE, ip, userAgent);
    return { status: "rejected", reason: "inactive" };
  }

  // Akun tanpa sandi (catatan pemohon/debitur) tidak pernah bisa login.
  if (!user.passwordHash) {
    await burnPasswordTime(password);
    await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.NO_PASSWORD, ip, userAgent);
    return { status: "rejected", reason: "no_password" };
  }

  const verification = await verifyPassword(password, user.passwordHash);

  if (!verification.ok) {
    const state = await registerFailedLogin(user.id);
    await writeLoginAudit(
      auditUser,
      verification.reason === "static_default" ? AUTH_AUDIT_NOTES.STATIC_DEFAULT : AUTH_AUDIT_NOTES.WRONG_PASSWORD,
      ip,
      userAgent,
      { failedLoginAttempts: state.failedLoginAttempts, locked: state.locked }
    );
    return { status: "rejected", reason: verification.reason ?? "wrong_password" };
  }

  // Sandi benar. Bila nilai lama masih teks polos (atau hash ber-cost rendah), ganti sekarang.
  let passwordChangedAt = user.passwordChangedAt;
  if (verification.needsUpgrade) {
    const upgraded = await hashPassword(password);
    const policy = validatePasswordPolicy(password, { email: user.email });

    if (policy.ok) {
      passwordChangedAt = new Date();
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: upgraded, passwordChangedAt },
      });
      await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.UPGRADED, ip, userAgent);
    } else {
      await db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
      await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.UPGRADED_WEAK_POLICY, ip, userAgent);
    }
  }

  const loginUser: LoginUser = {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    fullName: user.fullName,
    passwordChangedAt,
  };

  // Tahap 1B: bila MFA aktif, sesi BELUM dibuat — kode langkah kedua wajib dulu.
  if (user.mfaEnabled && user.mfaSecret) {
    await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.MFA_PENDING, ip, userAgent);
    return { status: "mfa_required", user: loginUser };
  }

  await registerSuccessfulLogin(user.id, ip);
  await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.SUCCESS, ip, userAgent);

  return { status: "ok", user: loginUser };
}

/** Bentuk objek pengguna yang dikembalikan NextAuth (dipakai kedua provider). */
export function toNextAuthUser(user: LoginUser, passwordChangedAt: Date | null = user.passwordChangedAt) {
  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    passwordChangedAt: passwordChangedAt ? passwordChangedAt.toISOString() : null,
  };
}

export { registerSuccessfulLogin, writeLoginAudit };
