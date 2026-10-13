/**
 * Verifikasi alur reset kata sandi (Tahap 1B-2) — uji perilaku sungguhan lewat HTTP.
 *
 * Membutuhkan server yang berjalan dengan transport email uji:
 *
 *   MAIL_TRANSPORT=file MAIL_OUTBOX_DIR="<dir kotak surat uji>" AUTH_SESSION_REVALIDATE_SECONDS=1 npm run dev
 *   MAIL_OUTBOX_DIR="<dir yang sama>" npm run verify:reset:live
 *
 * Skrip ini MEMBUAT akun uji sementara, mengujinya, lalu MENGHAPUS akun tersebut
 * beserta baris audit dan tautan resetnya. Tidak ada sandi/token yang dicetak.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();
const BASE = (process.env.AUTH_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_DOMAIN = "bpr-uji.internal";
const KOTAK_SURAT = process.env.MAIL_OUTBOX_DIR || "";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

class Jar {
  private store = new Map<string, string>();

  absorb(response: Response): void {
    const cookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie") || ""];

    for (const raw of cookies) {
      if (!raw) continue;
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === "" || value === "deleted") this.store.delete(name);
      else this.store.set(name, value);
    }
  }

  header(): string {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  hasSessionToken(): boolean {
    return [...this.store.keys()].some((k) => k.includes("session-token") && !k.includes("callback"));
  }
}

async function login(email: string, password: string, ip: string): Promise<{ jar: Jar; session: boolean }> {
  const jar = new Jar();
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-forwarded-for": ip, cookie: jar.header() } });
  jar.absorb(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip, cookie: jar.header() },
    body,
    redirect: "manual",
  });

  jar.absorb(response);
  return { jar, session: jar.hasSessionToken() };
}

async function sessionEmail(jar: Jar, ip: string): Promise<string | null> {
  const response = await fetch(`${BASE}/api/auth/session`, {
    headers: { "x-forwarded-for": ip, cookie: jar.header() },
  });
  const payload = (await response.json()) as { user?: { email?: string | null } | null };
  return payload?.user?.email ?? null;
}

interface Surat {
  berkas: string;
  to: string;
  subject: string;
  text: string;
}

/** Membaca seluruh surat di kotak surat uji. */
async function bacaSurat(): Promise<Surat[]> {
  const berkas = await fs.readdir(KOTAK_SURAT);
  const surat: Surat[] = [];
  for (const nama of berkas) {
    const isi = JSON.parse(await fs.readFile(path.join(KOTAK_SURAT, nama), "utf8")) as {
      to?: string;
      subject?: string;
      text?: string;
    };
    surat.push({ berkas: nama, to: isi.to ?? "", subject: isi.subject ?? "", text: isi.text ?? "" });
  }
  return surat;
}

function ambilToken(surat: Surat): string | null {
  return surat.text.match(/reset-password\?token=([0-9a-f]{64})/)?.[1] ?? null;
}

async function main(): Promise<void> {
  if (!KOTAK_SURAT) {
    console.log("LEWATI: MAIL_OUTBOX_DIR belum diisi. Jalankan sesuai petunjuk di kepala berkas ini.");
    process.exitCode = 1;
    return;
  }

  console.log(`Menguji ${BASE}\nKotak surat uji: ${KOTAK_SURAT}\n`);

  const reachable = await fetch(`${BASE}/login`).then((r) => r.status).catch(() => 0);
  if (reachable === 0) {
    console.log("LEWATI: server tidak berjalan. Jalankan `npm run dev` lebih dulu.");
    return;
  }

  await fs.rm(KOTAK_SURAT, { recursive: true, force: true });
  await fs.mkdir(KOTAK_SURAT, { recursive: true });

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error("Organisasi tidak ditemukan pada database.");

  const stamp = Date.now();
  const sandiLama = generateRandomPassword();
  const sandiBaru = generateRandomPassword();
  const email = `uji-reset-${stamp}@${TEST_DOMAIN}`;

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      fullName: "Uji Reset Kata Sandi",
      passwordHash: await hashPassword(sandiLama),
      passwordChangedAt: new Date(),
      isActive: true,
    },
    select: { id: true },
  });

  try {
    console.log("== 1. Sesi aktif sebelum reset (untuk uji pencabutan) ==");
    const ipSesi = `198.51.100.${10 + (stamp % 20)}`;
    const sesiAwal = await login(email, sandiLama, ipSesi);
    check("login awal berhasil", sesiAwal.session);
    check("sesi awal memuat email", (await sessionEmail(sesiAwal.jar, ipSesi)) === email);

    console.log("\n== 2. Jawaban seragam & waktu tanggapan seragam ==");
    const ipA = `198.51.100.${40 + (stamp % 20)}`;
    const mulaiAda = Date.now();
    const responAda = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipA },
      body: JSON.stringify({ email }),
    });
    const durasiAda = Date.now() - mulaiAda;
    const isiAda = await responAda.text();

    const ipB = `198.51.100.${60 + (stamp % 20)}`;
    const mulaiTidak = Date.now();
    const responTidak = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipB },
      body: JSON.stringify({ email: `tidak-ada-${stamp}@${TEST_DOMAIN}` }),
    });
    const durasiTidak = Date.now() - mulaiTidak;
    const isiTidak = await responTidak.text();

    check("permintaan untuk email terdaftar dijawab 200", responAda.status === 200, String(responAda.status));
    check("jawaban email terdaftar dan tidak terdaftar identik", isiAda === isiTidak, `${isiAda} vs ${isiTidak}`);
    check("jawaban tidak menyebut apakah email terdaftar", !/terdaftar|tidak ditemukan/i.test(isiAda.replace(/terdaftar sebagai akun staf/g, "")));
    check("waktu tanggapan email terdaftar disamakan (>=650ms)", durasiAda >= 650, `${durasiAda} ms`);
    check("waktu tanggapan email tak terdaftar disamakan (>=650ms)", durasiTidak >= 650, `${durasiTidak} ms`);
    check("selisih waktu kedua jawaban kecil", Math.abs(durasiAda - durasiTidak) <= 400, `${durasiAda} vs ${durasiTidak} ms`);

    console.log("\n== 3. Surat reset & pemeriksaan tautan ==");
    const surat = await bacaSurat();
    const suratReset = surat
      .filter((s) => s.to === email && /Reset Kata Sandi/i.test(s.subject))
      .sort((a, b) => a.berkas.localeCompare(b.berkas))
      .pop();
    check("surat reset terkirim ke alamat pengguna", Boolean(suratReset));
    const token = suratReset ? ambilToken(suratReset) : null;
    check("surat memuat tautan reset", Boolean(token));
    check("surat menyebut masa berlaku 30 menit", /30 menit/.test(suratReset?.text ?? ""));
    check("surat memuat alamat aplikasi", (suratReset?.text ?? "").includes(`${BASE}/reset-password`));

    const ipC = `198.51.100.${80 + (stamp % 20)}`;
    const periksaSah = await fetch(`${BASE}/api/auth/reset-password?token=${token}`, {
      headers: { "x-forwarded-for": ipC },
    });
    const isiSah = (await periksaSah.json()) as { valid?: boolean; emailMasked?: string };
    check("tautan sah dikenali API", isiSah.valid === true, JSON.stringify(isiSah));
    check(
      "email ditampilkan dalam bentuk tersamarkan",
      Boolean(isiSah.emailMasked && isiSah.emailMasked.includes("***") && isiSah.emailMasked.endsWith(`@${TEST_DOMAIN}`)),
      isiSah.emailMasked
    );

    const periksaPalsu = await fetch(`${BASE}/api/auth/reset-password?token=${"a".repeat(64)}`, {
      headers: { "x-forwarded-for": ipC },
    });
    const isiPalsu = (await periksaPalsu.json()) as { valid?: boolean; reason?: string };
    check("tautan palsu ditolak", isiPalsu.valid === false && isiPalsu.reason === "unknown", JSON.stringify(isiPalsu));

    const halamanSah = await fetch(`${BASE}/reset-password?token=${token}`, { headers: { "x-forwarded-for": ipC } });
    const isiHalamanSah = await halamanSah.text();
    check("halaman reset tampil untuk tautan sah", halamanSah.status === 200 && isiHalamanSah.includes("Atur Ulang Kata Sandi"));
    const halamanPalsu = await fetch(`${BASE}/reset-password?token=${"b".repeat(64)}`, {
      headers: { "x-forwarded-for": ipC },
    });
    const isiHalamanPalsu = await halamanPalsu.text();
    check("halaman reset menolak tautan palsu", isiHalamanPalsu.includes("Tautan Tidak Dapat Dipakai"));

    const halamanLogin = await fetch(`${BASE}/login`, { headers: { "x-forwarded-for": ipC } });
    check("halaman login memuat tautan lupa kata sandi", (await halamanLogin.text()).includes("Lupa kata sandi?"));

    const halamanLupa = await fetch(`${BASE}/forgot-password`, { headers: { "x-forwarded-for": ipC } });
    const isiHalamanLupa = await halamanLupa.text();
    check(
      "halaman lupa kata sandi dapat dibuka tanpa sesi",
      halamanLupa.status === 200 && isiHalamanLupa.includes("Lupa Kata Sandi"),
      String(halamanLupa.status)
    );

    console.log("\n== 4. Penetapan kata sandi baru ==");
    const ipD = `198.51.100.${100 + (stamp % 20)}`;
    const kirim = (sandi: string) =>
      fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ipD },
        body: JSON.stringify({ token, password: sandi }),
      });

    const lemah = await kirim("admin123");
    const isiLemah = (await lemah.json()) as { status?: string; message?: string };
    check("sandi lemah ditolak dengan pesan kebijakan", lemah.status === 400 && isiLemah.status === "policy", `${lemah.status} ${isiLemah.message}`);

    const sama = await kirim(sandiLama);
    const isiSama = (await sama.json()) as { status?: string };
    check("sandi lama ditolak sebagai sandi baru", sama.status === 400 && isiSama.status === "same_password");

    const sukses = await kirim(sandiBaru);
    const isiSukses = (await sukses.json()) as { status?: string; message?: string };
    check("sandi baru tersimpan", sukses.status === 200 && isiSukses.status === "ok", `${sukses.status} ${isiSukses.message}`);

    const ulang = await kirim(generateRandomPassword());
    check("tautan tidak dapat dipakai dua kali", ulang.status === 410, String(ulang.status));

    console.log("\n== 5. Efek pada sesi dan login ==");
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const sesiSetelah = await sessionEmail(sesiAwal.jar, ipSesi);
    check("sesi lama dicabut setelah sandi direset", sesiSetelah === null, String(sesiSetelah));

    const ipLoginA = `198.51.100.${130 + (stamp % 20)}`;
    const loginLama = await login(email, sandiLama, ipLoginA);
    check("sandi lama tidak dapat dipakai lagi", !loginLama.session);

    const ipLoginB = `198.51.100.${150 + (stamp % 20)}`;
    const loginBaru = await login(email, sandiBaru, ipLoginB);
    check("sandi baru dapat dipakai masuk", loginBaru.session);
    check("sesi baru memuat email yang benar", (await sessionEmail(loginBaru.jar, ipLoginB)) === email);

    console.log("\n== 6. Email pemberitahuan & audit ==");
    const suratPemberitahuan = (await bacaSurat()).find(
      (s) => s.to === email && /Kata Sandi Anda Telah Diubah/i.test(s.subject)
    );
    check("email pemberitahuan perubahan sandi terkirim", Boolean(suratPemberitahuan));

    const audit = await prisma.auditLog.findMany({ where: { userId: user.id }, select: { notes: true } });
    const catatan = audit.map((a) => a.notes ?? "").join(" | ");
    check("permintaan & penggantian sandi tercatat di audit", /tautan reset kata sandi/i.test(catatan) && /melalui tautan reset email/i.test(catatan));
    check("audit tidak memuat token atau sandi", !catatan.includes(token ?? "-") && !catatan.includes(sandiBaru) && !catatan.includes(sandiLama));

    console.log("\n== 7. Batas permintaan per akun & per IP ==");
    const ipE = `198.51.100.${170 + (stamp % 20)}`;
    const status: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const r = await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ipE },
        body: JSON.stringify({ email }),
      });
      status.push(r.status);
    }
    check("permintaan ke-6 dari satu IP ditolak (batas 5)", status[5] === 429, status.join(","));
    const tautanHidup = await prisma.passwordResetToken.count({ where: { userId: user.id, usedAt: null } });
    check("tautan tetap dibatasi per akun (maksimal 3 per jam)", tautanHidup <= 3, `${tautanHidup} tautan hidup`);
  } finally {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await fs.rm(KOTAK_SURAT, { recursive: true, force: true });
    console.log("\nAkun uji, tautan, audit, dan kotak surat uji dibersihkan.");
  }

  console.log(`\n${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Uji live gagal dijalankan:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
