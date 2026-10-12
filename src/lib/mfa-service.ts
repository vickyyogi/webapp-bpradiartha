/**
 * Operasi basis data MFA (Tahap 1B — P0.1).
 *
 * Aturan yang dijaga modul ini:
 * - Rahasia TOTP hanya tersimpan terenkripsi (lihat encryptTotpSecret).
 * - Kode cadangan hanya tersimpan sebagai hash dan hangus setelah dipakai.
 * - Tantangan login berumur pendek, sekali pakai, dan percobaannya dibatasi.
 * - Semua peristiwa penting dicatat ke audit log tanpa pernah memuat rahasia/kode.
 */
import { db } from "./db";
import { logAudit } from "./audit";
import {
  MFA_CHALLENGE_MAX_ATTEMPTS,
  buildOtpAuthUri,
  challengeExpiry,
  createChallengeToken,
  createTotpSecret,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  hashBackupCode,
  hashChallengeToken,
  backupCodeMatches,
  verifyTotpCode,
} from "./mfa";

export type SecondFactorMethod = "totp" | "backup_code";

export interface SecondFactorResult {
  ok: boolean;
  method: SecondFactorMethod | null;
  reason?: "invalid" | "no_secret" | "no_codes";
}

// ---------------------------------------------------------------------------
// Pendaftaran MFA
// ---------------------------------------------------------------------------

/** Langkah 1 pendaftaran: buat rahasia baru (belum aktif sampai kode diuji). */
export async function startMfaEnrollment(userId: string): Promise<{ secret: string; uri: string }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
  if (!user) throw new Error("Akun tidak ditemukan.");
  if (user.mfaEnabled) throw new Error("MFA sudah aktif pada akun ini. Nonaktifkan dahulu bila ingin mendaftar ulang.");

  const secret = createTotpSecret();
  await db.user.update({
    where: { id: userId },
    data: { mfaSecret: encryptTotpSecret(secret), mfaEnabled: false, mfaEnrolledAt: null, mfaLastTimeStep: null },
  });

  return { secret, uri: buildOtpAuthUri(secret, user.email) };
}

/** Langkah 2 pendaftaran: uji satu kode, lalu aktifkan MFA + buat kode cadangan. */
export async function confirmMfaEnrollment(
  userId: string,
  code: string
): Promise<{ ok: true; backupCodes: string[] } | { ok: false; reason: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, mfaSecret: true, mfaEnabled: true, organizationId: true },
  });

  if (!user) return { ok: false, reason: "Akun tidak ditemukan." };
  if (!user.mfaSecret) return { ok: false, reason: "Belum ada proses pendaftaran. Mulai ulang pendaftaran MFA." };
  if (user.mfaEnabled) return { ok: false, reason: "MFA sudah aktif pada akun ini." };

  let secret: string;
  try {
    secret = decryptTotpSecret(user.mfaSecret);
  } catch {
    return { ok: false, reason: "Rahasia MFA tidak dapat dibuka. Mulai ulang pendaftaran." };
  }

  const result = await verifyTotpCode(secret, code);
  if (!result.valid) {
    return { ok: false, reason: "Kode tidak cocok. Pastikan jam perangkat benar, lalu coba kode berikutnya." };
  }

  const backupCodes = generateBackupCodes();

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      // mfaLastTimeStep sengaja dibiarkan null: kalau tidak, kode dari jendela
      // waktu yang sama akan dianggap "sudah dipakai" dan login pertama setelah
      // pendaftaran ditolak (cacat yang ditemukan saat verifikasi).
      data: { mfaEnabled: true, mfaEnrolledAt: new Date(), mfaLastTimeStep: null },
    }),
    db.mfaBackupCode.deleteMany({ where: { userId } }),
    db.mfaBackupCode.createMany({
      data: backupCodes.map((plain) => ({ userId, codeHash: hashBackupCode(plain) })),
    }),
  ]);

  await logAudit({
    organizationId: user.organizationId,
    userId,
    action: "UPDATE",
    entityType: "USER",
    entityId: userId,
    notes: "MFA diaktifkan pada akun",
    newValues: { mfaEnabled: true, backupCodes: backupCodes.length },
  });

  return { ok: true, backupCodes };
}

/** Menonaktifkan MFA dan menghapus rahasia + kode cadangan. */
export async function disableMfa(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user) throw new Error("Akun tidak ditemukan.");

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null, mfaLastTimeStep: null },
    }),
    db.mfaBackupCode.deleteMany({ where: { userId } }),
    db.mfaChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ]);

  await logAudit({
    organizationId: user.organizationId,
    userId,
    action: "UPDATE",
    entityType: "USER",
    entityId: userId,
    notes: "MFA dinonaktifkan pada akun",
    newValues: { mfaEnabled: false },
  });
}

/**
 * Membuat ulang kode cadangan (kode lama langsung hangus).
 * Menerima kode TOTP MAUPUN kode cadangan, karena pengguna yang kehilangan
 * perangkat harus tetap bisa memulihkan diri lewat kode cadangan yang tersisa.
 */
export async function regenerateBackupCodes(userId: string, code: string): Promise<{ ok: true; backupCodes: string[] } | { ok: false; reason: string }> {
  const verification = await verifySecondFactor(userId, code);
  if (!verification.ok) {
    return { ok: false, reason: "Kode MFA tidak sah, kode cadangan tidak dibuat ulang." };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  const backupCodes = generateBackupCodes();

  await db.$transaction([
    db.mfaBackupCode.deleteMany({ where: { userId } }),
    db.mfaBackupCode.createMany({
      data: backupCodes.map((plain) => ({ userId, codeHash: hashBackupCode(plain) })),
    }),
  ]);

  await logAudit({
    organizationId: user?.organizationId ?? "",
    userId,
    action: "UPDATE",
    entityType: "USER",
    entityId: userId,
    notes: "Kode cadangan MFA dibuat ulang",
    newValues: { backupCodes: backupCodes.length },
  });

  return { ok: true, backupCodes };
}

export interface MfaStatus {
  enabled: boolean;
  enrolledAt: Date | null;
  backupCodesRemaining: number;
}

export async function getMfaStatus(userId: string): Promise<MfaStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaEnrolledAt: true },
  });

  const backupCodesRemaining = await db.mfaBackupCode.count({ where: { userId, usedAt: null } });

  return {
    enabled: Boolean(user?.mfaEnabled),
    enrolledAt: user?.mfaEnrolledAt ?? null,
    backupCodesRemaining,
  };
}

// ---------------------------------------------------------------------------
// Verifikasi langkah kedua
// ---------------------------------------------------------------------------

/**
 * Memverifikasi kode langkah kedua (TOTP atau kode cadangan).
 *
 * @param options.enforceReplayGuard
 *   Aktif HANYA pada login. Alasannya: pada login, kode yang sempat terlihat
 *   pihak lain tidak boleh dipakai ulang pada jendela 30 detik yang sama.
 *   Pada operasi mandiri (pendaftaran, nonaktifkan MFA, buat ulang kode
 *   cadangan) penjaga ini justru membuat pengguna sah ditolak — termasuk tepat
 *   setelah mendaftar — sehingga tidak dipakai di sana.
 */
export async function verifySecondFactor(
  userId: string,
  code: string,
  options: { enforceReplayGuard?: boolean } = {}
): Promise<SecondFactorResult> {
  const enforceReplayGuard = options.enforceReplayGuard === true;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaLastTimeStep: true },
  });

  if (!user?.mfaEnabled || !user.mfaSecret) {
    return { ok: false, method: null, reason: "no_secret" };
  }

  try {
    const secret = decryptTotpSecret(user.mfaSecret);
    const totp = await verifyTotpCode(secret, code, enforceReplayGuard ? user.mfaLastTimeStep : null);
    if (totp.valid) {
      if (enforceReplayGuard) {
        await db.user.update({ where: { id: userId }, data: { mfaLastTimeStep: totp.timeStep } });
      }
      return { ok: true, method: "totp" };
    }
  } catch {
    // Rahasia tidak terbaca (kunci enkripsi berubah) — lanjut ke kode cadangan.
  }

  const candidates = await db.mfaBackupCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });

  if (candidates.length === 0) {
    return { ok: false, method: null, reason: "no_codes" };
  }

  for (const candidate of candidates) {
    if (backupCodeMatches(code, candidate.codeHash)) {
      await db.mfaBackupCode.update({ where: { id: candidate.id }, data: { usedAt: new Date() } });
      return { ok: true, method: "backup_code" };
    }
  }

  return { ok: false, method: null, reason: "invalid" };
}

// ---------------------------------------------------------------------------
// Tantangan login langkah kedua
// ---------------------------------------------------------------------------

export interface LoginChallenge {
  id: string;
  token: string;
  expiresAt: Date;
}

/**
 * Membuat tantangan baru untuk satu akun. Tantangan lama yang belum dipakai
 * langsung dihanguskan supaya hanya satu yang berlaku pada satu waktu.
 */
export async function createLoginChallenge(userId: string): Promise<LoginChallenge> {
  const { token, tokenHash } = createChallengeToken();
  const expiresAt = challengeExpiry();

  await db.$transaction([
    db.mfaChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.mfaChallenge.create({ data: { userId, tokenHash, expiresAt } }),
  ]);

  return { id: tokenHash.slice(0, 12), token, expiresAt };
}

export type ChallengeState =
  | { status: "ok"; challengeId: string; userId: string; organizationId: string }
  | { status: "unknown" }
  | { status: "consumed" }
  | { status: "expired" }
  | { status: "attempts_exhausted" };

/** Mencari tantangan berdasarkan token yang dikirim klien (yang disimpan hanya hash). */
export async function loadLoginChallenge(token: string): Promise<ChallengeState> {
  const tokenHash = hashChallengeToken(token.trim());

  const challenge = await db.mfaChallenge.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      attempts: true,
      expiresAt: true,
      consumedAt: true,
      userId: true,
      user: { select: { organizationId: true } },
    },
  });

  if (!challenge) return { status: "unknown" };
  if (challenge.consumedAt) return { status: "consumed" };
  if (challenge.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  if (challenge.attempts >= MFA_CHALLENGE_MAX_ATTEMPTS) return { status: "attempts_exhausted" };

  return {
    status: "ok",
    challengeId: challenge.id,
    userId: challenge.userId,
    organizationId: challenge.user.organizationId,
  };
}

/** Menambah penghitung percobaan pada tantangan; mengembalikan jumlah terbaru. */
export async function registerChallengeFailure(challengeId: string): Promise<number> {
  const updated = await db.mfaChallenge.update({
    where: { id: challengeId },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });
  return updated.attempts;
}

/** Menghanguskan tantangan setelah dipakai (sekali pakai). */
export async function consumeChallenge(challengeId: string): Promise<void> {
  await db.mfaChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
}

/** Membersihkan tantangan kedaluwarsa (dipakai skrip verifikasi/pemeliharaan). */
export async function purgeExpiredChallenges(): Promise<number> {
  const result = await db.mfaChallenge.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }] },
  });
  return result.count;
}
