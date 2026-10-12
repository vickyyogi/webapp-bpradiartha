/**
 * Verifikasi Tahap 1A (P0.1) — bagian 2: uji perilaku login sungguhan lewat HTTP.
 *
 * Membutuhkan server dev/produksi yang berjalan dan database yang dapat ditulis.
 * Skrip ini MEMBUAT akun uji sementara, mengujinya, lalu MENGHAPUS akun tersebut
 * beserta baris audit yang dihasilkannya. Tidak ada sandi yang dicetak.
 *
 *   AUTH_SESSION_REVALIDATE_SECONDS=1 npm run dev        # terminal lain
 *   npm run verify:auth:live
 */
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword, validatePasswordPolicy } from "../src/lib/password";
import { MAX_FAILED_ATTEMPTS } from "../src/lib/auth-lockout";

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

/** Cookie jar sederhana untuk mengikuti alur NextAuth. */
class Jar {
  private store = new Map<string, string>();

  absorb(response: Response): void {
    const cookies = typeof response.headers.getSetCookie === "function"
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

interface LoginResult {
  sessionCookie: boolean;
  status: number;
}

async function login(email: string, password: string, ip: string, jar = new Jar()): Promise<{ result: LoginResult; jar: Jar }> {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { "x-forwarded-for": ip, cookie: jar.header() },
  });
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
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
      cookie: jar.header(),
    },
    body,
    redirect: "manual",
  });

  jar.absorb(response);
  return { result: { sessionCookie: jar.hasSessionToken(), status: response.status }, jar };
}

async function sessionEmail(jar: Jar, ip: string): Promise<string | null> {
  const response = await fetch(`${BASE}/api/auth/session`, {
    headers: { "x-forwarded-for": ip, cookie: jar.header() },
  });
  const payload = (await response.json()) as { user?: { email?: string | null } | null };
  return payload?.user?.email ?? null;
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
  const password = generateRandomPassword();
  const newPassword = generateRandomPassword();
  if (!validatePasswordPolicy(password).ok || !validatePasswordPolicy(newPassword).ok) {
    throw new Error("Sandi uji tidak memenuhi kebijakan — ada masalah pada generateRandomPassword.");
  }

  const activeEmail = `uji-aktif-${stamp}@${TEST_DOMAIN}`;
  const inactiveEmail = `uji-nonaktif-${stamp}@${TEST_DOMAIN}`;
  const applicantEmail = `uji-pemohon-${stamp}@${TEST_DOMAIN}`;

  const created: string[] = [];

  try {
    const active = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: activeEmail,
        fullName: "Uji Autentikasi Aktif",
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        isActive: true,
      },
      select: { id: true },
    });
    created.push(active.id);

    const inactive = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: inactiveEmail,
        fullName: "Uji Autentikasi Nonaktif",
        passwordHash: await hashPassword(password),
        isActive: false,
      },
      select: { id: true },
    });
    created.push(inactive.id);

    const applicant = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: applicantEmail,
        fullName: "Uji Catatan Pemohon",
        passwordHash: null,
        isActive: false,
      },
      select: { id: true },
    });
    created.push(applicant.id);

    console.log("== 1. Login berhasil (sandi bcrypt) ==");
    const ipA = "203.0.113.10";
    const first = await login(activeEmail, password, ipA);
    check("login dengan sandi benar menghasilkan sesi", first.result.sessionCookie, `status ${first.result.status}`);
    check("sesi memuat email pengguna", (await sessionEmail(first.jar, ipA)) === activeEmail);

    const afterLogin = await prisma.user.findUnique({
      where: { id: active.id },
      select: { lastLoginAt: true, failedLoginAttempts: true },
    });
    check("waktu login terakhir dicatat", Boolean(afterLogin?.lastLoginAt));

    console.log("\n== 2. Sandi salah tidak menghasilkan sesi ==");
    const ipB = "203.0.113.20";
    const wrongOne = await login(activeEmail, `${password}-salah`, ipB);
    check("sandi salah ditolak", !wrongOne.result.sessionCookie, `status ${wrongOne.result.status}`);
    const afterWrong = await prisma.user.findUnique({
      where: { id: active.id },
      select: { failedLoginAttempts: true },
    });
    check("kegagalan login tercatat", (afterWrong?.failedLoginAttempts ?? 0) >= 1, String(afterWrong?.failedLoginAttempts));

    console.log("\n== 3. Penguncian akun & batas per IP ==");
    const ipC = "203.0.113.30";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      await login(activeEmail, `${password}-salah`, ipC);
    }
    const locked = await prisma.user.findUnique({
      where: { id: active.id },
      select: { failedLoginAttempts: true, lockedUntil: true },
    });
    check(
      `akun terkunci setelah ${MAX_FAILED_ATTEMPTS} kegagalan`,
      Boolean(locked?.lockedUntil && locked.lockedUntil.getTime() > Date.now()),
      `failed=${locked?.failedLoginAttempts}`
    );

    const correctWhileLocked = await login(activeEmail, password, ipC);
    check("sandi benar tetap ditolak saat akun terkunci", !correctWhileLocked.result.sessionCookie);

    // Lanjutkan sampai melewati batas per IP (10 percobaan / 5 menit).
    for (let i = 0; i < 8; i += 1) {
      await login(activeEmail, `${password}-salah`, ipC);
    }
    const ipLimitLog = await prisma.auditLog.findFirst({
      where: { userId: active.id, notes: { contains: "batas percobaan per IP" } },
      select: { id: true, notes: true },
    });
    check("batas percobaan per IP tercatat pada audit", Boolean(ipLimitLog), ipLimitLog?.notes ?? "tidak ada baris audit");

    console.log("\n== 4. Buka kunci & login ulang ==");
    await prisma.user.update({
      where: { id: active.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    const ipD = "203.0.113.40";
    const afterUnlock = await login(activeEmail, password, ipD);
    check("login berhasil setelah kunci dibuka", afterUnlock.result.sessionCookie);

    console.log("\n== 5. Pencabutan sesi (akun dinonaktifkan & sandi berubah) ==");
    await prisma.user.update({ where: { id: active.id }, data: { isActive: false } });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const revokedByDeactivation = await sessionEmail(afterUnlock.jar, ipD);
    check("sesi dicabut setelah akun dinonaktifkan", revokedByDeactivation === null, String(revokedByDeactivation));

    await prisma.user.update({ where: { id: active.id }, data: { isActive: true } });
    const ipE = "203.0.113.50";
    const second = await login(activeEmail, password, ipE);
    check("login ulang setelah akun diaktifkan kembali", second.result.sessionCookie);

    await prisma.user.update({
      where: { id: active.id },
      data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() },
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const revokedByPasswordChange = await sessionEmail(second.jar, ipE);
    check("sesi lama dicabut setelah sandi diganti", revokedByPasswordChange === null, String(revokedByPasswordChange));

    const loginOldPassword = await login(activeEmail, password, "203.0.113.60");
    check("sandi lama tidak berlaku lagi", !loginOldPassword.result.sessionCookie);
    const loginNewPassword = await login(activeEmail, newPassword, "203.0.113.70");
    check("sandi baru berlaku", loginNewPassword.result.sessionCookie);

    console.log("\n== 6. Akun nonaktif & catatan pemohon tidak dapat login ==");
    const inactiveAttempt = await login(inactiveEmail, password, "203.0.113.80");
    check("akun nonaktif ditolak", !inactiveAttempt.result.sessionCookie);

    const applicantAttempt = await login(applicantEmail, password, "203.0.113.90");
    check("catatan pemohon tanpa sandi ditolak", !applicantAttempt.result.sessionCookie);
    const applicantRow = await prisma.user.findUnique({
      where: { id: applicant.id },
      select: { failedLoginAttempts: true },
    });
    check("percobaan pada catatan pemohon tidak dihitung sebagai kegagalan sandi", (applicantRow?.failedLoginAttempts ?? 0) === 0);

    console.log("\n== 7. Email tidak terdaftar ==");
    const unknownAttempt = await login(`tidak-ada-${stamp}@${TEST_DOMAIN}`, password, "203.0.113.100");
    check("email tidak terdaftar ditolak", !unknownAttempt.result.sessionCookie);

    const loginAudits = await prisma.auditLog.count({
      where: { entityType: "USER", action: "LOGIN", userId: { in: created } },
    });
    check("percobaan login tercatat pada audit", loginAudits > 0, `${loginAudits} baris`);

    const leaked = await prisma.auditLog.findFirst({
      where: {
        userId: { in: created },
        OR: [{ notes: { contains: password } }, { notes: { contains: newPassword } }],
      },
      select: { id: true },
    });
    check("tidak ada sandi yang bocor ke audit/log", leaked === null);
  } finally {
    // Bersihkan seluruh jejak akun uji (audit lebih dulu karena ada relasi ke users).
    if (created.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: created } } });
      await prisma.user.deleteMany({ where: { id: { in: created } } });
      console.log(`\nAkun uji dibersihkan: ${created.length} akun beserta baris auditnya.`);
    }
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
