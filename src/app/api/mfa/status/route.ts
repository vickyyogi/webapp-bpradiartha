import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-user";
import { getMfaStatus } from "@/lib/mfa-service";

/** Status MFA akun yang sedang login (Tahap 1B). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
  }

  const status = await getMfaStatus(user.id);

  return NextResponse.json({
    enabled: status.enabled,
    enrolledAt: status.enrolledAt ? status.enrolledAt.toISOString() : null,
    backupCodesRemaining: status.backupCodesRemaining,
  });
}
