/**
 * Verifikasi Tahap 3A (P0.3) — uji negatif HTTP: akses lintas cabang, lintas peran,
 * lintas penugasan, dan pencegahan persetujuan mandiri (Maker-Checker).
 *
 * Membutuhkan server dev berjalan dan database yang dapat ditulis.
 * Membuat data uji sementara lalu menghapusnya.
 *
 *   npm run dev
 *   npm run verify:access:live
 */
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();
const BASE = (process.env.AUTH_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_DOMAIN = "bpr-access-uji.internal";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

class Jar {
  private store = new Map<string, string>();
  absorb(response: Response): void {
    const cookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") || ""];
    for (const raw of cookies) {
      if (!raw) continue;
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === "" || value === "deleted") this.store.delete(name);
      else this.store.set(name, value);
    }
  }
  header(): string {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hasSessionToken(): boolean {
    return [...this.store.keys()].some((k) => k.includes("session-token") && !k.includes("callback"));
  }
}

async function login(email: string, password: string, ip: string): Promise<Jar> {
  const jar = new Jar();
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-forwarded-for": ip, cookie: jar.header() } });
  jar.absorb(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/dashboard`, json: "true" });
  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip, cookie: jar.header() },
    body,
    redirect: "manual",
  });
  jar.absorb(response);
  return jar;
}

type ListResp = { data?: Array<{ id?: string }> };
type CreateResp = { data?: { id?: string }; error?: string };

async function main(): Promise<void> {
  console.log(`Menguji ${BASE}\n`);

  const reachable = await fetch(`${BASE}/login`).then((r) => r.status).catch(() => 0);
  if (reachable === 0) {
    console.log("LEWATI: server tidak berjalan. Jalankan `npm run dev` lebih dulu.");
    return;
  }

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const branchA = await prisma.branch.findFirst({ where: { organizationId: org?.id }, select: { id: true } });
  if (!org || !branchA) throw new Error("Organisasi/cabang tidak ditemukan.");

  const stamp = Date.now();
  const password = generateRandomPassword();

  const createdUsers: string[] = [];
  const createdRoles: string[] = [];
  const createdApps: string[] = [];
  const createdCustomers: string[] = [];
  const createdTasks: string[] = [];
  const createdPRs: string[] = [];
  const createdInvItems: string[] = [];
  const createdAssets: string[] = [];
  const createdMasterItems: string[] = [];
  const createdOrgs: string[] = [];
  let branchB: string | null = null;

  async function makeRole(code: string, permCodes: string[]) {
    const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } }, select: { id: true, code: true } });
    const role = await prisma.role.create({
      data: {
        code,
        name: `Peran Uji Akses ${code}`,
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
      select: { id: true },
    });
    createdRoles.push(role.id);
    return role.id;
  }

  async function makeUser(email: string, branchId: string, roleId: string) {
    const user = await prisma.user.create({
      data: {
        organizationId: org!.id,
        branchId,
        email,
        fullName: `Uji Akses ${email}`,
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        isActive: true,
        userRoles: { create: { roleId } },
      },
      select: { id: true },
    });
    createdUsers.push(user.id);
    return user.id;
  }

  try {
    // Cabang kedua untuk menguji isolasi lintas cabang.
    branchB = (
      await prisma.branch.create({
        data: { organizationId: org.id, code: `UJI3-${stamp}`, name: `Cabang Uji 3 ${stamp}` },
        select: { id: true },
      })
    ).id;

    const branchRoleId = await makeRole(`T3_BRANCH_${stamp}`, [
      "credit.application.view",
      "credit.application.create",
      "credit.application.update",
      "credit.application.delete",
      "field.task.view",
      "field.task.create",
      "field.task.update",
      "crm.customer.view",
      "crm.lead.view",
      "report.management.view",
      "purchase.request.view",
      "purchase.request.approve",
      "inventory.item.view",
      "asset.view",
      "audit.log.view",
    ]);
    const noPermRoleId = await makeRole(`T3_NOPERM_${stamp}`, ["crm.lead.view"]);

    const branchEmail = `branch-${stamp}@${TEST_DOMAIN}`;
    const noPermEmail = `noperm-${stamp}@${TEST_DOMAIN}`;
    await makeUser(branchEmail, branchA.id, branchRoleId);
    await makeUser(noPermEmail, branchA.id, noPermRoleId);

    // Pengguna bercakupan ORGANIZATION (ADMIN_OPERASIONAL) untuk pembanding positif.
    const orgRole = await prisma.role.findFirst({ where: { code: "ADMIN_OPERASIONAL" }, select: { id: true } });
    if (!orgRole) throw new Error("Peran ADMIN_OPERASIONAL tidak ada (jalankan seed).");
    const orgEmail = `orgwide-${stamp}@${TEST_DOMAIN}`;
    await makeUser(orgEmail, branchA.id, orgRole.id);

    // Data cabang B langsung di DB (untuk menguji isolasi).
    const customerB = await prisma.customer.create({
      data: { organizationId: org.id, branchId: branchB, customerNumber: `CUST-T3-${stamp}`, legalName: `Nasabah Cabang B ${stamp}` },
      select: { id: true },
    });
    createdCustomers.push(customerB.id);
    const appB = await prisma.creditApplication.create({
      data: { organizationId: org.id, branchId: branchB, applicationNumber: `KRD-T3-B-${stamp}`, customerId: customerB.id, status: "SUBMITTED" },
      select: { id: true },
    });
    createdApps.push(appB.id);
    const taskB = await prisma.fieldTask.create({
      data: { organizationId: org.id, branchId: branchB, assignedOfficerId: createdUsers[2], title: `Tugas Cabang B ${stamp}` },
      select: { id: true },
    });
    createdTasks.push(taskB.id);

    // Pengadaan: satu PR di cabang B (bukan milik pengguna cabang A) dan satu PR di cabang A
    // yang diajukan oleh pengguna cabang A sendiri (untuk menguji pemisahan tugas).
    const prB = await prisma.purchaseRequest.create({
      data: { organizationId: org.id, branchId: branchB, requestNumber: `PR-T3-B-${stamp}`, requesterId: createdUsers[2], title: `Pengadaan Cabang B ${stamp}`, purpose: "Uji lintas cabang", status: "SUBMITTED", totalEstimatedAmount: 1000000 },
      select: { id: true },
    });
    const prA = await prisma.purchaseRequest.create({
      data: { organizationId: org.id, branchId: branchA.id, requestNumber: `PR-T3-A-${stamp}`, requesterId: createdUsers[0], title: `Pengadaan Sendiri ${stamp}`, purpose: "Uji SoD pengadaan", status: "SUBMITTED", totalEstimatedAmount: 1000000 },
      select: { id: true },
    });
    createdPRs.push(prB.id, prA.id);

    // Inventaris & aset di cabang B (untuk uji isolasi cabang).
    const invItemB = await prisma.inventoryItem.create({
      data: { organizationId: org.id, branchId: branchB, itemCode: `INV-T3-${stamp}`, name: `Barang Cabang B ${stamp}`, category: "ATK", unit: "Pcs" },
      select: { id: true },
    });
    const assetB = await prisma.asset.create({
      data: { organizationId: org.id, branchId: branchB, assetNumber: `AST-T3-${stamp}`, name: `Aset Cabang B ${stamp}`, category: "IT Equipment" },
      select: { id: true },
    });
    createdInvItems.push(invItemB.id);
    createdAssets.push(assetB.id);

    // Organisasi kedua + pengguna + master data (uji isolasi lintas organisasi).
    const orgB = await prisma.organization.create({
      data: { code: `UJI3-ORG-${stamp}`, name: `Organisasi Uji 3 ${stamp}` },
      select: { id: true },
    });
    createdOrgs.push(orgB.id);
    const userB = await prisma.user.create({
      data: { organizationId: orgB.id, email: `userb-${stamp}@${TEST_DOMAIN}`, fullName: `Pengguna Org B ${stamp}`, passwordHash: await hashPassword(password), passwordChangedAt: new Date(), isActive: true },
      select: { id: true },
    });
    createdUsers.push(userB.id);
    const masterItemB = await prisma.masterItem.create({
      data: { organizationId: orgB.id, category: "LOAN_PRODUCT", code: `MD-${stamp}`, name: `Master Org B ${stamp}` },
      select: { id: true },
    });
    createdMasterItems.push(masterItemB.id);

    const branchJar = await login(branchEmail, password, "10.5.5.1");
    const noPermJar = await login(noPermEmail, password, "10.5.5.2");
    const orgJar = await login(orgEmail, password, "10.5.5.3");
    check("login pengguna cabang & pengguna org berhasil", branchJar.hasSessionToken() && orgJar.hasSessionToken());

    // 1. Daftar kredit terisolasi per cabang.
    const branchList = (await (await fetch(`${BASE}/api/credit/applications`, { headers: { cookie: branchJar.header() } })).json()) as ListResp;
    check("daftar kredit pengguna cabang TIDAK memuat pengajuan cabang lain", !(branchList.data || []).some((a) => a.id === appB.id));

    const orgList = (await (await fetch(`${BASE}/api/credit/applications`, { headers: { cookie: orgJar.header() } })).json()) as ListResp;
    check("daftar kredit pengguna ORG memuat pengajuan cabang lain", (orgList.data || []).some((a) => a.id === appB.id));

    // 2. Akses langsung by-id lintas cabang → 404.
    const detailB = await fetch(`${BASE}/api/credit/applications/${appB.id}`, { headers: { cookie: branchJar.header() } });
    check("GET detail lintas cabang → 404", detailB.status === 404, String(detailB.status));
    const putB = await fetch(`${BASE}/api/credit/applications/${appB.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: branchJar.header() },
      body: JSON.stringify({ notes: "upaya lintas cabang" }),
    });
    check("PUT lintas cabang → 404", putB.status === 404, String(putB.status));
    const delB = await fetch(`${BASE}/api/credit/applications/${appB.id}`, { method: "DELETE", headers: { cookie: branchJar.header() } });
    check("DELETE lintas cabang → 404", delB.status === 404, String(delB.status));

    const orgDetailB = await fetch(`${BASE}/api/credit/applications/${appB.id}`, { headers: { cookie: orgJar.header() } });
    check("GET detail pengguna ORG → 200", orgDetailB.status === 200, String(orgDetailB.status));

    // 3. Membuat pengajuan pada cabang lain → 403.
    const createOtherBranch = await fetch(`${BASE}/api/credit/applications`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: branchJar.header() },
      body: JSON.stringify({
        customerMode: "MANUAL",
        customerName: `Nasabah Lintas Cabang ${stamp}`,
        customerNik: `7600${String(stamp).slice(-12)}`,
        customerPhone: "081966600001",
        branchId: branchB,
        product: "Kredit Modal Kerja",
        requestedAmount: 10000000,
        requestedTenorMonths: 12,
        purpose: "Uji lintas cabang",
      }),
    });
    check("POST pengajuan ke cabang lain → 403", createOtherBranch.status === 403, String(createOtherBranch.status));

    // 4. Pengguna tanpa izin → 403.
    const noPermList = await fetch(`${BASE}/api/credit/applications`, { headers: { cookie: noPermJar.header() } });
    check("pengguna tanpa izin kredit → 403", noPermList.status === 403, String(noPermList.status));

    // 5. Field task terisolasi per cabang.
    const branchTasks = (await (await fetch(`${BASE}/api/field/tasks`, { headers: { cookie: branchJar.header() } })).json()) as ListResp;
    check("daftar tugas pengguna cabang TIDAK memuat tugas cabang lain", !(branchTasks.data || []).some((t) => t.id === taskB.id));
    const taskDetail = await fetch(`${BASE}/api/field/tasks/${taskB.id}`, { headers: { cookie: branchJar.header() } });
    check("GET tugas lintas cabang → 404", taskDetail.status === 404, String(taskDetail.status));

    // 6. Maker-Checker: pembuat/pengaju tidak boleh menjadi pemutus.
    const createRes = await fetch(`${BASE}/api/credit/applications`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: branchJar.header() },
      body: JSON.stringify({
        customerMode: "MANUAL",
        customerName: `Nasabah SoD ${stamp}`,
        customerNik: `7500${String(stamp).slice(-12)}`,
        customerPhone: "081966600002",
        branchId: branchA.id,
        product: "Kredit Modal Kerja",
        requestedAmount: 10000000,
        requestedTenorMonths: 12,
        purpose: "Uji pemisahan tugas",
      }),
    });
    const createJson = (await createRes.json()) as CreateResp;
    const ownAppId = createJson.data?.id;
    if (ownAppId) createdApps.push(ownAppId);
    check("POST pengajuan sendiri berhasil (201)", createRes.status === 201, `${createRes.status} ${createJson.error ?? ""}`);

    if (ownAppId) {
      const selfApprove = await fetch(`${BASE}/api/credit/applications/${ownAppId}`, {
        method: "PUT",
        headers: { "content-type": "application/json", cookie: branchJar.header() },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      const selfJson = (await selfApprove.json()) as { code?: string; error?: string };
      check("persetujuan mandiri ditolak 403", selfApprove.status === 403, String(selfApprove.status));
      check("kode error SEGREGATION_OF_DUTIES", selfJson.code === "SEGREGATION_OF_DUTIES", JSON.stringify(selfJson));
    }

    // ===== Tahap 3B: CRM nasabah, laporan/ekspor, pengadaan =====
    const crmList = (await (await fetch(`${BASE}/api/crm/customers`, { headers: { cookie: branchJar.header() } })).json()) as ListResp;
    check("daftar nasabah pengguna cabang TIDAK memuat nasabah cabang lain", !(crmList.data || []).some((c) => c.id === customerB.id));
    const crmDetail = await fetch(`${BASE}/api/crm/customers/${customerB.id}`, { headers: { cookie: branchJar.header() } });
    check("detail nasabah lintas cabang → 404", crmDetail.status === 404, String(crmDetail.status));
    const crmDetailOrg = await fetch(`${BASE}/api/crm/customers/${customerB.id}`, { headers: { cookie: orgJar.header() } });
    check("detail nasabah pengguna ORG → 200", crmDetailOrg.status === 200, String(crmDetailOrg.status));

    const reportJson = await fetch(`${BASE}/api/reports`, { headers: { cookie: branchJar.header() } });
    check("laporan JSON dengan izin view → 200", reportJson.status === 200, String(reportJson.status));
    const reportCsv = await fetch(`${BASE}/api/reports?format=csv&domain=CREDIT`, { headers: { cookie: branchJar.header() } });
    check("ekspor CSV tanpa izin ekspor → 403", reportCsv.status === 403, String(reportCsv.status));

    const prList = (await (await fetch(`${BASE}/api/purchasing/requests`, { headers: { cookie: branchJar.header() } })).json()) as { requests?: Array<{ id?: string }> };
    check("daftar PR pengguna cabang TIDAK memuat PR cabang lain", !(prList.requests || []).some((p) => p.id === prB.id));
    const prDetailB = await fetch(`${BASE}/api/purchasing/requests/${prB.id}`, { headers: { cookie: branchJar.header() } });
    check("detail PR lintas cabang → 404", prDetailB.status === 404, String(prDetailB.status));
    const selfApprovePr = await fetch(`${BASE}/api/purchasing/requests/${prA.id}/workflow`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: branchJar.header() },
      body: JSON.stringify({ action: "APPROVE", comment: "uji SoD" }),
    });
    const selfPrJson = (await selfApprovePr.json()) as { code?: string };
    check("persetujuan mandiri pengadaan ditolak 403", selfApprovePr.status === 403, String(selfApprovePr.status));
    check("kode error SoD pengadaan", selfPrJson.code === "SEGREGATION_OF_DUTIES", JSON.stringify(selfPrJson));

    // ===== Tahap 3C: inventaris, aset, audit, master data, notifikasi =====
    const invList = (await (await fetch(`${BASE}/api/inventory/items`, { headers: { cookie: branchJar.header() } })).json()) as { items?: Array<{ id?: string }> };
    check("daftar inventaris pengguna cabang TIDAK memuat barang cabang lain", !(invList.items || []).some((i) => i.id === invItemB.id));
    const invDetail = await fetch(`${BASE}/api/inventory/items/${invItemB.id}`, { headers: { cookie: branchJar.header() } });
    check("detail inventaris lintas cabang → 404", invDetail.status === 404, String(invDetail.status));

    const assetList = (await (await fetch(`${BASE}/api/assets`, { headers: { cookie: branchJar.header() } })).json()) as { assets?: Array<{ id?: string }> };
    check("daftar aset pengguna cabang TIDAK memuat aset cabang lain", !(assetList.assets || []).some((a) => a.id === assetB.id));
    const assetDetail = await fetch(`${BASE}/api/assets/${assetB.id}`, { headers: { cookie: branchJar.header() } });
    check("detail aset lintas cabang → 404", assetDetail.status === 404, String(assetDetail.status));

    const auditRes = await fetch(`${BASE}/api/audit`, { headers: { cookie: branchJar.header() } });
    const auditJson = (await auditRes.json()) as { code?: string };
    check("audit ditolak untuk pengguna bercakupan cabang (403)", auditRes.status === 403, String(auditRes.status));
    check("kode error audit SCOPE_FORBIDDEN", auditJson.code === "SCOPE_FORBIDDEN", JSON.stringify(auditJson));

    const mdRes = await fetch(`${BASE}/api/admin/master-data`, { headers: { cookie: orgJar.header() } });
    const mdJson = (await mdRes.json()) as Array<{ id?: string }>;
    check("master data TIDAK memuat item organisasi lain", Array.isArray(mdJson) && !mdJson.some((m) => m.id === masterItemB.id), String(mdRes.status));

    const notifRes = await fetch(`${BASE}/api/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: branchJar.header() },
      body: JSON.stringify({ action: "SEND", userId: userB.id, title: "Uji", message: "Uji lintas organisasi" }),
    });
    check("kirim notifikasi lintas organisasi → 403", notifRes.status === 403, String(notifRes.status));
  } finally {
    if (createdApps.length) {
      await prisma.creditStatusHistory.deleteMany({ where: { creditApplicationId: { in: createdApps } } });
      await prisma.creditApprovalRecord.deleteMany({ where: { creditApplicationId: { in: createdApps } } });
      await prisma.creditApplication.deleteMany({ where: { id: { in: createdApps } } });
    }
    if (createdTasks.length) await prisma.fieldTask.deleteMany({ where: { id: { in: createdTasks } } });
    if (createdPRs.length) await prisma.purchaseRequest.deleteMany({ where: { id: { in: createdPRs } } });
    if (createdInvItems.length) await prisma.inventoryItem.deleteMany({ where: { id: { in: createdInvItems } } });
    if (createdAssets.length) await prisma.asset.deleteMany({ where: { id: { in: createdAssets } } });
    if (createdCustomers.length) await prisma.customer.deleteMany({ where: { id: { in: createdCustomers } } });
    if (branchB) await prisma.branch.deleteMany({ where: { id: branchB } });
    if (createdUsers.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    if (createdMasterItems.length) await prisma.masterItem.deleteMany({ where: { id: { in: createdMasterItems } } });
    if (createdOrgs.length) await prisma.organization.deleteMany({ where: { id: { in: createdOrgs } } });
    if (createdRoles.length) {
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: createdRoles } } });
      await prisma.role.deleteMany({ where: { id: { in: createdRoles } } });
    }
    const leftoverUsers = await prisma.user.count({ where: { email: { endsWith: TEST_DOMAIN } } });
    check("data uji dibersihkan", leftoverUsers === 0, `${leftoverUsers} user tersisa`);
  }

  console.log(`\n${failures === 0 ? "SEMUA LULUS" : "ADA KEGAGALAN"}: ${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Verifikasi live gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
