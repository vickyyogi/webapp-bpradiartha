/**
 * Skema ekstraksi SLIK OJK (IDEB) + normalisasi runtime.
 *
 * Dipakai bersama oleh:
 *  - API route `src/app/api/analyze-slik/route.ts` (server)
 *  - Generator laporan `src/lib/slik/generateSlikReport.ts` (client)
 *
 * Tidak memakai dependency tambahan (zod tidak terpasang di project ini), sehingga
 * validasi dilakukan secara manual: setiap nilai dipaksa (coerce) ke tipe yang benar
 * dan hasilnya tidak pernah throw — nilai yang tidak terbaca diganti default,
 * dan alasannya dicatat pada `issues` supaya analis tahu bagian mana yang perlu dicek.
 */

export type SlikRekomendasi = "REJECT" | "APPROVE" | "CONSIDER";

export interface SlikHeader {
  nomor_laporan: string;
  posisi_data: string;
  operator: string;
}

export interface SlikDataPribadi {
  nama_lengkap: string;
  nik: string;
  ttl_usia: string;
  pekerjaan: string;
  pendidikan: string;
}

export interface SlikRingkasanEksposur {
  total_baki_debet: number;
  plafon_efektif: string;
  kualitas_terburuk: string;
  total_kreditur: string;
  total_fasilitas: string;
}

export interface SlikRincianTunggakan {
  tunggakan_pokok: number;
  tunggakan_bunga: number;
  denda_berjalan: number;
  total_tunggakan_real: number;
}

export interface SlikFasilitas {
  bank_pelapor: string;
  jenis_fasilitas: string;
  plafon_awal: number;
  baki_debet: number;
  suku_bunga: string;
  kolektibilitas: string;
  hari_tunggakan: number;
  status_kondisi: string;
  est_angsuran_bulan: number;
  catatan_khusus: string;
}

export interface SlikRingkasanAngsuran {
  nama_bank: string;
  detail: string;
  nominal_per_bulan: string;
}

export interface SlikCatatanKritis {
  judul: string;
  uraian: string;
}

export interface SlikKeputusanKomite {
  rekomendasi: SlikRekomendasi;
  risk_rating: string;
  saran_tindakan: string[];
  syarat_khusus: string[];
}

export interface SlikAnalisisDanRekomendasi {
  ringkasan_angsuran: SlikRingkasanAngsuran[];
  total_estimasi_angsuran_bulanan: string;
  inventarisasi_agunan: string[];
  catatan_kritis_karakter: SlikCatatanKritis[];
  keputusan_komite: SlikKeputusanKomite;
}

export interface SlikAnalysis {
  header: SlikHeader;
  data_pribadi: SlikDataPribadi;
  ringkasan_eksposur: SlikRingkasanEksposur;
  rincian_tunggakan: SlikRincianTunggakan;
  fasilitas: SlikFasilitas[];
  analisis_dan_rekomendasi: SlikAnalisisDanRekomendasi;
}

export interface SlikSourceInfo {
  fileName: string;
  pages: number;
  chars: number;
  truncated: boolean;
}

export interface SlikAnalysisResult {
  data: SlikAnalysis;
  model: string;
  warnings: string[];
  sources: SlikSourceInfo[];
  elapsedMs: number;
}

/* ------------------------------------------------------------------ */
/* Coercion helpers                                                    */
/* ------------------------------------------------------------------ */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Mengubah nilai apa pun menjadi number.
 * Menangani format Indonesia: "Rp 1.500.000", "1.500.000,50", "3.5%", null, "".
 */
export function parseNumeric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return 0;

  const cleaned = value.trim();
  if (!cleaned) return 0;

  // Ambil hanya digit, titik, koma, dan tanda minus.
  const digitsOnly = cleaned.replace(/[^\d.,-]/g, "");
  if (!digitsOnly) return 0;

  const hasComma = digitsOnly.includes(",");
  const hasDot = digitsOnly.includes(".");
  let normalized = digitsOnly;

  if (hasDot && hasComma) {
    // Format Indonesia: titik = ribuan, koma = desimal.
    normalized = digitsOnly.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Bisa "1.500,50" (sudah ditangani di atas) atau "1500,5".
    normalized = digitsOnly.replace(",", ".");
  } else if (hasDot) {
    // "1.500.000" = ribuan; "12.5" = desimal.
    const parts = digitsOnly.split(".");
    const looksLikeThousandGroups = parts.length > 2 || (parts[1]?.length ?? 0) === 3;
    normalized = looksLikeThousandGroups ? digitsOnly.replace(/\./g, "") : digitsOnly;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asString(value: unknown, fallback = "-"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => asString(v, "")).filter(Boolean).join("; ") || fallback;
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => asString(v, "")).filter((v) => v.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|;/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function asArray<T>(value: unknown, mapper: (item: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(mapper);
}

/* ------------------------------------------------------------------ */
/* Normalizer                                                          */
/* ------------------------------------------------------------------ */

const REKOMENDASI_VALUES: SlikRekomendasi[] = ["REJECT", "APPROVE", "CONSIDER"];

function normalizeRekomendasi(value: unknown): { value: SlikRekomendasi; issue?: string } {
  const raw = asString(value, "REJECT").toUpperCase();
  const match = REKOMENDASI_VALUES.find((v) => raw.includes(v));
  if (match) return { value: match };
  return {
    value: "REJECT",
    issue: `Rekomendasi komite "${raw}" tidak dikenal, diubah menjadi REJECT (paling konservatif).`,
  };
}

/**
 * Memaksa hasil mentah dari LLM menjadi struktur `SlikAnalysis` yang aman dirender.
 * Selalu mengembalikan data (tidak pernah throw) beserta daftar `issues`.
 */
export function normalizeSlikAnalysis(raw: unknown): { data: SlikAnalysis; issues: string[] } {
  const issues: string[] = [];
  const root = isRecord(raw) ? raw : {};

  if (!isRecord(raw)) {
    issues.push("Respons model bukan objek JSON — seluruh field memakai nilai default.");
  }

  const header = isRecord(root.header) ? root.header : {};
  const dataPribadi = isRecord(root.data_pribadi) ? root.data_pribadi : {};
  const eksposur = isRecord(root.ringkasan_eksposur) ? root.ringkasan_eksposur : {};
  const tunggakan = isRecord(root.rincian_tunggakan) ? root.rincian_tunggakan : {};
  const analisis = isRecord(root.analisis_dan_rekomendasi) ? root.analisis_dan_rekomendasi : {};
  const keputusan = isRecord(analisis.keputusan_komite) ? analisis.keputusan_komite : {};

  if (!isRecord(root.header)) issues.push("Bagian `header` tidak ditemukan pada respons model.");
  if (!isRecord(root.data_pribadi)) issues.push("Bagian `data_pribadi` tidak ditemukan pada respons model.");
  if (!Array.isArray(root.fasilitas)) issues.push("Bagian `fasilitas` bukan array — tabel fasilitas akan kosong.");
  if (!isRecord(root.analisis_dan_rekomendasi)) {
    issues.push("Bagian `analisis_dan_rekomendasi` tidak ditemukan pada respons model.");
  }

  const rekomendasi = normalizeRekomendasi(keputusan.rekomendasi);
  if (rekomendasi.issue) issues.push(rekomendasi.issue);

  const fasilitas = asArray(root.fasilitas, (f) => {
    const originalKolektibilitas = asString(f.kolektibilitas, "");
    return {
      bank_pelapor: asString(f.bank_pelapor),
      jenis_fasilitas: asString(f.jenis_fasilitas),
      plafon_awal: parseNumeric(f.plafon_awal),
      baki_debet: parseNumeric(f.baki_debet),
      suku_bunga: asString(f.suku_bunga),
      // SLIK memakai format "1", "2"/"L", "3" dst. Dipertahankan apa adanya.
      kolektibilitas: originalKolektibilitas || "-",
      hari_tunggakan: Math.max(0, Math.round(parseNumeric(f.hari_tunggakan))),
      status_kondisi: asString(f.status_kondisi, "Aktif"),
      est_angsuran_bulan: parseNumeric(f.est_angsuran_bulan),
      catatan_khusus: asString(f.catatan_khusus),
    } satisfies SlikFasilitas;
  });

  const ringkasanAngsuran = asArray(analisis.ringkasan_angsuran, (item) => ({
    nama_bank: asString(item.nama_bank),
    detail: asString(item.detail),
    nominal_per_bulan: asString(item.nominal_per_bulan),
  } satisfies SlikRingkasanAngsuran));

  const catatanKritis = asArray(analisis.catatan_kritis_karakter, (item) => ({
    judul: asString(item.judul),
    uraian: asString(item.uraian),
  } satisfies SlikCatatanKritis));

  const data: SlikAnalysis = {
    header: {
      nomor_laporan: asString(header.nomor_laporan),
      posisi_data: asString(header.posisi_data),
      operator: asString(header.operator),
    },
    data_pribadi: {
      nama_lengkap: asString(dataPribadi.nama_lengkap),
      nik: asString(dataPribadi.nik),
      ttl_usia: asString(dataPribadi.ttl_usia),
      pekerjaan: asString(dataPribadi.pekerjaan),
      pendidikan: asString(dataPribadi.pendidikan),
    },
    ringkasan_eksposur: {
      total_baki_debet: parseNumeric(eksposur.total_baki_debet),
      plafon_efektif: asString(eksposur.plafon_efektif),
      kualitas_terburuk: asString(eksposur.kualitas_terburuk),
      total_kreditur: asString(eksposur.total_kreditur),
      total_fasilitas: asString(eksposur.total_fasilitas, String(fasilitas.length)),
    },
    rincian_tunggakan: {
      tunggakan_pokok: parseNumeric(tunggakan.tunggakan_pokok),
      tunggakan_bunga: parseNumeric(tunggakan.tunggakan_bunga),
      denda_berjalan: parseNumeric(tunggakan.denda_berjalan),
      total_tunggakan_real: parseNumeric(tunggakan.total_tunggakan_real),
    },
    fasilitas,
    analisis_dan_rekomendasi: {
      ringkasan_angsuran: ringkasanAngsuran,
      total_estimasi_angsuran_bulanan: asString(
        analisis.total_estimasi_angsuran_bulanan,
        "Rp 0/bulan"
      ),
      inventarisasi_agunan: asStringArray(analisis.inventarisasi_agunan),
      catatan_kritis_karakter: catatanKritis,
      keputusan_komite: {
        rekomendasi: rekomendasi.value,
        risk_rating: asString(keputusan.risk_rating, "HIGH RISK"),
        saran_tindakan: asStringArray(keputusan.saran_tindakan),
        syarat_khusus: asStringArray(keputusan.syarat_khusus),
      },
    },
  };

  return { data, issues };
}

/** Dipakai generator PDF: format rupiah yang konsisten untuk seluruh laporan. */
export function formatRupiah(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Rp 0";
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

/** Format angka biasa (tanpa "Rp") untuk kolom plafon/baki debet pada tabel. */
export function formatAngka(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return Math.round(value).toLocaleString("id-ID");
}
