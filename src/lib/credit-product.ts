/**
 * Tahap 9A (P1.1) — master produk kredit sebagai sumber aturan pengajuan.
 *
 * Produk kredit tetap disimpan pada Master Data kategori `LOAN_PRODUCT`
 * (tidak ada tabel baru). Atribut JSON produk diperluas dengan
 * `requiredDocuments` (kode DocumentType) yang nantinya dipakai checklist
 * verifikasi berkas. Nominal uang tetap number di batas API; kolom database
 * tetap Decimal (Tahap 6).
 *
 * Berkas ini sengaja bebas dari dependensi Next.js agar dapat diuji dengan
 * ts-node (lihat scripts/verify-credit-product.ts).
 */
import { DocumentType } from "@prisma/client";
import { db } from "./db";

export const DOCUMENT_TYPE_VALUES: string[] = Object.values(DocumentType);

export type CreditProductAttributes = {
  interestRate?: number | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  minTenor?: number | null;
  maxTenor?: number | null;
  requiredDocuments?: string[];
};

/** Produk aktif yang dikirim ke UI/form pengajuan. */
export type CreditProductOption = {
  code: string;
  name: string;
  attributes: CreditProductAttributes;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Menormalkan atribut produk. Mengembalikan `error` (bukan melempar) agar
 * route master data dapat membalas 400 tanpa stack trace.
 */
export function normalizeLoanProductAttributes(raw: unknown): {
  attributes: CreditProductAttributes;
  error: string | null;
} {
  if (raw === null || raw === undefined) return { attributes: {}, error: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { attributes: {}, error: "Atribut produk kredit harus berupa objek." };
  }
  const input = raw as Record<string, unknown>;
  const attributes: CreditProductAttributes = {};

  for (const field of ["interestRate", "minAmount", "maxAmount", "minTenor", "maxTenor"] as const) {
    if (input[field] === undefined) continue;
    const parsed = toNumber(input[field]);
    if (parsed === null || parsed < 0) {
      return { attributes: {}, error: `Parameter ${field} harus berupa angka nol atau lebih.` };
    }
    attributes[field] = parsed;
  }

  if (
    attributes.minAmount != null &&
    attributes.maxAmount != null &&
    attributes.minAmount > attributes.maxAmount
  ) {
    return { attributes: {}, error: "Plafon minimum tidak boleh melebihi plafon maksimum." };
  }
  if (attributes.minTenor != null && (!Number.isInteger(attributes.minTenor) || attributes.minTenor < 1)) {
    return { attributes: {}, error: "Tenor minimum harus bilangan bulat minimal 1 bulan." };
  }
  if (attributes.maxTenor != null && (!Number.isInteger(attributes.maxTenor) || attributes.maxTenor < 1)) {
    return { attributes: {}, error: "Tenor maksimum harus bilangan bulat minimal 1 bulan." };
  }
  if (
    attributes.minTenor != null &&
    attributes.maxTenor != null &&
    attributes.minTenor > attributes.maxTenor
  ) {
    return { attributes: {}, error: "Tenor minimum tidak boleh melebihi tenor maksimum." };
  }

  if (input.requiredDocuments !== undefined && input.requiredDocuments !== null) {
    if (!Array.isArray(input.requiredDocuments)) {
      return { attributes: {}, error: "Persyaratan dokumen harus berupa daftar." };
    }
    const docs = [...new Set(input.requiredDocuments.map((doc) => String(doc).trim().toUpperCase()))];
    const invalid = docs.filter((doc) => !DOCUMENT_TYPE_VALUES.includes(doc));
    if (invalid.length > 0) {
      return {
        attributes: {},
        error: `Jenis dokumen tidak dikenal: ${invalid.join(", ")}. Pilihan: ${DOCUMENT_TYPE_VALUES.join(", ")}.`,
      };
    }
    attributes.requiredDocuments = docs;
  }

  return { attributes, error: null };
}

export function readProductAttributes(raw: unknown): CreditProductAttributes {
  return normalizeLoanProductAttributes(raw).attributes;
}

/** Produk kredit aktif sebuah organisasi (Master Data kategori LOAN_PRODUCT). */
export async function listActiveCreditProducts(organizationId: string): Promise<CreditProductOption[]> {
  const items = await db.masterItem.findMany({
    where: { organizationId, category: "LOAN_PRODUCT", isActive: true },
    select: { code: true, name: true, attributes: true },
    orderBy: { sortOrder: "asc" },
  });
  return items.map((item) => ({
    code: item.code,
    name: item.name,
    attributes: readProductAttributes(item.attributes),
  }));
}

function findProduct(products: CreditProductOption[], name: string): CreditProductOption | null {
  const clean = name.trim().toLowerCase();
  return products.find((product) => product.name.trim().toLowerCase() === clean) ?? null;
}

export type CreditRequestInput = {
  product?: string | null;
  requestedAmount?: unknown;
  requestedTenorMonths?: unknown;
};

/**
 * Validasi server-side pengajuan terhadap master produk.
 * `legacyProduct` = nilai produk lama pada record; produk historis yang sudah
 * tidak ada di master tetap boleh disimpan tanpa perubahan (tidak memutus
 * pengajuan berjalan).
 */
export function validateCreditRequestAgainstProduct(
  input: CreditRequestInput,
  products: CreditProductOption[],
  legacyProduct?: string | null
): string | null {
  if (products.length === 0) {
    return "Master produk kredit belum dikonfigurasi. Hubungi administrator untuk mengisi Master Data kategori LOAN_PRODUCT.";
  }

  const productName = typeof input.product === "string" ? input.product.trim() : "";
  if (!productName) return "Produk kredit wajib dipilih.";

  let product = findProduct(products, productName);
  if (!product) {
    if (legacyProduct && legacyProduct.trim().toLowerCase() === productName.toLowerCase()) {
      product = null; // produk lama: aturan produk tidak tersedia, tapi tidak ditolak
    } else {
      return `Produk kredit "${productName}" tidak terdaftar/aktif pada Master Data produk kredit.`;
    }
  }

  const amountRaw = input.requestedAmount;
  if (amountRaw !== undefined && amountRaw !== null && amountRaw !== "") {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      return "Plafon yang dimohon harus berupa bilangan bulat rupiah lebih besar dari nol.";
    }
    if (product?.attributes.minAmount != null && amount < product.attributes.minAmount) {
      return `Plafon minimum produk ${product.name} adalah Rp ${product.attributes.minAmount.toLocaleString("id-ID")}.`;
    }
    if (product?.attributes.maxAmount != null && amount > product.attributes.maxAmount) {
      return `Plafon maksimum produk ${product.name} adalah Rp ${product.attributes.maxAmount.toLocaleString("id-ID")}.`;
    }
  }

  const tenorRaw = input.requestedTenorMonths;
  if (tenorRaw !== undefined && tenorRaw !== null && tenorRaw !== "") {
    const tenor = Number(tenorRaw);
    if (!Number.isInteger(tenor) || tenor < 1) {
      return "Tenor harus bilangan bulat minimal 1 bulan.";
    }
    if (product?.attributes.minTenor != null && tenor < product.attributes.minTenor) {
      return `Tenor minimum produk ${product.name} adalah ${product.attributes.minTenor} bulan.`;
    }
    if (product?.attributes.maxTenor != null && tenor > product.attributes.maxTenor) {
      return `Tenor maksimum produk ${product.name} adalah ${product.attributes.maxTenor} bulan.`;
    }
  }

  return null;
}
