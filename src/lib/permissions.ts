import { db } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

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
export async function requireAnyPermission(permissionCodes: string[]) {
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
  });

  if (!user || !user.isActive) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Akun pengguna tidak aktif atau tidak ditemukan." }, { status: 403 }),
      user: null,
    };
  }

  for (const code of permissionCodes) {
    if (await hasPermission(user.email, code)) {
      return { authorized: true as const, response: null, user };
    }
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
  });

  if (!user || !user.isActive) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Akun pengguna tidak aktif atau tidak ditemukan." }, { status: 403 }),
      user: null,
    };
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
