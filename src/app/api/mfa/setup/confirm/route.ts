import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-user";
import { confirmMfaEnrollment } from "@/lib/mfa-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Langkah 2 pendaftaran MFA (Tahap 1B).
 *
 * Menguji satu kode TOTP; bila cocok, MFA diaktifkan dan kode cadangan
 * dikembalikan SEKALI (penyimpanannya hanya berupa hash).
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "mfa-confirm", { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const result = await confirmMfaEnrollment(user.id, body.code ?? "");

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({
    enabled: true,
    backupCodes: result.backupCodes,
    warning: "Simpan kode cadangan di tempat aman. Kode ini tidak akan ditampilkan lagi.",
  });
}
