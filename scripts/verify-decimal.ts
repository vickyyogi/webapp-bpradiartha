/**
 * Tahap 6 (P0.6) — verifikasi presisi angka keuangan.
 * Cek: seluruh kolom nominal sudah numeric(18,0) (interest_rate numeric(6,4))
 * dan serialisasi JSON Decimal menjadi number (kontrak API/UI).
 */
import { db } from "../src/lib/db";

const EXPECTED: Array<[string, string, number, number]> = [
  ["asset_maintenances", "cost", 18, 0],
  ["assets", "purchase_price", 18, 0],
  ["credit_applications", "approved_amount", 18, 0],
  ["credit_applications", "interest_rate", 6, 4],
  ["credit_applications", "realization_amount", 18, 0],
  ["credit_applications", "requestedAmount", 18, 0],
  ["credit_approval_limits", "max_amount", 18, 0],
  ["credit_approval_limits", "min_amount", 18, 0],
  ["credit_approval_records", "approved_amount", 18, 0],
  ["customers", "monthly_income", 18, 0],
  ["inventory_items", "unit_price", 18, 0],
  ["purchase_order_items", "total_price", 18, 0],
  ["purchase_order_items", "unit_price", 18, 0],
  ["purchase_orders", "subtotal", 18, 0],
  ["purchase_orders", "tax_amount", 18, 0],
  ["purchase_orders", "total_amount", 18, 0],
  ["purchase_request_items", "estimated_price", 18, 0],
  ["purchase_request_items", "total_price", 18, 0],
  ["purchase_requests", "total_estimated_amount", 18, 0],
  ["slik_analysis_verifications", "ai_baki_debet", 18, 0],
  ["slik_analysis_verifications", "ai_tunggakan", 18, 0],
  ["slik_analysis_verifications", "confirmed_baki_debet", 18, 0],
  ["slik_analysis_verifications", "confirmed_tunggakan", 18, 0],
  ["workflow_steps", "max_amount", 18, 0],
  ["workflow_steps", "min_amount", 18, 0],
];

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}`);
  if (!ok) failed++;
}

(async () => {
  const rows = await db.$queryRawUnsafe<
    { table_name: string; column_name: string; data_type: string; numeric_precision: number; numeric_scale: number }[]
  >(
    `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [...new Set(EXPECTED.map(([t]) => t))]
  );

  for (const [table, column, precision, scale] of EXPECTED) {
    const row = rows.find((r) => r.table_name === table && r.column_name === column);
    check(
      `${table}.${column} = numeric(${precision},${scale})`,
      !!row && row.data_type === "numeric" && row.numeric_precision === precision && row.numeric_scale === scale
    );
  }

  const floats = await db.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type IN ('double precision', 'real')`
  );
  check("tidak ada kolom Float tersisa", Number(floats[0].n) === 0);

  const app = await db.creditApplication.findFirst({ select: { requestedAmount: true } });
  if (app?.requestedAmount) {
    check("JSON Decimal menjadi number", typeof JSON.parse(JSON.stringify(app.requestedAmount)) === "number");
  }

  await db.$disconnect();
  console.log(`\n${failed === 0 ? "LULUS" : `${failed} GAGAL`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
