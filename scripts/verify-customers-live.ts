/**
 * Verifikasi Tahap 2A (P0.2) — uji perilaku HTTP: pengajuan kredit harus membuat/menautkan
 * NASABAH (Customer), bukan akun pegawai (User), dan menyimpan identitas secara terstruktur.
 *
 * Membutuhkan server dev/produksi berjalan dan database yang dapat ditulis.
 * Skrip MEMBUAT data uji sementara lalu MENGHAPUSNYA (aplikasi, nasabah, akun, peran, audit).
 *
 *   npm run dev                      # terminal lain
 *   npm run verify:customers:live
 */
import { PrismaClient } from "@prisma/client";
import { generateRandomPassword, hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();
const BASE = (process.env.AUTH_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_DOMAIN = "bpr-cust-uji.internal";

let failures = 0;
let checks = 0;

type ApiJson = {
  data?: {
    id?: string;
    notes?: string | null;
    customer?: {
      id?: string;
      customerNumber?: string;
      legalName?: string;
      identityNumber?: string | null;
    };
  };
  error?: string;
};

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
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { "x-forwarded-for": ip, cookie: jar.header() },
  });
  jar.absorb(csrfResponse);
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
      cookie: jar.header(),
    },
    body,
    redirect: "manual",
  });
  jar.absorb(response);
  return jar;
}

type CustomerLite = {
  id?: string;
  customerNumber?: string;
  legalName?: string;
  identityNumber?: string | null;
  identityNumberMasked?: string | null;
  verifiedAt?: string | null;
};
type DuplicateResp = { id?: string; matchReasons?: string[]; identityNumberMasked?: string | null };
type CreateCustomerResp = { data?: CustomerLite; error?: string; duplicates?: DuplicateResp[] };
type ListCustomerResp = { data?: CustomerLite[] };
type DetailCustomerResp = {
  data?: CustomerLite & {
    identityHistories?: Array<{ action?: string; changedFields?: string[] | null }>;
    relationshipsAsSubject?: Array<{ id?: string }>;
    consents?: Array<{ id?: string; granted?: boolean }>;
  };
};
type UpdateCustomerResp = { data?: CustomerLite; changedFields?: string[]; error?: string };
type RelationResp = { data?: { id?: string } };
type ListRelationResp = { data?: Array<{ id?: string }> };
type ListConsentResp = { data?: Array<{ id?: string; granted?: boolean }> };

async function main(): Promise<void> {
  console.log(`Menguji ${BASE}\n`);

  const reachable = await fetch(`${BASE}/login`).then((r) => r.status).catch(() => 0);
  if (reachable === 0) {
    console.log("LEWATI: server tidak berjalan. Jalankan `npm run dev` lebih dulu.");
    return;
  }

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const branch = await prisma.branch.findFirst({ where: { organizationId: org?.id }, select: { id: true } });
  if (!org || !branch) throw new Error("Organisasi/cabang tidak ditemukan pada database.");

  const stamp = Date.now();
  const password = generateRandomPassword();
  const email = `uji-cust-${stamp}@${TEST_DOMAIN}`;
  const applicantName = `Nasabah Uji ${stamp}`;
  const nik = "3200000000000001";
  const phone = "081900000001";

  const createdUserIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdAppIds: string[] = [];
  let roleId: string | null = null;

  try {
    // Peran sementara dengan izin yang diperlukan (tanpa MFA agar login sederhana).
    const permCodes = ["credit.application.view", "credit.application.create", "crm.customer.view", "crm.customer.create", "crm.customer.update"];
    const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } }, select: { id: true, code: true } });
    for (const code of permCodes) {
      if (!perms.some((p) => p.code === code)) {
        throw new Error(`Izin ${code} tidak ada di katalog. Jalankan seed lebih dulu.`);
      }
    }

    const role = await prisma.role.create({
      data: {
        code: `VERIFY_CUSTOMER_${stamp}`,
        name: "Peran Uji Nasabah (sementara)",
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
      select: { id: true },
    });
    roleId = role.id;

    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        email,
        fullName: "Uji API Nasabah",
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        isActive: true,
        userRoles: { create: { roleId: role.id } },
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);

    const jar = await login(email, password, "10.9.9.9");
    check("login (tanpa MFA) berhasil membentuk sesi", jar.hasSessionToken());

    // 1. Daftar pengajuan dapat dibaca.
    const listRes = await fetch(`${BASE}/api/credit/applications`, { headers: { cookie: jar.header() } });
    check("GET /api/credit/applications berhasil", listRes.status === 200, String(listRes.status));

    // 2. Buat pengajuan MANUAL (nasabah baru) dengan NIK + alamat terstruktur.
    const createRes = await fetch(`${BASE}/api/credit/applications`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: jar.header() },
      body: JSON.stringify({
        customerMode: "MANUAL",
        customerName: applicantName,
        customerNik: nik,
        customerPhone: phone,
        customerAddress: "Jl. Uji Verifikasi No. 1, Denpasar",
        branchId: branch.id,
        product: "Kredit Modal Kerja",
        requestedAmount: 25000000,
        requestedTenorMonths: 12,
        purpose: "Uji integrasi Tahap 2A",
        source: "Marketing Officer",
      }),
    });
    const createJson = (await createRes.json()) as ApiJson;
    check("POST pengajuan MANUAL berhasil (201)", createRes.status === 201, `${createRes.status} ${JSON.stringify(createJson).slice(0, 200)}`);

    const app = createJson?.data;
    if (app?.id) createdAppIds.push(app.id);
    const customerId = app?.customer?.id;
    if (customerId) createdCustomerIds.push(customerId);

    check("respons memuat nasabah dengan nama legal", app?.customer?.legalName === applicantName, JSON.stringify(app?.customer));
    check("NIK tersimpan terstruktur pada nasabah", app?.customer?.identityNumber === nik, String(app?.customer?.identityNumber));
    check("nomor nasabah berformat CUST-YYYY-NNNN", /^CUST-\d{4}-\d{4,}$/.test(app?.customer?.customerNumber || ""), String(app?.customer?.customerNumber));
    check("catatan pengajuan TIDAK memuat NIK", !/3200000000000001/.test(app?.notes || ""), String(app?.notes));

    if (customerId) {
      const dbCustomer = await prisma.customer.findUnique({ where: { id: customerId }, select: { identityNumber: true, address: true, phone: true, legacyApplicantUserId: true } });
      check("NIK di database sama dengan input", dbCustomer?.identityNumber === nik, String(dbCustomer?.identityNumber));
      check("alamat tersimpan terstruktur", dbCustomer?.address === "Jl. Uji Verifikasi No. 1, Denpasar", String(dbCustomer?.address));
      check("nasabah baru BUKAN hasil konversi akun pegawai", dbCustomer?.legacyApplicantUserId === null, String(dbCustomer?.legacyApplicantUserId));
    }

    const leftoverUser = await prisma.user.count({ where: { fullName: applicantName } });
    check("pemohon TIDAK dibuat sebagai akun pegawai (User)", leftoverUser === 0, `${leftoverUser} user`);

    // 3. Buat pengajuan berikutnya memakai NASABAH terdaftar (mode CUSTOMER).
    if (customerId) {
      const reuseRes = await fetch(`${BASE}/api/credit/applications`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: jar.header() },
        body: JSON.stringify({
          customerMode: "CUSTOMER",
          customerId,
          branchId: branch.id,
          product: "Kredit Investasi Usaha",
          requestedAmount: 30000000,
          requestedTenorMonths: 24,
          purpose: "Uji pemakaian nasabah terdaftar",
        }),
      });
      const reuseJson = (await reuseRes.json()) as ApiJson;
      if (reuseJson?.data?.id) createdAppIds.push(reuseJson.data.id);
      check("POST pengajuan mode CUSTOMER berhasil", reuseRes.status === 201, String(reuseRes.status));
      check("pengajuan kedua memakai nasabah yang sama", reuseJson?.data?.customer?.id === customerId, JSON.stringify(reuseJson?.data?.customer));
    }

    // 4. NIK tidak valid harus ditolak (400).
    const invalidRes = await fetch(`${BASE}/api/credit/applications`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: jar.header() },
      body: JSON.stringify({
        customerMode: "MANUAL",
        customerName: "Nasabah NIK Salah",
        customerNik: "123",
        customerPhone: "081900000002",
        branchId: branch.id,
        product: "Kredit Modal Kerja",
        requestedAmount: 10000000,
        requestedTenorMonths: 12,
        purpose: "Uji NIK tidak valid",
      }),
    });
    check("NIK tidak valid ditolak (400)", invalidRes.status === 400, String(invalidRes.status));

    // ===== Tahap 2B: manajemen nasabah, riwayat, duplikasi, hubungan, consent =====
    const nik2b = "7700000000000009";
    const name2b = `Nasabah CRM ${stamp}`;
    const baseHeaders = { "content-type": "application/json", cookie: jar.header() };

    const createCustRes = await fetch(`${BASE}/api/crm/customers`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({
        customerType: "INDIVIDU",
        legalName: name2b,
        identityType: "KTP",
        identityNumber: nik2b,
        phone: "081977700001",
        branchId: branch.id,
      }),
    });
    const custJson = (await createCustRes.json()) as CreateCustomerResp;
    const cid = custJson.data?.id;
    if (cid) createdCustomerIds.push(cid);
    check("POST /api/crm/customers berhasil (201)", createCustRes.status === 201, `${createCustRes.status} ${custJson.error ?? ""}`);
    check("nasabah CRM baru punya nomor CUST", /^CUST-\d{4}-\d{4,}$/.test(custJson.data?.customerNumber || ""), String(custJson.data?.customerNumber));

    if (cid) {
      // Deteksi duplikat (NIK)
      const dupRes = await fetch(`${BASE}/api/crm/customers/duplicates?identityNumber=${nik2b}`, { headers: { cookie: jar.header() } });
      const dupJson = (await dupRes.json()) as { data?: DuplicateResp[] };
      check("deteksi duplikat NIK menemukan nasabah", (dupJson.data || []).some((d) => d.id === cid && (d.matchReasons || []).includes("IDENTITY_EXACT")));
      check("hasil duplikat menyamarkan NIK", (dupJson.data || []).every((d) => !d.identityNumberMasked || d.identityNumberMasked.includes("*")));

      // Identitas duplikat ditolak 409
      const dupCreateRes = await fetch(`${BASE}/api/crm/customers`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ customerType: "INDIVIDU", legalName: `Kembar ${stamp}`, identityNumber: nik2b, branchId: branch.id }),
      });
      check("NIK duplikat ditolak 409", dupCreateRes.status === 409, String(dupCreateRes.status));

      // Daftar menyamarkan NIK
      const listRes = await fetch(`${BASE}/api/crm/customers?search=${encodeURIComponent(name2b)}`, { headers: { cookie: jar.header() } });
      const listJson = (await listRes.json()) as ListCustomerResp;
      const listed = (listJson.data || []).find((c) => c.id === cid);
      check("daftar nasabah memuat nasabah uji", Boolean(listed));
      check("daftar menyamarkan NIK", Boolean(listed?.identityNumberMasked?.includes("*")));
      check("daftar TIDAK memuat NIK mentah", listed ? !("identityNumber" in listed) || !listed.identityNumber : true);

      // Detail menampilkan NIK lengkap untuk pengguna berizin
      const detRes = await fetch(`${BASE}/api/crm/customers/${cid}`, { headers: { cookie: jar.header() } });
      const detJson = (await detRes.json()) as DetailCustomerResp;
      check("detail nasabah menampilkan NIK lengkap", detJson.data?.identityNumber === nik2b, String(detJson.data?.identityNumber));

      // Ubah telepon → tercatat pada riwayat
      const updRes = await fetch(`${BASE}/api/crm/customers/${cid}`, {
        method: "PUT",
        headers: baseHeaders,
        body: JSON.stringify({ phone: "081977700002" }),
      });
      const updJson = (await updRes.json()) as UpdateCustomerResp;
      check("PUT nasabah berhasil", updRes.status === 200, String(updRes.status));
      check("perubahan telepon tercatat sebagai field berubah", (updJson.changedFields || []).includes("phone"), JSON.stringify(updJson.changedFields));

      const detRes2 = await fetch(`${BASE}/api/crm/customers/${cid}`, { headers: { cookie: jar.header() } });
      const detJson2 = (await detRes2.json()) as DetailCustomerResp;
      check("riwayat identitas memuat aksi UPDATE", (detJson2.data?.identityHistories || []).some((h) => h.action === "UPDATE"));

      // Verifikasi identitas
      const verRes = await fetch(`${BASE}/api/crm/customers/${cid}/verify`, { method: "POST", headers: baseHeaders, body: JSON.stringify({}) });
      const verJson = (await verRes.json()) as DetailCustomerResp;
      check("verifikasi identitas menandai verifiedAt", verRes.status === 200 && Boolean(verJson.data?.verifiedAt), String(verRes.status));

      // Hubungan antar-pihak
      const relRes = await fetch(`${BASE}/api/crm/customers/${cid}/relationships`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ relationshipType: "GUARANTOR", relatedName: "Penjamin Uji" }),
      });
      const relJson = (await relRes.json()) as RelationResp;
      check("POST hubungan antar-pihak berhasil", relRes.status === 201, String(relRes.status));
      const relListRes = await fetch(`${BASE}/api/crm/customers/${cid}/relationships`, { headers: { cookie: jar.header() } });
      const relListJson = (await relListRes.json()) as ListRelationResp;
      check("daftar hubungan memuat 1 baris", (relListJson.data || []).length === 1, `${(relListJson.data || []).length}`);
      if (relJson.data?.id) {
        const relDelRes = await fetch(`${BASE}/api/crm/customers/${cid}/relationships/${relJson.data.id}`, { method: "DELETE", headers: { cookie: jar.header() } });
        check("DELETE hubungan berhasil", relDelRes.status === 200, String(relDelRes.status));
      }

      // Persetujuan data pribadi
      const conRes = await fetch(`${BASE}/api/crm/customers/${cid}/consents`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ consentType: "DATA_PROCESSING", granted: true, policyVersion: "v1" }),
      });
      check("POST persetujuan data berhasil", conRes.status === 201, String(conRes.status));
      const conListRes = await fetch(`${BASE}/api/crm/customers/${cid}/consents`, { headers: { cookie: jar.header() } });
      const conListJson = (await conListRes.json()) as ListConsentResp;
      check("daftar persetujuan memuat 1 baris", (conListJson.data || []).length === 1, `${(conListJson.data || []).length}`);
    }
  } finally {
    // Bersihkan data uji.
    if (createdAppIds.length) {
      await prisma.creditStatusHistory.deleteMany({ where: { creditApplicationId: { in: createdAppIds } } });
      await prisma.creditApprovalRecord.deleteMany({ where: { creditApplicationId: { in: createdAppIds } } });
      await prisma.creditApplication.deleteMany({ where: { id: { in: createdAppIds } } });
    }
    if (createdCustomerIds.length) {
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    if (createdUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (roleId) {
      await prisma.rolePermission.deleteMany({ where: { roleId } });
      await prisma.role.deleteMany({ where: { id: roleId } });
    }
    const leftoverCust = await prisma.customer.count({ where: { legalName: applicantName } });
    check("data nasabah uji dibersihkan", leftoverCust === 0, `${leftoverCust} tersisa`);
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
