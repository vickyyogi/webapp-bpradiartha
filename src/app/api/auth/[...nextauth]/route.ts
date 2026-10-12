import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { AUTH_AUDIT_NOTES, toNextAuthUser, verifyLoginCredentials, writeLoginAudit } from "@/lib/auth-login";
import { checkLoginIpRate, readClientIp, registerSuccessfulLogin } from "@/lib/auth-lockout";
import { consumeChallenge, loadLoginChallenge, registerChallengeFailure, verifySecondFactor } from "@/lib/mfa-service";
import { MFA_CHALLENGE_MAX_ATTEMPTS } from "@/lib/mfa";
import {
  SESSION_MAX_AGE_SECONDS,
  SESSION_REVALIDATE_AFTER_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from "@/lib/auth-config";

/**
 * Autentikasi — Tahap 1A & 1B (P0.1).
 *
 * Jalur sandi (Tahap 1A):
 * - Sandi diverifikasi dengan bcrypt melalui src/lib/auth-login.ts: satu tempat untuk
 *   seluruh aturan (pembatas laju per IP, penguncian akun, akun nonaktif, akun tanpa
 *   sandi, peningkatan hash lama). Sandi teks polos tidak pernah dipakai lagi.
 * - Akun dengan passwordHash NULL (mis. pemohon/debitur) tidak dapat login.
 * - Akun terkunci (locked_until) ditolak walau sandinya benar.
 * - Sesi berlaku 8 jam dan diperiksa ulang ke database setiap 5 menit, sehingga
 *   penonaktifan akun atau penggantian sandi mencabut sesi yang masih berjalan.
 *
 * Langkah kedua MFA (Tahap 1B) — provider "mfa":
 * - Provider "credentials" TIDAK membuat sesi bila akun memakai MFA; ia hanya mencatat
 *   bahwa sandi benar lalu menunggu kode langkah kedua (audit "menunggu kode MFA").
 * - Sesi hanya terbentuk setelah kode TOTP/kode cadangan diverifikasi pada tantangan
 *   berumur pendek, sekali pakai, dan dibatasi 5 percobaan.
 * - Tidak ada nilai sandi maupun kode MFA yang pernah ditulis ke console, log, atau audit.
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

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@bpr.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const headers = (req as unknown as { headers?: unknown } | undefined)?.headers;

        const outcome = await verifyLoginCredentials({
          email: credentials?.email,
          password: credentials?.password,
          ip: readClientIp(headers),
          userAgent: readHeaderValue(headers, "user-agent"),
        });

        // "mfa_required" sengaja TIDAK menghasilkan sesi: langkah kedua MFA wajib dulu.
        return outcome.status === "ok" ? toNextAuthUser(outcome.user) : null;
      },
    }),
    CredentialsProvider({
      id: "mfa",
      name: "MFA",
      credentials: {
        challengeToken: { label: "Tantangan", type: "text" },
        code: { label: "Kode MFA", type: "text" },
      },
      async authorize(credentials, req) {
        const challengeToken = credentials?.challengeToken?.trim();
        const code = credentials?.code?.trim();

        if (!challengeToken || !code) {
          return null;
        }

        const headers = (req as unknown as { headers?: unknown } | undefined)?.headers;
        const ip = readClientIp(headers);
        const userAgent = readHeaderValue(headers, "user-agent");

        // Lapis 1 tetap berlaku pada langkah kedua supaya kode tidak bisa disemprot.
        const ipRate = checkLoginIpRate(ip);
        if (!ipRate.allowed) {
          console.warn(`[auth] langkah kedua MFA ditolak: batas percobaan per IP terlampaui — ip=${ip}`);
          return null;
        }

        const state = await loadLoginChallenge(challengeToken);

        if (state.status !== "ok") {
          console.warn(`[auth] langkah kedua MFA ditolak (${state.status}) — ip=${ip}`);
          return null;
        }

        const auditUser = { id: state.userId, organizationId: state.organizationId };
        // Penjaga anti-replay hanya di jalur login (lihat verifySecondFactor).
        const verification = await verifySecondFactor(state.userId, code, { enforceReplayGuard: true });

        if (!verification.ok) {
          const attempts = await registerChallengeFailure(state.challengeId);
          await writeLoginAudit(
            auditUser,
            attempts >= MFA_CHALLENGE_MAX_ATTEMPTS ? AUTH_AUDIT_NOTES.MFA_CHALLENGE_LIMIT : AUTH_AUDIT_NOTES.MFA_FAILED,
            ip,
            userAgent,
            { attempts, maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS }
          );
          return null;
        }

        await consumeChallenge(state.challengeId);

        const user = await db.user.findUnique({
          where: { id: state.userId },
          select: {
            id: true,
            email: true,
            fullName: true,
            organizationId: true,
            isActive: true,
            passwordChangedAt: true,
          },
        });

        if (!user || !user.isActive) {
          await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.INACTIVE, ip, userAgent);
          return null;
        }

        await registerSuccessfulLogin(user.id, ip);
        await writeLoginAudit(auditUser, AUTH_AUDIT_NOTES.MFA_SUCCESS, ip, userAgent, {
          method: verification.method,
        });

        return toNextAuthUser({
          id: user.id,
          organizationId: user.organizationId,
          email: user.email,
          fullName: user.fullName,
          passwordChangedAt: user.passwordChangedAt,
        });
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
