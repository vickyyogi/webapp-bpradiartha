import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { roleCodesRequireMfa } from "@/lib/mfa";

/**
 * Gerbang MFA (Tahap 1B — P0.1).
 *
 * Selama akun berperan wajib-MFA belum mendaftarkan TOTP, seluruh API dengan
 * pemeriksaan izin ditolak. Rute layanan mandiri MFA (/api/mfa/*) dan alur
 * autentikasi tidak memakai fungsi ini, sehingga pendaftaran MFA tetap bisa dilakukan.
 */
function mfaSetupRequired(user: { mfaEnabled: boolean; userRoles: { role: { code: string } }[] }): boolean {
  if (user.mfaEnabled) return false;
  return roleCodesRequireMfa(user.userRoles.map((ur) => ur.role.code));
}

const MFA_REQUIRED_RESPONSE = () =>
  NextResponse.json(
    {
      error:
        "Akun ini wajib memakai autentikasi dua faktor (MFA). Daftarkan MFA terlebih dahulu melalui /mfa/setup.",
      code: "MFA_REQUIRED",
    },
    { status: 403 }
  );

/**
 * Gerbang kebijakan sandi (Tahap 1B-3 — P0.1).
 *
 * Akun yang sandinya tidak memenuhi kebijakan (mis. sandi lama yang di-hash saat
 * migrasi) wajib menggantinya di /account/password sebelum memakai API berizin.
 */
function passwordChangeRequired(user: { mustChangePassword: boolean }): boolean {
  return user.mustChangePassword;
}

const PASSWORD_CHANGE_RESPONSE = () =>
  NextResponse.json(
    {
      error:
        "Kata sandi akun ini wajib diganti terlebih dahulu karena tidak memenuhi kebijakan. Buka /account/password.",
      code: "PASSWORD_CHANGE_REQUIRED",
    },
    { status: 403 }
  );

/**
 * Checks if a user has a specific permission code attached to any of their assigned roles.
 */
export async function hasPermission(
  userEmail: string,
  permissionCode: string
): Promise<boolean> {
  if (!userEmail) return false;

  const user = await db.user.findUnique({
    where: { email: userEmail },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) return false;

  // Check if any assigned role contains the specified permission code
  for (const ur of user.userRoles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission.code === permissionCode || rp.permission.code === "admin.super") {
        return true;
      }
    }
  }

  return false;
}

/**
 * Ensures current session user is authenticated and possesses AT LEAST ONE of the
 * given permission codes. Useful for endpoints whose required permission depends
 * on the request payload (e.g. stock IN/OUT/ADJUST, workflow APPROVE/REJECT).
 */
export async function requireAnyPermission(permissionCodes: string[], extraRoleCodes: string[] = []) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 }),
      user: null,
    };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { userRoles: { select: { role: { select: { code: true } } } } },
  });

  if (!user || !user.isActive) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Akun pengguna tidak aktif atau tidak ditemukan." }, { status: 403 }),
      user: null,
    };
  }

  // Tahap 1B: peran wajib-MFA belum mendaftar TOTP => tolak akses API.
  if (mfaSetupRequired(user)) {
    return { authorized: false as const, response: MFA_REQUIRED_RESPONSE(), user };
  }

  // Tahap 1B-3: sandi belum memenuhi kebijakan => wajib diganti lebih dahulu.
  if (passwordChangeRequired(user)) {
    return { authorized: false as const, response: PASSWORD_CHANGE_RESPONSE(), user };
  }

  for (const code of permissionCodes) {
    if (await hasPermission(user.email, code)) {
      return { authorized: true as const, response: null, user };
    }
  }

  const allowedRoles = extraRoleCodes.map((code) => code.toUpperCase());
  if (allowedRoles.length && user.userRoles.some((ur) => allowedRoles.includes(ur.role.code.toUpperCase()))) {
    return { authorized: true as const, response: null, user };
  }

  return {
    authorized: false as const,
    response: NextResponse.json(
      { error: `Akses ditolak: Anda tidak memiliki hak akses '${permissionCodes.join("' / '")}'.` },
      { status: 403 }
    ),
    user,
  };
}

/**
 * Ensures current session user is authenticated and possesses the required permission.
 * Returns { authorized: true, user } if valid, or { authorized: false, response: NextResponse } if unauthorized/forbidden.
 */
export async function requireAuthAndPermission(permissionCode: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 }),
      user: null,
    };
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    include: { userRoles: { select: { role: { select: { code: true } } } } },
  });

  if (!user || !user.isActive) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Akun pengguna tidak aktif atau tidak ditemukan." }, { status: 403 }),
      user: null,
    };
  }

  // Tahap 1B: peran wajib-MFA belum mendaftar TOTP => tolak akses API.
  if (mfaSetupRequired(user)) {
    return { authorized: false as const, response: MFA_REQUIRED_RESPONSE(), user };
  }

  // Tahap 1B-3: sandi belum memenuhi kebijakan => wajib diganti lebih dahulu.
  if (passwordChangeRequired(user)) {
    return { authorized: false as const, response: PASSWORD_CHANGE_RESPONSE(), user };
  }

  // Allow bypass for system admin / initial setup if permission check passes
  const permitted = await hasPermission(user.email, permissionCode);

  if (!permitted) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: `Akses ditolak: Anda tidak memiliki hak akses '${permissionCode}'.` },
        { status: 403 }
      ),
      user,
    };
  }

  return {
    authorized: true as const,
    response: null,
    user,
  };
}
