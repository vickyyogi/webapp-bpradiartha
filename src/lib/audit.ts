// Impor relatif (bukan alias @/) agar berkas ini juga dapat dimuat oleh skrip
// verifikasi yang dijalankan dengan ts-node.
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { maskAccountNumber, maskNIK } from "./privacy";
import { NextRequest } from "next/server";

const REDACTED = "[REDACTED]";
const REDACTED_CONTENT = "[REDACTED_CONTENT]";
const SECRET_KEY =
  /^(password|passwordhash|passwd|token|accesstoken|refreshtoken|secret|authorization|cookie|apikey|api_key|privatekey|private_key|mfasecret|mfa_secret|backupcodes?|creditcardnumber|cvv|pin|otp)$/i;
const CONTENT_KEY =
  /^(content|filecontent|filedata|filebuffer|file_body|documentbody|documentcontent|rawbody|buffer|bytes)$/i;
const NIK_KEY = /^(nik|identitynumber|identity_number|ktpnumber|ktp_number|nomorinduk|nomor_induk|npwp)$/i;
const ACCOUNT_KEY = /^(accountnumber|account_number|rekening|virtualaccount|va_number)$/i;

export class AuditLogWriteError extends Error {
  readonly code = "AUDIT_LOG_WRITE_FAILED";
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;

  constructor(message: string, params: Pick<LogAuditParams, "action" | "entityType" | "entityId">, cause?: unknown) {
    super(message);
    this.name = "AuditLogWriteError";
    this.action = params.action;
    this.entityType = params.entityType;
    this.entityId = String(params.entityId);
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export interface LogAuditParams {
  organizationId: string;
  userId?: string | null;
  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "APPROVE"
    | "REJECT"
    | "LOGIN"
    | "LOGOUT"
    | "UPLOAD"
    | "DOWNLOAD"
    | "EXPORT"
    | "STATUS_CHANGE"
    | "ASSIGN"
    | "TRANSFER"
    | "DISPOSAL"
    | string;
  entityType:
    | "CREDIT_APPLICATION"
    | "LEAD"
    | "PURCHASE_REQUEST"
    | "PURCHASE_ORDER"
    | "GOODS_RECEIPT"
    | "INVENTORY_ITEM"
    | "ASSET"
    | "DOCUMENT"
    | "USER"
    | "ROLE"
    | string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  notes?: string | null;
  /**
   * Tahap 7 (P1.6): default true = kegagalan menulis audit menggagalkan aksi
   * (fail-closed). Hanya log non-kritis yang boleh memakai `critical: false`,
   * dan kegagalannya tetap dicetak ke stderr agar terdeteksi.
   */
  critical?: boolean;
}

function normalizedKey(key: string): string {
  return key.replace(/[\s_-]/g, "").toLowerCase();
}

function sanitizeText(value: string): string {
  return (
    value
      // NIK 16 digit yang lolos di catatan bebas tetap disamarkan.
      .replace(/\b\d{16}\b/g, (match) => maskNIK(match))
      // Rahasia yang ditulis di catatan bebas (mis. "password=...").
      .replace(
        /\b(password|passwd|token|secret|authorization|cookie|pin|otp|api[_-]?key)\b\s*(?:[:=]|is)?\s*[^\s,;]+/gi,
        "$1=[REDACTED]"
      )
  );
}

/**
 * Membersihkan nilai sebelum masuk kolom JSON audit.
 * - password/token/secret/kode MFA/isi berkas tidak pernah disimpan.
 * - NIK dan nomor rekening disamarkan, bukan disimpan plaintext.
 * - Berlaku rekursif untuk objek dan array.
 */
export function sanitizeAuditValue(value: unknown, key = ""): unknown {
  const normalized = normalizedKey(key);

  if (normalized && SECRET_KEY.test(normalized)) return REDACTED;
  if (normalized && CONTENT_KEY.test(normalized)) return REDACTED_CONTENT;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) return value;
    // Buffer/Uint8Array = isi berkas; jangan pernah masuk log.
    if (ArrayBuffer.isView(value)) return REDACTED_CONTENT;
    // Decimal dan objek non-plain dibiarkan; JSON.stringify memakai toJSON-nya.
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizeAuditValue(childValue, childKey),
      ])
    );
  }

  if (typeof value === "string") {
    if (normalized && NIK_KEY.test(normalized)) return maskNIK(value);
    if (normalized && ACCOUNT_KEY.test(normalized)) return maskAccountNumber(value);
    return sanitizeText(value);
  }

  return value;
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(sanitizeAuditValue(value))) as Prisma.InputJsonValue;
}

/** Data siap tulis; dipakai juga oleh transaksi pemanggil (atomic audit). */
export function buildAuditLogData(params: LogAuditParams): Prisma.AuditLogUncheckedCreateInput {
  return {
    organizationId: params.organizationId,
    userId: params.userId || null,
    action: params.action,
    entityType: params.entityType,
    entityId: String(params.entityId),
    oldValues: toJsonSafe(params.oldValues),
    newValues: toJsonSafe(params.newValues),
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    notes: params.notes ? sanitizeText(String(params.notes)) : null,
  };
}

function reportAuditFailure(params: LogAuditParams, error: unknown) {
  console.error(
    `[audit] GAGAL menulis audit log: action=${params.action} entity=${params.entityType}/${params.entityId}`,
    error
  );
}

/**
 * Tahap 7 (P1.6): kegagalan audit tidak lagi ditelan.
 *
 * Pemanggil kritis (login, perubahan role/izin, approval, ekspor, unduhan,
 * master data, konfigurasi) memakai default `critical: true`, sehingga
 * kegagalan menulis audit menjadi error yang terlihat dan permintaan gagal.
 * Untuk perubahan data yang harus atomik, gunakan `buildAuditLogData` di dalam
 * `db.$transaction` yang sama dengan perubahan datanya.
 */
export async function logAudit(params: LogAuditParams) {
  const critical = params.critical !== false;
  try {
    return await db.auditLog.create({ data: buildAuditLogData(params) });
  } catch (error) {
    reportAuditFailure(params, error);
    if (critical) {
      throw new AuditLogWriteError(
        "Audit log gagal ditulis. Aksi dibatalkan agar tidak ada perubahan tanpa jejak audit.",
        params,
        error
      );
    }
    return null;
  }
}

export function extractClientInfo(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "Unknown";
  return { ipAddress, userAgent };
}
