/**
 * Verifikasi Tahap 5A (P0.5) — penyimpanan hasil analisa SLIK terkait debitur.
 * Tidak memerlukan server aplikasi, tetapi memerlukan koneksi database.
 * Data uji dibuat lalu DIHAPUS kembali di blok cleanup.
 *
 *   npm run verify:slik-records
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { readdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { normalizeSlikAnalysis, type SlikAnalysis } from "../src/lib/slik/types";
import {
  isContinuationStatus,
  isValidOverrideReason,
  overrideRoleLabel,
  resolveOverrideActor,
} from "../src/lib/slik/override";
import { detectCorrections, validateVerificationInput } from "../src/lib/slik/verification";
import {
  buildScopeFilter,
  recordInScope,
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

const SAMPLE_RESULT: SlikAnalysis = {
  header: { nomor_laporan: "SLIK-TEST-001", posisi_data: "31 Agustus 2026", operator: "AO Uji" },
  data_pribadi: {
    nama_lengkap: "Nasabah Uji Tahap 5A",
    nik: "0000000000000000",
    ttl_usia: "41 Tahun",
    pekerjaan: "Wiraswasta",
    pendidikan: "SMA",
  },
  ringkasan_eksposur: {
    total_baki_debet: 1500000000,
    plafon_efektif: "Rp 2.000.000.000",
    kualitas_terburuk: "1",
    total_kreditur: "2",
    total_fasilitas: "3",
  },
  rincian_tunggakan: { tunggakan_pokok: 0, tunggakan_bunga: 0, denda_berjalan: 0, total_tunggakan_real: 0 },
  fasilitas: [],
  analisis_dan_rekomendasi: {
    ringkasan_angsuran: [],
    total_estimasi_angsuran_bulanan: "Rp 0/bulan",
    inventarisasi_agunan: [],
    catatan_kritis_karakter: [],
    keputusan_komite: { rekomendasi: "CONSIDER", risk_rating: "MEDIUM RISK", saran_tindakan: [], syarat_khusus: [] },
  },
};

function logicTests(): void {
  console.log("== 1. Normalisasi header (keterlacakan hasil) ==");
  const { data } = normalizeSlikAnalysis({
    header: { nomor_laporan: 12345, operator: "AO Cabang Utama" },
  });
  check("nomor_laporan angka -> string", data.header.nomor_laporan === "12345", data.header.nomor_laporan);
  check("operator dinormalisasi", data.header.operator === "AO Cabang Utama", data.header.operator);
  const empty = normalizeSlikAnalysis({}).data.header;
  check(
    "header kosong -> fallback aman",
    empty.nomor_laporan === "-" && empty.posisi_data === "-" && empty.operator === "-",
    JSON.stringify(empty)
  );

  console.log("== 1b. Aturan alasan penerusan meski rekomendasi AI REJECT ==");
  check("status ANALYSIS/SURVEY/DECISION/APPROVED = penerusan", isContinuationStatus("ANALYSIS") && isContinuationStatus("SURVEY") && isContinuationStatus("DECISION") && isContinuationStatus("APPROVED"));
  check("status RETURNED/REJECTED bukan penerusan", !isContinuationStatus("RETURNED") && !isContinuationStatus("REJECTED"));
  check("alasan terlalu pendek ditolak", !isValidOverrideReason("pendek") && !isValidOverrideReason("") && !isValidOverrideReason(123));
  check("alasan wajar diterima", isValidOverrideReason("Tunggakan berasal dari fasilitas yang sudah lunas."));
  check("label peran benar", overrideRoleLabel("AO") === "Account Officer" && overrideRoleLabel("SURVEY") === "Petugas Survei Lapangan");
  check(
    "label peran baru benar",
    overrideRoleLabel("VERIFIER") === "Verifikator" &&
      overrideRoleLabel("ADMIN") === "Super Admin" &&
      overrideRoleLabel("DIRECTOR") === "Direksi"
  );

  const actor = { id: "user-1", userRoles: [{ role: { code: "CREDIT_ANALYST" } }] };
  check(
    "penugasan marketing officer = Account Officer",
    resolveOverrideActor(actor, { assignedMarketingOfficerId: "user-1" }) === "AO"
  );
  check(
    "penugasan survey officer = petugas survei",
    resolveOverrideActor(actor, { assignedSurveyOfficerId: "user-1" }) === "SURVEY"
  );
  check(
    "kode peran AO_MARKETING/FIELD_OFFICER dikenali",
    resolveOverrideActor({ id: "u", userRoles: [{ role: { code: "AO_MARKETING" } }] }, {}) === "AO" &&
      resolveOverrideActor({ id: "u", userRoles: [{ role: { code: "FIELD_OFFICER" } }] }, {}) === "SURVEY"
  );
  check(
    "analis tanpa izin verifikasi TIDAK berwenang mengisi alasan",
    resolveOverrideActor(actor, {}) === null
  );
  check(
    "pemegang izin verifikasi berwenang mengisi alasan",
    resolveOverrideActor(actor, {}, { canVerify: true }) === "VERIFIER"
  );
  check(
    "Super Admin & Direksi berwenang mengisi alasan",
    resolveOverrideActor({ id: "u", userRoles: [{ role: { code: "ADMIN" } }] }, {}) === "ADMIN" &&
      resolveOverrideActor({ id: "u", userRoles: [{ role: { code: "DIRECTOR" } }] }, {}) === "DIRECTOR"
  );

  console.log("== 1c. Verifikasi manual angka ekstraksi AI ==");
  check(
    "input tanpa angka ditolak",
    validateVerificationInput({ kolektibilitas: "Lancar" }) !== null
  );
  check(
    "angka negatif/bukan angka ditolak",
    validateVerificationInput({ bakiDebet: -1, tunggakan: "abc", kolektibilitas: "1" }) !== null
  );
  check(
    "kolektibilitas wajib diisi",
    validateVerificationInput({ bakiDebet: 1, tunggakan: 1, kolektibilitas: "  " }) !== null
  );
  check(
    "catatan terlalu panjang ditolak",
    validateVerificationInput({ bakiDebet: 1, tunggakan: 1, kolektibilitas: "1", note: "x".repeat(1001) }) !== null
  );
  check(
    "input lengkap sah (termasuk angka nol)",
    validateVerificationInput({ bakiDebet: 0, tunggakan: 12345.67, kolektibilitas: "1 - Lancar", note: "sesuai PDF" }) === null
  );
  const aiFigs = { bakiDebet: 1000000, tunggakan: 0, kolektibilitas: "1" };
  check(
    "tanpa koreksi = daftar kosong",
    detectCorrections(aiFigs, { ...aiFigs }).length === 0
  );
  check(
    "koreksi nilai terdeteksi",
    detectCorrections(aiFigs, { ...aiFigs, bakiDebet: 950000 }).length === 1
  );
  check(
    "koreksi AI-null -> nilai terdeteksi",
    detectCorrections({ ...aiFigs, bakiDebet: null }, { ...aiFigs, bakiDebet: 500000 }).length === 1
  );
  check(
    "koreksi kolektibilitas terdeteksi",
    detectCorrections(aiFigs, { ...aiFigs, kolektibilitas: "2" }).map((c) => c.field).join() === "kolektibilitas"
  );
}

async function dbTests(): Promise<void> {
  console.log("== 2. Tabel slik_analysis_records ==");

  const organization = await prisma.organization.findFirst({ where: { isActive: true } });
  const user = await prisma.user.findFirst({ where: { isActive: true } });
  if (!organization || !user) {
    check("organisasi & pengguna uji tersedia", false, "database belum di-seed");
    return;
  }

  const stamp = Date.now();
  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      customerNumber: `TEST-5A-${stamp}`,
      legalName: "Nasabah Uji Tahap 5A",
      createdById: user.id,
    },
  });
  const application = await prisma.creditApplication.create({
    data: {
      organizationId: organization.id,
      applicationNumber: `TEST-5A-APP-${stamp}`,
      customerId: customer.id,
    },
  });

  const baseRecord = {
    organizationId: organization.id,
    branchId: null,
    customerId: customer.id,
    creditApplicationId: application.id,
    customerName: customer.legalName,
    sourceFileNames: ["slik-uji.pdf"],
    mode: "merge",
    rekomendasi: "CONSIDER",
    riskRating: "MEDIUM RISK",
    modelUsed: "test-model",
    elapsedMs: 1234,
    result: SAMPLE_RESULT as unknown as Prisma.InputJsonValue,
    meta: { warnings: [], sources: [] } as Prisma.InputJsonValue,
    createdById: user.id,
  };

  const createdIds: string[] = [];
  const createdOverrideIds: string[] = [];
  const createdVerificationIds: string[] = [];
  try {
    const record = await prisma.slikAnalysisRecord.create({ data: baseRecord });
    createdIds.push(record.id);
    check("record analisa tersimpan terkait debitur", record.customerId === customer.id);

    const readBack = await prisma.slikAnalysisRecord.findUnique({ where: { id: record.id } });
    const roundTrip = readBack && (readBack.result as unknown as SlikAnalysis);
    check(
      "result JSON roundtrip utuh",
      Boolean(
        roundTrip &&
          roundTrip.header.nomor_laporan === "SLIK-TEST-001" &&
          roundTrip.data_pribadi.nama_lengkap === "Nasabah Uji Tahap 5A" &&
          roundTrip.ringkasan_eksposur.total_baki_debet === 1500000000
      )
    );

    const withRelations = await prisma.slikAnalysisRecord.findUnique({
      where: { id: record.id },
      include: { customer: true, creditApplication: true },
    });
    check(
      "relasi nasabah & pengajuan kredit terbaca",
      Boolean(withRelations?.customer && withRelations?.creditApplication)
    );

    let fkRejected = false;
    try {
      await prisma.slikAnalysisRecord.create({
        data: { ...baseRecord, customerId: randomUUID() },
      });
    } catch {
      fkRejected = true;
    }
    check("FK nasabah wajib sah (record liar ditolak)", fkRejected);

    const migrations = readdirSync(join(process.cwd(), "prisma", "migrations"), {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory());
    check(
      "jumlah folder migrasi = 24 (tidak ada migrasi hilang)",
      migrations.length === 24,
      `ditemukan ${migrations.length}`
    );

    console.log("== 3. Kelayakan debitur & cakupan data ==");
    const registered = await prisma.customer.findFirst({
      where: { id: customer.id, creditApplications: { some: {} } },
      select: { id: true },
    });
    check("nasabah dengan pengajuan terdeteksi 'terdaftar'", Boolean(registered));

    const orphanCustomer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        customerNumber: `TEST-5A-ORPHAN-${stamp}`,
        legalName: "Nasabah Tanpa Pengajuan (Uji)",
        createdById: user.id,
      },
    });
    try {
      const notRegistered = await prisma.customer.findFirst({
        where: { id: orphanCustomer.id, creditApplications: { some: {} } },
        select: { id: true },
      });
      check("nasabah TANPA pengajuan tidak memenuhi syarat", notRegistered === null);
    } finally {
      await prisma.customer.delete({ where: { id: orphanCustomer.id } });
    }

    const scopeOrg: ScopeUser = {
      id: user.id,
      organizationId: organization.id,
      branchId: null,
      roleCodes: ["ADMIN"],
    };
    const scopeOtherOrg: ScopeUser = { ...scopeOrg, organizationId: randomUUID() };
    const scopeAssigned: ScopeUser = { ...scopeOrg, id: randomUUID(), roleCodes: ["FIELD_OFFICER"] };
    const assignment = { assignmentFields: ["createdById"] };

    check("recordInScope: cakupan organisasi -> true", recordInScope(scopeOrg, record, assignment));
    check(
      "recordInScope: organisasi berbeda -> false",
      !recordInScope(scopeOtherOrg, record, assignment)
    );
    check(
      "recordInScope: petugas lapangan atas record orang lain -> false",
      !recordInScope(scopeAssigned, record, assignment)
    );
    check(
      "recordInScope: petugas lapangan atas record sendiri -> true",
      recordInScope({ ...scopeAssigned, id: user.id }, record, assignment)
    );

    const filter = buildScopeFilter(scopeOrg, { assignmentFields: ["createdById"] }) as Prisma.SlikAnalysisRecordWhereInput;
    const scopedCount = await prisma.slikAnalysisRecord.count({ where: { ...filter, id: record.id } });
    check("buildScopeFilter menemukan record dalam cakupan", scopedCount === 1);
    const filteredOut = await prisma.slikAnalysisRecord.count({
      where: {
        ...(buildScopeFilter(scopeOtherOrg, { assignmentFields: ["createdById"] }) as Prisma.SlikAnalysisRecordWhereInput),
        id: record.id,
      },
    });
    check("buildScopeFilter menyembunyikan record di luar cakupan", filteredOut === 0);

    console.log("== 4. Alasan penerusan meski rekomendasi AI REJECT ==");
    const override = await prisma.creditSlikOverride.create({
      data: {
        organizationId: organization.id,
        creditApplicationId: application.id,
        slikAnalysisRecordId: record.id,
        rekomendasi: "REJECT",
        reason: "Tunggakan berasal dari fasilitas yang sudah lunas dan terdapat agunan tambahan.",
        recordedById: user.id,
        recordedByName: user.fullName,
        recordedByRole: "AO",
      },
    });
    createdOverrideIds.push(override.id);

    const overrideBack = await prisma.creditSlikOverride.findUnique({
      where: { id: override.id },
      include: { slikAnalysisRecord: true, creditApplication: true },
    });
    check(
      "alasan penerusan tersimpan & terkait analisa + pengajuan",
      Boolean(overrideBack?.slikAnalysisRecord && overrideBack?.creditApplication)
    );

    const covered = await prisma.creditSlikOverride.findFirst({
      where: { creditApplicationId: application.id, slikAnalysisRecordId: record.id },
      select: { id: true },
    });
    check("alasan yang menanggapi analisa ditemukan (gate terpuaskan)", Boolean(covered));

    const uncovered = await prisma.creditSlikOverride.findFirst({
      where: { creditApplicationId: application.id, slikAnalysisRecordId: randomUUID() },
      select: { id: true },
    });
    check("alasan tidak berlaku untuk analisa lain (analisa REJECT baru wajib ditanggapi)", uncovered === null);

    console.log("== 5. Verifikasi manual angka ekstraksi AI ==");
    const verification = await prisma.slikAnalysisVerification.create({
      data: {
        organizationId: organization.id,
        slikAnalysisRecordId: record.id,
        aiBakiDebet: 1000000,
        aiTunggakan: 0,
        aiKolektibilitas: "1",
        confirmedBakiDebet: 950000, // koreksi terhadap dokumen asli
        confirmedTunggakan: 0,
        confirmedKolektibilitas: "1",
        note: "Angka AI beda dengan dokumen asli (tabel halaman 2 terpotong).",
        verifiedById: user.id,
        verifiedByName: user.fullName,
      },
    });
    createdVerificationIds.push(verification.id);

    const verificationBack = await prisma.slikAnalysisVerification.findUnique({
      where: { id: verification.id },
      include: { slikAnalysisRecord: true, verifiedBy: true },
    });
    check(
      "verifikasi tersimpan & terkait record + petugas",
      Boolean(verificationBack?.slikAnalysisRecord && verificationBack?.verifiedBy)
    );
    check(
      "snapshot nilai AI ikut tersimpan sebagai pembanding",
      Number(verificationBack?.aiBakiDebet) === 1000000 && verificationBack?.aiKolektibilitas === "1"
    );
    check(
      "koreksi terdeteksi (AI ≠ konfirmasi petugas)",
      verificationBack
        ? detectCorrections(
            {
              bakiDebet: Number(verificationBack.aiBakiDebet),
              tunggakan: Number(verificationBack.aiTunggakan),
              kolektibilitas: verificationBack.aiKolektibilitas,
            },
            {
              bakiDebet: Number(verificationBack.confirmedBakiDebet),
              tunggakan: Number(verificationBack.confirmedTunggakan),
              kolektibilitas: verificationBack.confirmedKolektibilitas,
            }
          ).length === 1
        : false
    );

    const gatePassed = await prisma.slikAnalysisVerification.findFirst({
      where: { slikAnalysisRecordId: record.id },
      select: { id: true },
    });
    check("gate 5C terpuaskan bila ada verifikasi untuk analisa terkait", Boolean(gatePassed));
  } finally {
    for (const id of createdVerificationIds) {
      await prisma.slikAnalysisVerification.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdOverrideIds) {
      await prisma.creditSlikOverride.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdIds) {
      await prisma.slikAnalysisRecord.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.creditApplication.delete({ where: { id: application.id } }).catch(() => undefined);
    await prisma.customer.delete({ where: { id: customer.id } }).catch(() => undefined);
    console.log("   (data uji dibersihkan)");
  }
}

async function main() {
  try {
    logicTests();
    await dbTests();
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${checks - failures}/${checks} pemeriksaan lulus.`);
  if (failures > 0) {
    console.error(`GAGAL: ${failures} pemeriksaan tidak terpenuhi.`);
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error("Kesalahan tak terduga:", error);
  await prisma.$disconnect();
  process.exit(1);
});
