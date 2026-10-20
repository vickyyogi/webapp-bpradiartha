/**
 * Tahap 9B–9F (P1.1) — verifikasi aturan tata kelola kredit.
 * Jalankan: npm run verify:credit-governance
 */
import assert from "assert";
import { db } from "../src/lib/db";
import {
  APPLICATION_NUMBER_MAX_RETRIES,
  effectiveLimitsForBranch,
  generateApplicationNumber,
  missingRequiredDocuments,
  normalizeCommitteeDecision,
  requiredDocumentsForProduct,
  validateChecklistUpdate,
  validateDisbursementReady,
  validateReturnReason,
  validateStandardAnalysis,
  validateStandardSurvey,
} from "../src/lib/credit-governance";

let passed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`OK    ${label}`);
  } catch (error) {
    console.error(`FAIL  ${label}`);
    console.error("      " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}

const products = [
  {
    name: "Kredit Modal Kerja",
    attributes: { requiredDocuments: ["KTP", "KK", "BUSINESS_DOC"] },
  },
  { name: "Kredit Tanpa Syarat", attributes: {} },
];

check("9B: limit cabang menggantikan limit organisasi", () => {
  const limits = [
    { branchId: null, levelName: "Pusat", maxAmount: 1_000_000_000 },
    { branchId: "cabang-a", levelName: "Cabang A", maxAmount: 100_000_000 },
  ];
  assert.deepStrictEqual(
    effectiveLimitsForBranch(limits, "cabang-a").map((limit) => limit.levelName),
    ["Cabang A"]
  );
  assert.deepStrictEqual(
    effectiveLimitsForBranch(limits, "cabang-b").map((limit) => limit.levelName),
    ["Pusat"]
  );
});

check("9C: dokumen wajib produk dibaca", () => {
  assert.deepStrictEqual(requiredDocumentsForProduct(products, "kredit modal kerja"), [
    "KTP",
    "KK",
    "BUSINESS_DOC",
  ]);
  assert.deepStrictEqual(requiredDocumentsForProduct(products, "Kredit Tanpa Syarat"), []);
});

check("9C: item wajib yang belum dicentang terdeteksi", () => {
  assert.deepStrictEqual(
    missingRequiredDocuments([
      { documentType: "KTP", isRequired: true, isChecked: true },
      { documentType: "KK", isRequired: true, isChecked: false },
      { documentType: "OTHER", isRequired: false, isChecked: false },
    ]),
    ["KK"]
  );
});

check("9C: item wajib tidak boleh dihapus dari checklist", () => {
  const result = validateChecklistUpdate(
    [{ documentType: "KTP", isRequired: true, isChecked: false }],
    [{ documentType: "OTHER", isChecked: true }],
    ["KTP"]
  );
  assert.match(result.error ?? "", /wajib tidak boleh dihapus/);
});

check("9C: klien tidak bisa menurunkan status wajib", () => {
  const result = validateChecklistUpdate([], [{ documentType: "KTP", isChecked: true }], ["KTP"]);
  assert.strictEqual(result.error, null);
  assert.strictEqual(result.items[0].isRequired, true);
});

check("9C: alasan pengembalian minimal 10 karakter", () => {
  assert.ok(validateReturnReason("pendek"));
  assert.strictEqual(validateReturnReason("Berkas KTP tidak terbaca jelas"), null);
});

const completeAnalysis = {
  characterNotes: "Riwayat pembayaran baik",
  monthlyIncome: 10_000_000,
  monthlyExpense: 4_000_000,
  installmentCapacity: 3_000_000,
  dsrRatio: 30,
  collateralType: "SHM",
  collateralAddress: "Jl. Contoh",
  marketValue: 300_000_000,
  liquidationValue: 240_000_000,
  businessCondition: "Stabil",
  marketRisk: "Rendah",
  analystRecommendation: "LAYAK",
  analystNotes: "Kapasitas memadai",
};

check("9D: analisis 5C lengkap diterima", () => {
  assert.strictEqual(validateStandardAnalysis(completeAnalysis), null);
});

check("9D: analisis tidak lengkap ditolak", () => {
  assert.match(validateStandardAnalysis({ ...completeAnalysis, collateralAddress: "" }) ?? "", /belum lengkap/);
  assert.match(validateStandardAnalysis({ ...completeAnalysis, monthlyIncome: -1 }) ?? "", /angka nol atau lebih/);
});

const completeSurvey = {
  surveyDate: "2026-10-20",
  surveyLocation: "Jl. Contoh",
  interviewee: "Pemilik usaha",
  businessStatus: "Aktif",
  physicalCondition: "Baik",
  surveyFindingNotes: "Usaha berjalan",
  surveyRecommendation: "DIREKOMENDASIKAN",
};

check("9D: survei lengkap diterima", () => {
  assert.strictEqual(validateStandardSurvey(completeSurvey), null);
  assert.match(validateStandardSurvey({ ...completeSurvey, surveyDate: "bukan-tanggal" }) ?? "", /Tanggal survei/);
});

const committee = {
  scheduledAt: "2026-10-20T09:00:00.000Z",
  decidedAt: "2026-10-20T10:00:00.000Z",
  quorumRequired: 2,
  participants: [
    { name: "Direktur", role: "Ketua", present: true, vote: "APPROVE" },
    { name: "Analis", role: "Anggota", present: true, vote: "APPROVE" },
    { name: "Komite", role: "Anggota", present: false, vote: "ABSTAIN" },
  ],
  decision: "APPROVED",
  notes: "Layak dengan syarat agunan diikat",
};

check("9E: kuorum terpenuhi diterima", () => {
  const parsed = normalizeCommitteeDecision(committee);
  assert.strictEqual(parsed.error, null);
  assert.strictEqual(parsed.value?.participants.length, 3);
});

check("9E: kuorum kurang ditolak", () => {
  const parsed = normalizeCommitteeDecision({ ...committee, quorumRequired: 3 });
  assert.match(parsed.error ?? "", /Kuorum belum terpenuhi/);
});

check("9E: waktu keputusan sebelum sidang ditolak", () => {
  const parsed = normalizeCommitteeDecision({
    ...committee,
    decidedAt: "2026-10-20T08:00:00.000Z",
  });
  assert.match(parsed.error ?? "", /tidak boleh lebih awal/);
});

check("9E: risalah wajib beralasan", () => {
  const parsed = normalizeCommitteeDecision({ ...committee, notes: "ok" });
  assert.match(parsed.error ?? "", /minimal 10/);
});

check("9F: pencairan tertahan bila syarat belum dipenuhi", () => {
  assert.match(
    validateDisbursementReady([
      { description: "Agunan diikat HT", isSatisfied: true },
      { description: "Asuransi aktif", isSatisfied: false },
    ]) ?? "",
    /Asuransi aktif/
  );
  assert.strictEqual(validateDisbursementReady([{ description: "Agunan diikat HT", isSatisfied: true }]), null);
});

check("9F: nomor aplikasi unik berformat KRD-YYYYMMDD-NNNNNN", () => {
  const numbers = new Set(Array.from({ length: 200 }, () => generateApplicationNumber(new Date("2026-10-20"))));
  assert.strictEqual(numbers.size, 200);
  assert.ok([...numbers].every((value) => /^KRD-20261020-\d{6}$/.test(value)));
  assert.ok(APPLICATION_NUMBER_MAX_RETRIES >= 2);
});

async function databaseChecks() {
  const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string; is_nullable: string }>>`
    SELECT table_name, column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('credit_approval_limits', 'credit_document_checklists', 'credit_committee_decisions', 'credit_disbursement_conditions')
      AND column_name IN ('branch_id', 'is_required', 'quorum_required', 'is_satisfied')
  `;
  const key = (table: string, column: string) => columns.find((row) => row.table_name === table && row.column_name === column);

  check("9B: kolom branch_id pada limit ada dan nullable", () => {
    assert.ok(key("credit_approval_limits", "branch_id"));
    assert.strictEqual(key("credit_approval_limits", "branch_id")?.is_nullable, "YES");
  });
  check("9C: tabel checklist memiliki is_required", () => {
    assert.ok(key("credit_document_checklists", "is_required"));
  });
  check("9E: tabel komite memiliki quorum_required", () => {
    assert.ok(key("credit_committee_decisions", "quorum_required"));
  });
  check("9F: tabel syarat memiliki is_satisfied", () => {
    assert.ok(key("credit_disbursement_conditions", "is_satisfied"));
  });
}

databaseChecks()
  .catch((error) => {
    console.error("FAIL  pemeriksaan skema database");
    console.error("      " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    console.log(`\n${passed} pemeriksaan lulus${process.exitCode ? " (ada kegagalan)" : ""}.`);
  });
