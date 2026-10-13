/**
 * Reset kata sandi mandiri (Tahap 1B-2 — P0.1).
 *
 * Aturan yang dijaga modul ini:
 * - Token reset hanya tersimpan sebagai hash; nilai aslinya hanya ada di email.
 * - Umur token pendek (bawaan 30 menit), sekali pakai, dan percobaan dibatasi.
 * - Meminta tautan tidak pernah mengungkap apakah email terdaftar atau tidak.
 * - Setelah sandi diganti: penghitung kunci disetel ulang, semua tautan lain
 *   dihanguskan, dan perubahan dicatat ke audit (tanpa memuat sandi/token).
 */
import { db } from "./db";
import { logAudit } from "./audit";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "./password";
import { createHashedToken, expiryFromMinutes, hashToken } from "./secure-token";
import { sendMail } from "./mailer";

export const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30);
export const PASSWORD_RESET_MAX_ATTEMPTS = Number(process.env.PASSWORD_RESET_MAX_ATTEMPTS ?? 5);
export const PASSWORD_RESET_MAX_PER_WINDOW = Number(process.env.PASSWORD_RESET_MAX_PER_WINDOW ?? 3);
export const PASSWORD_RESET_WINDOW_MINUTES = Number(process.env.PASSWORD_RESET_WINDOW_MINUTES ?? 60);
export const PASSWORD_RESET_MIN_PASSWORD_LENGTH = 10;

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/** Alamat dasar aplikasi untuk menyusun tautan di email. */
export function appBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL?.trim() || process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function buildResetLink(token: string): string {
  return `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Permintaan tautan reset
// ---------------------------------------------------------------------------

export type ResetRequestReason =
  | "sent"
  | "no_account"
  | "inactive"
  | "no_password"
  | "rate_limited"
  | "mail_unavailable";

export interface ResetRequestResult {
  /** true hanya bila email benar-benar terkirim. Jawaban HTTP tetap seragam. */
  requested: boolean;
  reason: ResetRequestReason;
}

function buildResetEmail(fullName: string | null, link: string): { subject: string; text: string } {
  const nama = fullName?.trim() || "Bapak/Ibu";
  return {
    subject: "Reset Kata Sandi — BPR Adiartha Reksacitra",
    text: [
      `Halo ${nama},`,
      "",
      "Kami menerima permintaan untuk mengatur ulang kata sandi akun aplikasi BPR Adiartha Reksacitra Anda.",
      "",
      "Buka tautan berikut untuk menetapkan kata sandi baru:",
      link,
      "",
      `Tautan ini hanya berlaku ${PASSWORD_RESET_TTL_MINUTES} menit dan hanya dapat dipakai satu kali.`,
      "",
      "Bila Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini — kata sandi Anda tidak berubah.",
      "",
      "— BPR Adiartha Reksacitra",
      "Email otomatis, mohon tidak dibalas.",
    ].join("\n"),
  };
}

/**
 * Membuat token reset dan mengirimkannya lewat email.
 * Selalu mengembalikan hasil tanpa melempar, supaya pemanggil dapat menjawab
 * dengan pesan seragam (anti-enumerasi).
 */
export async function requestPasswordReset(
  emailInput: string,
  meta: RequestMeta = {}
): Promise<ResetRequestResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { requested: false, reason: "no_account" };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, organizationId: true, email: true, fullName: true, isActive: true, passwordHash: true },
  });

  if (!user) return { requested: false, reason: "no_account" };
  if (!user.isActive) return { requested: false, reason: "inactive" };
  if (!user.passwordHash) return { requested: false, reason: "no_password" };

  const windowStart = new Date(Date.now() - PASSWORD_RESET_WINDOW_MINUTES * 60 * 1000);
  const terbaru = await db.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: windowStart } },
  });
  if (terbaru >= PASSWORD_RESET_MAX_PER_WINDOW) {
    return { requested: false, reason: "rate_limited" };
  }

  // Tautan lama yang belum dipakai dihanguskan agar hanya satu tautan yang hidup.
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = createHashedToken();
  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: expiryFromMinutes(PASSWORD_RESET_TTL_MINUTES),
      requestedIp: meta.ip ?? null,
    },
  });

  const email_body = buildResetEmail(user.fullName, buildResetLink(token));
  const hasil = await sendMail({ to: user.email, subject: email_body.subject, text: email_body.text });

  if (!hasil.sent) {
    // Email tidak terkirim -> tautan tidak boleh tetap hidup (tidak ada yang tahu nilainya).
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: user.id,
    notes: hasil.sent
      ? "Permintaan tautan reset kata sandi dikirim melalui email."
      : `Permintaan reset kata sandi gagal dikirim: ${hasil.error}`,
    ipAddress: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { requested: hasil.sent, reason: hasil.sent ? "sent" : "mail_unavailable" };
}

// ---------------------------------------------------------------------------
// Pemeriksaan dan pemakaian token
// ---------------------------------------------------------------------------

/** Pesan yang ditampilkan/dikembalikan untuk setiap keadaan tautan reset. */
export const RESET_TOKEN_MESSAGES: Record<ResetTokenStatus, string> = {
  ok: "",
  unknown: "Tautan reset tidak dikenal.",
  used: "Tautan reset sudah pernah dipakai.",
  expired: "Tautan reset sudah kedaluwarsa. Minta tautan baru.",
  attempts_exhausted: "Tautan reset diblokir karena terlalu banyak percobaan. Minta tautan baru.",
  inactive: "Akun tidak aktif. Hubungi administrator.",
  no_password: "Akun ini tidak memakai kata sandi. Hubungi administrator.",
};

export type ResetTokenStatus =
  | "ok"
  | "unknown"
  | "used"
  | "expired"
  | "attempts_exhausted"
  | "inactive"
  | "no_password";

export interface ResetTokenContext {
  tokenId: string;
  userId: string;
  organizationId: string;
  email: string;
  fullName: string | null;
}

export interface ResetTokenState {
  status: ResetTokenStatus;
  /** Ada bila barisnya ditemukan (walau sudah dipakai/kedaluwarsa). */
  tokenId?: string;
  context?: ResetTokenContext;
}

/** Memeriksa token tanpa menghanguskannya. */
export async function loadResetToken(token: string | null | undefined): Promise<ResetTokenState> {
  if (!token || !token.trim()) return { status: "unknown" };

  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      attempts: true,
      user: { select: { id: true, organizationId: true, email: true, fullName: true, isActive: true, passwordHash: true } },
    },
  });

  if (!row) return { status: "unknown" };

  const tokenId = row.id;
  // Diblokir karena percobaan diperiksa lebih dahulu: tautan semacam ini memang
  // sudah dihanguskan, tetapi sebabnya "kehabisan percobaan" lebih informatif.
  if (row.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) return { status: "attempts_exhausted", tokenId };
  if (row.usedAt) return { status: "used", tokenId };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "expired", tokenId };
  if (!row.user.isActive) return { status: "inactive", tokenId };
  if (!row.user.passwordHash) return { status: "no_password", tokenId };

  return {
    status: "ok",
    tokenId,
    context: {
      tokenId: row.id,
      userId: row.user.id,
      organizationId: row.user.organizationId,
      email: row.user.email,
      fullName: row.user.fullName,
    },
  };
}

/** Menambah catatan percobaan gagal; tautan dihanguskan bila batas tercapai. */
export async function registerResetFailure(tokenId: string): Promise<number> {
  const row = await db.passwordResetToken.update({
    where: { id: tokenId },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  if (row.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await db.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
  }

  return row.attempts;
}

export type CompleteResetResult =
  | { ok: true; email: string }
  | { ok: false; status: ResetTokenStatus | "policy" | "same_password"; message: string };

/**
 * Menetapkan kata sandi baru memakai token reset.
 * Efek samping: semua tautan reset akun dihanguskan, kunci akun dibuka,
 * penghitung kegagalan login disetel ulang, dan sesi lama gugur karena
 * passwordChangedAt diperbarui (dipakai penjaga sesi).
 */
export async function completePasswordReset(
  token: string | null | undefined,
  newPassword: string,
  meta: RequestMeta = {}
): Promise<CompleteResetResult> {
  const state = await loadResetToken(token);
  if (state.status !== "ok" || !state.context) {
    // Percobaan gagal pada tautan yang sudah dikenal dicatat; tautan dihanguskan
    // begitu batas percobaan tercapai. Tautan tak dikenal tidak punya baris.
    if (state.tokenId && state.status !== "attempts_exhausted" && state.status !== "used") {
      await registerResetFailure(state.tokenId);
    }

    return { ok: false, status: state.status, message: RESET_TOKEN_MESSAGES[state.status] };
  }

  const { context } = state;

  const policy = validatePasswordPolicy(newPassword, { email: context.email });
  if (!policy.ok) {
    return { ok: false, status: "policy", message: policy.message ?? "Kata sandi tidak memenuhi kebijakan." };
  }

  const lama = await db.user.findUnique({ where: { id: context.userId }, select: { passwordHash: true } });
  const samaDenganLama = await verifyPassword(newPassword, lama?.passwordHash);
  if (samaDenganLama.ok) {
    return { ok: false, status: "same_password", message: "Kata sandi baru tidak boleh sama dengan kata sandi lama." };
  }

  await db.$transaction([
    db.user.update({
      where: { id: context.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    db.passwordResetToken.updateMany({
      where: { userId: context.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await logAudit({
    organizationId: context.organizationId,
    userId: context.userId,
    action: "UPDATE",
    entityType: "USER",
    entityId: context.userId,
    notes: "Kata sandi diganti melalui tautan reset email.",
    ipAddress: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { ok: true, email: context.email };
}

/** Email pemberitahuan setelah sandi berhasil diganti (tidak wajib berhasil). */
export async function sendPasswordChangedNotice(email: string, fullName: string | null): Promise<void> {
  const nama = fullName?.trim() || "Bapak/Ibu";
  await sendMail({
    to: email,
    subject: "Kata Sandi Anda Telah Diubah — BPR Adiartha Reksacitra",
    text: [
      `Halo ${nama},`,
      "",
      "Kata sandi akun aplikasi BPR Adiartha Reksacitra Anda baru saja diubah dan seluruh sesi login lama sudah diputus.",
      "",
      "Bila Anda tidak melakukan perubahan ini, segera hubungi administrator TI bank.",
      "",
      "— BPR Adiartha Reksacitra",
    ].join("\n"),
  });
}
