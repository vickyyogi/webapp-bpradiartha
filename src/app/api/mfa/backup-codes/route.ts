import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-user";
import { regenerateBackupCodes } from "@/lib/mfa-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Membuat ulang kode cadangan MFA (Tahap 1B).
 *
 * Kode lama langsung hangus. Karena alasan paling umum adalah "kode saya
 * hilang", kode TOTP maupun kode cadangan yang tersisa sama-sama diterima.
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "mfa-backup-codes", { limit: 10, windowMs: 5 * 60 * 1000 });
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

  const result = await regenerateBackupCodes(user.id, body.code ?? "");
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({
    backupCodes: result.backupCodes,
    warning: "Kode cadangan lama sudah tidak berlaku. Simpan kode baru ini di tempat aman.",
  });
}
