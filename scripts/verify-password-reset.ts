/**
 * Verifikasi alur reset kata sandi (Tahap 1B-2) — tanpa server HTTP.
 *
 * Yang diuji:
 * 1. Token: panjang, hash tersimpan (bukan nilai asli), pencocokan.
 * 2. Pemilihan transport email: smtp bila dikonfigurasi, file hanya untuk
 *    non-produksi, dan tidak aktif di produksi.
 * 3. Permintaan tautan: hanya untuk akun aktif bersandi, ada pembatas per akun,
 *    tautan lama hangus, dan tautan dihanguskan bila email gagal terkirim.
 * 4. Pemeriksaan tautan: dikenal, tak dikenal, kedaluwarsa, sudah dipakai.
 * 5. Penetapan sandi: kebijakan sandi ditegakkan, sandi lama ditolak, sukses
 *    memperbarui hash + passwordChangedAt + membuka kunci akun, sekali pakai.
 * 6. Audit: tercatat tanpa pernah memuat token atau sandi.
 */
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "../src/lib/db";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { createHashedToken, hashToken, tokenMatches } from "../src/lib/secure-token";
import { mailTransportName, sendMail } from "../src/lib/mailer";
import {
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_MAX_PER_WINDOW,
  completePasswordReset,
  loadResetToken,
  registerResetFailure,
  requestPasswordReset,
} from "../src/lib/password-reset";

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

const SANDI_LAMA = "SandiLama2026aman";
const SANDI_BARU = "KreditBaru2026aman";

/** Menyetel variabel lingkungan (NODE_ENV bersifat read-only pada tipe proyek ini). */
function setEnv(kunci: string, nilai: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (nilai === undefined) delete env[kunci];
  else env[kunci] = nilai;
}

async function hapusAkunUji(userId: string) {
  await db.passwordResetToken.deleteMany({ where: { userId } });
  await db.auditLog.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: userId } });
}

async function main() {
  const outbox = path.join(tmpdir(), "bpr-mail-uji");
  await fs.rm(outbox, { recursive: true, force: true });

  // -------------------------------------------------------------------------
  // 1. Token
  // -------------------------------------------------------------------------
  const { token: contohToken, tokenHash: contohHash } = createHashedToken();
  check("token 32 byte (64 karakter heksadesimal)", /^[0-9a-f]{64}$/.test(contohToken), contohToken.length.toString());
  check("hash tersimpan berupa sha256 heksadesimal", /^[0-9a-f]{64}$/.test(contohHash));
  check("token asli tidak sama dengan hash tersimpan", contohToken !== contohHash);
  check("token cocok dengan hash-nya", tokenMatches(contohToken, contohHash));
  check("token lain tidak cocok", !tokenMatches(createHashedToken().token, contohHash));
  check("hash bersifat deterministik", hashToken(contohToken) === contohHash);

  // -------------------------------------------------------------------------
  // 2. Pemilihan transport
  // -------------------------------------------------------------------------
  const simpanEnv = { ...process.env };
  delete process.env.MAIL_TRANSPORT;
  delete process.env.SMTP_HOST;
  check("tanpa SMTP & tanpa MAIL_TRANSPORT -> tidak ada transport", mailTransportName() === "none");

  process.env.MAIL_TRANSPORT = "file";
  check("MAIL_TRANSPORT=file di non-produksi -> transport file", mailTransportName() === "file");

  setEnv("NODE_ENV", "production");
  check("MAIL_TRANSPORT=file DITOLAK di produksi", mailTransportName() === "none");
  setEnv("NODE_ENV", simpanEnv.NODE_ENV);

  delete process.env.MAIL_TRANSPORT;
  process.env.SMTP_HOST = "smtp.contoh.internal";
  delete process.env.MAIL_FROM;
  check("SMTP_HOST diisi -> transport smtp", mailTransportName() === "smtp");
  const tanpaFrom = await sendMail({ to: "tak-ada@contoh.internal", subject: "uji", text: "uji" });
  check(
    "SMTP tanpa MAIL_FROM ditolak tanpa melempar",
    tanpaFrom.sent === false && /MAIL_FROM/.test(tanpaFrom.error ?? ""),
    tanpaFrom.error
  );
  restore(simpanEnv);

  // -------------------------------------------------------------------------
  // 3. Akun uji + permintaan tautan
  // -------------------------------------------------------------------------
  const org = await db.organization.findFirstOrThrow({ select: { id: true } });
  const email = "uji-reset-sandi@bpr-uji.internal";
  const lama = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (lama) await hapusAkunUji(lama.id);

  const user = await db.user.create({
    data: {
      organizationId: org.id,
      email,
      fullName: "Uji Reset Sandi",
      isActive: true,
      passwordHash: await hashPassword(SANDI_LAMA),
    },
    select: { id: true },
  });

  // Email tidak terdaftar: jawaban tetap "tidak dikirim" (anti-enumerasi ditangani rute).
  process.env.MAIL_TRANSPORT = "file";
  process.env.MAIL_OUTBOX_DIR = outbox;

  const bukanAkun = await requestPasswordReset("tidak-ada@bpr-uji.internal");
  check("email tak terdaftar -> no_account", bukanAkun.requested === false && bukanAkun.reason === "no_account");

  const akunNonaktif = await db.user.create({
    data: { organizationId: org.id, email: "uji-reset-nonaktif@bpr-uji.internal", fullName: "Nonaktif", isActive: false },
    select: { id: true },
  });
  const nonaktif = await requestPasswordReset("uji-reset-nonaktif@bpr-uji.internal");
  check("akun nonaktif -> inactive", nonaktif.requested === false && nonaktif.reason === "inactive");
  await db.user.delete({ where: { id: akunNonaktif.id } });

  const permintaan1 = await requestPasswordReset(email, { ip: "127.0.0.9" });
  check("permintaan tautan terkirim lewat transport file", permintaan1.requested === true, permintaan1.reason);

  const berkas = await fs.readdir(outbox);
  const isiSurat = await fs.readFile(path.join(outbox, berkas[0]), "utf8");
  const cocok = isiSurat.match(/reset-password\?token=([0-9a-f]{64})/);
  check("surat memuat tautan reset", Boolean(cocok));
  const token1 = cocok?.[1] ?? "";

  const baris = await db.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null },
    select: { id: true, tokenHash: true, expiresAt: true },
  });
  check("hash token tersimpan, nilai asli TIDAK tersimpan", baris?.tokenHash === hashToken(token1) && baris?.tokenHash !== token1);
  const sisaMenit = baris ? Math.round((baris.expiresAt.getTime() - Date.now()) / 60000) : -1;
  check("masa berlaku tautan sekitar 30 menit", sisaMenit >= 28 && sisaMenit <= 30, `${sisaMenit} menit`);

  // Tautan lama hangus saat tautan baru diminta.
  const permintaan2 = await requestPasswordReset(email);
  check("permintaan tautan berikutnya diterima", permintaan2.requested === true);
  const stateToken1 = await loadResetToken(token1);
  check("tautan lama hangus setelah tautan baru dibuat", stateToken1.status === "used", stateToken1.status);

  // -------------------------------------------------------------------------
  // 4. Pemeriksaan tautan
  // -------------------------------------------------------------------------
  check("token tak dikenal -> unknown", (await loadResetToken("a".repeat(64))).status === "unknown");
  check("token kosong -> unknown", (await loadResetToken("")).status === "unknown");

  const berkasSemua = (await fs.readdir(outbox)).sort();
  const suratTerakhir = await fs.readFile(path.join(outbox, berkasSemua[berkasSemua.length - 1]), "utf8");
  const token2 = suratTerakhir.match(/reset-password\?token=([0-9a-f]{64})/)?.[1] ?? "";
  const stateToken2 = await loadResetToken(token2);
  check("tautan terbaru sah", stateToken2.status === "ok" && stateToken2.context?.email === email);

  // Kedaluwarsa.
  await db.passwordResetToken.update({ where: { id: stateToken2.tokenId! }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check("tautan kedaluwarsa ditolak", (await loadResetToken(token2)).status === "expired");
  await db.passwordResetToken.update({
    where: { id: stateToken2.tokenId! },
    data: { expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  });

  // -------------------------------------------------------------------------
  // 5. Penetapan sandi
  // -------------------------------------------------------------------------
  const sandiLemah = await completePasswordReset(token2, "admin123");
  check("sandi lemah ditolak oleh kebijakan", sandiLemah.ok === false && sandiLemah.status === "policy", JSON.stringify(sandiLemah));
  const belumBerubah = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  check("hash sandi belum berubah setelah penolakan", (await verifyPassword(SANDI_LAMA, belumBerubah?.passwordHash)).ok);

  const sandiSama = await completePasswordReset(token2, SANDI_LAMA);
  check("sandi baru tidak boleh sama dengan sandi lama", sandiSama.ok === false && sandiSama.status === "same_password");

  const sukses = await completePasswordReset(token2, SANDI_BARU, { ip: "127.0.0.9" });
  check("penetapan sandi baru berhasil", sukses.ok === true, JSON.stringify(sukses));

  const setelah = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, passwordChangedAt: true, failedLoginAttempts: true, lockedUntil: true },
  });
  check("sandi lama tidak berlaku lagi", !(await verifyPassword(SANDI_LAMA, setelah?.passwordHash)).ok);
  check("sandi baru dapat diverifikasi", (await verifyPassword(SANDI_BARU, setelah?.passwordHash)).ok);
  check("hash bcrypt (bukan teks polos)", /^\$2[aby]?\$12\$/.test(setelah?.passwordHash ?? ""));
  check("passwordChangedAt diperbarui (sesi lama gugur)", Boolean(setelah?.passwordChangedAt));
  check("penghitung gagal login disetel ulang", setelah?.failedLoginAttempts === 0 && setelah?.lockedUntil === null);

  check("tautan hangus setelah dipakai", (await loadResetToken(token2)).status === "used");
  const pakaiUlang = await completePasswordReset(token2, "SandiKetiga2026aman");
  check("tautan tidak dapat dipakai dua kali", pakaiUlang.ok === false && pakaiUlang.status === "used");

  // Akun terkunci: reset harus membukanya.
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
  });
  const permintaanBuka = await requestPasswordReset(email);
  const berkas3 = (await fs.readdir(outbox)).sort();
  const token3 = (await fs.readFile(path.join(outbox, berkas3[berkas3.length - 1]), "utf8")).match(
    /reset-password\?token=([0-9a-f]{64})/
  )?.[1] ?? "";
  check("tautan untuk akun terkunci tetap dibuat", permintaanBuka.requested === true && token3.length === 64);
  const bukaKunci = await completePasswordReset(token3, "SandiKeempat2026aman");
  const setelahBuka = await db.user.findUnique({
    where: { id: user.id },
    select: { failedLoginAttempts: true, lockedUntil: true },
  });
  check(
    "reset membuka kunci akun",
    bukaKunci.ok === true && setelahBuka?.failedLoginAttempts === 0 && setelahBuka?.lockedUntil === null
  );

  // Batas permintaan per akun: riwayat dibersihkan dulu agar tidak mengganggu.
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const hasilPermintaan: boolean[] = [];
  for (let i = 0; i < PASSWORD_RESET_MAX_PER_WINDOW; i += 1) {
    hasilPermintaan.push((await requestPasswordReset(email)).requested);
  }
  check(
    `${PASSWORD_RESET_MAX_PER_WINDOW} permintaan pertama dalam satu jam diterima`,
    hasilPermintaan.every(Boolean),
    hasilPermintaan.join(",")
  );
  const kelebihan = await requestPasswordReset(email);
  check(
    `permintaan ke-${PASSWORD_RESET_MAX_PER_WINDOW + 1} dalam satu jam ditolak`,
    kelebihan.requested === false && kelebihan.reason === "rate_limited",
    kelebihan.reason
  );

  // Batas percobaan pada satu tautan.
  const berkas4 = (await fs.readdir(outbox)).sort();
  const token4 = (await fs.readFile(path.join(outbox, berkas4[berkas4.length - 1]), "utf8")).match(
    /reset-password\?token=([0-9a-f]{64})/
  )?.[1] ?? "";
  const state4 = await loadResetToken(token4);
  check("tautan terakhir masih sah sebelum uji batas percobaan", state4.status === "ok", state4.status);
  for (let i = 0; i < PASSWORD_RESET_MAX_ATTEMPTS; i += 1) {
    await registerResetFailure(state4.tokenId!);
  }
  check("tautan diblokir setelah batas percobaan", (await loadResetToken(token4)).status === "attempts_exhausted");

  // -------------------------------------------------------------------------
  // 6. Transport tanpa konfigurasi + audit
  // -------------------------------------------------------------------------
  restore(simpanEnv);
  delete process.env.MAIL_TRANSPORT;
  delete process.env.SMTP_HOST;
  // Riwayat tautan dibersihkan agar batas per akun tidak menutupi penyebab lain.
  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const tanpaTransport = await requestPasswordReset(email);
  check(
    "tanpa transport email -> permintaan dilaporkan gagal",
    tanpaTransport.requested === false && tanpaTransport.reason === "mail_unavailable"
  );
  const hidup = await db.passwordResetToken.count({ where: { userId: user.id, usedAt: null } });
  check("tautan dihanguskan bila email gagal terkirim", hidup === 0, `${hidup} tautan masih hidup`);

  const audit = await db.auditLog.findMany({ where: { userId: user.id }, select: { notes: true } });
  const catatan = audit.map((a) => a.notes ?? "").join(" | ");
  check("peristiwa reset tercatat di audit", /tautan reset kata sandi/i.test(catatan));
  check("audit memuat catatan penggantian sandi", /melalui tautan reset email/i.test(catatan));
  check("audit tidak memuat token atau sandi", !catatan.includes(token1) && !catatan.includes(SANDI_BARU) && !catatan.includes(SANDI_LAMA));

  await hapusAkunUji(user.id);
  await fs.rm(outbox, { recursive: true, force: true });

  console.log(`\n${pass}/${pass + fail} pemeriksaan lulus.`);
  if (fail > 0) process.exitCode = 1;
}

/** Mengembalikan variabel lingkungan yang diubah selama pengujian. */
function restore(simpanan: NodeJS.ProcessEnv) {
  for (const kunci of ["MAIL_TRANSPORT", "MAIL_FROM", "SMTP_HOST", "MAIL_OUTBOX_DIR", "NODE_ENV"]) {
    setEnv(kunci, simpanan[kunci]);
  }
}

main()
  .catch((error) => {
    console.error("Verifikasi gagal dijalankan:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
