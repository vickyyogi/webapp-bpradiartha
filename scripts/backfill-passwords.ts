/**
 * Backfill kata sandi — Tahap 1A (P0.1).
 *
 * Tugas:
 * 1. Setiap nilai sandi lama yang masih teks polos di-hash dengan bcrypt (cost 12).
 * 2. Catatan pemohon/debitur (bukan pegawai) dikunci: passwordHash = NULL dan isActive = false,
 *    sehingga tidak ada sandi default statis yang tersisa dan catatan itu tidak dapat login.
 * 3. Nilai yang sudah berupa hash bcrypt dilewati.
 *
 * Aman dijalankan berulang (idempoten). TIDAK PERNAH mencetak nilai sandi atau hash — hanya
 * jumlah baris dan email yang disamarkan.
 *
 * Pemakaian:
 *   npx ts-node --project scripts/tsconfig.json scripts/backfill-passwords.ts            # uji (dry-run)
 *   npx ts-node --project scripts/tsconfig.json scripts/backfill-passwords.ts --apply    # tulis ke DB
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, isBcryptHash, KNOWN_STATIC_DEFAULTS, byteLength, MAX_PASSWORD_BYTES } from "../src/lib/password";
import { maskEmail } from "../src/lib/privacy";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** Domain email palsu yang dibuat kode lama untuk pemohon/debitur. */
const APPLICANT_EMAIL_DOMAIN = "@bpr-client.internal";

interface Plan {
  id: string;
  email: string;
  fullName: string;
  action: "hash" | "lock" | "skip";
  reason: string;
  value?: string;
}

/** Memotong nilai menjadi maksimal `maxBytes` byte tanpa memecah karakter multibyte. */
function truncateToBytes(value: string, maxBytes: number): string {
  const buf = Buffer.from(value, "utf8");
  if (buf.length <= maxBytes) return value;
  return buf.subarray(0, maxBytes).toString("utf8").replace(/\uFFFD+$/, "");
}

async function main(): Promise<void> {
  console.log(`Mode: ${APPLY ? "APPLY (menulis ke database)" : "DRY-RUN (tidak menulis)"}\n`);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      isActive: true,
      employeeNumber: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const plans: Plan[] = [];

  for (const user of users) {
    const value = user.passwordHash ?? "";

    if (!value) {
      plans.push({ id: user.id, email: user.email, fullName: user.fullName, action: "skip", reason: "tanpa sandi (sudah terkunci)" });
      continue;
    }

    if (isBcryptHash(value)) {
      plans.push({ id: user.id, email: user.email, fullName: user.fullName, action: "skip", reason: "sudah hash bcrypt" });
      continue;
    }

    const looksLikeApplicant =
      (KNOWN_STATIC_DEFAULTS as readonly string[]).includes(value) ||
      user.email.toLowerCase().endsWith(APPLICANT_EMAIL_DOMAIN) ||
      (!user.employeeNumber && value === "DEBITUR_DEFAULT_PASS");

    if (looksLikeApplicant) {
      plans.push({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        action: "lock",
        reason: "pemohon/debitur atau memakai sandi default statis",
      });
      continue;
    }

    const tooLong = byteLength(value) > MAX_PASSWORD_BYTES;
    plans.push({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      action: "hash",
      reason: tooLong ? "teks polos (dipotong ke 72 byte saat hashing)" : "teks polos",
      value,
    });
  }

  const toHash = plans.filter((p) => p.action === "hash");
  const toLock = plans.filter((p) => p.action === "lock");
  const skipped = plans.filter((p) => p.action === "skip");

  console.log(`Total akun diperiksa : ${users.length}`);
  console.log(`Akan di-hash         : ${toHash.length}`);
  console.log(`Akan dikunci         : ${toLock.length}`);
  console.log(`Dilewati             : ${skipped.length}\n`);

  if (toHash.length) {
    console.log("Akun yang akan di-hash (email disamarkan):");
    for (const plan of toHash) console.log(`  - ${maskEmail(plan.email)} [${plan.reason}]`);
  }
  if (toLock.length) {
    console.log("\nAkun yang akan dikunci (tidak dapat login):");
    for (const plan of toLock) console.log(`  - ${maskEmail(plan.email)} [${plan.reason}]`);
  }

  if (!APPLY) {
    console.log("\nDRY-RUN selesai. Jalankan ulang dengan --apply untuk menulis perubahan.");
    return;
  }

  let hashed = 0;
  let locked = 0;

  for (const plan of plans) {
    if (plan.action === "hash" && plan.value) {
      const safeValue = truncateToBytes(plan.value, MAX_PASSWORD_BYTES);
      await prisma.user.update({
        where: { id: plan.id },
        data: {
          passwordHash: await hashPassword(safeValue),
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      hashed += 1;
    } else if (plan.action === "lock") {
      await prisma.user.update({
        where: { id: plan.id },
        data: {
          passwordHash: null,
          isActive: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      locked += 1;
    }
  }

  console.log(`\nSELESAI: ${hashed} akun di-hash, ${locked} akun dikunci.`);
}

main()
  .catch((error) => {
    console.error("Backfill gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
