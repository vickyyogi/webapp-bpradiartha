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
  const generate = flags.includes("--generate");
  const fromEnv = process.env.TARGET_PASSWORD?.trim();

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
