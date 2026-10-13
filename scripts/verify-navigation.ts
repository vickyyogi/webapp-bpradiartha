/**
 * Verifikasi Tahap 3D (P0.3) — konsistensi navigasi & penjagaan halaman.
 * Tidak memerlukan server aplikasi, tetapi memerlukan koneksi database.
 *
 *   npm run verify:navigation
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildVisibleNav,
  hasNavAccess,
  requirementForPath,
  type NavSectionConfig,
} from "../src/lib/navigation";

const prisma = new PrismaClient();

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

const flattenKeys = (sections: NavSectionConfig[]): string[] => {
  const keys: string[] = [];
  for (const s of sections) {
    for (const item of s.items) {
      keys.push(item.key);
      (item.children ?? []).forEach((c) => keys.push(c.key));
    }
  }
  return keys;
};

function logicTests(): void {
  console.log("== 1. Visibilitas menu (murni permission + cakupan) ==");

  const admin = new Set<string>(["admin.super"]);
  const adminNav = flattenKeys(buildVisibleNav(admin, "ORGANIZATION"));
  check("admin.super melihat audit & admin", adminNav.includes("audit") && adminNav.includes("admin.users") && adminNav.includes("admin.cms"));

  const marketing = new Set<string>([
    "dashboard.view", "crm.lead.view", "crm.customer.view",
    "credit.application.view", "credit.application.create", "credit.survey.view",
    "field.task.view", "document.view",
  ]);
  const mNav = flattenKeys(buildVisibleNav(marketing, "BRANCH"));
  check("marketing melihat CRM, Kredit, Lapangan, Dokumen", ["crm", "crm.leads", "credit", "field", "documents"].every((k) => mNav.includes(k)), mNav.join(","));
  check("marketing TIDAK melihat audit", !mNav.includes("audit"));
  check("marketing TIDAK melihat admin", !mNav.includes("admin"));
  check("marketing TIDAK melihat inventaris", !mNav.includes("inventory"));

  const asset = new Set<string>(["dashboard.view", "inventory.item.view", "asset.view"]);
  const aNav = flattenKeys(buildVisibleNav(asset, "BRANCH"));
  check("petugas aset melihat inventaris", aNav.includes("inventory") && aNav.includes("inventory.items"));
  check("petugas aset TIDAK melihat kredit", !aNav.includes("credit"));

  const cms = new Set<string>(["cms.page.view", "cms.post.view"]);
  const cNav = flattenKeys(buildVisibleNav(cms, "BRANCH"));
  check("editor CMS melihat admin (hanya CMS)", cNav.includes("admin") && cNav.includes("admin.cms"));
  check("editor CMS TIDAK melihat menu admin lain", !cNav.includes("admin.users") && !cNav.includes("admin.roles"));
  check("editor CMS TIDAK melihat audit", !cNav.includes("audit"));

  console.log("\n== 2. Cakupan (scope) ==");
  check("audit butuh cakupan ORGANIZATION (BRANCH ditolak)", !hasNavAccess(admin, "BRANCH", { permissions: ["audit.log.view"], scope: "ORGANIZATION" }));
  check("audit boleh untuk cakupan ORGANIZATION", hasNavAccess(admin, "ORGANIZATION", { permissions: ["audit.log.view"], scope: "ORGANIZATION" }));
  check("menu tanpa scope bebas cakupan", hasNavAccess(new Set(["crm.lead.view"]), "BRANCH", { permissions: ["crm.lead.view"] }));

  console.log("\n== 3. Pemetaan rute → izin ==");
  const rCust = requirementForPath("/crm/customers/abc-123");
  check("rute /crm/customers/* → izin nasabah", Boolean(rCust) && rCust!.permissions.includes("crm.customer.view"), JSON.stringify(rCust));
  const rAdmin = requirementForPath("/admin/users");
  check("rute /admin/users → admin.user.view + ORGANIZATION", Boolean(rAdmin) && rAdmin!.permissions.includes("admin.user.view") && rAdmin!.scope === "ORGANIZATION", JSON.stringify(rAdmin));
  const rAudit = requirementForPath("/audit");
  check("rute /audit → ORGANIZATION", Boolean(rAudit) && rAudit!.scope === "ORGANIZATION");
  check("rute /dashboard tidak dijaga khusus", requirementForPath("/dashboard") === null);
}

async function databaseTests(): Promise<void> {
  console.log("\n== 4. Peran lama memiliki permission (opsi A) ==");
  for (const code of ["AO_MARKETING", "BRANCH_MANAGER", "CREDIT_COMMITTEE", "DIRECTOR"]) {
    const role = await prisma.role.findUnique({
      where: { code },
      select: { id: true, permissions: { select: { permissionId: true } } },
    });
    check(`peran ${code} ada & punya permission`, Boolean(role) && (role?.permissions.length ?? 0) > 0, String(role?.permissions.length ?? 0));
  }
}

function sourceGuardTests(): void {
  console.log("\n== 5. Penjaga sumber ==");
  const layout = readFileSync(join(__dirname, "../src/app/(dashboard)/layout.tsx"), "utf8");
  const shell = readFileSync(join(__dirname, "../src/components/layouts/DashboardShell.tsx"), "utf8");
  const proxy = readFileSync(join(__dirname, "../src/proxy.ts"), "utf8");

  check("layout memakai buildVisibleNav", layout.includes("buildVisibleNav"));
  check("layout memakai requirementForPath (penjaga halaman)", layout.includes("requirementForPath"));
  check("layout tidak lagi memakai fallback roleCodes.size === 0", !layout.includes("roleCodes.size === 0"));
  check("shell tidak lagi memakai MenuVisibility manual", !shell.includes("MenuVisibility"));
  check("middleware meneruskan x-pathname", proxy.includes("x-pathname"));
}

async function main(): Promise<void> {
  logicTests();
  await databaseTests();
  sourceGuardTests();

  console.log(`\n${failures === 0 ? "SEMUA LULUS" : "ADA KEGAGALAN"}: ${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Verifikasi gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
