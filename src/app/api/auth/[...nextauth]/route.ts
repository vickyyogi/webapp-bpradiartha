import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { burnPasswordTime, hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/password";
import {
  checkLoginIpRate,
  isAccountLocked,
  readClientIp,
  registerFailedLogin,
  registerSuccessfulLogin,
} from "@/lib/auth-lockout";
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_REVALIDATE_AFTER_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/lib/auth-config";

/**
 * Autentikasi — Tahap 1A (P0.1).
 *
 * Perubahan dari versi lama (yang membandingkan sandi teks polos):
 * - Sandi diverifikasi dengan bcrypt; nilai lama yang masih teks polos otomatis diganti hash
 *   saat login berhasil (jaring pengaman bila backfill terlewat).
 * - Akun dengan passwordHash NULL (mis. pemohon/debitur) tidak dapat login.
 * - Akun nonaktif ditolak SEBELUM sesi dibuat (sebelumnya baru ditolak pada request berikutnya).
 * - Akun terkunci (locked_until) ditolak walau sandinya benar.
 * - Pembatas laju per IP + pencatatan kegagalan berulang per akun.
 * - Sesi berlaku 8 jam dan diperiksa ulang ke database setiap 5 menit, sehingga penonaktifan
 *   akun atau penggantian sandi mencabut sesi yang masih berjalan.
 * - Tidak ada nilai sandi yang pernah ditulis ke console, log, atau audit.
 */

function readHeaderValue(headers: unknown, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const bag = headers as Record<string, unknown>;
  const value = bag[name] ?? bag[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

const AUTH_AUDIT_NOTES = {
  SUCCESS: "Login berhasil",
  WRONG_PASSWORD: "Login gagal: kata sandi salah",
  STATIC_DEFAULT: "Login ditolak: akun masih memakai kata sandi default statis",
  UNKNOWN_EMAIL: "Login gagal: email tidak terdaftar",
  INACTIVE: "Login ditolak: akun tidak aktif",
  LOCKED: "Login ditolak: akun terkunci sementara",
  RATE_LIMITED: "Login ditolak: batas percobaan per IP terlampaui",
  NO_PASSWORD: "Login ditolak: akun tidak memiliki kata sandi (bukan akun pegawai)",
  UPGRADED: "Kata sandi ditingkatkan ke hash bcrypt saat login",
  UPGRADED_WEAK_POLICY: "Kata sandi lama di-hash ulang; wajib diganti (tidak memenuhi kebijakan baru)",
} as const;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@bpr.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const headers = (req as unknown as { headers?: unknown } | undefined)?.headers;
        const ip = readClientIp(headers);
        const userAgent = readHeaderValue(headers, "user-agent");

        // Lapis 1: pembatas laju per IP. Diperiksa SEBELUM pencarian akun supaya percobaan
        // ke email yang tidak terdaftar (penyemprotan/enumerasi) pun ikut dibatasi.
        const ipRate = checkLoginIpRate(ip);

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            organizationId: true,
            email: true,
            fullName: true,
            passwordHash: true,
            isActive: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            passwordChangedAt: true,
          },
        });

        // Email tidak terdaftar: tetap habiskan waktu setara verifikasi bcrypt agar
        // penyerang tidak dapat membedakannya lewat selisih waktu respons.
        if (!user) {
          await burnPasswordTime(password);
          console.warn(
            `[auth] ${AUTH_AUDIT_NOTES.UNKNOWN_EMAIL} — ip=${ip}${ipRate.allowed ? "" : " (batas per IP terlampaui)"}`
          );
          return null;
        }

        const writeAudit = (notes: string, extra?: Record<string, unknown>) =>
          logAudit({
            organizationId: user.organizationId,
            userId: user.id,
            action: "LOGIN",
            entityType: "USER",
            entityId: user.id,
            newValues: extra,
            ipAddress: ip,
            userAgent,
            notes,
          });

        // Lapis 1 (lanjutan): batas per IP terlampaui => tolak sebelum memeriksa sandi.
        if (!ipRate.allowed) {
          await writeAudit(`${AUTH_AUDIT_NOTES.RATE_LIMITED} (retry ${ipRate.retryAfterSeconds}s)`);
          return null;
        }

        // Lapis 2: penguncian akun berbasis database.
        if (isAccountLocked(user)) {
          await writeAudit(AUTH_AUDIT_NOTES.LOCKED);
          return null;
        }

        if (!user.isActive) {
          await writeAudit(AUTH_AUDIT_NOTES.INACTIVE);
          return null;
        }

        // Akun tanpa sandi (catatan pemohon/debitur) tidak pernah bisa login, dan tidak
        // dihitung sebagai kegagalan sandi karena memang bukan akun pengguna.
        if (!user.passwordHash) {
          await burnPasswordTime(password);
          await writeAudit(AUTH_AUDIT_NOTES.NO_PASSWORD);
          return null;
        }

        const verification = await verifyPassword(password, user.passwordHash);

        if (!verification.ok) {
          const state = await registerFailedLogin(user.id);
          await writeAudit(
            verification.reason === "static_default" ? AUTH_AUDIT_NOTES.STATIC_DEFAULT : AUTH_AUDIT_NOTES.WRONG_PASSWORD,
            { failedLoginAttempts: state.failedLoginAttempts, locked: state.locked }
          );
          return null;
        }

        // Sandi benar. Bila nilai lama masih teks polos (atau hash lama ber-cost rendah),
        // ganti sekarang juga supaya tidak ada teks polos yang tertinggal.
        let passwordChangedAt = user.passwordChangedAt;
        if (verification.needsUpgrade) {
          const upgraded = await hashPassword(password);
          const policy = validatePasswordPolicy(password, { email: user.email });

          if (policy.ok) {
            passwordChangedAt = new Date();
            await db.user.update({
              where: { id: user.id },
              data: { passwordHash: upgraded, passwordChangedAt },
            });
            await writeAudit(AUTH_AUDIT_NOTES.UPGRADED);
          } else {
            // Tetap di-hash agar tidak ada teks polos tersisa, tetapi pengguna wajib
            // menggantinya (dicatat untuk tindak lanjut; tidak memblokir login).
            await db.user.update({
              where: { id: user.id },
              data: { passwordHash: upgraded },
            });
            await writeAudit(AUTH_AUDIT_NOTES.UPGRADED_WEAK_POLICY);
          }
        }

        await registerSuccessfulLogin(user.id, ip);
        await writeAudit(AUTH_AUDIT_NOTES.SUCCESS);

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          passwordChangedAt: passwordChangedAt ? passwordChangedAt.toISOString() : null,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.active = true;
        token.pwdChangedAt = (user as { passwordChangedAt?: string | null }).passwordChangedAt ?? null;
        token.authCheckedAt = Math.floor(Date.now() / 1000);
        return token;
      }

      // Pemeriksaan ulang berkala: akun dinonaktifkan atau sandi diganti => sesi dicabut.
      const checkedAt = typeof token.authCheckedAt === "number" ? token.authCheckedAt : 0;
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (typeof token.id === "string" && nowSeconds - checkedAt > SESSION_REVALIDATE_AFTER_SECONDS) {
        const fresh = await db.user.findUnique({
          where: { id: token.id },
          select: { isActive: true, passwordChangedAt: true },
        });

        const currentStamp = fresh?.passwordChangedAt ? fresh.passwordChangedAt.toISOString() : null;
        const previousStamp = typeof token.pwdChangedAt === "string" ? token.pwdChangedAt : null;
        const changedAfter = currentStamp !== previousStamp && currentStamp !== null;

        token.active = Boolean(fresh && fresh.isActive && !changedAfter);
        token.authCheckedAt = nowSeconds;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.active === false) {
          // Sesi dicabut: kosongkan identitas agar semua pemeriksaan otorisasi
          // (yang bergantung pada session.user.email) menolak permintaan ini.
          (session.user as { id?: string }).id = undefined;
          (session.user as { email?: string | null }).email = null;
          (session as { invalidated?: boolean }).invalidated = true;
          return session;
        }
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { email?: string | null }).email = token.email as string;
        (session.user as { name?: string | null }).name = token.name as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
