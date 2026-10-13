/**
 * Verifikasi Tahap 2A + 2B (P0.2) — master nasabah/debitur terpisah dari pegawai,
 * riwayat identitas, deteksi duplikasi, hubungan antar-pihak, dan persetujuan data.
 * Tidak memerlukan server aplikasi, tetapi memerlukan koneksi database.
 *
 *   npm run verify:customers
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildCustomerNumber,
  createCustomerWithNumber,
  diffIdentitySnapshots,
  findCustomerByIdentity,
  findDuplicateCandidates,
  isValidIdentity,
  isValidNIK,
  maskIdentity,
  normalizeIdentityNumber,
  pickIdentitySnapshot,
  recordCustomerIdentityHistory,
} from "../src/lib/customer";

const prisma = new PrismaClient();

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail?: string): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "OK   " : "GAGAL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

function logicTests(): void {
  console.log("== 1. Aturan identitas & nomor nasabah ==");

  check(
    "NIK dibersihkan dari spasi/titik/dash",
    normalizeIdentityNumber(" 3171.01-234 5678901 ") === "3171012345678901",
    String(normalizeIdentityNumber(" 3171.01-234 5678901 "))
  );
  check("nilai kosong menjadi null", normalizeIdentityNumber("") === null);
  check("NIK 16 digit diterima", isValidNIK("3171012345678901"));
  check("NIK 15 digit ditolak", !isValidNIK("317101234567890"));
  check("NIK berhuruf ditolak", !isValidNIK("31710123456789ab"));

  check("identitas kosong boleh (opsional)", isValidIdentity("INDIVIDU", null));
  check("NIK valid untuk INDIVIDU diterima", isValidIdentity("INDIVIDU", "3171012345678901"));
  check("NIK tidak valid untuk INDIVIDU ditolak", !isValidIdentity("INDIVIDU", "12345"));
  check("ID usaha pendek untuk BADAN ditolak", !isValidIdentity("BADAN", "12"));
  check("ID usaha wajar untuk BADAN diterima", isValidIdentity("BADAN", "NIB-123456"));

  check("format nomor nasabah benar", buildCustomerNumber(2026, 1) === "CUST-2026-0001", buildCustomerNumber(2026, 1));
  check("nomor nasabah >9999 tetap unik", buildCustomerNumber(2026, 12345) === "CUST-2026-12345");
}

async function schemaTests(): Promise<void> {
  console.log("\n== 2. Struktur tabel ==");

  const customerTable = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  `;
  check("tabel customers tersedia", Number(customerTable[0].n) === 1);

  const appColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'credit_applications' AND column_name IN ('customer_id', 'applicant_id')
  `;
  const cols = appColumns.map((c) => c.column_name);
  check("credit_applications memiliki customer_id", cols.includes("customer_id"), cols.join(", "));
  check("credit_applications tidak lagi memiliki applicant_id", !cols.includes("applicant_id"), cols.join(", "));

  const fks = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'credit_applications' AND constraint_name = 'credit_applications_customer_id_fkey'
  `;
  check("FK credit_applications.customer_id -> customers terpasang", fks.length === 1);
}

async function integrityTests(): Promise<void> {
  console.log("\n== 3. Integritas relasi pengajuan -> nasabah ==");

  const apps = await prisma.creditApplication.findMany({
    select: {
      id: true,
      organizationId: true,
      customerId: true,
      notes: true,
      customer: { select: { id: true, organizationId: true, legalName: true, customerNumber: true } },
    },
  });

  check("setiap pengajuan memiliki customer_id", apps.every((a) => Boolean(a.customerId)), `${apps.filter((a) => !a.customerId).length} kosong`);
  check("setiap pengajuan punya nasabah yang valid", apps.every((a) => Boolean(a.customer)), `${apps.filter((a) => !a.customer).length} tanpa nasabah`);
  check(
    "organisasi pengajuan == organisasi nasabah",
    apps.every((a) => !a.customer || a.customer.organizationId === a.organizationId),
    apps.filter((a) => a.customer && a.customer.organizationId !== a.organizationId).map((a) => a.id).join(", ")
  );

  const notesWithIdentity = apps.filter((a) => /\[NIK KTP:|\[Alamat Pemohon:/.test(a.notes || ""));
  check("tidak ada NIK/alamat tersisa di catatan bebas", notesWithIdentity.length === 0, `${notesWithIdentity.length} catatan`);

  // Nomor nasabah unik per organisasi.
  const customers = await prisma.customer.findMany({
    select: { id: true, organizationId: true, customerNumber: true, legalName: true, legacyApplicantUserId: true },
  });
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const c of customers) {
    const key = `${c.organizationId}:${c.customerNumber}`;
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  check("nomor nasabah unik per organisasi", dupes.length === 0, dupes.join(", "));
  check("semua nasabah punya nama legal", customers.every((c) => Boolean(c.legalName && c.legalName.trim())));
  check(
    "semua nasabah punya nomor CUST-YYYY-NNNN",
    customers.every((c) => /^CUST-\d{4}-\d{4,}$/.test(c.customerNumber)),
    customers.filter((c) => !/^CUST-\d{4}-\d{4,}$/.test(c.customerNumber)).map((c) => c.customerNumber).join(", ")
  );

  // Nasabah hasil migrasi harus tetap dapat ditelusuri ke baris users lama.
  const migrated = customers.filter((c) => c.legacyApplicantUserId);
  const legacyUsers = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(legacyUsers.map((u) => u.id));
  check(
    "nasabah migrasi menunjuk baris users lama yang masih ada",
    migrated.every((c) => c.legacyApplicantUserId && userIds.has(c.legacyApplicantUserId)),
    migrated.filter((c) => !c.legacyApplicantUserId || !userIds.has(c.legacyApplicantUserId)).map((c) => c.id).join(", ")
  );

  console.log(`\nRingkasan data: ${customers.length} nasabah, ${apps.length} pengajuan kredit, ${migrated.length} nasabah hasil migrasi.`);
}

async function integrationTests(): Promise<void> {
  console.log("\n== 4. Operasi nasabah pada database (uji lalu bersihkan) ==");

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    check("organisasi tersedia untuk uji integrasi", false);
    return;
  }

  const nik = "9999888877776666";
  const emailMarker = `verify-cust-${Date.now()}@example.test`;
  const created: string[] = [];

  try {
    const c1 = await createCustomerWithNumber(org.id, {
      legalName: "Nasabah Uji Verifikasi",
      identityType: "KTP",
      identityNumber: nik,
      phone: "081200000001",
      email: emailMarker,
      status: "PROSPEK",
    });
    created.push(c1.id);
    check("nasabah uji dibuat dengan nomor valid", /^CUST-\d{4}-\d{4,}$/.test(c1.customerNumber), c1.customerNumber);

    const found = await findCustomerByIdentity(org.id, nik);
    check("pencarian berdasarkan NIK menemukan nasabah uji", found?.id === c1.id);

    const normalizedFind = await findCustomerByIdentity(org.id, "9999.8888-7777 6666");
    check("pencarian NIK ternormalisasi menemukan nasabah uji", normalizedFind?.id === c1.id);

    const c2 = await createCustomerWithNumber(org.id, { legalName: "Nasabah Uji Verifikasi 2" });
    created.push(c2.id);
    check("nomor nasabah kedua berbeda", c2.customerNumber !== c1.customerNumber, `${c1.customerNumber} vs ${c2.customerNumber}`);

    const noIdentity = await findCustomerByIdentity(org.id, null);
    check("pencarian tanpa NIK tidak mengembalikan apa pun", noIdentity === null);
  } finally {
    if (created.length) {
      await prisma.customer.deleteMany({ where: { id: { in: created } } });
      const leftover = await prisma.customer.count({ where: { id: { in: created } } });
      check("data uji dibersihkan", leftover === 0, `${leftover} tersisa`);
    }
  }
}

function sourceGuardTests(): void {
  console.log("\n== 5. Penjaga sumber (mencegah regresi ke akun pegawai) ==");

  const routeSrc = readFileSync(
    join(__dirname, "../src/app/api/credit/applications/route.ts"),
    "utf8"
  );
  const schemaSrc = readFileSync(join(__dirname, "../prisma/schema.prisma"), "utf8");

  check("route pengajuan tidak pernah membuat akun pegawai (db.user.create)", !/db\.user\.create/.test(routeSrc));
  check("route pengajuan tidak menyentuh passwordHash", !/passwordHash/.test(routeSrc));
  check("route pengajuan membuat/menautkan nasabah", /createCustomerWithNumber/.test(routeSrc) && /customerId/.test(routeSrc));
  check("route pengajuan tidak lagi menulis NIK ke catatan bebas", !/\[NIK KTP:/.test(routeSrc) && !/\[Alamat Pemohon:/.test(routeSrc));

  const creditBlock = schemaSrc.slice(
    schemaSrc.indexOf("model CreditApplication {"),
    schemaSrc.indexOf("model CreditStatusHistory {")
  );
  check("skema CreditApplication memakai customerId", /\bcustomerId\b/.test(creditBlock));
  check("skema CreditApplication tidak lagi memakai applicantId", !/\bapplicantId\b/.test(creditBlock));
}

async function stage2BTests(): Promise<void> {
  console.log("\n== 6. Tahap 2B: riwayat, duplikasi, hubungan, consent ==");

  // 6a. Logika snapshot & diff
  const snapshot = pickIdentitySnapshot({
    legalName: "Budi",
    identityNumber: "3171012345678901",
    phone: "0812",
    status: "AKTIF", // bukan field identitas → harus diabaikan
  });
  check("snapshot hanya memuat field identitas", !("status" in snapshot) && "legalName" in snapshot);
  const diff = diffIdentitySnapshots(
    { legalName: "Budi", phone: "0812", identityNumber: null },
    { legalName: "Budi Santoso", phone: "0812", identityNumber: "3171012345678901" }
  );
  check("diff mendeteksi field yang berubah", diff.changedFields.includes("legalName") && diff.changedFields.includes("identityNumber"), diff.changedFields.join(","));
  check("diff tidak menandai field yang sama", !diff.changedFields.includes("phone"));
  check("masking identitas menyembunyikan sebagian digit", maskIdentity("3171012345678901") === "************8901", String(maskIdentity("3171012345678901")));

  // 6b. Struktur tabel baru
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('customer_identity_histories', 'customer_relationships', 'customer_consents')
  `;
  check("tabel riwayat/hubungan/consent tersedia", tables.length === 3, tables.map((t) => t.table_name).join(", "));

  // 6c. Integrasi DB
  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) {
    check("organisasi tersedia untuk uji 2B", false);
    return;
  }

  const stamp = Date.now();
  const nikA = `8888${String(stamp).slice(-12)}`;
  const nameA = `Nasabah Dua B ${stamp}`;
  const birth = "1990-05-15";
  const created: string[] = [];

  try {
    const a = await createCustomerWithNumber(org.id, {
      legalName: nameA,
      identityType: "KTP",
      identityNumber: nikA,
      phone: "081255500001",
      birthDate: new Date(birth),
      status: "PROSPEK",
    });
    const b = await createCustomerWithNumber(org.id, { legalName: `Pasangan ${stamp}`, status: "PROSPEK" });
    created.push(a.id, b.id);

    const dupIdentity = await findDuplicateCandidates(org.id, { identityNumber: nikA });
    check("deteksi duplikat NIK (IDENTITY_EXACT)", dupIdentity.some((d) => d.id === a.id && d.matchReasons.includes("IDENTITY_EXACT")));
    check("hasil duplikat menyamarkan NIK", dupIdentity.every((d) => !d.identityNumberMasked || d.identityNumberMasked.includes("*")));

    const dupPhone = await findDuplicateCandidates(org.id, { phone: "081255500001" });
    check("deteksi duplikat telepon (PHONE_EXACT)", dupPhone.some((d) => d.id === a.id && d.matchReasons.includes("PHONE_EXACT")));

    const dupName = await findDuplicateCandidates(org.id, { legalName: nameA, birthDate: birth });
    check("deteksi duplikat nama+tanggal lahir", dupName.some((d) => d.id === a.id && d.matchReasons.includes("NAME_BIRTHDATE")));

    const dupNone = await findDuplicateCandidates(org.id, { identityNumber: "1111222233334444" });
    check("identitas berbeda tidak dianggap duplikat", dupNone.length === 0, `${dupNone.length}`);

    const excluded = await findDuplicateCandidates(org.id, { identityNumber: nikA, excludeCustomerId: a.id });
    check("excludeCustomerId mengabaikan nasabah sendiri", !excluded.some((d) => d.id === a.id));

    // Riwayat identitas
    await recordCustomerIdentityHistory({
      customerId: a.id,
      action: "CREATE",
      newValues: pickIdentitySnapshot(a),
    });
    await recordCustomerIdentityHistory({
      customerId: a.id,
      action: "UPDATE",
      changedFields: ["phone"],
      oldValues: { phone: "081255500001" },
      newValues: { phone: "081255500002" },
    });
    const histories = await prisma.customerIdentityHistory.findMany({ where: { customerId: a.id } });
    check("riwayat identitas tersimpan (2 baris)", histories.length === 2, `${histories.length}`);
    check("riwayat mencatat field yang berubah", histories.some((h) => JSON.stringify(h.changedFields).includes("phone")));

    // Hubungan antar-pihak
    await prisma.customerRelationship.create({
      data: { customerId: a.id, relatedCustomerId: b.id, relationshipType: "SPOUSE" },
    });
    const rels = await prisma.customerRelationship.findMany({ where: { customerId: a.id } });
    check("hubungan antar-pihak tersimpan", rels.length === 1 && rels[0].relatedCustomerId === b.id);

    // Persetujuan data pribadi
    await prisma.customerConsent.create({
      data: { customerId: a.id, consentType: "DATA_PROCESSING", granted: true, grantedAt: new Date() },
    });
    await prisma.customerConsent.create({
      data: { customerId: a.id, consentType: "DATA_PROCESSING", granted: false, revokedAt: new Date() },
    });
    const consents = await prisma.customerConsent.findMany({ where: { customerId: a.id } });
    check("catatan persetujuan (beri & cabut) tersimpan", consents.length === 2 && consents.some((c) => !c.granted));
  } finally {
    if (created.length) {
      await prisma.customerRelationship.deleteMany({ where: { customerId: { in: created } } });
      await prisma.customerConsent.deleteMany({ where: { customerId: { in: created } } });
      await prisma.customerIdentityHistory.deleteMany({ where: { customerId: { in: created } } });
      await prisma.customer.deleteMany({ where: { id: { in: created } } });
      const leftover = await prisma.customer.count({ where: { id: { in: created } } });
      check("data uji 2B dibersihkan", leftover === 0, `${leftover} tersisa`);
    }
  }
}

async function main(): Promise<void> {
  logicTests();
  await schemaTests();
  await integrityTests();
  await integrationTests();
  sourceGuardTests();
  await stage2BTests();

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
