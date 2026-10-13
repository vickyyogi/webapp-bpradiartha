import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/lib/password-reset";

/**
 * Permintaan tautan reset kata sandi (Tahap 1B-2 — P0.1).
 *
 * Catatan keamanan:
 * - Jawaban SELALU sama, baik email terdaftar maupun tidak (anti-enumerasi).
 * - Waktu tanggapan disamakan (minimal 700 ms) agar ada/tidaknya akun tidak
 *   terbaca dari selisih waktu proses.
 * - Pembatas laju per IP membendung penyalahgunaan sebagai alat spam email.
 */
const JAWABAN_SERAGAM = {
  status: "ok",
  message:
    "Bila alamat email tersebut terdaftar sebagai akun staf, kami telah mengirimkan tautan pengaturan ulang kata sandi. Periksa kotak masuk Anda (termasuk folder spam).",
};

async function samakanWaktu(mulai: number, minimumMs: number): Promise<void> {
  const selesai = Date.now() - mulai;
  if (selesai < minimumMs) {
    await new Promise((resolve) => setTimeout(resolve, minimumMs - selesai));
  }
}

export async function POST(req: NextRequest) {
  const mulai = Date.now();

  const rate = checkRateLimit(req, "auth-forgot-password", { limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  let body: { email?: unknown } = {};
  try {
    body = (await req.json()) as { email?: unknown };
  } catch {
    body = {};
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (email) {
    const hasil = await requestPasswordReset(email, {
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    if (!hasil.requested && hasil.reason === "mail_unavailable") {
      // Hanya dicatat di log server: pengguna tidak diberi tahu supaya tidak
      // membocorkan apakah akun ada, tetapi operator perlu tahu email tidak jalan.
      console.warn(
        "[forgot-password] Permintaan reset tidak terkirim karena transport email belum siap. " +
          "Isi SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM di .env."
      );
    }
  }

  await samakanWaktu(mulai, 700);
  return NextResponse.json(JAWABAN_SERAGAM);
}
