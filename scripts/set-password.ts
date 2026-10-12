/**
 * Rencana pemulihan akun — Tahap 1A (P0.1).
 *
 * Dipakai bila sebuah akun terkunci/kehilangan kata sandi (mis. akun yang terpaksa
 * dikunci oleh backfill karena masih memakai sandi default statis). Hanya operator
 * dengan akses server dan database yang dapat menjalankannya.
 *
 * Pemakaian:
 *   # Sandi diambil dari variabel lingkungan (tidak pernah ditampilkan):
 *   TARGET_PASSWORD='...' npx ts-node --project scripts/tsconfig.json scripts/set-password.ts admin@bpr.com
 *
 *   # Sandi acak dibuat dan ditampilkan SEKALI di terminal operator (wajib diganti setelah login):
 *   npx ts-node --project scripts/tsconfig.json scripts/set-password.ts admin@bpr.com --generate
 *
 *   # Hanya membuka kunci tanpa mengubah sandi:
 *   npx ts-node --project scripts/tsconfig.json scripts/set-password.ts admin@bpr.com --unlock
 *
 *   # Menonaktifkan MFA (Tahap 1B) — dipakai bila pengguna kehilangan ponsel
 *   # authenticator DAN seluruh kode cadangannya, sehingga tidak bisa memenuhi
 *   # langkah kedua saat login:
 *   npx ts-node --project scripts/tsconfig.json scripts/set-password.ts admin@bpr.com --reset-mfa
 *
 * Skrip ini tidak mencetak hash dan tidak menulis sandi ke audit log.
 */
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword, validatePasswordPolicy } from "../src/lib/password";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [emailArg, ...flags] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();

  if (!email) {
    console.error("Sebutkan email akun. Contoh: scripts/set-password.ts admin@bpr.com --generate");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, isActive: true, lockedUntil: true },
  });

  if (!user) {
    console.error(`Akun ${email} tidak ditemukan.`);
    process.exitCode = 1;
    return;
  }

  const unlockOnly = flags.includes("--unlock");
  const resetMfa = flags.includes("--reset-mfa");
  const generate = flags.includes("--generate");
  const fromEnv = process.env.TARGET_PASSWORD?.trim();

  // Tahap 1B: pemulihan bila pengguna kehilangan perangkat authenticator dan
  // seluruh kode cadangannya. Menghapus rahasia TOTP + kode cadangan sekaligus.
  if (resetMfa) {
    const terdaftar = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { mfaEnabled: true, organizationId: true },
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null, mfaLastTimeStep: null },
      }),
      prisma.mfaBackupCode.deleteMany({ where: { userId: user.id } }),
      prisma.mfaChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } }),
    ]);

    await prisma.auditLog.create({
      data: {
        organizationId: terdaftar.organizationId,
        userId: user.id,
        action: "UPDATE",
        entityType: "USER",
        entityId: user.id,
        notes: "MFA dinonaktifkan oleh operator melalui skrip pemulihan (pengguna wajib mendaftar ulang).",
        newValues: { mfaEnabled: false, sebelum: terdaftar.mfaEnabled },
      },
    });

    console.log(
      `MFA akun ${email} ${terdaftar.mfaEnabled ? "dinonaktifkan" : "memang belum aktif"} + kode cadangan dihapus. ` +
        "Pengguna wajib mendaftar MFA ulang saat login berikutnya."
    );

    if (!unlockOnly && !generate && !fromEnv) return;
  }

  if (unlockOnly) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, isActive: true },
    });
    console.log(`Akun ${email} dibuka dan diaktifkan kembali (sandi tidak diubah).`);
    return;
  }

  const newPassword = fromEnv || (generate ? generateRandomPassword(20) : null);

  if (!newPassword) {
    console.error(
      "Sandi baru tidak diberikan. Gunakan TARGET_PASSWORD=<sandi> atau --generate (sandi acak ditampilkan sekali)."
    );
    process.exitCode = 1;
    return;
  }

  const policy = validatePasswordPolicy(newPassword, { email });
  if (!policy.ok) {
    console.error(`Sandi tidak memenuhi kebijakan: ${policy.message}`);
    process.exitCode = 1;
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: (await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { organizationId: true } }))
        .organizationId,
      userId: user.id,
      action: "UPDATE",
      entityType: "USER",
      entityId: user.id,
      notes: "Kata sandi akun ditetapkan ulang oleh operator melalui skrip pemulihan (nilai sandi tidak dicatat).",
    },
  });

  console.log(`Kata sandi akun ${email} berhasil ditetapkan ulang. Akun diaktifkan dan dibuka kuncinya.`);
  if (!fromEnv && generate) {
    console.log(`\nSANDI BARU (hanya ditampilkan sekali, segera ganti setelah login):\n  ${newPassword}\n`);
  }
}

main()
  .catch((error) => {
    console.error("Gagal menetapkan sandi:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
