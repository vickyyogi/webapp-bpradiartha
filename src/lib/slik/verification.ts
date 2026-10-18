/**
 * Verifikasi manual angka hasil ekstraksi AI (Tahap 5B — P0.5).
 *
 * Sebelum hasil ekstraksi AI (baki debet, tunggakan, kolektibilitas) dipakai
 * dalam Analisis 5C, petugas wajib membandingkannya terhadap dokumen SLIK
 * asli. Nilai AI (snapshot) dan nilai konfirmasi petugas disimpan berdampingan
 * — koreksi terekam berjejak tanpa pernah mengubah record hasil AI, sehingga
 * hasil dapat ditinjau, dikoreksi, dan ditelusuri.
 *
 * Modul murni (tanpa I/O): dipakai oleh endpoint verifikasi (server) dan
 * diuji langsung oleh skrip verifikasi.
 */

/** Angka hasil ekstraksi AI (snapshot dari dokumen sumber). */
export type SlikAiFigures = {
  bakiDebet: number | null;
  tunggakan: number | null;
  kolektibilitas: string | null;
};

/** Angka yang dikonfirmasi/dikoreksi petugas setelah memeriksa dokumen asli. */
export type SlikConfirmedFigures = {
  bakiDebet: number | null;
  tunggakan: number | null;
  kolektibilitas: string | null;
};

/** Satu selisih antara nilai AI dan nilai petugas (koreksi). */
export type SlikFigureCorrection = {
  field: "bakiDebet" | "tunggakan" | "kolektibilitas";
  from: string;
  to: string;
};

export const KOLEKTIBILITAS_MAX_LENGTH = 100;
export const VERIFICATION_NOTE_MAX_LENGTH = 1000;

/** Angka sah: finite dan >= 0 (tanpa parsing format lokal — P0.6). */
function isFigure(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Validasi input verifikasi. Semua angka wajib diisi (verifikasi manual
 * baki debet, tunggakan, dan kolektibilitas bersifat wajib). Mengembalikan
 * pesan galat atau null bila sah.
 */
export function validateVerificationInput(input: {
  bakiDebet?: unknown;
  tunggakan?: unknown;
  kolektibilitas?: unknown;
  note?: unknown;
}): string | null {
  if (!isFigure(input.bakiDebet)) {
    return "Total baki debet wajib diisi berupa angka nol atau lebih (angka sesuai dokumen SLIK asli).";
  }
  if (!isFigure(input.tunggakan)) {
    return "Total tunggakan wajib diisi berupa angka nol atau lebih (angka sesuai dokumen SLIK asli).";
  }
  const kolektibilitas = typeof input.kolektibilitas === "string" ? input.kolektibilitas.trim() : "";
  if (!kolektibilitas || kolektibilitas.length > KOLEKTIBILITAS_MAX_LENGTH) {
    return `Kolektibilitas wajib diisi (maks. ${KOLEKTIBILITAS_MAX_LENGTH} karakter).`;
  }
  if (
    input.note !== undefined &&
    input.note !== null &&
    (typeof input.note !== "string" || input.note.length > VERIFICATION_NOTE_MAX_LENGTH)
  ) {
    return `Catatan verifikasi maksimal ${VERIFICATION_NOTE_MAX_LENGTH} karakter.`;
  }
  return null;
}

/**
 * Angka dianggap sama bila identik atau selisihnya di bawah ambang pembulatan
 * sen (Float — presisi penuh menunggu migrasi Decimal, P0.6).
 */
function sameFigure(a: number | null, b: number | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.005;
}

function formatFigure(value: number | null): string {
  return value === null ? "-" : String(value);
}

/** Selisih nilai AI vs nilai petugas — hanya field yang dikoreksi. */
export function detectCorrections(
  ai: SlikAiFigures,
  confirmed: SlikConfirmedFigures
): SlikFigureCorrection[] {
  const corrections: SlikFigureCorrection[] = [];
  if (!sameFigure(ai.bakiDebet, confirmed.bakiDebet)) {
    corrections.push({
      field: "bakiDebet",
      from: formatFigure(ai.bakiDebet),
      to: formatFigure(confirmed.bakiDebet),
    });
  }
  if (!sameFigure(ai.tunggakan, confirmed.tunggakan)) {
    corrections.push({
      field: "tunggakan",
      from: formatFigure(ai.tunggakan),
      to: formatFigure(confirmed.tunggakan),
    });
  }
  if ((ai.kolektibilitas ?? "").trim() !== (confirmed.kolektibilitas ?? "").trim()) {
    corrections.push({
      field: "kolektibilitas",
      from: ai.kolektibilitas ?? "-",
      to: confirmed.kolektibilitas ?? "-",
    });
  }
  return corrections;
}
