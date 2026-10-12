/**
 * Verifikasi logika MFA (Tahap 1B) — tanpa server.
 *
 * Yang diuji:
 * 1. TOTP: kecocokan kode, toleransi selisih jam, penolakan replay, panjang kode.
 * 2. Enkripsi rahasia TOTP (AES-256-GCM): bolak-balik, penolakan data yang diubah.
 * 3. Kode cadangan: jumlah, keunikan, hash, sekali pakai.
 * 4. Siklus hidup tantangan login: sekali pakai, kedaluwarsa, batas percobaan.
 * 5. Alur basis data: pendaftaran → konfirmasi → verifikasi → nonaktif.
 * 6. Aturan peran wajib-MFA.
 *
 * Implementasi RFC 6238 ditulis ulang di sini sebagai pembanding independen
 * terhadap pustaka otplib (bukan memakai pustaka yang sama untuk menguji dirinya).
 */
import { createHmac } from "node:crypto";
import { db } from "../src/lib/db";
import {
  MFA_CHALLENGE_MAX_ATTEMPTS,
  MFA_BACKUP_CODE_COUNT,
  backupCodeMatches,
  buildOtpAuthUri,
  challengeExpiry,
  createChallengeToken,
  createTotpSecret,
  currentTimeStep,
  decryptTotpSecret,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpNow,
  hashBackupCode,
  hashChallengeToken,
  roleCodesRequireMfa,
  verifyTotpCode,
} from "../src/lib/mfa";
import {
  confirmMfaEnrollment,
  createLoginChallenge,
  disableMfa,
  getMfaStatus,
  loadLoginChallenge,
  registerChallengeFailure,
  regenerateBackupCodes,
  startMfaEnrollment,
  verifySecondFactor,
} from "../src/lib/mfa-service";
import { hashPassword } from "../src/lib/password";

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    pass += 1;
    console.log(`OK    ${label}`);
  } else {
    fail += 1;
    console.log(`GAGAL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Implementasi RFC 6238 independen (untuk pembanding)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Karakter base32 tidak sah: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(out);
}

function totpRfc6238(secretBase32: string, timeStep: number, digits = 6): string {
  const key = base32Decode(secretBase32);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));

  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Membuat akun uji sementara. */
async function buatAkunUji(suffix: string, opts?: { mfa?: boolean }) {
  const organization = await db.organization.findFirst({ select: { id: true } });
  if (!organization) throw new Error("Tidak ada organisasi di basis data.");

  const email = `uji-mfa-${suffix}@bpr-uji.internal`;
  const adminRole = await db.role.findFirst({ where: { code: "ADMIN" }, select: { id: true } });

  const user = await db.user.create({
    data: {
      organizationId: organization.id,
      email,
      fullName: `Uji MFA ${suffix}`,
      passwordHash: await hashPassword("SandiUjiMfa2026"),
      isActive: true,
      ...(adminRole
        ? { userRoles: { create: [{ roleId: adminRole.id }] } }
        : {}),
    },
    select: { id: true, email: true, organizationId: true },
  });

  if (opts?.mfa) {
    const { secret } = await startMfaEnrollment(user.id);
    await confirmMfaEnrollment(user.id, await generateTotpNow(secret));
  }

  return { ...user, roleTerpasang: Boolean(adminRole) };
}

async function hapusAkunUji(id: string) {
  await db.mfaChallenge.deleteMany({ where: { userId: id } });
  await db.mfaBackupCode.deleteMany({ where: { userId: id } });
  await db.auditLog.deleteMany({ where: { userId: id } });
  await db.userRole.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });
}

async function main() {
  console.log("=== 1. TOTP & pembanding RFC 6238 ===");
  const secret = createTotpSecret();
  const kodeSekarang = await generateTotpNow(secret);
  const langkah = currentTimeStep();

  check("rahasia berbentuk base32 32 karakter", /^[A-Z2-7]{32}$/.test(secret), secret.length.toString());
  check("kode pustaka 6 digit", /^[0-9]{6}$/.test(kodeSekarang));
  check(
    "implementasi RFC 6238 sendiri menghasilkan kode yang sama dengan pustaka",
    totpRfc6238(secret, langkah) === kodeSekarang,
    `${totpRfc6238(secret, langkah)} vs ${kodeSekarang}`
  );

  const sah = await verifyTotpCode(secret, kodeSekarang);
  check("kode benar diterima", sah.valid);
  check(
    "kode langkah sebelumnya masih diterima (toleransi jam)",
    (await verifyTotpCode(secret, totpRfc6238(secret, langkah - 1))).valid
  );
  check(
    "kode langkah berikutnya masih diterima (toleransi jam)",
    (await verifyTotpCode(secret, totpRfc6238(secret, langkah + 1))).valid
  );
  check(
    "kode dua langkah lalu DITOLAK",
    !(await verifyTotpCode(secret, totpRfc6238(secret, langkah - 2))).valid
  );
  check("kode salah ditolak", !(await verifyTotpCode(secret, "000000")).valid || kodeSekarang === "000000");
  check("kode bukan 6 digit ditolak", !(await verifyTotpCode(secret, "12345")).valid);
  check("kode dengan spasi tetap diterima", (await verifyTotpCode(secret, ` ${kodeSekarang} `)).valid);
  check(
    "replay pada langkah waktu yang sama ditolak",
    !(await verifyTotpCode(secret, kodeSekarang, langkah)).valid
  );

  console.log("\n=== 2. Enkripsi rahasia TOTP ===");
  const terenkripsi = encryptTotpSecret(secret);
  check("hasil enkripsi bergaya v1:iv:tag:data", terenkripsi.startsWith("v1:") && terenkripsi.split(":").length === 4);
  check("rahasia tidak terlihat pada teks tersimpan", !terenkripsi.includes(secret));
  check("dekripsi mengembalikan nilai semula", decryptTotpSecret(terenkripsi) === secret);
  const ivLain = encryptTotpSecret(secret);
  check("dua enkripsi nilai sama menghasilkan teks berbeda (IV acak)", ivLain !== terenkripsi);

  const rusak = `${terenkripsi.slice(0, -4)}AAAA`;
  let tolakRusak = false;
  try {
    decryptTotpSecret(rusak);
  } catch {
    tolakRusak = true;
  }
  check("data yang diubah ditolak (tag GCM)", tolakRusak);

  console.log("\n=== 3. Kode cadangan ===");
  const kodeCadangan = generateBackupCodes();
  check(`jumlah kode cadangan = ${MFA_BACKUP_CODE_COUNT}`, kodeCadangan.length === MFA_BACKUP_CODE_COUNT);
  check("semua kode berbeda", new Set(kodeCadangan).size === MFA_BACKUP_CODE_COUNT);
  check("format XXXXX-XXXXX", kodeCadangan.every((k) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(k)));
  check("hash cocok untuk kode benar", backupCodeMatches(kodeCadangan[0], hashBackupCode(kodeCadangan[0])));
  check(
    "huruf kecil dan tanpa tanda hubung tetap cocok",
    backupCodeMatches(
      kodeCadangan[0].replace("-", "").toLowerCase(),
      hashBackupCode(kodeCadangan[0])
    )
  );
  check("hash tidak mengandung kode aslinya", !hashBackupCode(kodeCadangan[0]).includes(kodeCadangan[0]));
  check("kode lain tidak cocok", !backupCodeMatches(kodeCadangan[1], hashBackupCode(kodeCadangan[0])));

  console.log("\n=== 4. Aturan peran wajib-MFA ===");
  check("peran ADMIN wajib MFA", roleCodesRequireMfa(["ADMIN"]));
  check("kode peran huruf kecil tetap dikenali", roleCodesRequireMfa(["admin"]));
  check("peran lain tidak wajib MFA", !roleCodesRequireMfa(["TELLER", "CREDIT_ANALYST"]));

  console.log("\n=== 5. Siklus hidup tantangan login ===");
  const akun = await buatAkunUji("siklus");
  const tantangan = await createLoginChallenge(akun.id);
  const dimuat = await loadLoginChallenge(tantangan.token);
  check("tantangan baru dapat dimuat", dimuat.status === "ok", dimuat.status);
  check("token tidak disimpan apa adanya", !tantangan.token.includes(tantangan.id));
  check(
    "token yang tidak dikenal ditolak",
    (await loadLoginChallenge("token-yang-tidak-ada")).status === "unknown"
  );

  // Batas percobaan diuji pada tantangan pertama sebelum dihanguskan.
  if (dimuat.status === "ok") {
    for (let i = 0; i < MFA_CHALLENGE_MAX_ATTEMPTS; i += 1) {
      await registerChallengeFailure(dimuat.challengeId);
    }
  }
  check(
    "tantangan dibatasi jumlah percobaan",
    (await loadLoginChallenge(tantangan.token)).status === "attempts_exhausted"
  );

  const tantangan2 = await createLoginChallenge(akun.id);
  check("tantangan kedua dapat dimuat", (await loadLoginChallenge(tantangan2.token)).status === "ok");
  const tantangan3 = await createLoginChallenge(akun.id);
  check(
    "tantangan lama hangus saat tantangan baru dibuat",
    (await loadLoginChallenge(tantangan2.token)).status === "consumed"
  );

  await db.mfaChallenge.update({
    where: { tokenHash: hashChallengeToken(tantangan3.token) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  check("tantangan kedaluwarsa ditolak", (await loadLoginChallenge(tantangan3.token)).status === "expired");
  check("masa berlaku tantangan ~5 menit", Math.round((challengeExpiry().getTime() - Date.now()) / 60000) === 5);
  const { tokenHash } = createChallengeToken();
  check("token tantangan panjang 64 heksadesimal", /^[0-9a-f]{64}$/.test(tokenHash));
  await hapusAkunUji(akun.id);

  console.log("\n=== 6. Alur basis data pendaftaran → verifikasi ===");
  const akunMfa = await buatAkunUji("alur");
  const status1 = await getMfaStatus(akunMfa.id);
  check("MFA belum aktif sebelum pendaftaran", !status1.enabled);

  const mulai = await startMfaEnrollment(akunMfa.id);
  check("URI otpauth memuat penerbit dan akun", mulai.uri.startsWith("otpauth://totp/") && mulai.uri.includes(encodeURIComponent(akunMfa.email)));
  check("URI otpauth sama dengan hasil buildOtpAuthUri", mulai.uri === buildOtpAuthUri(mulai.secret, akunMfa.email));

  const tersimpan = await db.user.findUnique({ where: { id: akunMfa.id }, select: { mfaSecret: true, mfaEnabled: true } });
  check("rahasia tersimpan terenkripsi", Boolean(tersimpan?.mfaSecret?.startsWith("v1:")));
  check("rahasia asli tidak ada di kolom basis data", !tersimpan?.mfaSecret?.includes(mulai.secret));
  check("belum aktif sebelum kode diuji", tersimpan?.mfaEnabled === false);

  const konfirmasiSalah = await confirmMfaEnrollment(akunMfa.id, "000000");
  check("konfirmasi dengan kode salah gagal", !konfirmasiSalah.ok);

  const kodeSah = await generateTotpNow(mulai.secret);
  const konfirmasi = await confirmMfaEnrollment(akunMfa.id, kodeSah);
  check("konfirmasi dengan kode benar berhasil", konfirmasi.ok);
  check(
    `kode cadangan dibuat ${MFA_BACKUP_CODE_COUNT} buah`,
    konfirmasi.ok && konfirmasi.backupCodes.length === MFA_BACKUP_CODE_COUNT
  );

  const status2 = await getMfaStatus(akunMfa.id);
  check("MFA aktif setelah konfirmasi", status2.enabled && status2.enrolledAt !== null);
  check(`kode cadangan tersisa ${MFA_BACKUP_CODE_COUNT}`, status2.backupCodesRemaining === MFA_BACKUP_CODE_COUNT);

  const simpanCadangan = await db.mfaBackupCode.findMany({ where: { userId: akunMfa.id }, select: { codeHash: true } });
  const kodePolosTersimpan = konfirmasi.ok
    ? konfirmasi.backupCodes.some((k) => simpanCadangan.some((r) => r.codeHash === k))
    : false;
  check("kode cadangan TIDAK tersimpan apa adanya", !kodePolosTersimpan);

  // Simulasi login pertama tepat setelah pendaftaran. Dulu ini DITOLAK karena
  // penjaga anti-replay ikut berlaku, sehingga admin tidak bisa masuk selama
  // jendela 30 detik pertama setelah mendaftar.
  const kodeLogin = await generateTotpNow(mulai.secret);
  const verifikasiLogin = await verifySecondFactor(akunMfa.id, kodeLogin, { enforceReplayGuard: true });
  check("login tepat setelah pendaftaran diterima", verifikasiLogin.ok && verifikasiLogin.method === "totp");
  const verifikasiReplay = await verifySecondFactor(akunMfa.id, kodeLogin, { enforceReplayGuard: true });
  check("kode TOTP yang sama tidak bisa dipakai dua kali pada login", !verifikasiReplay.ok);
  const verifikasiMandiri = await verifySecondFactor(akunMfa.id, await generateTotpNow(mulai.secret));
  check("operasi mandiri tidak terhalang penjaga replay", verifikasiMandiri.ok);

  const cadanganPertama = konfirmasi.ok ? konfirmasi.backupCodes[0] : "";
  const verifikasiCadangan = await verifySecondFactor(akunMfa.id, cadanganPertama);
  check("kode cadangan diterima", verifikasiCadangan.ok && verifikasiCadangan.method === "backup_code");
  const cadanganUlang = await verifySecondFactor(akunMfa.id, cadanganPertama);
  check("kode cadangan sekali pakai", !cadanganUlang.ok);
  check("kode cadangan lain tetap bisa dipakai", (await verifySecondFactor(akunMfa.id, konfirmasi.ok ? konfirmasi.backupCodes[1] : "")).ok);

  const buatUlang = await regenerateBackupCodes(akunMfa.id, await generateTotpNow(mulai.secret));
  check("kode cadangan dapat dibuat ulang dengan TOTP", buatUlang.ok);
  check(
    "kode cadangan lama hangus setelah dibuat ulang",
    !(await verifySecondFactor(akunMfa.id, konfirmasi.ok ? konfirmasi.backupCodes[2] : "")).ok
  );

  await disableMfa(akunMfa.id);
  const status3 = await getMfaStatus(akunMfa.id);
  check("MFA nonaktif dan rahasia dibersihkan", !status3.enabled && status3.backupCodesRemaining === 0);
  const sisaRahasia = await db.user.findUnique({ where: { id: akunMfa.id }, select: { mfaSecret: true } });
  check("rahasia terhapus dari basis data", sisaRahasia?.mfaSecret === null);
  await hapusAkunUji(akunMfa.id);

  console.log(`\n${pass}/${pass + fail} pemeriksaan lulus.`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Verifikasi gagal dijalankan:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
