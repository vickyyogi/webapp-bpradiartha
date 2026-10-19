/**
 * Tahap 9A (P1.1) — verifikasi master produk kredit & validasi pengajuan.
 * Fokus: aturan produk (plafon, tenor, persyaratan dokumen) dan validasi
 * server-side saat membuat/mengubah pengajuan. Jalankan: npm run verify:credit-product
 */
import assert from "assert";
import {
  normalizeLoanProductAttributes,
  readProductAttributes,
  validateCreditRequestAgainstProduct,
  type CreditProductOption,
} from "../src/lib/credit-product";
import { db } from "../src/lib/db";

const MODAL_KERJA: CreditProductOption = {
  code: "KREDIT-MK",
  name: "Kredit Modal Kerja",
  attributes: { minAmount: 10_000_000, maxAmount: 500_000_000, minTenor: 6, maxTenor: 36 },
};
const products = [MODAL_KERJA];

let passed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`OK    ${label}`);
  } catch (error) {
    console.error(`FAIL  ${label}`);
    console.error("      " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}

check("produk & plafon valid diterima", () => {
  assert.strictEqual(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Modal Kerja", requestedAmount: 100_000_000, requestedTenorMonths: 12 },
      products
    ),
    null
  );
});

check("nama produk dinormalisasi (spasi & huruf besar)", () => {
  assert.strictEqual(
    validateCreditRequestAgainstProduct(
      { product: "  kredit modal kerja ", requestedAmount: 10_000_000, requestedTenorMonths: 6 },
      products
    ),
    null
  );
});

check("produk kosong ditolak", () => {
  assert.match(
    validateCreditRequestAgainstProduct({ product: "", requestedAmount: 1 }, products) ?? "",
    /wajib dipilih/
  );
});

check("produk tidak terdaftar ditolak", () => {
  assert.match(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Investasi Usaha", requestedAmount: 100_000_000 },
      products
    ) ?? "",
    /tidak terdaftar/
  );
});

check("produk lama tetap boleh selama tidak diubah", () => {
  assert.strictEqual(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Investasi Usaha", requestedAmount: 100_000_000, requestedTenorMonths: 12 },
      products,
      "Kredit Investasi Usaha"
    ),
    null
  );
});

check("plafon di bawah minimum ditolak", () => {
  assert.match(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Modal Kerja", requestedAmount: 5_000_000, requestedTenorMonths: 12 },
      products
    ) ?? "",
    /Plafon minimum/
  );
});

check("plafon di atas maksimum ditolak", () => {
  assert.match(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Modal Kerja", requestedAmount: 500_000_001, requestedTenorMonths: 12 },
      products
    ) ?? "",
    /Plafon maksimum/
  );
});

check("plafon nol/negatif/pecahan ditolak", () => {
  for (const amount of [0, -1, 10_000_000.5, "abc"]) {
    assert.match(
      validateCreditRequestAgainstProduct({ product: "Kredit Modal Kerja", requestedAmount: amount }, products) ?? "",
      /bilangan bulat rupiah/
    );
  }
});

check("tenor di luar rentang produk ditolak", () => {
  assert.match(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Modal Kerja", requestedAmount: 100_000_000, requestedTenorMonths: 3 },
      products
    ) ?? "",
    /Tenor minimum/
  );
  assert.match(
    validateCreditRequestAgainstProduct(
      { product: "Kredit Modal Kerja", requestedAmount: 100_000_000, requestedTenorMonths: 48 },
      products
    ) ?? "",
    /Tenor maksimum/
  );
});

check("plafon/tenor kosong tetap boleh (draft)", () => {
  assert.strictEqual(
    validateCreditRequestAgainstProduct({ product: "Kredit Modal Kerja", requestedAmount: null }, products),
    null
  );
});

check("master produk kosong menolak pengajuan", () => {
  assert.match(
    validateCreditRequestAgainstProduct({ product: "Kredit Modal Kerja", requestedAmount: 1 }, []) ?? "",
    /belum dikonfigurasi/
  );
});

check("normalisasi atribut produk valid", () => {
  const { attributes, error } = normalizeLoanProductAttributes({
    minAmount: "1000000",
    maxAmount: 5000000,
    minTenor: 6,
    maxTenor: 36,
    interestRate: 1.25,
    requiredDocuments: ["ktp", "KTP", "SURVEY_PHOTO"],
  });
  assert.strictEqual(error, null);
  assert.strictEqual(attributes.minAmount, 1_000_000);
  assert.deepStrictEqual(attributes.requiredDocuments, ["KTP", "SURVEY_PHOTO"]);
});

check("normalisasi menolak rentang plafon terbalik", () => {
  const { error } = normalizeLoanProductAttributes({ minAmount: 10, maxAmount: 5 });
  assert.match(error ?? "", /Plafon minimum/);
});

check("normalisasi menolak rentang tenor terbalik", () => {
  const { error } = normalizeLoanProductAttributes({ minTenor: 36, maxTenor: 6 });
  assert.match(error ?? "", /Tenor minimum/);
});

check("normalisasi menolak jenis dokumen tak dikenal", () => {
  const { error } = normalizeLoanProductAttributes({ requiredDocuments: ["NIK_FOTO"] });
  assert.match(error ?? "", /tidak dikenal/);
});

check("normalisasi menolak atribut negatif", () => {
  const { error } = normalizeLoanProductAttributes({ maxAmount: -1 });
  assert.match(error ?? "", /nol atau lebih/);
});

check("readProductAttributes mengabaikan atribut rusak (data lama)", () => {
  assert.deepStrictEqual(readProductAttributes({ minAmount: "x" }), {});
});

(async () => {
  try {
    const loanProducts = await db.masterItem.findMany({
      where: { category: "LOAN_PRODUCT" },
      select: { code: true, name: true, attributes: true, isActive: true },
    });
    check("master LOAN_PRODUCT terbaca & atributnya valid", () => {
      assert.ok(loanProducts.length > 0, "tidak ada Master Data LOAN_PRODUCT");
      for (const item of loanProducts) {
        const { error } = normalizeLoanProductAttributes(item.attributes);
        assert.strictEqual(error, null, `${item.code}: ${error}`);
      }
    });

    const activeProducts = loanProducts
      .filter((item) => item.isActive)
      .map<CreditProductOption>((item) => ({
        code: item.code,
        name: item.name,
        attributes: readProductAttributes(item.attributes),
      }));

    const applications = await db.creditApplication.findMany({ select: { product: true } });
    const distinct = [...new Set(applications.map((app) => app.product).filter((p): p is string => !!p))];
    const unmatched = distinct.filter(
      (name) => !activeProducts.some((product) => product.name.trim().toLowerCase() === name.trim().toLowerCase())
    );
    console.log(
      `INFO  produk pengajuan: ${distinct.length} nama; di luar master aktif: ${
        unmatched.length ? unmatched.join(", ") : "-"
      } (produk lama tetap diizinkan tanpa perubahan)`
    );

    for (const name of distinct) {
      const result = validateCreditRequestAgainstProduct(
        { product: name },
        activeProducts,
        name // simulasi edit tanpa perubahan produk
      );
      check(`produk pengajuan lama "${name}" tetap dapat disimpan`, () => assert.strictEqual(result, null));
    }
  } finally {
    await db.$disconnect();
  }

  if (process.exitCode) {
    console.error(`\n${passed} pemeriksaan lulus, ada pemeriksaan GAGAL.`);
  } else {
    console.log(`\nSEMUA ${passed} PEMERIKSAAN LULUS.`);
  }
})();
