/**
 * Verifikasi Tahap 1B (P0.1) — uji perilaku MFA sungguhan lewat HTTP.
 *
 * Membutuhkan server dev/produksi yang berjalan dan database yang dapat ditulis.
 * Skrip ini MEMBUAT akun uji sementara, mengujinya, lalu MENGHAPUS akun tersebut
 * beserta baris audit, tantangan, dan kode cadangannya.
 * Tidak ada sandi, rahasia TOTP, atau kode cadangan yang dicetak.
 *
 *   npm run dev          # terminal lain
 *   npm run verify:mfa:live
 */
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword } from "../src/lib/password";
import { MFA_CHALLENGE_MAX_ATTEMPTS, currentTimeStep, generateTotpNow } from "../src/lib/mfa";

/**
 * Menunggu sampai jendela waktu TOTP (30 detik) berganti.
 *
 * Diperlukan karena penjaga anti-replay memang menolak kode dari jendela yang
 * sudah dipakai login — jadi uji login berikutnya harus menunggu jendela baru,
 * bukan menganggap aplikasinya salah.
 */
async function tungguJendelaBaru(): Promise<void> {
  const awal = currentTimeStep();
  for (let i = 0; i < 40 && currentTimeStep() === awal; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

const prisma = new PrismaClient();
const BASE = (process.env.AUTH_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_DOMAIN = "bpr-uji.internal";

let checks = 0;
let failures = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

/** Cookie jar sederhana untuk mengikuti alur NextAuth. */
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

  reset(): void {
    this.store.clear();
  }
}

async function csrf(jar: Jar, ip: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-forwarded-for": ip, cookie: jar.header() } });
  jar.absorb(response);
  const { csrfToken } = (await response.json()) as { csrfToken: string };
  return csrfToken;
}

/** Langkah 1: verifikasi sandi lewat /api/auth/prelogin. */
async function prelogin(
  email: string,
  password: string,
  ip: string
): Promise<{ status: number; kind?: string; challengeToken?: string }> {
  const response = await fetch(`${BASE}/api/auth/prelogin`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => ({}))) as { status?: string; challengeToken?: string };
  return { status: response.status, kind: body.status, challengeToken: body.challengeToken };
}

/** Login tanpa MFA (provider "credentials"), seperti perilaku Tahap 1A. */
async function loginCredential(email: string, password: string, ip: string, jar = new Jar()) {
  const token = await csrf(jar, ip);
  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
      cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken: token, email, password, callbackUrl: `${BASE}/dashboard`, json: "true" }),
    redirect: "manual",
  });
  jar.absorb(response);
  return { sessionCookie: jar.hasSessionToken(), status: response.status, jar };
}

/** Langkah 2 MFA (provider "mfa"). */
async function loginMfa(challengeToken: string, code: string, ip: string, jar = new Jar()) {
  const token = await csrf(jar, ip);
  const response = await fetch(`${BASE}/api/auth/callback/mfa`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
      cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken: token,
      challengeToken,
      code,
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
    }),
    redirect: "manual",
  });
  jar.absorb(response);
  return { sessionCookie: jar.hasSessionToken(), status: response.status, jar };
}

async function sessionEmail(jar: Jar, ip: string): Promise<string | null> {
  const response = await fetch(`${BASE}/api/auth/session`, {
    headers: { "x-forwarded-for": ip, cookie: jar.header() },
  });
  const payload = (await response.json()) as { user?: { email?: string | null } | null };
  return payload?.user?.email ?? null;
}

/** Memanggil API ber-izin untuk memeriksa gerbang wajib-MFA. */
async function probeApi(jar: Jar, ip: string): Promise<{ status: number; code?: string; body: string }> {
  const response = await fetch(`${BASE}/api/users`, { headers: { "x-forwarded-for": ip, cookie: jar.header() } });
  const body = await response.text();
  let code: string | undefined;
  try {
    code = (JSON.parse(body) as { code?: string }).code;
  } catch {
    code = undefined;
  }
  return { status: response.status, code, body };
}

async function bersihkan(userIds: string[]) {
  for (const id of userIds) {
    await prisma.mfaChallenge.deleteMany({ where: { userId: id } });
    await prisma.mfaBackupCode.deleteMany({ where: { userId: id } });
    await prisma.auditLog.deleteMany({ where: { userId: id } });
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
  }
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

  const adminRole = await prisma.role.findFirst({ where: { code: "ADMIN" }, select: { id: true, code: true } });
  if (!adminRole) throw new Error("Peran ADMIN tidak ditemukan pada database.");

  const peranLain = await prisma.role.findFirst({
    where: { code: { notIn: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, code: true },
  });

  const stamp = Date.now();
  const sandiAdmin = generateRandomPassword();
  const sandiStaf = generateRandomPassword();

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `uji-mfa-live-admin-${stamp}@${TEST_DOMAIN}`,
      fullName: `Uji MFA Admin ${stamp}`,
      passwordHash: await hashPassword(sandiAdmin),
      isActive: true,
      userRoles: { create: [{ roleId: adminRole.id }] },
    },
    select: { id: true, email: true },
  });

  const staf = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: `uji-mfa-live-staf-${stamp}@${TEST_DOMAIN}`,
      fullName: `Uji MFA Staf ${stamp}`,
      passwordHash: await hashPassword(sandiStaf),
      isActive: true,
      ...(peranLain ? { userRoles: { create: [{ roleId: peranLain.id }] } } : {}),
    },
    select: { id: true, email: true },
  });

  // Setiap kali dijalankan, uji ini memakai alamat IP uji sendiri. Alasannya:
  // pembatas laju login disimpan di memori proses server (10 percobaan / 5 menit
  // per IP), sehingga menjalankan uji berulang dari IP yang sama akan ikut
  // terhitung dan membuat uji gagal karena sebab yang tidak berkaitan.
  // Bagian yang banyak melakukan percobaan login sengaja memakai IP berbeda,
  // karena pembatas laju 10 percobaan/5 menit itu memang benar bekerja.
  const ipAcak = (benih: number) => `198.51.100.${(benih % 250) + 1}`;
  const ipAdmin = ipAcak(stamp);
  const ipAdmin2 = ipAcak(stamp + 41);
  const ipAdmin3 = ipAcak(stamp + 83);
  const ipStaf = ipAcak(stamp + 7);

  try {
    console.log("=== 1. Gerbang wajib-MFA sebelum pendaftaran ===");

    const loginAwal = await loginCredential(admin.email, sandiAdmin, ipAdmin);
    check("admin dapat login dengan sandi sebelum MFA aktif", loginAwal.sessionCookie);
    check("sesi admin mengenali emailnya", (await sessionEmail(loginAwal.jar, ipAdmin)) === admin.email);

    const apiSebelum = await probeApi(loginAwal.jar, ipAdmin);
    check("API ber-izin menolak admin yang belum mendaftar MFA", apiSebelum.status === 403, `status ${apiSebelum.status}`);
    check("penolakan memakai kode MFA_REQUIRED", apiSebelum.code === "MFA_REQUIRED", apiSebelum.code ?? apiSebelum.body.slice(0, 80));

    const halamanDasbor = await fetch(`${BASE}/dashboard`, {
      headers: { "x-forwarded-for": ipAdmin, cookie: loginAwal.jar.header() },
      redirect: "manual",
    });
    const lokasi = halamanDasbor.headers.get("location") ?? "";
    const isiDasbor = halamanDasbor.status === 200 ? await halamanDasbor.text() : "";
    check(
      "halaman dasbor mengalihkan ke /mfa/setup",
      lokasi.includes("/mfa/setup") || isiDasbor.includes("/mfa/setup"),
      `status ${halamanDasbor.status}${lokasi ? ` → ${lokasi}` : ""}`
    );

    const halamanSetup = await fetch(`${BASE}/mfa/setup`, {
      headers: { "x-forwarded-for": ipAdmin, cookie: loginAwal.jar.header() },
    });
    const isiSetup = await halamanSetup.text();
    check(
      "halaman /mfa/setup dapat dibuka oleh admin yang belum mendaftar",
      halamanSetup.status === 200 && isiSetup.includes("Autentikasi Dua Faktor"),
      `status ${halamanSetup.status}`
    );

    console.log("\n=== 2. Pendaftaran MFA lewat HTTP ===");

    const mulai = await fetch(`${BASE}/api/mfa/setup`, {
      method: "POST",
      headers: { "x-forwarded-for": ipAdmin, cookie: loginAwal.jar.header() },
    });
    const dataMulai = (await mulai.json()) as { secret?: string; uri?: string; qrDataUrl?: string; error?: string };
    check("pendaftaran MFA dimulai", mulai.status === 200 && Boolean(dataMulai.secret));
    check("URI otpauth berisi akun", Boolean(dataMulai.uri?.includes("otpauth://totp/")));
    check("gambar QR dihasilkan (data URL)", Boolean(dataMulai.qrDataUrl?.startsWith("data:image/png;base64,")));

    const secret = dataMulai.secret ?? "";
    if (!secret) {
      console.log("\nLEWATI: pendaftaran MFA tidak menghasilkan rahasia; sisa pengujian dilewati.");
      return;
    }
    const kodePendaftaran = await generateTotpNow(secret);

    const konfirmasiSalah = await fetch(`${BASE}/api/mfa/setup/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipAdmin, cookie: loginAwal.jar.header() },
      body: JSON.stringify({ code: "000000" }),
    });
    check("konfirmasi dengan kode salah ditolak", konfirmasiSalah.status === 400);

    const konfirmasi = await fetch(`${BASE}/api/mfa/setup/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipAdmin, cookie: loginAwal.jar.header() },
      body: JSON.stringify({ code: kodePendaftaran }),
    });
    const dataKonfirmasi = (await konfirmasi.json()) as { backupCodes?: string[]; error?: string };
    check("konfirmasi dengan kode benar berhasil", konfirmasi.status === 200, dataKonfirmasi.error);
    check("10 kode cadangan dikembalikan sekali", dataKonfirmasi.backupCodes?.length === 10);

    const statusMfa = await fetch(`${BASE}/api/mfa/status`, {
      headers: { "x-forwarded-for": ipAdmin, cookie: loginAwal.jar.header() },
    });
    const dataStatus = (await statusMfa.json()) as { enabled?: boolean; backupCodesRemaining?: number };
    check("status MFA aktif", dataStatus.enabled === true);
    check("kode cadangan tersisa 10", dataStatus.backupCodesRemaining === 10);

    const apiSesudah = await probeApi(loginAwal.jar, ipAdmin);
    check("gerbang wajib-MFA terbuka setelah pendaftaran", apiSesudah.code !== "MFA_REQUIRED", apiSesudah.code ?? apiSesudah.body.slice(0, 80));

    console.log("\n=== 3. Alur login dua langkah ===");

    const langkah1 = await prelogin(admin.email, sandiAdmin, ipAdmin);
    check("langkah 1 menjawab 'mfa'", langkah1.kind === "mfa", langkah1.kind);
    check("token tantangan diberikan", typeof langkah1.challengeToken === "string" && langkah1.challengeToken.length === 64);

    const sesiLangsung = await loginCredential(admin.email, sandiAdmin, ipAdmin);
    check("provider 'credentials' TIDAK membuat sesi untuk akun ber-MFA", !sesiLangsung.sessionCookie);

    const kodeSalah = await loginMfa(langkah1.challengeToken ?? "", "000000", ipAdmin);
    check("kode MFA salah ditolak", !kodeSalah.sessionCookie);

    const kodeBenar = await loginMfa(langkah1.challengeToken ?? "", await generateTotpNow(secret), ipAdmin);
    check("kode MFA benar menghasilkan sesi", kodeBenar.sessionCookie);
    check("sesi MFA mengenali emailnya", (await sessionEmail(kodeBenar.jar, ipAdmin)) === admin.email);

    const replay = await loginMfa(langkah1.challengeToken ?? "", await generateTotpNow(secret), ipAdmin);
    check("tantangan yang sudah dipakai ditolak", !replay.sessionCookie);

    console.log("\n=== 4. Anti replay kode TOTP ===");

    await tungguJendelaBaru();
    const t1 = await prelogin(admin.email, sandiAdmin, ipAdmin);
    const kodePakai = await generateTotpNow(secret);
    const pakaiPertama = await loginMfa(t1.challengeToken ?? "", kodePakai, ipAdmin);
    check("kode TOTP dapat dipakai pada login pertama", pakaiPertama.sessionCookie);

    const t2 = await prelogin(admin.email, sandiAdmin, ipAdmin);
    const pakaiKedua = await loginMfa(t2.challengeToken ?? "", kodePakai, ipAdmin);
    const masihJendelaSama = (await generateTotpNow(secret)) === kodePakai;
    if (masihJendelaSama) {
      check("kode TOTP yang sama ditolak pada login kedua (jendela sama)", !pakaiKedua.sessionCookie);
    } else {
      console.log("LEWATI: jendela waktu berganti saat pengujian, uji replay tidak dapat dijalankan.");
    }

    console.log("\n=== 5. Kode cadangan ===");

    const kodeCadangan = dataKonfirmasi.backupCodes ?? [];
    const t3 = await prelogin(admin.email, sandiAdmin, ipAdmin);
    const pakaiCadangan = await loginMfa(t3.challengeToken ?? "", kodeCadangan[0] ?? "", ipAdmin);
    check("login dengan kode cadangan berhasil", pakaiCadangan.sessionCookie);

    const t4 = await prelogin(admin.email, sandiAdmin, ipAdmin);
    const pakaiCadanganUlang = await loginMfa(t4.challengeToken ?? "", kodeCadangan[0] ?? "", ipAdmin);
    check("kode cadangan tidak bisa dipakai dua kali", !pakaiCadanganUlang.sessionCookie);

    const sisaCadangan = await prisma.mfaBackupCode.count({ where: { userId: admin.id, usedAt: null } });
    check("kode cadangan tersisa 9 di database", sisaCadangan === 9, String(sisaCadangan));

    console.log("\n=== 6. Batas percobaan kode ===");

    // Bagian ini melakukan 5 percobaan gagal + percobaan lanjutan, jadi memakai
    // alamat IP tersendiri agar tidak menyentuh batas 10 percobaan/5 menit.
    const t5 = await prelogin(admin.email, sandiAdmin, ipAdmin2);
    for (let i = 0; i < MFA_CHALLENGE_MAX_ATTEMPTS; i += 1) {
      await loginMfa(t5.challengeToken ?? "", "000000", ipAdmin2);
    }
    const lewatBatas = await loginMfa(t5.challengeToken ?? "", await generateTotpNow(secret), ipAdmin2);
    check("kode benar pun ditolak setelah batas percobaan terlampaui", !lewatBatas.sessionCookie);

    const catatanBatas = await prisma.auditLog.findFirst({
      where: { userId: admin.id, notes: { contains: "batas percobaan kode MFA" } },
      select: { id: true },
    });
    check("percobaan berlebih tercatat di audit", Boolean(catatanBatas));

    // Jendela waktu menunggu berganti: kode dari jendela yang sudah dipakai
    // memang ditolak oleh penjaga anti-replay.
    await tungguJendelaBaru();
    const t6 = await prelogin(admin.email, sandiAdmin, ipAdmin3);
    const tantanganBaru = await loginMfa(t6.challengeToken ?? "", await generateTotpNow(secret), ipAdmin3);
    check("login kembali berhasil setelah membuat tantangan baru", tantanganBaru.sessionCookie);

    console.log("\n=== 7. Nonaktifkan MFA ===");

    const nonaktifSalah = await fetch(`${BASE}/api/mfa/disable`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipAdmin3, cookie: tantanganBaru.jar.header() },
      body: JSON.stringify({ code: "000000" }),
    });
    check("nonaktifkan MFA dengan kode salah ditolak", nonaktifSalah.status === 400);

    const nonaktif = await fetch(`${BASE}/api/mfa/disable`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ipAdmin3, cookie: tantanganBaru.jar.header() },
      body: JSON.stringify({ code: kodeCadangan[1] ?? "" }),
    });
    check("nonaktifkan MFA dengan kode cadangan berhasil", nonaktif.status === 200);

    const setelahNonaktif = await prelogin(admin.email, sandiAdmin, ipAdmin3);
    check("setelah MFA nonaktif, langkah 1 menjawab 'ok'", setelahNonaktif.kind === "ok", setelahNonaktif.kind);

    console.log("\n=== 8. Akun tanpa MFA tetap seperti semula ===");

    const stafLangkah1 = await prelogin(staf.email, sandiStaf, ipStaf);
    check("staf non-MFA: langkah 1 menjawab 'ok'", stafLangkah1.kind === "ok", stafLangkah1.kind);
    const stafLogin = await loginCredential(staf.email, sandiStaf, ipStaf);
    check("staf non-MFA dapat login lewat provider 'credentials'", stafLogin.sessionCookie);

    const sandiSalah = await prelogin(staf.email, "SandiSalahSekali2026", ipStaf);
    check("sandi salah tetap ditolak dengan 'invalid'", sandiSalah.status === 401 && sandiSalah.kind === "invalid");
  } finally {
    await bersihkan([admin.id, staf.id]);
    console.log("\nAkun uji dan seluruh jejaknya dihapus.");
  }

  console.log(`\n${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Verifikasi gagal dijalankan:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
