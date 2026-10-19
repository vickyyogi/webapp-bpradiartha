/**
 * Aturan penerusan pengajuan saat rekomendasi AI = REJECT (Tahap 5B — P0.5).
 *
 * Analisa SLIK AI adalah alat bantu; bila rekomendasinya penolakan (REJECT)
 * namun pengajuan tetap dilanjutkan, Account Officer atau petugas survei
 * lapangan WAJIB mengisi alasan penerusan. Alasan tersimpan sebagai record
 * tersendiri (`credit_slik_overrides`) + audit log, sehingga keputusan tidak
 * pernah otomatis berdasarkan output AI dan pertimbangannya dapat ditelusuri.
 *
 * Modul ini murni (tanpa I/O) agar dapat diuji langsung oleh skrip verifikasi
 * dan dipakai bersama oleh API route (server) maupun komponen (client).
 */

export const OVERRIDE_REASON_MIN_LENGTH = 10;

/**
 * Peran pelaku yang berwenang mengisi alasan penerusan: Account Officer,
 * petugas survei, pemegang izin verifikasi pengajuan, Super Admin, dan Direksi.
 */
export type SlikOverrideActorRole = "AO" | "SURVEY" | "VERIFIER" | "ADMIN" | "DIRECTOR";

/**
 * Status yang berarti pengajuan DITERUSKAN (bukan dikembalikan/ditolak).
 * RETURNED = dikembalikan untuk koreksi; REJECTED = penolakan final bank —
 * keduanya bukan "penerusan", jadi tidak memerlukan alasan penerusan.
 */
export function isContinuationStatus(status: string): boolean {
  return status !== "RETURNED" && status !== "REJECTED";
}

/**
 * Menentukan peran pelaku untuk pengisian alasan penerusan.
 *
 * Prioritas: penugasan pada pengajuan (Account Officer = marketing officer,
 * petugas survei = survey officer), lalu kode peran AO_MARKETING /
 * FIELD_OFFICER, Super Admin (ADMIN), Direksi (DIRECTOR), dan terakhir siapa
 * pun yang memegang izin verifikasi pengajuan (`canVerify`).
 */
export function resolveOverrideActor(
  actor: { id: string; userRoles?: { role: { code: string } }[] },
  application: {
    assignedMarketingOfficerId?: string | null;
    assignedSurveyOfficerId?: string | null;
  },
  options?: { canVerify?: boolean }
): SlikOverrideActorRole | null {
  if (application.assignedMarketingOfficerId && application.assignedMarketingOfficerId === actor.id) {
    return "AO";
  }
  if (application.assignedSurveyOfficerId && application.assignedSurveyOfficerId === actor.id) {
    return "SURVEY";
  }
  const codes = (actor.userRoles ?? []).map((ur) => ur.role.code.toUpperCase());
  if (codes.includes("ADMIN")) return "ADMIN";
  if (codes.includes("DIRECTOR")) return "DIRECTOR";
  if (codes.includes("AO_MARKETING")) return "AO";
  if (codes.includes("FIELD_OFFICER")) return "SURVEY";
  if (options?.canVerify) return "VERIFIER";
  return null;
}

export function overrideRoleLabel(role: string): string {
  switch (role) {
    case "AO":
      return "Account Officer";
    case "SURVEY":
      return "Petugas Survei Lapangan";
    case "ADMIN":
      return "Super Admin";
    case "DIRECTOR":
      return "Direksi";
    case "VERIFIER":
      return "Verifikator";
    default:
      return "Petugas";
  }
}

/** Memvalidasi alasan penerusan (wajib, tidak kosong, panjang wajar). */
export function isValidOverrideReason(reason: unknown): reason is string {
  return typeof reason === "string" && reason.trim().length >= OVERRIDE_REASON_MIN_LENGTH;
}
