import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/password";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session-user";

/**
 * Ganti kata sandi sendiri (Tahap 1B-3 — P0.1).
 *
 * Layanan mandiri: hanya akun pemilik sesi. Rute ini sengaja TIDAK memakai
 * pemeriksaan izin peran, supaya akun yang ditandai "wajib ganti sandi" tetap
 * dapat memperbaiki keadaannya sendiri.
 *
 * Efek samping: passwordChangedAt diperbarui, sehingga seluruh sesi (termasuk
 * sesi yang sedang dipakai) dicabut oleh penjaga sesi setelah pemeriksaan ulang.
 */
export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, "account-password", { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rate.isAllowed) {
    return rate.response ?? NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown } = {};
  try {
    body = (await req.json()) as { currentPassword?: unknown; newPassword?: unknown };
  } catch {
    return NextResponse.json({ status: "invalid", message: "Permintaan tidak valid." }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { status: "invalid", message: "Kata sandi saat ini dan kata sandi baru wajib diisi." },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  const saatIni = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  const cocok = await verifyPassword(currentPassword, saatIni?.passwordHash);

  if (!cocok.ok) {
    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "UPDATE",
      entityType: "USER",
      entityId: user.id,
      notes: "Ganti kata sandi ditolak: kata sandi saat ini tidak cocok.",
      ipAddress: ip,
      userAgent,
    });
    return NextResponse.json(
      { status: "invalid_current", message: "Kata sandi saat ini tidak cocok." },
      { status: 400 }
    );
  }

  if (newPassword === currentPassword) {
    return NextResponse.json(
      { status: "same_password", message: "Kata sandi baru tidak boleh sama dengan kata sandi saat ini." },
      { status: 400 }
    );
  }

  const policy = validatePasswordPolicy(newPassword, { email: user.email });
  if (!policy.ok) {
    return NextResponse.json(
      { status: "policy", message: policy.message ?? "Kata sandi tidak memenuhi kebijakan." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "UPDATE",
    entityType: "USER",
    entityId: user.id,
    notes: "Kata sandi diganti oleh pengguna melalui halaman Keamanan Akun.",
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({
    status: "ok",
    message: "Kata sandi berhasil diganti. Semua sesi login lama diputus — silakan masuk kembali.",
  });
}
