import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session-user";

/**
 * Keluar dari semua perangkat (Tahap 1B-3 — P0.1).
 *
 * Menandai `sessions_valid_from = sekarang`. Penjaga sesi membandingkan waktu
 * terbit setiap token dengan nilai ini, sehingga SELURUH sesi milik akun — lama
 * maupun yang memicu tindakan ini — berhenti berlaku pada pemeriksaan berikutnya.
 * Kata sandi TIDAK diubah.
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "account-logout-all", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
  }

  const waktu = new Date();
  await db.user.update({ where: { id: user.id }, data: { sessionsValidFrom: waktu } });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LOGOUT",
    entityType: "USER",
    entityId: user.id,
    notes: "Seluruh sesi perangkat dikeluarkan atas permintaan pengguna.",
    ipAddress: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    status: "ok",
    message: "Semua sesi di seluruh perangkat telah diakhiri. Silakan masuk kembali.",
  });
}
