import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-user";
import { disableMfa, verifySecondFactor } from "@/lib/mfa-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Menonaktifkan MFA (Tahap 1B).
 *
 * Wajib menyertakan kode TOTP atau satu kode cadangan yang masih berlaku, supaya
 * sesi yang dibajak tidak cukup untuk mematikan perlindungan ini.
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "mfa-disable", { limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
  }

  if (!user.mfaEnabled) {
    return NextResponse.json({ error: "MFA belum aktif pada akun ini." }, { status: 409 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const verification = await verifySecondFactor(user.id, body.code ?? "");
  if (!verification.ok) {
    return NextResponse.json({ error: "Kode MFA tidak sah." }, { status: 400 });
  }

  await disableMfa(user.id);

  return NextResponse.json({ enabled: false });
}
