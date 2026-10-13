/**
 * Otorisasi akses dokumen — Tahap 4 (P0.4).
 *
 * Izin (`document.download`/`document.view`) saja tidak cukup: setiap akses
 * ke metadata maupun isi dokumen juga harus lolos pemeriksaan cakupan:
 *   - organisasi yang sama,
 *   - cakupan cabang/penugasan pemohon (Tahap 3A), dan
 *   - pemilik/penugasan record induk (pengajuan kredit, lead, aset, dll.).
 *
 * Seluruh keputusan dilakukan di server; URL tidak dianggap sebagai keamanan.
 */

import { db } from "./db";
import {
  recordInScope,
  resolveScopeLevel,
  toScopeUser,
  type ScopeUser,
} from "./access-scope";
import type { DocumentOwnerType, Document as PrismaDocument, User } from "@prisma/client";

/** Pemetaan pemilik dokumen → model record induk yang menjadi dasar pengecekan cakupan. */
type OwnerScopeCase = "CREDIT_APPLICATION" | "LEAD" | "CUSTOMER" | "ASSET" | "INVENTORY" | "PURCHASE_REQUEST" | "PURCHASE_ORDER" | "GOODS_RECEIPT";

const OWNER_SCOPE_CASES: Partial<Record<DocumentOwnerType, OwnerScopeCase>> = {
  CREDIT_APPLICATION: "CREDIT_APPLICATION",
  LEAD: "LEAD",
  CUSTOMER: "CUSTOMER",
  ASSET: "ASSET",
  INVENTORY: "INVENTORY",
  PURCHASE_REQUEST: "PURCHASE_REQUEST",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  GOODS_RECEIPT: "GOODS_RECEIPT",
};

type UserWithRoles = User & { userRoles?: { role: { code: string } }[] };

/**
 * Apakah record induk sebuah dokumen berada dalam cakupan pengguna.
 * @returns true = dalam cakupan, false = di luar cakupan,
 *          null = record induk tidak dapat diverifikasi (dihanguskan/di luar cakupan cabang).
 */
async function ownerRecordInScope(
  scopeUser: ScopeUser,
  ownerType: DocumentOwnerType,
  ownerId: string
): Promise<boolean | null> {
  const branchField = "branchId";

  switch (OWNER_SCOPE_CASES[ownerType]) {
    case "CREDIT_APPLICATION": {
      const record = await db.creditApplication.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, {
        branchField,
        assignmentFields: ["assignedMarketingOfficerId", "assignedAnalystId", "assignedSurveyOfficerId"],
      });
    }
    case "LEAD": {
      const record = await db.lead.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    case "CUSTOMER": {
      const record = await db.customer.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    case "ASSET": {
      const record = await db.asset.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    case "INVENTORY": {
      const record = await db.inventoryItem.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    case "PURCHASE_REQUEST": {
      const record = await db.purchaseRequest.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    case "PURCHASE_ORDER": {
      const record = await db.purchaseOrder.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    case "GOODS_RECEIPT": {
      const record = await db.goodsReceipt.findUnique({ where: { id: ownerId } });
      if (!record) return null;
      return recordInScope(scopeUser, record, { branchField });
    }
    default:
      // VENDOR &INTERNAL: tidak memiliki cabang → organisasi (lihat pemanggil).
      return null;
  }
}

export interface DocumentAccessResult {
  allowed: boolean;
  /** Alasan penolakan (untuk log, bukan untuk klien). */
  reason?: string;
}

/**
 * Menilai apakah pengguna boleh mengakses sebuah dokumen (metadata maupun isi).
 * Asumsi: pengguna sudah lolos autentikasi + permission terkait.
 */
export async function evaluateDocumentAccess(
  user: UserWithRoles,
  document: Pick<PrismaDocument, "organizationId" | "ownerType" | "ownerId" | "uploadedById">
): Promise<DocumentAccessResult> {
  if (document.organizationId !== user.organizationId) {
    return { allowed: false, reason: "cross_organization" };
  }

  // Pengunggah selalu boleh mengakses berkas yang ia unggah sendiri.
  if (document.uploadedById === user.id) {
    return { allowed: true };
  }

  const scopeUser = toScopeUser(user);
  const level = resolveScopeLevel(scopeUser);

  // Cakupan organisasi: seluruh dokumen dalam organisasi yang sama.
  if (level === "ORGANIZATION") {
    return { allowed: true };
  }

  // Repositori dokumen umum (INTERNAL) tidak terikat cabang → tetap berbasis izin.
  if (document.ownerType === "INTERNAL") {
    return { allowed: true };
  }

  const inScope = await ownerRecordInScope(scopeUser, document.ownerType, document.ownerId);
  if (inScope === true) return { allowed: true };
  if (inScope === false) return { allowed: false, reason: "outside_scope" };
  return { allowed: false, reason: "owner_not_verifiable" };
}

/**
 * Apakah pengguna boleh mengunggah/melampirkan dokumen ke sebuah record induk.
 * Dipakai oleh endpoint unggah untuk mencegah lampiran silang cabang (IDOR).
 */
export async function canAttachDocumentTo(
  user: UserWithRoles,
  ownerType: DocumentOwnerType,
  ownerId: string
): Promise<boolean> {
  // Repositori dokumen umum tidak menunjuk ke record tertentu.
  if (ownerType === "INTERNAL") return true;

  if (!ownerId || ownerId.length > 100) return false;

  const scopeUser = toScopeUser(user);
  try {
    const inScope = await ownerRecordInScope(scopeUser, ownerType, ownerId);
    if (inScope !== null) return inScope;
    // Record induk tanpa cabang (mis. VENDOR) atau tidak dikenal: hanya cakupan
    // organisasi yang boleh melampirkannya.
    return resolveScopeLevel(scopeUser) === "ORGANIZATION" && (await ownerExistsInOrg(user, ownerType, ownerId));
  } catch {
    // id bukan UUID / query gagal → tolak, jangan menebak.
    return false;
  }
}

/** Pengecekan minimal: record induk ada dan berada di organisasi yang sama. */
async function ownerExistsInOrg(
  user: UserWithRoles,
  ownerType: DocumentOwnerType,
  ownerId: string
): Promise<boolean> {
  switch (ownerType) {
    case "VENDOR":
      return Boolean(
        await db.vendor.findFirst({ where: { id: ownerId, organizationId: user.organizationId }, select: { id: true } })
      );
    default:
      return false;
  }
}
