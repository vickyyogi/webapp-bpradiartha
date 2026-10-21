/**
 * Tahap 10 (P1.2) — helper agunan.
 * Aturan bisnis (jenis agunan, pengikatan, penilai) sengaja berupa teks bebas
 * sampai SOP resmi menetapkan daftar pilihan.
 */
import { Prisma } from "@prisma/client";

export const COLLATERAL_STATUSES = ["ACTIVE", "RELEASED", "EXPIRED"] as const;
export type CollateralStatusValue = (typeof COLLATERAL_STATUSES)[number];

export interface CollateralPayload {
  customerId: string;
  creditApplicationId: string | null;
  collateralCode: string | null;
  collateralType: string;
  ownershipProof: string | null;
  legalOwnerName: string;
  ownerRelationship: string | null;
  marketValue: Prisma.Decimal | null;
  njopValue: Prisma.Decimal | null;
  appraisedValue: Prisma.Decimal | null;
  appraiserName: string | null;
  appraisalMethod: string | null;
  appraisalDate: Date | null;
  nextAppraisalDate: Date | null;
  bindingType: string | null;
  bindingNumber: string | null;
  bindingDate: Date | null;
  bindingExpiryDate: Date | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiryDate: Date | null;
  locationAddress: string | null;
  status: CollateralStatusValue;
  notes: string | null;
}

function text(value: unknown, max = 200): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim().slice(0, max) || null;
}

function date(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function money(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(Math.round(n));
}

export function parseCollateralPayload(body: Record<string, unknown>): {
  data?: CollateralPayload;
  error?: string;
} {
  const customerId = text(body.customerId, 64);
  const collateralType = text(body.collateralType, 100);
  const legalOwnerName = text(body.legalOwnerName, 200);
  if (!customerId) return { error: "Nasabah wajib dipilih." };
  if (!collateralType) return { error: "Jenis agunan wajib diisi." };
  if (!legalOwnerName) return { error: "Pemilik legal wajib diisi." };

  const statusRaw = String(body.status ?? "ACTIVE").toUpperCase();
  const status = (COLLATERAL_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as CollateralStatusValue)
    : "ACTIVE";

  return {
    data: {
      customerId,
      creditApplicationId: text(body.creditApplicationId, 64),
      collateralCode: text(body.collateralCode, 50),
      collateralType,
      ownershipProof: text(body.ownershipProof, 200),
      legalOwnerName,
      ownerRelationship: text(body.ownerRelationship, 100),
      marketValue: money(body.marketValue),
      njopValue: money(body.njopValue),
      appraisedValue: money(body.appraisedValue),
      appraiserName: text(body.appraiserName, 200),
      appraisalMethod: text(body.appraisalMethod, 100),
      appraisalDate: date(body.appraisalDate),
      nextAppraisalDate: date(body.nextAppraisalDate),
      bindingType: text(body.bindingType, 100),
      bindingNumber: text(body.bindingNumber, 100),
      bindingDate: date(body.bindingDate),
      bindingExpiryDate: date(body.bindingExpiryDate),
      insuranceProvider: text(body.insuranceProvider, 200),
      insurancePolicyNumber: text(body.insurancePolicyNumber, 100),
      insuranceExpiryDate: date(body.insuranceExpiryDate),
      locationAddress: text(body.locationAddress, 2000),
      status,
      notes: text(body.notes, 2000),
    },
  };
}

/** Selisih hari dari hari ini (negatif = sudah lewat). */
export function daysUntil(value: Date | string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((end - start) / 86_400_000);
}

/** Kategori pengingat berdasarkan tenggat terdekat. */
export function reminderLevel(value: Date | string | null | undefined, warningDays = 30): "OVERDUE" | "DUE_SOON" | "OK" | "NONE" {
  const days = daysUntil(value);
  if (days === null) return "NONE";
  if (days < 0) return "OVERDUE";
  if (days <= warningDays) return "DUE_SOON";
  return "OK";
}
