/**
 * Pengambil pengguna dari sesi (Tahap 1B).
 *
 * Rute MFA bersifat layanan mandiri: yang boleh diubah hanya akun milik sesi
 * itu sendiri, sehingga tidak memerlukan kode izin peran — cukup sesi sah dan
 * akun yang masih aktif.
 */
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export interface SessionUser {
  id: string;
  email: string;
  organizationId: string;
  fullName: string;
  mfaEnabled: boolean;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) return null;

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, organizationId: true, fullName: true, isActive: true, mfaEnabled: true },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    fullName: user.fullName,
    mfaEnabled: user.mfaEnabled,
  };
}
