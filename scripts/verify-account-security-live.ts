/**
 * Verifikasi keamanan akun (Tahap 1B-3) — uji perilaku sungguhan lewat HTTP.
 *
 * Membutuhkan server yang berjalan:
 *   AUTH_SESSION_REVALIDATE_SECONDS=1 npm run dev
 *   npm run verify:account:live
 *
 * Skrip ini MEMBUAT akun uji sementara, mengujinya, lalu MENGHAPUS akun tersebut
 * beserta baris auditnya. Tidak ada sandi yang dicetak.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword, validatePasswordPolicy } from "../src/lib/password";

const prisma = new PrismaClient();
const BASE = (process.env.AUTH_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_DOMAIN = "bpr-uji.internal";

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

/** GET API berizin; mengembalikan status + kode galat bila ada. */
async function apiBerizin(jar: Jar, ip: string): Promise<{ status: number; code: string | null }> {
  const response = await fetch(`${BASE}/api/users`, {
    headers: { "x-forwarded-for": ip, cookie: jar.header() },
    redirect: "manual",
  });
  const teks = await response.text();
  const code = teks.match(/"code"\s*:\s*"([A-Z_]+)"/)?.[1] ?? null;
  return { status: response.status, code };
}

async function main(): Promise<void> {
  console.log(`Menguji ${BASE}\n`);

  const reachable = await fetch(`${BASE}/login`).then((r) => r.status).catch(() => 0);
  if (reachable === 0) {
    console.log("LEWATI: server tidak berjalan. Jalankan `npm run dev` lebih dulu.");
    return;
  }

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error("Organisasi tidak ditemukan pada database.");

  const stamp = Date.now();
  const sandiLamaLemah = "bpr2024"; // 8 karakter: tidak memenuhi kebijakan, tetapi bukan sandi default statis
  const sandiBaru = generateRandomPassword();
  const email = `uji-keamanan-${stamp}@${TEST_DOMAIN}`;

  if (!validatePasswordPolicy(sandiBaru).ok) throw new Error("Sandi uji baru tidak memenuhi kebijakan.");

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      fullName: "Uji Keamanan Akun",
      passwordHash: await bcrypt.hash(sandiLamaLemah, 10), // hash lama ber-cost rendah
      isActive: true,
    },
    select: { id: true },
  });

  try {
    console.log("== 1. Login dengan sandi lama lemah -> akun ditandai wajib ganti ==");
    const ipA = `192.0.2.${10 + (stamp % 20)}`;
    const masuk = await login(email, sandiLamaLemah, ipA);
    check("login tetap berhasil (tidak dikunci karena kebijakan)", masuk.session);

    const ditandai = await prisma.user.findUnique({ where: { id: user.id }, select: { mustChangePassword: true } });
    check("akun ditandai wajib ganti sandi", ditandai?.mustChangePassword === true, String(ditandai?.mustChangePassword));

    console.log("\n== 2. Gerbang API & halaman dasbor ==");
    const gerbang = await apiBerizin(masuk.jar, ipA);
    check("API berizin ditolak 403 PASSWORD_CHANGE_REQUIRED", gerbang.status === 403 && gerbang.code === "PASSWORD_CHANGE_REQUIRED", `${gerbang.status} ${gerbang.code}`);

    const dasbor = await fetch(`${BASE}/dashboard`, {
      headers: { "x-forwarded-for": ipA, cookie: masuk.jar.header() },
      redirect: "manual",
    });
    check("halaman dasbor mengalihkan ke /account/password", dasbor.status === 307 && (dasbor.headers.get("location") || "").includes("/account/password"), `${dasbor.status} ${dasbor.headers.get("location")}`);

    const halaman = await fetch(`${BASE}/account/password`, {
      headers: { "x-forwarded-for": ipA, cookie: masuk.jar.header() },
    });
    const isiHalaman = await halaman.text();
    check("halaman Keamanan Akun dapat dibuka", halaman.status === 200, String(halaman.status));
    check("halaman menampilkan kebijakan kata sandi", isiHalaman.includes("Kebijakan kata sandi"));
    check("halaman menampilkan peringatan wajib ganti", /tidak memenuhi kebijakan keamanan/i.test(isiHalaman));
    check("halaman menyediakan aksi keluar dari semua perangkat", isiHalaman.includes("Keluar dari Semua Perangkat"));

    console.log("\n== 3. Penolakan ganti sandi ==");
    const ipB = `192.0.2.${40 + (stamp % 20)}`;
    const ganti = (body: unknown, jar: Jar, ip: string) =>
      fetch(`${BASE}/api/account/password`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip, cookie: jar.header() },
        body: JSON.stringify(body),
      });

    const salah = await ganti({ currentPassword: `${sandiLamaLemah}-salah`, newPassword: sandiBaru }, masuk.jar, ipB);
    const isiSalah = (await salah.json()) as { status?: string };
    check("sandi saat ini salah ditolak", salah.status === 400 && isiSalah.status === "invalid_current", `${salah.status} ${isiSalah.status}`);

    const lemah = await ganti({ currentPassword: sandiLamaLemah, newPassword: "admin123" }, masuk.jar, ipB);
    const isiLemah = (await lemah.json()) as { status?: string };
    check("sandi baru lemah ditolak kebijakan", lemah.status === 400 && isiLemah.status === "policy", `${lemah.status} ${isiLemah.status}`);

    const sama = await ganti({ currentPassword: sandiLamaLemah, newPassword: sandiLamaLemah }, masuk.jar, ipB);
    const isiSama = (await sama.json()) as { status?: string };
    check("sandi baru sama dengan lama ditolak", sama.status === 400 && isiSama.status === "same_password", `${sama.status} ${isiSama.status}`);

    const masihTerkunci = await apiBerizin(masuk.jar, ipB);
    check("gerbang tetap menutup setelah percobaan gagal", masihTerkunci.code === "PASSWORD_CHANGE_REQUIRED");

    console.log("\n== 4. Ganti sandi berhasil ==");
    const sukses = await ganti({ currentPassword: sandiLamaLemah, newPassword: sandiBaru }, masuk.jar, ipB);
    const isiSukses = (await sukses.json()) as { status?: string; message?: string };
    check("kata sandi berhasil diganti", sukses.status === 200 && isiSukses.status === "ok", `${sukses.status} ${isiSukses.status}`);

    const setelah = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mustChangePassword: true, passwordChangedAt: true, passwordHash: true },
    });
    check("penanda wajib ganti dibersihkan", setelah?.mustChangePassword === false);
    check("hash bcrypt cost produksi tersimpan", /^\$2[aby]?\$12\$/.test(setelah?.passwordHash ?? ""));
    check("waktu perubahan sandi diperbarui", Boolean(setelah?.passwordChangedAt));

    await new Promise((resolve) => setTimeout(resolve, 2500));
    check("sesi lama dicabut setelah sandi diganti", (await sessionEmail(masuk.jar, ipA)) === null);

    const ipC = `192.0.2.${70 + (stamp % 20)}`;
    const loginLama = await login(email, sandiLamaLemah, ipC);
    check("sandi lama tidak berlaku lagi", !loginLama.session);

    const ipD = `192.0.2.${90 + (stamp % 20)}`;
    const loginBaru = await login(email, sandiBaru, ipD);
    check("sandi baru dapat dipakai masuk", loginBaru.session);

    const gerbangTerbuka = await apiBerizin(loginBaru.jar, ipD);
    check(
      "gerbang wajib-ganti tidak lagi menutup",
      gerbangTerbuka.code !== "PASSWORD_CHANGE_REQUIRED",
      `${gerbangTerbuka.status} ${gerbangTerbuka.code}`
    );

    console.log("\n== 5. Keluar dari semua perangkat ==");
    const ipE = `192.0.2.${110 + (stamp % 20)}`;
    const sesiKedua = await login(email, sandiBaru, ipE);
    check("sesi kedua (perangkat lain) terbentuk", sesiKedua.session);
    check("kedua sesi sah sebelum pencabutan", (await sessionEmail(loginBaru.jar, ipD)) === email && (await sessionEmail(sesiKedua.jar, ipE)) === email);

    const keluarSemua = await fetch(`${BASE}/api/account/logout-all`, {
      method: "POST",
      headers: { "x-forwarded-for": ipD, cookie: loginBaru.jar.header() },
    });
    const isiKeluar = (await keluarSemua.json()) as { status?: string };
    check("permintaan keluar dari semua perangkat diterima", keluarSemua.status === 200 && isiKeluar.status === "ok", `${keluarSemua.status} ${isiKeluar.status}`);

    await new Promise((resolve) => setTimeout(resolve, 2500));
    check("sesi pemanggil ikut dicabut", (await sessionEmail(loginBaru.jar, ipD)) === null);
    check("sesi perangkat lain dicabut", (await sessionEmail(sesiKedua.jar, ipE)) === null);

    const sandiMasihBerlaku = await login(email, sandiBaru, `192.0.2.${130 + (stamp % 20)}`);
    check("sandi TIDAK berubah setelah keluar dari semua perangkat", sandiMasihBerlaku.session);

    console.log("\n== 6. Audit ==");
    const audit = await prisma.auditLog.findMany({ where: { userId: user.id }, select: { notes: true } });
    const catatan = audit.map((a) => a.notes ?? "").join(" | ");
    check("pengingkaran hash sandi lemah tercatat sebagai wajib diganti", /wajib diganti/i.test(catatan));
    check("penggantian sandi tercatat", /melalui halaman Keamanan Akun/i.test(catatan));
    check("pencabutan semua sesi tercatat", /seluruh sesi perangkat dikeluarkan/i.test(catatan));
    check("audit tidak memuat sandi apa pun", !catatan.includes(sandiBaru) && !catatan.includes(sandiLamaLemah));
  } finally {
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log("\nAkun uji beserta baris auditnya dibersihkan.");
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
