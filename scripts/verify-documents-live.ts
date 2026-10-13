/**
 * Verifikasi Tahap 4 (P0.4) — uji akses dokumen lewat HTTP nyata.
 *
 * Membutuhkan server dev berjalan dan database yang dapat ditulis.
 * Membuat data uji sementara lalu menghapusnya.
 *
 *   npm run dev
 *   npm run verify:documents:live
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readdirSync } from "fs";
import { generateRandomPassword, hashPassword } from "../src/lib/password";
import { parseDocumentRef, resolvePrivateDocumentPath, savePrivateDocument } from "../src/lib/document-storage";

const prisma = new PrismaClient();
const BASE = (process.env.AUTH_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TEST_DOMAIN = "bpr-documents-uji.internal";

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

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 0x43),
]);

function pngBlob(): Blob {
  return new Blob([PNG_BYTES], { type: "image/png" });
}

async function uploadDocument(
  jar: Jar,
  options: { file: Blob; fileName: string; ownerType: string; ownerId: string }
): Promise<Response> {
  const form = new FormData();
  form.append("file", options.file, options.fileName);
  form.append("ownerType", options.ownerType);
  form.append("ownerId", options.ownerId);
  form.append("documentType", "OTHER");
  form.append("notes", "Data uji Tahap 4");
  return fetch(`${BASE}/api/documents`, { method: "POST", headers: { cookie: jar.header() }, body: form });
}

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
  const createdDocs: string[] = [];
  const createdApps: string[] = [];
  const createdCustomers: string[] = [];
  const createdOrgs: string[] = [];
  const createdFiles: string[] = [];
  let branchB: string | null = null;
  const deleteFileLater = (ref: string) => {
    const parsed = parseDocumentRef(ref);
    if (parsed.kind === "private") createdFiles.push(parsed.key);
  };

  async function makeRole(code: string, permCodes: string[]) {
    const perms = await prisma.permission.findMany({ where: { code: { in: permCodes } }, select: { id: true } });
    const role = await prisma.role.create({
      data: { code, name: `Peran Uji Dokumen ${code}`, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } },
      select: { id: true },
    });
    createdRoles.push(role.id);
    return role.id;
  }

  async function makeUser(email: string, branchId: string | null, roleId: string | null, organizationId: string) {
    const user = await prisma.user.create({
      data: {
        organizationId,
        branchId,
        email,
        fullName: `Uji Dokumen ${email}`,
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        isActive: true,
        ...(roleId ? { userRoles: { create: { roleId } } } : {}),
      },
      select: { id: true },
    });
    createdUsers.push(user.id);
    return user.id;
  }

  try {
    branchB = (
      await prisma.branch.create({
        data: { organizationId: org.id, code: `UJI4-${stamp}`, name: `Cabang Uji Dokumen ${stamp}` },
        select: { id: true },
      })
    ).id;

    const docRoleId = await makeRole(`T4_DOC_${stamp}`, [
      "document.view",
      "document.upload",
      "document.download",
      "document.delete",
    ]);
    const viewOnlyRoleId = await makeRole(`T4_VIEW_${stamp}`, ["document.view"]);

    const userAEmail = `doc-a-${stamp}@${TEST_DOMAIN}`;
    const viewEmail = `doc-view-${stamp}@${TEST_DOMAIN}`;
    await makeUser(userAEmail, branchA.id, docRoleId, org.id);
    await makeUser(viewEmail, branchA.id, viewOnlyRoleId, org.id);

    // Organisasi kedua (uji isolasi lintas organisasi).
    const orgB = await prisma.organization.create({
      data: { code: `UJI4-ORG-${stamp}`, name: `Organisasi Uji Dokumen ${stamp}` },
      select: { id: true },
    });
    createdOrgs.push(orgB.id);
    const orgBEmail = `doc-orgb-${stamp}@${TEST_DOMAIN}`;
    await makeUser(orgBEmail, null, docRoleId, orgB.id);

    // Pengajuan pada cabang A (dalam cakupan userA) dan cabang B (di luar cakupan).
    const customerA = await prisma.customer.create({
      data: { organizationId: org.id, branchId: branchA.id, customerNumber: `CUST-T4-${stamp}`, legalName: `Nasabah Uji Dokumen ${stamp}` },
      select: { id: true },
    });
    createdCustomers.push(customerA.id);
    const appA = await prisma.creditApplication.create({
      data: { organizationId: org.id, branchId: branchA.id, applicationNumber: `KRD-T4-A-${stamp}`, customerId: customerA.id, status: "SUBMITTED" },
      select: { id: true },
    });
    createdApps.push(appA.id);

    const customerB = await prisma.customer.create({
      data: { organizationId: org.id, branchId: branchB, customerNumber: `CUST-T4B-${stamp}`, legalName: `Nasabah Cabang B ${stamp}` },
      select: { id: true },
    });
    createdCustomers.push(customerB.id);
    const appB = await prisma.creditApplication.create({
      data: { organizationId: org.id, branchId: branchB, applicationNumber: `KRD-T4-B-${stamp}`, customerId: customerB.id, status: "SUBMITTED" },
      select: { id: true },
    });
    createdApps.push(appB.id);

    // Dokumen pada cabang B (dibuat langsung di DB, di luar cakupan userA).
    // Pengunggahnya sengaja bukan userA — pengunggah selalu boleh mengakses
    // berkasnya sendiri, sehingga uji lintas cabang membutuhkan pengunggah lain.
    const docBEmail = `doc-b-${stamp}@${TEST_DOMAIN}`;
    const docBUserId = await makeUser(docBEmail, branchB, docRoleId, org.id);
    const foreignSaved = await savePrivateDocument(PNG_BYTES, "png");
    createdFiles.push(foreignSaved.key);
    const docB = await prisma.document.create({
      data: {
        organizationId: org.id,
        ownerType: "CREDIT_APPLICATION",
        ownerId: appB.id,
        documentType: "KTP",
        fileName: `ktp-cabang-b-${stamp}.png`,
        filePath: `private:${foreignSaved.key}`,
        fileExt: "png",
        fileSize: PNG_BYTES.length,
        mimeType: "image/png",
        uploadedById: docBUserId,
        status: "ACTIVE",
        notes: "Data uji lintas cabang",
      },
      select: { id: true },
    });
    createdDocs.push(docB.id);

    const jarA = await login(userAEmail, password, "10.6.6.1");
    const jarView = await login(viewEmail, password, "10.6.6.2");
    const jarOrgB = await login(orgBEmail, password, "10.6.6.3");
    check(
      "login ketiga pengguna uji berhasil",
      jarA.hasSessionToken() && jarView.hasSessionToken() && jarOrgB.hasSessionToken()
    );

    console.log("\n== A. Jalur publik ditutup ==");

    const legacyPublic = await fetch(`${BASE}/uploads/documents/ktp-budi.pdf`, { redirect: "manual" });
    check("permintaan anonim ke /uploads/documents/* → 404", legacyPublic.status === 404, String(legacyPublic.status));

    const privateLeak = await fetch(`${BASE}/uploads/${foreignSaved.key}`, { redirect: "manual" });
    check("kunci penyimpanan privat tidak dapat diakses lewat /uploads", privateLeak.status === 404, String(privateLeak.status));

    const heroDir = `${process.cwd()}/public/uploads/hero`;
    const heroFile = existsSync(heroDir)
      ? (readdirSync(heroDir).find((name) => !name.startsWith(".")) || null)
      : null;
    if (heroFile) {
      const heroRes = await fetch(`${BASE}/uploads/hero/${heroFile}`, { redirect: "manual" });
      check("aset CMS publik (/uploads/hero/*) tetap dapat diakses", heroRes.status === 200, String(heroRes.status));
    } else {
      console.log("LEWATI: belum ada berkas contoh di public/uploads/hero.");
    }

    console.log("\n== B. Endpoint unduh wajib autentikasi ==");
    const anonJson = await fetch(`${BASE}/api/documents/${docB.id}/download`, {
      headers: { accept: "application/json" },
      redirect: "manual",
    });
    check("anonim + accept JSON → 401", anonJson.status === 401, String(anonJson.status));

    const anonHtml = await fetch(`${BASE}/api/documents/${docB.id}/download`, {
      headers: { accept: "text/html" },
      redirect: "manual",
    });
    check(
      "anonim + navigasi peramban → diarahkan ke /login",
      anonHtml.status >= 300 && anonHtml.status < 400 && (anonHtml.headers.get("location") || "").includes("/login"),
      `${anonHtml.status} ${anonHtml.headers.get("location")}`
    );

    console.log("\n== C. Unggah tervalidasi ==");
    const okUpload = await uploadDocument(jarA, {
      file: pngBlob(),
      fileName: `uji-${stamp}.png`,
      ownerType: "CREDIT_APPLICATION",
      ownerId: appA.id,
    });
    const okUploadJson = (await okUpload.json()) as { data?: { id?: string; downloadUrl?: string; filePath?: string } };
    check("unggah PNG valid → 201", okUpload.status === 201, `${okUpload.status} ${JSON.stringify(okUploadJson).slice(0, 200)}`);
    const docAId = okUploadJson.data?.id;
    if (docAId) createdDocs.push(docAId);
    check("respons berisi URL unduh terotorisasi", okUploadJson.data?.downloadUrl === `/api/documents/${docAId}/download`);
    check("respons TIDAK membocorkan kunci penyimpanan privat", !JSON.stringify(okUploadJson).includes("private:"));
    check("respons TIDAK mengembalikan filePath", !("filePath" in (okUploadJson.data || {})));

    const fakePdf = await uploadDocument(jarA, {
      file: new Blob([Buffer.from("bukan pdf sama sekali", "utf8")], { type: "application/pdf" }),
      fileName: `palsu-${stamp}.pdf`,
      ownerType: "CREDIT_APPLICATION",
      ownerId: appA.id,
    });
    check("berkas teks bernama .pdf → 400", fakePdf.status === 400, String(fakePdf.status));

    const mismatch = await uploadDocument(jarA, {
      file: new Blob([PNG_BYTES], { type: "image/png" }),
      fileName: `salah-ekstensi-${stamp}.pdf`,
      ownerType: "CREDIT_APPLICATION",
      ownerId: appA.id,
    });
    check("PNG bernama .pdf (ekstensi tidak cocok) → 400", mismatch.status === 400, String(mismatch.status));

    const oversize = await uploadDocument(jarA, {
      file: new Blob([Buffer.concat([Buffer.from("%PDF-", "latin1"), Buffer.alloc(10 * 1024 * 1024, 0x41)])], {
        type: "application/pdf",
      }),
      fileName: `besar-${stamp}.pdf`,
      ownerType: "CREDIT_APPLICATION",
      ownerId: appA.id,
    });
    check("berkas > 10MB → 400", oversize.status === 400, String(oversize.status));

    const crossOwner = await uploadDocument(jarA, {
      file: pngBlob(),
      fileName: `lintas-cabang-${stamp}.png`,
      ownerType: "CREDIT_APPLICATION",
      ownerId: appB.id,
    });
    check("lampiran ke pengajuan cabang lain → 403", crossOwner.status === 403, String(crossOwner.status));

    // Jalur yang dipakai halaman "Dokumen Digital" (repositori umum INTERNAL).
    const internalUpload = await uploadDocument(jarA, {
      file: pngBlob(),
      fileName: `repositori-umum-${stamp}.png`,
      ownerType: "INTERNAL",
      ownerId: "general",
    });
    const internalJson = (await internalUpload.json()) as { data?: { id?: string } };
    check("unggah ke repositori umum (INTERNAL) → 201", internalUpload.status === 201, `${internalUpload.status} ${JSON.stringify(internalJson).slice(0, 160)}`);
    const internalId = internalJson.data?.id;
    if (internalId) createdDocs.push(internalId);
    if (internalId) {
      const internalDownload = await fetch(`${BASE}/api/documents/${internalId}/download`, {
        headers: { cookie: jarA.header() },
        redirect: "manual",
      });
      check("unduh dokumen repositori umum → 200", internalDownload.status === 200, String(internalDownload.status));
      check(
        "unduh dokumen repositori umum menyajikan berkas privat",
        (internalDownload.headers.get("content-type") || "") === "image/png",
        internalDownload.headers.get("content-type") || ""
      );
    }

    console.log("\n== D. Otorisasi unduh ==");
    if (!docAId) throw new Error("Unggah pertama gagal, pengujian dihentikan.");

    const selfDownload = await fetch(`${BASE}/api/documents/${docAId}/download`, {
      headers: { cookie: jarA.header() },
      redirect: "manual",
    });
    const selfBody = Buffer.from(await selfDownload.arrayBuffer());
    check("pengunggah mengunduh miliknya sendiri → 200", selfDownload.status === 200, String(selfDownload.status));
    check("isi berkas identik dengan yang diunggah", selfBody.length === PNG_BYTES.length && selfBody.subarray(0, 8).equals(PNG_BYTES.subarray(0, 8)));
    check("Content-Type ditentukan dari isi berkas", (selfDownload.headers.get("content-type") || "") === "image/png", selfDownload.headers.get("content-type") || "");
    check(
      "Content-Disposition inline untuk tipe aman",
      (selfDownload.headers.get("content-disposition") || "").startsWith("inline"),
      selfDownload.headers.get("content-disposition") || ""
    );
    check(
      "Cache-Control privat + no-store",
      (selfDownload.headers.get("cache-control") || "").includes("private") &&
        (selfDownload.headers.get("cache-control") || "").includes("no-store"),
      selfDownload.headers.get("cache-control") || ""
    );

    const viewDownload = await fetch(`${BASE}/api/documents/${docAId}/download`, {
      headers: { cookie: jarView.header() },
      redirect: "manual",
    });
    check("pengguna tanpa document.download → 403", viewDownload.status === 403, String(viewDownload.status));

    const orgBDownload = await fetch(`${BASE}/api/documents/${docAId}/download`, {
      headers: { cookie: jarOrgB.header() },
      redirect: "manual",
    });
    check("lintas organisasi → 404 (tidak membocorkan keberadaan)", orgBDownload.status === 404, String(orgBDownload.status));

    const crossBranchDownload = await fetch(`${BASE}/api/documents/${docB.id}/download`, {
      headers: { cookie: jarA.header() },
      redirect: "manual",
    });
    check("lintas cabang (pengajuan cabang B) → 404", crossBranchDownload.status === 404, String(crossBranchDownload.status));

    const metaCrossBranch = await fetch(`${BASE}/api/documents/${docB.id}`, {
      headers: { cookie: jarA.header() },
      redirect: "manual",
    });
    check("metadata lintas cabang → 404", metaCrossBranch.status === 404, String(metaCrossBranch.status));

    console.log("\n== E. Daftar & penghapusan ==");
    const list = await fetch(`${BASE}/api/documents?ownerType=CREDIT_APPLICATION`, { headers: { cookie: jarA.header() } });
    const listText = await list.text();
    check("daftar dokumen → 200", list.status === 200, String(list.status));
    check("daftar dokumen tidak membocorkan kunci penyimpanan", !listText.includes("private:"));
    check("daftar dokumen tidak mengembalikan filePath", !listText.includes('"filePath"'));

    const row = await prisma.document.findUnique({ where: { id: docAId }, select: { filePath: true } });
    if (!row) throw new Error("Dokumen uji hilang sebelum penghapusan.");
    deleteFileLater(row.filePath);
    const filePathBeforeDelete = parseDocumentRef(row.filePath);
    const fileExistedBefore = filePathBeforeDelete.kind === "private" && existsSync(resolvePrivateDocumentPath(filePathBeforeDelete.key));
    check("berkas uji tersimpan di penyimpanan privat", fileExistedBefore);

    const deleteNoPerm = await fetch(`${BASE}/api/documents/${docAId}`, {
      method: "DELETE",
      headers: { cookie: jarView.header() },
      redirect: "manual",
    });
    check("penghapusan tanpa document.delete → 403", deleteNoPerm.status === 403, String(deleteNoPerm.status));

    const deleteOk = await fetch(`${BASE}/api/documents/${docAId}`, {
      method: "DELETE",
      headers: { cookie: jarA.header() },
      redirect: "manual",
    });
    check("penghapusan oleh pemilik → 200", deleteOk.status === 200, String(deleteOk.status));

    const afterDelete = filePathBeforeDelete.kind === "private" && !existsSync(resolvePrivateDocumentPath(filePathBeforeDelete.key));
    check("berkas fisik ikut terhapus dari penyimpanan privat", Boolean(afterDelete));

    const downloadAfterDelete = await fetch(`${BASE}/api/documents/${docAId}/download`, {
      headers: { cookie: jarA.header() },
      redirect: "manual",
    });
    check("unduh setelah dihapus → 404", downloadAfterDelete.status === 404, String(downloadAfterDelete.status));

    const auditCount = await prisma.auditLog.count({
      where: { entityType: "DOCUMENT", entityId: { in: [docAId, docB.id] } },
    });
    check("aksi dokumen tercatat dalam audit log (UPLOAD/DOWNLOAD/DELETE)", auditCount >= 3, `${auditCount} catatan`);
  } finally {
    if (createdDocs.length) {
      const rows = await prisma.document.findMany({ where: { id: { in: createdDocs } }, select: { filePath: true } });
      for (const r of rows) deleteFileLater(r.filePath);
      await prisma.auditLog.deleteMany({ where: { entityType: "DOCUMENT", entityId: { in: createdDocs } } });
      await prisma.document.deleteMany({ where: { id: { in: createdDocs } } });
    }
    if (createdApps.length) {
      await prisma.creditStatusHistory.deleteMany({ where: { creditApplicationId: { in: createdApps } } });
      await prisma.creditApplication.deleteMany({ where: { id: { in: createdApps } } });
    }
    if (createdCustomers.length) await prisma.customer.deleteMany({ where: { id: { in: createdCustomers } } });
    if (branchB) await prisma.branch.deleteMany({ where: { id: branchB } });
    if (createdUsers.length) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    if (createdOrgs.length) await prisma.organization.deleteMany({ where: { id: { in: createdOrgs } } });
    if (createdRoles.length) {
      await prisma.rolePermission.deleteMany({ where: { roleId: { in: createdRoles } } });
      await prisma.role.deleteMany({ where: { id: { in: createdRoles } } });
    }
    for (const key of createdFiles) {
      try {
        const { rm } = await import("fs/promises");
        await rm(resolvePrivateDocumentPath(key), { force: true });
      } catch {
        /* berkas mungkin sudah terhapus */
      }
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
