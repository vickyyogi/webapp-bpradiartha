import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { completePasswordReset, loadResetToken, sendPasswordChangedNotice } from "@/lib/password-reset";

/**
 * Pemeriksaan dan pemakaian tautan reset kata sandi (Tahap 1B-2 — P0.1).
 *
 * GET  ?token=...  -> memeriksa keabsahan tautan (tanpa menghanguskan).
 * POST {token,password} -> menetapkan kata sandi baru.
 *
 * Token hanya ada di tautan email; nilai aslinya tidak pernah tersimpan di
 * basis data (hanya hash-nya).
 */

function samarkanEmail(email: string): string {
  const [lokal, domain] = email.split("@");
  if (!domain) return "***";
  const awal = lokal.slice(0, 2);
  return `${awal}${"*".repeat(Math.max(3, lokal.length - 2))}@${domain}`;
}

export async function GET(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-reset-check", { limit: 30, windowMs: 15 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ valid: false, reason: "rate_limited" }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token");
  const state = await loadResetToken(token);

  if (state.status !== "ok" || !state.context) {
    return NextResponse.json({ valid: false, reason: state.status });
  }

  return NextResponse.json({
    valid: true,
    emailMasked: samarkanEmail(state.context.email),
  });
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "auth-reset-submit", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  let body: { token?: unknown; password?: unknown } = {};
  try {
    body = (await req.json()) as { token?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ status: "invalid", message: "Permintaan tidak valid." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json(
      { status: "invalid", message: "Tautan dan kata sandi baru wajib diisi." },
      { status: 400 }
    );
  }

  const meta = { ip: getClientIp(req), userAgent: req.headers.get("user-agent") };
  const hasil = await completePasswordReset(token, password, meta);

  if (!hasil.ok) {
    const statusHttp =
      hasil.status === "policy" || hasil.status === "same_password"
        ? 400
        : hasil.status === "inactive" || hasil.status === "no_password"
          ? 403
          : 410; // tautan tidak dikenal / sudah dipakai / kedaluwarsa / diblokir
    return NextResponse.json({ status: hasil.status, message: hasil.message }, { status: statusHttp });
  }

  await sendPasswordChangedNotice(hasil.email, null);

  return NextResponse.json({
    status: "ok",
    message: "Kata sandi berhasil diperbarui. Seluruh sesi login lama sudah diputus — silakan masuk kembali.",
  });
}
