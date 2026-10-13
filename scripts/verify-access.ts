/**
 * Verifikasi Tahap 3A (P0.3) — otorisasi cakupan data & pemisahan tugas.
 * Tidak memerlukan server aplikasi, tetapi memerlukan koneksi database.
 *
 *   npm run verify:access
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import {
  buildScopeFilter,
  isBranchAllowed,
  recordInScope,
  resolveScopeLevel,
  violatesSegregationOfDuties,
  type ScopeUser,
} from "../src/lib/access-scope";

const prisma = new PrismaClient();

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

function logicTests(): void {
  console.log("== 1. Penentu cakupan ==");

  const orgUser: ScopeUser = { id: "u-org", organizationId: "org-1", branchId: "br-1", roleCodes: ["ADMIN"] };
  const branchUser: ScopeUser = { id: "u-branch", organizationId: "org-1", branchId: "br-1", roleCodes: ["MARKETING"] };
  const assignedUser: ScopeUser = { id: "u-assigned", organizationId: "org-1", branchId: "br-1", roleCodes: ["FIELD_OFFICER"] };
  const noBranchUser: ScopeUser = { id: "u-nb", organizationId: "org-1", branchId: null, roleCodes: ["CREDIT_ANALYST"] };

  check("peran admin → ORGANIZATION", resolveScopeLevel(orgUser) === "ORGANIZATION");
  check("peran marketing → BRANCH", resolveScopeLevel(branchUser) === "BRANCH");
  check("peran field officer → ASSIGNED", resolveScopeLevel(assignedUser) === "ASSIGNED");
  check("peran analis tanpa cabang → BRANCH", resolveScopeLevel(noBranchUser) === "BRANCH");

  const orgFilter = buildScopeFilter(orgUser, { assignmentFields: ["assignedAnalystId"] });
  check("filter ORGANIZATION hanya berisi organizationId", JSON.stringify(orgFilter) === JSON.stringify({ organizationId: "org-1" }), JSON.stringify(orgFilter));

  const branchFilter = buildScopeFilter(branchUser, { assignmentFields: ["assignedAnalystId"] });
  check("filter BRANCH memuat cabang + penugasan", "OR" in branchFilter && Array.isArray((branchFilter as { OR: unknown[] }).OR));

  const assignedFilter = buildScopeFilter(assignedUser, { assignmentFields: ["assignedAnalystId"] });
  const assignedOr = (assignedFilter as { OR?: Array<Record<string, unknown>> }).OR ?? [];
  check("filter ASSIGNED hanya berisi penugasan (tanpa cabang)", assignedOr.length === 1 && assignedOr[0].assignedAnalystId === "u-assigned", JSON.stringify(assignedFilter));

  const emptyFilter = buildScopeFilter(noBranchUser, {});
  check("BRANCH tanpa cabang & tanpa penugasan → filter mustahil", (emptyFilter as { id?: string }).id === "__no_scope__", JSON.stringify(emptyFilter));

  check("record di cabang lain ditolak", !recordInScope(branchUser, { organizationId: "org-1", branchId: "br-2", assignedAnalystId: null }));
  check("record di cabang sendiri diterima", recordInScope(branchUser, { organizationId: "org-1", branchId: "br-1" }));
  check("record yang ditugaskan diterima walau beda cabang", recordInScope(branchUser, { organizationId: "org-1", branchId: "br-2", assignedAnalystId: "u-branch" }, { assignmentFields: ["assignedAnalystId"] }));
  check("organisasi lain selalu ditolak", !recordInScope(orgUser, { organizationId: "org-2", branchId: "br-1" }));

  check("cabang lain tidak diizinkan untuk pengguna cabang", !isBranchAllowed(branchUser, "br-2"));
  check("cabang sendiri diizinkan", isBranchAllowed(branchUser, "br-1"));
  check("admin boleh cabang mana pun", isBranchAllowed(orgUser, "br-2"));

  console.log("\n== 2. Pemisahan tugas (Maker-Checker) ==");
  check("pemutus = pengaju → pelanggaran", violatesSegregationOfDuties("u1", ["u1", null, "u2"]));
  check("pemutus = analis → pelanggaran", violatesSegregationOfDuties("u2", ["u1", "u2", null]));
  check("pemutus berbeda dari semua pihak → aman", !violatesSegregationOfDuties("u9", ["u1", "u2", "u3"]));
  check("daftar kosong → aman", !violatesSegregationOfDuties("u9", [null, undefined]));
}

async function integrationTests(): Promise<void> {
  console.log("\n== 3. Cakupan pada database nyata ==");

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const branchA = await prisma.branch.findFirst({ where: { organizationId: org?.id }, select: { id: true } });
  if (!org || !branchA) {
    check("organisasi & cabang tersedia", false);
    return;
  }

  const stamp = Date.now();
  let branchB: { id: string } | null = null;
  let customer: { id: string } | null = null;
  let application: { id: string } | null = null;
  let invItem: { id: string } | null = null;
  let asset: { id: string } | null = null;

  try {
    branchB = await prisma.branch.create({
      data: { organizationId: org.id, code: `UJI-${stamp}`, name: `Cabang Uji ${stamp}` },
      select: { id: true },
    });
    customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        branchId: branchB.id,
        customerNumber: `CUST-UJI-${stamp}`,
        legalName: `Nasabah Cabang Lain ${stamp}`,
      },
      select: { id: true },
    });
    application = await prisma.creditApplication.create({
      data: {
        organizationId: org.id,
        branchId: branchB.id,
        applicationNumber: `KRD-UJI-${stamp}`,
        customerId: customer.id,
        status: "SUBMITTED",
      },
      select: { id: true },
    });
    invItem = await prisma.inventoryItem.create({
      data: { organizationId: org.id, branchId: branchB.id, itemCode: `INV-UJI-${stamp}`, name: `Barang Cabang Lain ${stamp}`, category: "ATK", unit: "Pcs" },
      select: { id: true },
    });
    asset = await prisma.asset.create({
      data: { organizationId: org.id, branchId: branchB.id, assetNumber: `AST-UJI-${stamp}`, name: `Aset Cabang Lain ${stamp}`, category: "IT Equipment" },
      select: { id: true },
    });

    const branchUser: ScopeUser = { id: randomUUID(), organizationId: org.id, branchId: branchA.id, roleCodes: ["MARKETING"] };
    const orgUser: ScopeUser = { id: randomUUID(), organizationId: org.id, branchId: branchA.id, roleCodes: ["ADMIN"] };
    const assignedUser: ScopeUser = { id: randomUUID(), organizationId: org.id, branchId: branchA.id, roleCodes: ["FIELD_OFFICER"] };

    const assignmentFields = ["assignedMarketingOfficerId", "assignedAnalystId", "assignedSurveyOfficerId", "decisionMakerId"];

    const branchVisible = await prisma.creditApplication.findMany({
      where: buildScopeFilter(branchUser, { assignmentFields }),
      select: { id: true },
    });
    check("pengguna cabang A tidak melihat pengajuan cabang B", !branchVisible.some((a) => a.id === application!.id));

    const orgVisible = await prisma.creditApplication.findMany({
      where: buildScopeFilter(orgUser, { assignmentFields }),
      select: { id: true },
    });
    check("pengguna ORGANIZATION melihat pengajuan cabang B", orgVisible.some((a) => a.id === application!.id));

    const assignedVisible = await prisma.creditApplication.findMany({
      where: buildScopeFilter(assignedUser, { assignmentFields }),
      select: { id: true },
    });
    check("pengguna ASSIGNED tidak melihat pengajuan yang bukan tugasnya", !assignedVisible.some((a) => a.id === application!.id));

    check("recordInScope menolak pengajuan cabang lain", !recordInScope(branchUser, { organizationId: org.id, branchId: branchB.id }, { assignmentFields }));

    // Cakupan nasabah (CRM): cabang A tidak melihat nasabah cabang B.
    const branchCustomers = await prisma.customer.findMany({
      where: buildScopeFilter(branchUser, { assignmentFields: ["createdById"] }),
      select: { id: true },
    });
    check("pengguna cabang A tidak melihat nasabah cabang B", !branchCustomers.some((c) => c.id === customer!.id));
    const orgCustomers = await prisma.customer.findMany({
      where: buildScopeFilter(orgUser, { assignmentFields: ["createdById"] }),
      select: { id: true },
    });
    check("pengguna ORGANIZATION melihat nasabah cabang B", orgCustomers.some((c) => c.id === customer!.id));

    // Cakupan inventaris & aset (3C).
    const branchInv = await prisma.inventoryItem.findMany({
      where: buildScopeFilter(branchUser, { assignmentFields: [] }),
      select: { id: true },
    });
    check("pengguna cabang A tidak melihat barang cabang B", !branchInv.some((i) => i.id === invItem!.id));
    const branchAssets = await prisma.asset.findMany({
      where: buildScopeFilter(branchUser, { assignmentFields: ["currentHolderId"] }),
      select: { id: true },
    });
    check("pengguna cabang A tidak melihat aset cabang B", !branchAssets.some((a) => a.id === asset!.id));
    const orgAssets = await prisma.asset.findMany({
      where: buildScopeFilter(orgUser, { assignmentFields: ["currentHolderId"] }),
      select: { id: true },
    });
    check("pengguna ORGANIZATION melihat aset cabang B", orgAssets.some((a) => a.id === asset!.id));

    // Pencarian langsung (IDOR) memakai filter cakupan.
    const direct = await prisma.creditApplication.findFirst({
      where: { id: application.id, ...(buildScopeFilter(branchUser, { assignmentFields }) as object) },
      select: { id: true },
    });
    check("akses langsung by-id lintas cabang tidak menemukan record", direct === null);
  } finally {
    if (application) {
      await prisma.creditStatusHistory.deleteMany({ where: { creditApplicationId: application.id } });
      await prisma.creditApplication.deleteMany({ where: { id: application.id } });
    }
    if (invItem) await prisma.inventoryItem.deleteMany({ where: { id: invItem.id } });
    if (asset) await prisma.asset.deleteMany({ where: { id: asset.id } });
    if (customer) await prisma.customer.deleteMany({ where: { id: customer.id } });
    if (branchB) await prisma.branch.deleteMany({ where: { id: branchB.id } });
    const leftover = branchB ? await prisma.branch.count({ where: { id: branchB.id } }) : 0;
    check("data uji dibersihkan", leftover === 0);
  }
}

function sourceGuardTests(): void {
  console.log("\n== 4. Penjaga sumber ==");
  const creditDetail = readFileSync(join(__dirname, "../src/app/api/credit/applications/[id]/route.ts"), "utf8");
  const creditList = readFileSync(join(__dirname, "../src/app/api/credit/applications/route.ts"), "utf8");
  const fieldList = readFileSync(join(__dirname, "../src/app/api/field/tasks/route.ts"), "utf8");
  const creditPage = readFileSync(join(__dirname, "../src/app/(dashboard)/credit/applications/[id]/page.tsx"), "utf8");

  check("route detail kredit memakai buildScopeFilter", creditDetail.includes("buildScopeFilter"));
  check("route detail kredit menegakkan pemisahan tugas", creditDetail.includes("violatesSegregationOfDuties"));
  check("route daftar kredit memakai buildScopeFilter", creditList.includes("buildScopeFilter"));
  check("route field task memakai buildScopeFilter", fieldList.includes("buildScopeFilter"));
  check("halaman detail kredit (SSR) memakai buildScopeFilter", creditPage.includes("buildScopeFilter"));

  const crmCustomers = readFileSync(join(__dirname, "../src/app/api/crm/customers/route.ts"), "utf8");
  const crmLead = readFileSync(join(__dirname, "../src/app/api/crm/leads/route.ts"), "utf8");
  const reports = readFileSync(join(__dirname, "../src/app/api/reports/route.ts"), "utf8");
  const prWorkflow = readFileSync(join(__dirname, "../src/app/api/purchasing/requests/[id]/workflow/route.ts"), "utf8");

  check("route CRM nasabah memakai buildScopeFilter", crmCustomers.includes("buildScopeFilter"));
  check("route CRM leads memakai buildScopeFilter", crmLead.includes("buildScopeFilter"));
  check("route laporan memakai buildScopeFilter", reports.includes("buildScopeFilter"));
  check("ekspor laporan menuntut izin ekspor", reports.includes("report.management.export"));
  check("workflow pengadaan menegakkan pemisahan tugas", prWorkflow.includes("violatesSegregationOfDuties"));

  const invItems = readFileSync(join(__dirname, "../src/app/api/inventory/items/route.ts"), "utf8");
  const assets = readFileSync(join(__dirname, "../src/app/api/assets/route.ts"), "utf8");
  const audit = readFileSync(join(__dirname, "../src/app/api/audit/route.ts"), "utf8");
  const masterData = readFileSync(join(__dirname, "../src/app/api/admin/master-data/route.ts"), "utf8");
  const users = readFileSync(join(__dirname, "../src/app/api/users/[id]/route.ts"), "utf8");

  check("route inventaris memakai buildScopeFilter", invItems.includes("buildScopeFilter"));
  check("route aset memakai buildScopeFilter", assets.includes("buildScopeFilter"));
  check("route audit menuntut cakupan organisasi", audit.includes("resolveScopeLevel"));
  check("master data menyaring organisasi", masterData.includes("organizationId"));
  check("perubahan role/cabang/nonaktif mencabut sesi", users.includes("sessionsValidFrom"));
}

async function main(): Promise<void> {
  logicTests();
  await integrationTests();
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
