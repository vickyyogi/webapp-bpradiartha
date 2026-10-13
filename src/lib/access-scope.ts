/**
 * Otorisasi berbasis cakupan data — Tahap 3A (P0.3).
 *
 * Izin (permission) saja tidak cukup: pengguna juga dibatasi oleh cakupan
 * organisasi, cabang, dan penugasan. Modul ini menyediakan penentu cakupan dan
 * pembentuk filter yang dipakai bersama oleh API route maupun server component.
 *
 * Pemetaan peran → cakupan dapat dikonfigurasi lewat environment:
 *   ACCESS_ORG_WIDE_ROLE_CODES   (default: ADMIN,DIRECTOR,MANAGEMENT,AUDITOR,ADMIN_OPERASIONAL)
 *   ACCESS_ASSIGNED_ROLE_CODES   (default: FIELD_OFFICER)
 * Peran di luar keduanya dianggap bercakupan BRANCH (cabang sendiri + penugasan sendiri).
 *
 * CATATAN: pemetaan ini adalah baseline teknis dan WAJIB dikonfirmasi pemilik
 * proses/compliance (lihat docs/ROLE_PERMISSION_MATRIX.md §7).
 */

export type ScopeLevel = "ORGANIZATION" | "BRANCH" | "ASSIGNED";

export interface ScopeUser {
  id: string;
  organizationId: string;
  branchId: string | null;
  departmentId?: string | null;
  roleCodes: string[];
}

export interface ScopeOptions {
  /** Field pada record yang menunjuk ke id pengguna (mis. assignedAnalystId). */
  assignmentFields?: string[];
  /** Nama kolom cabang pada model (default "branchId"). */
  branchField?: string;
}

const parseCodes = (value: string | undefined, fallback: string): string[] =>
  (value?.trim() || fallback)
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

export const ACCESS_ORG_WIDE_ROLE_CODES: string[] = parseCodes(
  process.env.ACCESS_ORG_WIDE_ROLE_CODES,
  "ADMIN,DIRECTOR,MANAGEMENT,AUDITOR,ADMIN_OPERASIONAL"
);

export const ACCESS_ASSIGNED_ROLE_CODES: string[] = parseCodes(
  process.env.ACCESS_ASSIGNED_ROLE_CODES,
  "FIELD_OFFICER"
);

/** Menentukan tingkat cakupan data seorang pengguna berdasarkan peran yang dimiliki. */
export function resolveScopeLevel(user: ScopeUser): ScopeLevel {
  const roles = user.roleCodes.map((r) => r.toUpperCase());
  if (roles.some((r) => ACCESS_ASSIGNED_ROLE_CODES.includes(r))) return "ASSIGNED";
  if (roles.some((r) => ACCESS_ORG_WIDE_ROLE_CODES.includes(r))) return "ORGANIZATION";
  return "BRANCH";
}

/**
 * Filter Prisma untuk membatasi daftar/kueri ke cakupan pengguna.
 * Bila pengguna tidak memiliki cakupan sah sama sekali, dikembalikan filter
 * mustahil (`id: "__no_scope__"`) agar tidak ada data yang bocor.
 */
export function buildScopeFilter(user: ScopeUser, options: ScopeOptions = {}): Record<string, unknown> {
  const level = resolveScopeLevel(user);
  const organizationId = user.organizationId;
  const assignmentFields = options.assignmentFields ?? [];
  const branchField = options.branchField ?? "branchId";

  if (level === "ORGANIZATION") return { organizationId };

  const or: Record<string, unknown>[] = [];
  if (level === "BRANCH" && user.branchId) or.push({ [branchField]: user.branchId });
  for (const field of assignmentFields) or.push({ [field]: user.id });

  if (or.length === 0) return { organizationId, id: "__no_scope__" };
  return { organizationId, OR: or };
}

/** Memeriksa apakah satu record berada dalam cakupan pengguna. */
export function recordInScope(
  user: ScopeUser,
  record: Record<string, unknown>,
  options: ScopeOptions = {}
): boolean {
  const level = resolveScopeLevel(user);
  const assignmentFields = options.assignmentFields ?? [];
  const branchField = options.branchField ?? "branchId";

  if (record.organizationId !== user.organizationId) return false;
  if (level === "ORGANIZATION") return true;

  if (level === "BRANCH" && user.branchId && record[branchField] === user.branchId) return true;
  return assignmentFields.some((field) => record[field] === user.id);
}

/** Apakah pengguna boleh menetapkan/mengubah record ke cabang tertentu. */
export function isBranchAllowed(user: ScopeUser, branchId?: string | null): boolean {
  if (!branchId) return true;
  if (resolveScopeLevel(user) === "ORGANIZATION") return true;
  return Boolean(user.branchId) && user.branchId === branchId;
}

/** Mengubah objek pengguna hasil requireAuthAndPermission menjadi ScopeUser. */
export function toScopeUser(user: {
  id: string;
  organizationId: string;
  branchId: string | null;
  departmentId?: string | null;
  userRoles?: { role: { code: string } }[];
}): ScopeUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    departmentId: user.departmentId ?? null,
    roleCodes: (user.userRoles ?? []).map((ur) => ur.role.code),
  };
}

/** Status pengajuan kredit yang merupakan keputusan (butuh pemisahan tugas). */
export const CREDIT_DECISION_STATUSES = ["APPROVED", "REJECTED"] as const;

/**
 * Pemisahan tugas (Maker-Checker): seorang pemutus tidak boleh sekaligus menjadi
 * pengaju/analis/surveyor pada record yang sama. Mengembalikan true bila terjadi pelanggaran.
 */
export function violatesSegregationOfDuties(
  actorId: string,
  makerIds: Array<string | null | undefined>
): boolean {
  return makerIds.some((id) => Boolean(id) && id === actorId);
}

