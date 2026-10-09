import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/layouts/DashboardShell";

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

  // Extract role codes, role names, and permission codes
  const roleCodes = new Set<string>();
  const roleNames: string[] = [];

  currentUser.userRoles.forEach((ur) => {
    roleCodes.add(ur.role.code.toUpperCase());
    if (ur.role.name) roleNames.push(ur.role.name);
  });

  const isSystemAdmin =
    roleCodes.has("SUPER_ADMIN") ||
    roleCodes.has("ADMIN_OPERASIONAL") ||
    roleCodes.has("ADMIN") ||
    currentUser.userRoles.some((ur) => ur.role.isSystem) ||
    roleCodes.size === 0;

  const permissionCodes = new Set<string>();
  currentUser.userRoles.forEach((ur) => {
    ur.role.permissions?.forEach((rp) => {
      if (rp.permission?.code) {
        permissionCodes.add(rp.permission.code);
      }
    });
  });

  /**
   * Helper function to check menu access by matching EITHER Role Codes OR Permission Codes.
   */
  const canAccessMenu = (validRoleCodes: string[], validPermissions: string[]) => {
    if (isSystemAdmin) return true;

    const hasRoleMatch = validRoleCodes.some((code) => roleCodes.has(code.toUpperCase()));
    if (hasRoleMatch) return true;

    const hasPermissionMatch = validPermissions.some(
      (code) => permissionCodes.has(code) || permissionCodes.has("admin.super")
    );
    if (hasPermissionMatch) return true;

    return false;
  };

  const menuVisibility = {
    showCrm: canAccessMenu(
      ["AO_MARKETING", "MARKETING", "BRANCH_MANAGER", "CREDIT_ANALYST", "CREDIT_COMMITTEE", "DIRECTOR", "ADMIN_OPERASIONAL"],
      ["crm.lead.view", "credit.application.create", "credit.application.view"]
    ),
    showCredit: canAccessMenu(
      ["CREDIT_ANALYST", "BRANCH_MANAGER", "CREDIT_COMMITTEE", "DIRECTOR", "AO_MARKETING", "MARKETING", "ADMIN_OPERASIONAL"],
      ["credit.application.view", "credit.application.create", "credit.analysis.create", "credit.analysis.review", "credit.application.approve"]
    ),
    showField: canAccessMenu(
      ["FIELD_OFFICER", "SURVEYOR", "AO_MARKETING", "BRANCH_MANAGER", "CREDIT_ANALYST", "ADMIN_OPERASIONAL"],
      ["field.task.view", "credit.survey.view", "credit.application.view"]
    ),
    showDocuments: canAccessMenu(
      ["AO_MARKETING", "CREDIT_ANALYST", "BRANCH_MANAGER", "DIRECTOR", "FIELD_OFFICER", "ADMIN_OPERASIONAL", "PURCHASING_OFFICER", "ASSET_OFFICER"],
      ["document.view", "credit.application.view"]
    ),
    showInventory: canAccessMenu(
      ["ASSET_OFFICER", "INVENTORY_OFFICER", "ADMIN_OPERASIONAL", "BRANCH_MANAGER", "DIRECTOR", "PURCHASING_OFFICER"],
      ["inventory.asset.view", "inventory.item.view", "inventory.asset.create"]
    ),
    showPurchasing: canAccessMenu(
      ["PURCHASING_OFFICER", "FINANCE", "ADMIN_OPERASIONAL", "BRANCH_MANAGER", "DIRECTOR", "ASSET_OFFICER"],
      ["purchase.request.create", "purchase.request.approve", "purchase.order.create"]
    ),
    showReports: canAccessMenu(
      ["MANAGEMENT", "DIRECTOR", "BRANCH_MANAGER", "CREDIT_COMMITTEE", "AUDITOR", "ADMIN_OPERASIONAL"],
      ["report.credit.view", "report.performance.view"]
    ),
    showAudit: canAccessMenu(
      ["AUDITOR", "DIRECTOR", "BRANCH_MANAGER", "ADMIN_OPERASIONAL", "SUPER_ADMIN"],
      ["audit.log.view", "admin.user.manage"]
    ),
    showAdmin: canAccessMenu(
      ["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN", "ADMIN_CMS"],
      ["admin.user.manage", "admin.role.manage", "admin.master.manage", "admin.cms.manage"]
    ),
    showAdminUsers: canAccessMenu(["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN"], ["admin.user.manage"]),
    showAdminRoles: canAccessMenu(["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN"], ["admin.role.manage"]),
    showAdminMaster: canAccessMenu(["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN"], ["admin.master.manage"]),
    showAdminBranches: canAccessMenu(["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN"], ["admin.master.manage"]),
    showAdminDepartments: canAccessMenu(["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN"], ["admin.master.manage"]),
    showAdminCms: canAccessMenu(["SUPER_ADMIN", "ADMIN_OPERASIONAL", "ADMIN", "ADMIN_CMS"], ["admin.cms.manage"]),
  };

  const primaryRoleLabel = roleNames.length > 0 ? roleNames.join(", ") : "Staff Operasional";

  return (
    <DashboardShell
      userName={currentUser.fullName}
      userRoleLabel={primaryRoleLabel}
      menuVisibility={menuVisibility}
    >
      {children}
    </DashboardShell>
  );
}
