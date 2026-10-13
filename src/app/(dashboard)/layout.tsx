import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/layouts/DashboardShell";
import { roleCodesRequireMfa } from "@/lib/mfa";
import { resolveScopeLevel, toScopeUser } from "@/lib/access-scope";
import { buildVisibleNav, hasNavAccess, requirementForPath } from "@/lib/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Fetch current user with assigned roles and permissions
  const currentUser = await db.user.findUnique({
    where: { email: session.user.email },
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

  if (!currentUser) {
    redirect("/login");
  }

  const roleCodes = new Set<string>();
  const roleNames: string[] = [];
  currentUser.userRoles.forEach((ur) => {
    roleCodes.add(ur.role.code.toUpperCase());
    if (ur.role.name) roleNames.push(ur.role.name);
  });

  // Tahap 1B: peran wajib-MFA (bawaan: ADMIN) harus mendaftarkan TOTP lebih dahulu.
  if (!currentUser.mfaEnabled && roleCodesRequireMfa(roleCodes)) {
    redirect("/mfa/setup");
  }

  // Tahap 1B-3: sandi lama yang tidak memenuhi kebijakan wajib diganti dahulu.
  if (currentUser.mustChangePassword) {
    redirect("/account/password");
  }

  // Tahap 3D: visibilitas menu MURNI dari permission + cakupan data (bukan daftar role).
  const permissionCodes = new Set<string>();
  currentUser.userRoles.forEach((ur) => {
    ur.role.permissions?.forEach((rp) => {
      if (rp.permission?.code) permissionCodes.add(rp.permission.code);
    });
  });
  const scopeLevel = resolveScopeLevel(toScopeUser(currentUser));
  const visibleNav = buildVisibleNav(permissionCodes, scopeLevel);

  // Penjagaan halaman terpusat: URL langsung ke halaman yang bukan porsinya dialihkan.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const requirement = requirementForPath(pathname);
  if (requirement && !hasNavAccess(permissionCodes, scopeLevel, requirement)) {
    redirect("/forbidden");
  }

  const primaryRoleLabel = roleNames.length > 0 ? roleNames.join(", ") : "Staff Operasional";

  return (
    <DashboardShell
      userName={currentUser.fullName}
      userRoleLabel={primaryRoleLabel}
      navSections={visibleNav}
    >
      {children}
    </DashboardShell>
  );
}
