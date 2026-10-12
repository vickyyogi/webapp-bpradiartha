import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSessionUser } from "@/lib/session-user";
import { startMfaEnrollment } from "@/lib/mfa-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Langkah 1 pendaftaran MFA (Tahap 1B).
 *
 * Mengembalikan rahasia TOTP + URI otpauth + gambar QR. Rahasia ini hanya
 * ditampilkan sekali pada proses pendaftaran; penyimpanannya terenkripsi.
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "mfa-setup", { limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
  }

  if (user.mfaEnabled) {
    return NextResponse.json(
      { error: "MFA sudah aktif pada akun ini. Nonaktifkan dahulu bila ingin mendaftar ulang." },
      { status: 409 }
    );
  }

  try {
    const { secret, uri } = await startMfaEnrollment(user.id);
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

    return NextResponse.json({ secret, uri, qrDataUrl, issuer: "BPR Adiartha Reksacitra" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pendaftaran MFA gagal dimulai.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
