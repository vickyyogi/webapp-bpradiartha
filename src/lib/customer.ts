/**
 * Master Nasabah/Debitur — Tahap 2A (P0.2).
 *
 * Entitas nasabah sengaja TERPISAH dari User/Pegawai. Modul ini berisi aturan
 * validasi identitas dan pembuatan nomor nasabah yang dipakai bersama oleh API
 * pengajuan kredit dan (tahap lanjutan) API CRM.
 */
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { maskPhone } from "./privacy";

export const CUSTOMER_TYPES = ["INDIVIDU", "BADAN"] as const;
export type CustomerTypeValue = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_STATUSES = ["PROSPEK", "AKTIF", "NONAKTIF", "BLACKLIST"] as const;
export type CustomerStatusValue = (typeof CUSTOMER_STATUSES)[number];

/** Membersihkan NIK/NPWP/ID usaha dari spasi dan pemisah. */
export function normalizeIdentityNumber(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\s.\-]/g, "").trim();
  return cleaned.length ? cleaned : null;
}

/** NIK Indonesia harus tepat 16 digit angka. */
export function isValidNIK(nik: string): boolean {
  return /^\d{16}$/.test(nik.replace(/[\s.\-]/g, ""));
}

/**
 * Identitas opsional. Bila diisi: INDIVIDU wajib NIK 16 digit;
 * BADAN wajib nomor identitas usaha minimal 5 karakter.
 */
export function isValidIdentity(
  customerType: CustomerTypeValue,
  identityNumber?: string | null
): boolean {
  const normalized = normalizeIdentityNumber(identityNumber);
  if (!normalized) return true;
  if (customerType === "INDIVIDU") return /^\d{16}$/.test(normalized);
  return normalized.length >= 5;
}

export function buildCustomerNumber(year: number, seq: number): string {
  return `CUST-${year}-${String(seq).padStart(4, "0")}`;
}

/** Nomor nasabah internal berurutan per organisasi, mis. CUST-2026-0001. */
export async function generateCustomerNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CUST-${year}-`;
  const last = await db.customer.findFirst({
    where: { organizationId, customerNumber: { startsWith: prefix } },
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  let seq = 1;
  if (last) {
    const parsed = parseInt(last.customerNumber.slice(prefix.length), 10);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return buildCustomerNumber(year, seq);
}

/**
 * Membuat nasabah dengan nomor unik. Bila terjadi tabrakan nomor (P2002),
 * nomor dihitung ulang dan dicoba lagi. Bukan transaksi lintas-instance penuh,
 * tetapi cukup aman karena constraint unik tetap menjaga integritas.
 */
export async function createCustomerWithNumber(
  organizationId: string,
  data: Omit<Prisma.CustomerUncheckedCreateInput, "organizationId" | "customerNumber" | "id">
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const customerNumber = await generateCustomerNumber(organizationId);
    try {
      return await db.customer.create({
        data: { organizationId, customerNumber, ...data },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Gagal membuat nomor nasabah unik setelah beberapa percobaan.");
}

/**
 * Mencari nasabah yang sudah ada berdasarkan NIK/ID usaha di organisasi yang sama.
 * Dipakai untuk mencegah duplikasi saat pengajuan dibuat dengan identitas yang sudah terdaftar.
 * Hanya mencocokkan nomor identitas yang benar-benar terisi.
 */
export async function findCustomerByIdentity(
  organizationId: string,
  identityNumber?: string | null
) {
  const normalized = normalizeIdentityNumber(identityNumber);
  if (!normalized) return null;
  return db.customer.findFirst({
    where: { organizationId, identityNumber: normalized },
    orderBy: { createdAt: "asc" },
  });
}

// ============================================================
// Tahap 2B (P0.2): riwayat identitas, duplikasi, masking
// ============================================================

/**
 * Field identitas yang dilacak pada riwayat perubahan nasabah.
 * Status, cabang, dan profil penghasilan sengaja tidak termasuk (bukan identitas).
 */
export const CUSTOMER_IDENTITY_FIELDS = [
  "customerType",
  "legalName",
  "nickname",
  "identityType",
  "identityNumber",
  "npwp",
  "birthPlace",
  "birthDate",
  "gender",
  "address",
  "rtRw",
  "kelurahan",
  "kecamatan",
  "city",
  "province",
  "postalCode",
  "phone",
  "email",
] as const;

export type CustomerIdentityField = (typeof CUSTOMER_IDENTITY_FIELDS)[number];

function normalizeForCompare(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return text.length ? text : null;
}

/** Ambil hanya field identitas dari sebuah objek nasabah. */
export function pickIdentitySnapshot(source: Record<string, unknown>): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const field of CUSTOMER_IDENTITY_FIELDS) {
    if (field in source) snapshot[field] = source[field] ?? null;
  }
  return snapshot;
}

/** Hitung field identitas yang berubah antara dua snapshot. */
export function diffIdentitySnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { changedFields: CustomerIdentityField[]; oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const changedFields: CustomerIdentityField[] = [];
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const field of CUSTOMER_IDENTITY_FIELDS) {
    const oldV = normalizeForCompare(before[field]);
    const newV = normalizeForCompare(after[field]);
    if (oldV !== newV) {
      changedFields.push(field);
      oldValues[field] = before[field] ?? null;
      newValues[field] = after[field] ?? null;
    }
  }

  return { changedFields, oldValues, newValues };
}

/**
 * Menulis baris riwayat identitas nasabah. Nilai yang disimpan adalah field yang
 * berubah saja (bukan seluruh objek), dan tidak memuat sandi/token apa pun.
 */
export async function recordCustomerIdentityHistory(params: {
  customerId: string;
  changedById?: string | null;
  verifiedById?: string | null;
  action: "CREATE" | "UPDATE" | "VERIFY" | string;
  changedFields?: string[];
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  notes?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const client = params.tx ?? db;
  return client.customerIdentityHistory.create({
    data: {
      customerId: params.customerId,
      changedById: params.changedById ?? null,
      verifiedById: params.verifiedById ?? null,
      action: params.action,
      changedFields: params.changedFields ? JSON.parse(JSON.stringify(params.changedFields)) : undefined,
      oldValues: params.oldValues ? JSON.parse(JSON.stringify(params.oldValues)) : undefined,
      newValues: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : undefined,
      notes: params.notes ?? null,
    },
  });
}

/** Menyamarkan nomor identitas nasabah untuk daftar/hasil pencarian. */
export function maskIdentity(identityNumber?: string | null): string | null {
  if (!identityNumber) return null;
  if (identityNumber.length <= 4) return "****";
  const visible = identityNumber.slice(-4);
  return `${"*".repeat(Math.max(0, identityNumber.length - 4))}${visible}`;
}

/**
 * Deteksi potensi duplikasi nasabah dalam satu organisasi (Tahap 2B).
 *
 * Alasan kecocokan:
 *  - "IDENTITY_EXACT" : NIK/ID usaha sama persis (bobot tertinggi)
 *  - "PHONE_EXACT"    : nomor telepon sama persis
 *  - "NAME_BIRTHDATE" : nama (tanpa beda huruf besar/kecil) sama + tanggal lahir sama
 *
 * Hasil TIDAK memuat NIK mentah (disamarkan) dan selalu dibatasi ke organisasi pemanggil.
 */
export async function findDuplicateCandidates(
  organizationId: string,
  input: {
    identityNumber?: string | null;
    phone?: string | null;
    legalName?: string | null;
    birthDate?: string | Date | null;
    excludeCustomerId?: string | null;
    /** Filter tambahan (mis. cakupan cabang/penugasan) yang digabung dengan syarat organisasi. */
    extraWhere?: Prisma.CustomerWhereInput;
  }
): Promise<
  Array<{
    id: string;
    customerNumber: string;
    legalName: string;
    customerType: string;
    status: string;
    identityNumberMasked: string | null;
    phoneMasked: string | null;
    matchReasons: string[];
  }>
> {
  const normalizedIdentity = normalizeIdentityNumber(input.identityNumber);
  const normalizedPhone = input.phone ? input.phone.replace(/[^\d]/g, "") || null : null;
  const normalizedName = input.legalName ? input.legalName.trim().toLowerCase() : null;

  const or: Prisma.CustomerWhereInput[] = [];
  if (normalizedIdentity) or.push({ identityNumber: normalizedIdentity });
  if (normalizedPhone) or.push({ phone: { contains: normalizedPhone } });
  if (normalizedName) or.push({ legalName: { equals: input.legalName!.trim(), mode: "insensitive" } });

  if (or.length === 0) return [];

  const candidates = await db.customer.findMany({
    where: {
      AND: [
        { organizationId },
        ...(input.extraWhere ? [input.extraWhere] : []),
        { OR: or },
        ...(input.excludeCustomerId ? [{ id: { not: input.excludeCustomerId } }] : []),
      ],
    },
    select: {
      id: true,
      customerNumber: true,
      legalName: true,
      customerType: true,
      status: true,
      identityNumber: true,
      phone: true,
      birthDate: true,
    },
    take: 25,
    orderBy: { createdAt: "asc" },
  });

  const inputBirth = input.birthDate
    ? new Date(input.birthDate).toISOString().slice(0, 10)
    : null;

  const results = [];
  for (const c of candidates) {
    const reasons: string[] = [];
    if (normalizedIdentity && c.identityNumber && normalizeIdentityNumber(c.identityNumber) === normalizedIdentity) {
      reasons.push("IDENTITY_EXACT");
    }
    if (normalizedPhone && c.phone && c.phone.replace(/[^\d]/g, "") === normalizedPhone) {
      reasons.push("PHONE_EXACT");
    }
    if (
      normalizedName &&
      c.legalName.trim().toLowerCase() === normalizedName &&
      inputBirth &&
      c.birthDate &&
      new Date(c.birthDate).toISOString().slice(0, 10) === inputBirth
    ) {
      reasons.push("NAME_BIRTHDATE");
    }
    if (reasons.length === 0) continue;
    results.push({
      id: c.id,
      customerNumber: c.customerNumber,
      legalName: c.legalName,
      customerType: c.customerType,
      status: c.status,
      identityNumberMasked: maskIdentity(c.identityNumber),
      phoneMasked: c.phone ? maskPhone(c.phone) : null,
      matchReasons: reasons,
    });
  }

  // Urutkan: alasan identitas lebih kuat.
  const weight: Record<string, number> = { IDENTITY_EXACT: 3, PHONE_EXACT: 2, NAME_BIRTHDATE: 1 };
  return results.sort(
    (a, b) =>
      Math.max(...b.matchReasons.map((r) => weight[r] ?? 0)) -
      Math.max(...a.matchReasons.map((r) => weight[r] ?? 0))
  );
}

