import { NextRequest, NextResponse } from "next/server";
import { verifyLoginCredentials } from "@/lib/auth-login";
import { createLoginChallenge } from "@/lib/mfa-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Langkah pertama login (Tahap 1B — P0.1).
 *
 * Tugasnya satu: memverifikasi sandi SEKALI (semua aturan penguncian tetap di
 * src/lib/auth-login.ts) lalu memberi tahu halaman login apakah langkah kedua
 * MFA diperlukan, beserta token tantangannya.
 *
 * Catatan keamanan:
 * - Jawaban untuk sandi salah selalu sama ("invalid"), tidak membedakan email
 *   terdaftar atau tidak.
 * - Token tantangan hanya diberikan setelah sandi terbukti benar.
 * - Pesan sukses tidak pernah membocorkan apakah akun punya MFA sebelum sandi benar.
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-prelogin", { limit: 12, windowMs: 5 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ status: "invalid" }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ status: "invalid", error: "Permintaan tidak valid." }, { status: 400 });
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";

  const outcome = await verifyLoginCredentials({
    email: body.email,
    password: body.password,
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  if (outcome.status === "rejected") {
    // 401 untuk semua sebab yang berkaitan dengan kredensial; 403 untuk akun nonaktif.
    const status = outcome.reason === "inactive" ? 403 : 401;
    return NextResponse.json({ status: "invalid" }, { status });
  }

  if (outcome.status === "mfa_required") {
    const challenge = await createLoginChallenge(outcome.user.id);
    return NextResponse.json({
      status: "mfa",
      challengeToken: challenge.token,
      expiresAt: challenge.expiresAt.toISOString(),
    });
  }

  return NextResponse.json({ status: "ok" });
}
