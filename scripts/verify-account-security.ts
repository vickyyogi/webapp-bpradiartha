/**
 * Verifikasi keamanan akun (Tahap 1B-3) — tanpa server.
 *
 * Yang diuji:
 * 1. Cermin kebijakan sandi di klien tidak pernah lebih longgar dari server.
 * 2. Sandi lama (hash ber-cost rendah) yang TIDAK memenuhi kebijakan: setelah login
 *    berhasil, akun ditandai wajib ganti sandi dan hash-nya dinaikkan.
 * 3. Sandi lama yang sudah memenuhi kebijakan: tidak ditandai.
 * 4. Kolom penanda & waktu pencabutan sesi dibaca-tulis dengan benar.
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { BCRYPT_COST, validatePasswordPolicy, verifyPassword } from "../src/lib/password";
import { periksaAturanSandi } from "../src/lib/password-policy-rules";
import { verifyLoginCredentials } from "../src/lib/auth-login";

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

const ORG_EMAIL_DOMAIN = "bpr-uji.internal";

async function main() {
  const org = await db.organization.findFirstOrThrow({ select: { id: true } });

  // -------------------------------------------------------------------------
  // 1. Cermin kebijakan di klien vs server
  // -------------------------------------------------------------------------
  const contoh = [
    "",
    "pendek1",
    "hanyahurufsaja",
    "1234567890123",
    "aaaaaaaaaaaa",
    "bpr2024",
    "AdminBpr2026",
    "BprAdiartha2026",
    "KreditBaru2026aman",
  ];

  let cerminTidakLonggar = true;
  let rincian = "";
  for (const s of contoh) {
    const aturan = periksaAturanSandi(s);
    const klienLulus = aturan.every((a) => a.lulus);
    const server = validatePasswordPolicy(s, { email: `pengguna@${ORG_EMAIL_DOMAIN}` });
    // Bila klien menganggap semua aturan lulus, server boleh tetap menolak
    // (daftar sandi lemah/email) — tetapi tidak sebaliknya.
    if (!klienLulus && server.ok) {
      cerminTidakLonggar = false;
      rincian = `contoh "${s}"`;
    }
  }
  check("cermin kebijakan di klien tidak lebih longgar dari server", cerminTidakLonggar, rincian);
  check("daftar periksa mengembalikan 3 aturan", periksaAturanSandi("x").length === 3);
  check(
    "sandi kuat melewati semua aturan klien",
    periksaAturanSandi("BprAdiartha2026").every((a) => a.lulus)
  );
  check(
    "sandi lemah gagal pada aturan klien",
    periksaAturanSandi("bpr2024").some((a) => !a.lulus)
  );

  // -------------------------------------------------------------------------
  // 2. Sandi lama lemah -> ditandai wajib ganti setelah login berhasil
  // -------------------------------------------------------------------------
  const emailLemah = `uji-wajib-ganti-${Date.now()}@${ORG_EMAIL_DOMAIN}`;
  const sandiLamaLemah = "bpr2024"; // 8 karakter, huruf+angka, bukan sandi default statis
  check("sandi uji ditolak kebijakan baru (prasyarat)", !validatePasswordPolicy(sandiLamaLemah, { email: emailLemah }).ok);

  const akunLemah = await db.user.create({
    data: {
      organizationId: org.id,
      email: emailLemah,
      fullName: "Uji Wajib Ganti",
      isActive: true,
      // Hash lama ber-cost rendah supaya jalur "peningkatan hash" terpicu.
      passwordHash: await bcrypt.hash(sandiLamaLemah, 10),
    },
    select: { id: true },
  });

  const sebelum = await db.user.findUnique({ where: { id: akunLemah.id }, select: { mustChangePassword: true } });
  check("akun baru belum ditandai wajib ganti", sebelum?.mustChangePassword === false);

  const login = await verifyLoginCredentials({
    email: emailLemah,
    password: sandiLamaLemah,
    ip: "203.0.113.210",
    userAgent: "uji-tahap-1b3",
  });
  check("login dengan sandi lama berhasil", login.status === "ok", login.status);

  const sesudah = await db.user.findUnique({
    where: { id: akunLemah.id },
    select: { mustChangePassword: true, passwordHash: true },
  });
  check("akun ditandai wajib ganti sandi", sesudah?.mustChangePassword === true, String(sesudah?.mustChangePassword));
  check(
    "hash sandi dinaikkan ke cost produksi",
    Number.parseInt((sesudah?.passwordHash ?? "").split("$")[2] ?? "0", 10) === BCRYPT_COST,
    (sesudah?.passwordHash ?? "").slice(0, 7)
  );
  check("sandi lama masih dapat diverifikasi setelah peningkatan", (await verifyPassword(sandiLamaLemah, sesudah?.passwordHash)).ok);

  // -------------------------------------------------------------------------
  // 3. Sandi lama yang sudah kuat -> tidak ditandai
  // -------------------------------------------------------------------------
  const emailKuat = `uji-tidak-diandai-${Date.now()}@${ORG_EMAIL_DOMAIN}`;
  const sandiLamaKuat = "SandiLama2026aman";
  check("sandi uji memenuhi kebijakan baru (prasyarat)", validatePasswordPolicy(sandiLamaKuat, { email: emailKuat }).ok);

  const akunKuat = await db.user.create({
    data: {
      organizationId: org.id,
      email: emailKuat,
      fullName: "Uji Tidak Diandai",
      isActive: true,
      passwordHash: await bcrypt.hash(sandiLamaKuat, 10),
    },
    select: { id: true },
  });

  const loginKuat = await verifyLoginCredentials({
    email: emailKuat,
    password: sandiLamaKuat,
    ip: "203.0.113.211",
    userAgent: "uji-tahap-1b3",
  });
  check("login dengan sandi lama kuat berhasil", loginKuat.status === "ok", loginKuat.status);
  const akunKuatSetelah = await db.user.findUnique({
    where: { id: akunKuat.id },
    select: { mustChangePassword: true, passwordHash: true },
  });
  check("akun TIDAK ditandai wajib ganti", akunKuatSetelah?.mustChangePassword === false);
  check(
    "hash tetap dinaikkan ke cost produksi",
    Number.parseInt((akunKuatSetelah?.passwordHash ?? "").split("$")[2] ?? "0", 10) === BCRYPT_COST
  );

  // -------------------------------------------------------------------------
  // 4. Kolom pencabutan sesi
  // -------------------------------------------------------------------------
  const waktu = new Date();
  await db.user.update({ where: { id: akunKuat.id }, data: { sessionsValidFrom: waktu } });
  const dibaca = await db.user.findUnique({ where: { id: akunKuat.id }, select: { sessionsValidFrom: true } });
  check(
    "sessionsValidFrom tersimpan dan terbaca",
    Boolean(dibaca?.sessionsValidFrom) &&
      Math.abs((dibaca?.sessionsValidFrom?.getTime() ?? 0) - waktu.getTime()) < 1000
  );

  // Cermin aturan penjaga sesi di src/app/api/auth/[...nextauth]/route.ts:
  // token yang terbit pada atau sebelum sessionsValidFrom tidak berlaku lagi.
  const dicabut = (terbitDetik: number, batas: Date | null | undefined) =>
    batas ? terbitDetik <= Math.floor(batas.getTime() / 1000) : false;
  const detikWaktu = Math.floor(waktu.getTime() / 1000);
  check("token yang terbit sebelum pencabutan tidak berlaku", dicabut(detikWaktu - 5, dibaca?.sessionsValidFrom));
  check("token yang terbit sesaat setelah pencabutan tetap berlaku", !dicabut(detikWaktu + 5, dibaca?.sessionsValidFrom));

  // Audit
  const audit = await db.auditLog.findMany({ where: { userId: { in: [akunLemah.id, akunKuat.id] } }, select: { notes: true } });
  const catatan = audit.map((a) => a.notes ?? "").join(" | ");
  check("peningkatan hash sandi lemah dicatat sebagai wajib ganti", /wajib diganti/i.test(catatan));
  check("audit tidak memuat nilai sandi", !catatan.includes(sandiLamaLemah) && !catatan.includes(sandiLamaKuat));

  await db.auditLog.deleteMany({ where: { userId: { in: [akunLemah.id, akunKuat.id] } } });
  await db.user.deleteMany({ where: { id: { in: [akunLemah.id, akunKuat.id] } } });

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
