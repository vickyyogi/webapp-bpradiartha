/**
 * Tahap 9B–9F (P1.1) — aturan tata kelola kredit yang diuji terpisah dari UI.
 * Semua keputusan tetap di server; berkas ini hanya berisi fungsi murni agar
 * dapat dijalankan dengan ts-node (lihat scripts/verify-credit-governance.ts).
 */
import { randomInt } from "crypto";

export const RETURN_REASON_MIN_LENGTH = 10;
export const DECISION_NOTES_MIN_LENGTH = 10;

export type ChecklistInput = {
  documentType: string;
  isChecked?: boolean;
  note?: string | null;
};

export type ChecklistState = {
  documentType: string;
  isRequired: boolean;
  isChecked: boolean;
};

/** Dokumen wajib produk (kode DocumentType) untuk checklist Tahap 9C. */
export function requiredDocumentsForProduct(
  products: Array<{ name: string; attributes: { requiredDocuments?: string[] } }>,
  productName: string | null | undefined
): string[] {
  const clean = (productName ?? "").trim().toLowerCase();
  if (!clean) return [];
  const product = products.find((item) => item.name.trim().toLowerCase() === clean);
  return [...new Set(product?.attributes.requiredDocuments ?? [])];
}

/** Item wajib yang belum dicentang — penghalang pindah ke analisis/putusan. */
export function missingRequiredDocuments(items: ChecklistState[]): string[] {
  return items
    .filter((item) => item.isRequired && !item.isChecked)
    .map((item) => item.documentType);
}

/**
 * Validasi checklist yang dikirim UI. Item wajib tidak boleh dihapus dan
 * `isRequired` tidak boleh diturunkan oleh klien.
 */
export function validateChecklistUpdate(
  existing: ChecklistState[],
  incoming: ChecklistInput[],
  requiredDocs: string[]
): { error: string | null; items: Array<ChecklistInput & { isRequired: boolean }> } {
  if (!Array.isArray(incoming)) return { error: "Checklist dokumen harus berupa daftar.", items: [] };

  const required = new Set([...requiredDocs, ...existing.filter((item) => item.isRequired).map((item) => item.documentType)]);
  const seen = new Set<string>();
  const items: Array<ChecklistInput & { isRequired: boolean }> = [];

  for (const raw of incoming) {
    const documentType = String(raw?.documentType ?? "").trim().toUpperCase();
    if (!documentType) return { error: "Jenis dokumen checklist tidak boleh kosong.", items: [] };
    if (seen.has(documentType)) return { error: `Jenis dokumen ${documentType} duplikat pada checklist.`, items: [] };
    seen.add(documentType);
    items.push({
      documentType,
      isChecked: Boolean(raw.isChecked),
      note: raw.note ?? null,
      isRequired: required.has(documentType),
    });
  }

  const missingItems = [...required].filter((doc) => !seen.has(doc));
  if (missingItems.length > 0) {
    return { error: `Item wajib tidak boleh dihapus dari checklist: ${missingItems.join(", ")}.`, items: [] };
  }

  return { error: null, items };
}

/** Alasan pengembalian wajib (Tahap 9C). */
export function validateReturnReason(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim().length < RETURN_REASON_MIN_LENGTH) {
    return `Alasan pengembalian wajib diisi minimal ${RETURN_REASON_MIN_LENGTH} karakter.`;
  }
  return null;
}

/** Field minimum formulir analisis 5C terstandardisasi (Tahap 9D). */
export const ANALYSIS_REQUIRED_FIELDS = [
  "characterNotes",
  "monthlyIncome",
  "monthlyExpense",
  "installmentCapacity",
  "collateralType",
  "collateralAddress",
  "marketValue",
  "liquidationValue",
  "businessCondition",
  "analystRecommendation",
  "analystNotes",
] as const;

/** Field minimum formulir survei lapangan terstandardisasi (Tahap 9D). */
export const SURVEY_REQUIRED_FIELDS = [
  "surveyDate",
  "surveyLocation",
  "interviewee",
  "businessStatus",
  "physicalCondition",
  "surveyFindingNotes",
  "surveyRecommendation",
] as const;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

export function validateStandardAnalysis(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "Data analisis 5C harus berupa objek.";
  }
  const data = raw as Record<string, unknown>;
  const missing = ANALYSIS_REQUIRED_FIELDS.filter((field) => isBlank(data[field]));
  if (missing.length > 0) return `Formulir analisis 5C belum lengkap: ${missing.join(", ")}.`;
  for (const field of ["monthlyIncome", "monthlyExpense", "installmentCapacity", "marketValue", "liquidationValue"] as const) {
    const value = Number(data[field]);
    if (!Number.isFinite(value) || value < 0) return `Nilai ${field} harus berupa angka nol atau lebih.`;
  }
  const dsr = data.dsrRatio;
  if (!isBlank(dsr) && (!Number.isFinite(Number(dsr)) || Number(dsr) < 0)) {
    return "Nilai dsrRatio harus berupa angka nol atau lebih.";
  }
  return null;
}

export function validateStandardSurvey(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "Data survei lapangan harus berupa objek.";
  }
  const data = raw as Record<string, unknown>;
  const missing = SURVEY_REQUIRED_FIELDS.filter((field) => isBlank(data[field]));
  if (missing.length > 0) return `Formulir survei lapangan belum lengkap: ${missing.join(", ")}.`;
  if (Number.isNaN(new Date(String(data.surveyDate)).getTime())) return "Tanggal survei tidak valid.";
  return null;
}

export type CommitteeParticipant = {
  name: string;
  role?: string;
  present: boolean;
  vote?: "APPROVE" | "REJECT" | "ABSTAIN";
};

export type CommitteeInput = {
  scheduledAt?: unknown;
  decidedAt?: unknown;
  quorumRequired?: unknown;
  participants?: unknown;
  decision?: unknown;
  notes?: unknown;
  conditions?: unknown;
};

export type NormalizedCommittee = {
  scheduledAt: Date;
  decidedAt: Date;
  quorumRequired: number;
  participants: CommitteeParticipant[];
  decision: "APPROVED" | "REJECTED";
  notes: string | null;
  conditions: string | null;
};

/** Validasi risalah komite: peserta hadir >= kuorum, waktu masuk akal (Tahap 9E). */
export function normalizeCommitteeDecision(raw: CommitteeInput): {
  error: string | null;
  value: NormalizedCommittee | null;
} {
  if (!raw || typeof raw !== "object") return { error: "Data keputusan komite wajib diisi.", value: null };

  const quorumRequired = Number(raw.quorumRequired);
  if (!Number.isInteger(quorumRequired) || quorumRequired < 1) {
    return { error: "Kuorum wajib berupa bilangan bulat minimal 1.", value: null };
  }

  if (!Array.isArray(raw.participants)) {
    return { error: "Daftar peserta komite wajib diisi.", value: null };
  }
  const participants: CommitteeParticipant[] = [];
  for (const item of raw.participants) {
    if (!item || typeof item !== "object") return { error: "Peserta komite tidak valid.", value: null };
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) return { error: "Setiap peserta komite wajib memiliki nama.", value: null };
    const voteRaw = String(row.vote ?? "").toUpperCase();
    const vote = voteRaw === "APPROVE" || voteRaw === "REJECT" || voteRaw === "ABSTAIN" ? voteRaw : undefined;
    participants.push({
      name,
      role: row.role ? String(row.role).trim() : undefined,
      present: Boolean(row.present),
      vote,
    });
  }

  const present = participants.filter((p) => p.present).length;
  if (present < quorumRequired) {
    return { error: `Kuorum belum terpenuhi: ${present} dari ${quorumRequired} peserta hadir.`, value: null };
  }

  const decisionRaw = String(raw.decision ?? "").toUpperCase();
  if (decisionRaw !== "APPROVED" && decisionRaw !== "REJECTED") {
    return { error: "Keputusan komite harus APPROVED atau REJECTED.", value: null };
  }

  const scheduledAt = new Date(String(raw.scheduledAt ?? ""));
  const decidedAt = new Date(String(raw.decidedAt ?? ""));
  if (Number.isNaN(scheduledAt.getTime()) || Number.isNaN(decidedAt.getTime())) {
    return { error: "Jadwal dan waktu keputusan komite wajib valid.", value: null };
  }
  if (decidedAt.getTime() < scheduledAt.getTime()) {
    return { error: "Waktu keputusan tidak boleh lebih awal dari jadwal sidang.", value: null };
  }

  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  if (notes.length < DECISION_NOTES_MIN_LENGTH) {
    return { error: `Risalah keputusan komite wajib diisi minimal ${DECISION_NOTES_MIN_LENGTH} karakter.`, value: null };
  }

  return {
    error: null,
    value: {
      scheduledAt,
      decidedAt,
      quorumRequired,
      participants,
      decision: decisionRaw,
      notes,
      conditions: typeof raw.conditions === "string" ? raw.conditions.trim() || null : null,
    },
  };
}

/**
 * Tahap 9B — limit khusus cabang menggantikan limit organisasi untuk cabang
 * itu. Bila belum ada limit cabang, limit organisasi (branchId null) dipakai.
 */
export function effectiveLimitsForBranch<T extends { branchId: string | null }>(
  limits: T[],
  branchId: string | null | undefined
): T[] {
  const branchLimits = branchId ? limits.filter((limit) => limit.branchId === branchId) : [];
  return branchLimits.length > 0 ? branchLimits : limits.filter((limit) => !limit.branchId);
}

/** Pencairan hanya boleh dicatat setelah seluruh syarat terstruktur terpenuhi (Tahap 9F). */
export function validateDisbursementReady(conditions: Array<{ description: string; isSatisfied: boolean }>): string | null {
  const pending = conditions.filter((item) => !item.isSatisfied).map((item) => item.description);
  if (pending.length > 0) {
    return `Pencairan belum dapat dicatat. Syarat belum dipenuhi: ${pending.join("; ")}.`;
  }
  return null;
}

/** Nomor aplikasi unik dengan entropi kriptografis; bentrok unik di-retry oleh route. */
export function generateApplicationNumber(date = new Date()): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `KRD-${dateStr}-${randomInt(100000, 1000000)}`;
}

export const APPLICATION_NUMBER_MAX_RETRIES = 5;
