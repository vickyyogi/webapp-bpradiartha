/**
 * Verifikasi Tahap 1A (P0.1) — bagian 1: logika kata sandi + integritas database.
 * Tidak memerlukan server yang berjalan. Tidak pernah mencetak sandi/hash.
 *
 *   npm run verify:auth
 */
import { PrismaClient } from "@prisma/client";
import {
  BCRYPT_COST,
  generateRandomPassword,
  hashPassword,
  isBcryptHash,
  KNOWN_STATIC_DEFAULTS,
  validatePasswordPolicy,
  verifyPassword,
} from "../src/lib/password";
import { SESSION_MAX_AGE_SECONDS, SESSION_REVALIDATE_AFTER_SECONDS, SESSION_UPDATE_AGE_SECONDS } from "../src/lib/auth-config";
import { ACCOUNT_LOCK_MS, MAX_FAILED_ATTEMPTS, isAccountLocked } from "../src/lib/auth-lockout";

const prisma = new PrismaClient();

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

async function logicTests(): Promise<void> {
  console.log("== 1. Hashing & verifikasi ==");

  const plain = "SandiUji1Kuat";
  const hash = await hashPassword(plain);

  check("hash bukan teks polos", hash !== plain);
  check("hash dikenali sebagai bcrypt", isBcryptHash(hash));
  check(`cost hash = ${BCRYPT_COST}`, hash.startsWith(`$2a$${BCRYPT_COST}$`) || hash.startsWith(`$2b$${BCRYPT_COST}$`), hash.slice(0, 7));

  const okVerify = await verifyPassword(plain, hash);
  check("sandi benar terverifikasi", okVerify.ok && okVerify.reason === "ok");

  const wrong = await verifyPassword("SandiUji1Salah", hash);
  check("sandi salah ditolak", !wrong.ok && wrong.reason === "mismatch");

  const empty = await verifyPassword(plain, null);
  check("passwordHash null (akun pemohon) selalu ditolak", !empty.ok && empty.reason === "empty");

  const legacy = await verifyPassword("sandiLama123", "sandiLama123");
  check("nilai teks polos lama masih bisa login + wajib di-hash ulang", legacy.ok && legacy.needsUpgrade);

  const legacyWrong = await verifyPassword("sandiLama123", "sandiLamaLain");
  check("teks polos lama yang salah ditolak", !legacyWrong.ok);

  for (const known of KNOWN_STATIC_DEFAULTS) {
    const result = await verifyPassword(known, known);
    check(`sandi default statis "${known}" selalu ditolak`, !result.ok);
  }

  const longLowCost = await hashPassword("SandiPanjang1");
  check("hash kedua memakai cost yang sama", longLowCost.includes(`$${BCRYPT_COST}$`));

  console.log("\n== 2. Kebijakan kata sandi ==");
  check("terlalu pendek ditolak", !validatePasswordPolicy("Pendek1").ok);
  check("tanpa angka ditolak", !validatePasswordPolicy("tanpaAngkaSama").ok);
  check("tanpa huruf ditolak", !validatePasswordPolicy("1234567890").ok);
  check("sandi lemah ditolak", !validatePasswordPolicy("password123").ok);
  check("sandi default statis ditolak", !validatePasswordPolicy("admin123").ok);
  check("variasi karakter terlalu sedikit ditolak", !validatePasswordPolicy("aaaaaaaaa1").ok);
  check("memuat email ditolak", !validatePasswordPolicy("BudiSantoso1", { email: "budisantoso@bpr.com" }).ok);
  check("sandi melebihi 72 byte ditolak", !validatePasswordPolicy(`${"A".repeat(70)}12`).ok);
  check("sandi layak diterima", validatePasswordPolicy("SandiUji1Kuat").ok);

  const generated = generateRandomPassword();
  check("sandi acak memenuhi kebijakan", validatePasswordPolicy(generated).ok);
  check("dua sandi acak berbeda", generateRandomPassword() !== generateRandomPassword());

  console.log("\n== 3. Konfigurasi sesi & penguncian ==");
  check("masa berlaku sesi 8 jam", SESSION_MAX_AGE_SECONDS === 28800, String(SESSION_MAX_AGE_SECONDS));
  check("perpanjangan sesi 1 jam", SESSION_UPDATE_AGE_SECONDS === 3600, String(SESSION_UPDATE_AGE_SECONDS));
  check("pemeriksaan ulang izin tiap 5 menit", SESSION_REVALIDATE_AFTER_SECONDS === 300, String(SESSION_REVALIDATE_AFTER_SECONDS));
  check("ambang kegagalan login 5", MAX_FAILED_ATTEMPTS === 5, String(MAX_FAILED_ATTEMPTS));
  check("durasi kunci 15 menit", ACCOUNT_LOCK_MS === 900000, String(ACCOUNT_LOCK_MS));
  check(
    "akun terkunci dikenali",
    isAccountLocked({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60000) })
  );
  check(
    "akun dengan kunci kedaluwarsa tidak terkunci",
    !isAccountLocked({ failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 60000) })
  );
}

async function databaseTests(): Promise<void> {
  console.log("\n== 4. Integritas database ==");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, passwordHash: true, isActive: true, employeeNumber: true },
  });

  const withHash = users.filter((u) => Boolean(u.passwordHash));
  const plaintext = withHash.filter((u) => !isBcryptHash(u.passwordHash));
  const staticDefaults = withHash.filter((u) =>
    (KNOWN_STATIC_DEFAULTS as readonly string[]).includes(u.passwordHash as string)
  );
  const applicants = users.filter((u) => u.email.toLowerCase().endsWith("@bpr-client.internal"));
  const applicantsStillLoginable = applicants.filter((u) => Boolean(u.passwordHash) && u.isActive);
  const lowCost = withHash.filter((u) => isBcryptHash(u.passwordHash) && !(u.passwordHash as string).includes(`$${BCRYPT_COST}$`));

  check(`tidak ada sandi teks polos (diperiksa ${withHash.length} akun bersandi)`, plaintext.length === 0, plaintext.map((u) => u.email).join(", "));
  check("tidak ada sandi default statis", staticDefaults.length === 0, staticDefaults.map((u) => u.email).join(", "));
  check("akun pemohon/debitur (@bpr-client.internal) tidak dapat login", applicantsStillLoginable.length === 0, applicantsStillLoginable.map((u) => u.email).join(", "));
  check(`semua hash memakai cost ${BCRYPT_COST}`, lowCost.length === 0, lowCost.map((u) => u.email).join(", "));

  const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('failed_login_attempts', 'locked_until', 'password_changed_at')
  `;
  check("kolom penguncian akun tersedia di tabel users", columns.length === 3, columns.map((c) => c.column_name).join(", "));

  console.log(
    `\nRingkasan akun: ${users.length} total, ${withHash.length} bersandi, ${applicants.length} catatan pemohon`
  );
}

async function main(): Promise<void> {
  await logicTests();
  await databaseTests();

  console.log(`\n${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Verifikasi gagal dijalankan:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
