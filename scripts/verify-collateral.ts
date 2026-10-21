/**
 * Tahap 10 (P1.2) — verifikasi manajemen agunan.
 * Cek validasi payload, pengingat tenggat, dan struktur tabel.
 */
import { db } from "../src/lib/db";
import { daysUntil, parseCollateralPayload, reminderLevel } from "../src/lib/collateral";

let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "OK  " : "FAIL"}  ${label}`);
  if (!ok) failed++;
}

(async () => {
  const base = {
    customerId: "11111111-1111-1111-1111-111111111111",
    collateralType: "SHM",
    legalOwnerName: "Budi",
    marketValue: 500000000.6,
    appraisalDate: "2026-10-01",
    nextAppraisalDate: "2027-10-01",
    status: "active",
  };

  const valid = parseCollateralPayload(base);
  check("payload valid diterima", !!valid.data);
  check("nominal dibulatkan ke rupiah", valid.data?.marketValue?.toString() === "500000001");
  check("status dinormalisasi", valid.data?.status === "ACTIVE");
  check("opsional kosong menjadi null", valid.data?.bindingType === null);
  check("nasabah wajib", !!parseCollateralPayload({ ...base, customerId: "" }).error);
  check("jenis wajib", !!parseCollateralPayload({ ...base, collateralType: "" }).error);
  check("pemilik legal wajib", !!parseCollateralPayload({ ...base, legalOwnerName: "" }).error);
  check("nominal negatif menjadi null", parseCollateralPayload({ ...base, marketValue: -1 }).data?.marketValue === null);
  check("status tidak dikenal jatuh ke ACTIVE", parseCollateralPayload({ ...base, status: "HACKED" }).data?.status === "ACTIVE");

  const now = new Date("2026-10-21T12:00:00");
  check("hari ini = 0 hari", daysUntil("2026-10-21", now) === 0);
  check("besok = 1 hari", daysUntil("2026-10-22", now) === 1);
  check("kemarin = -1 hari", daysUntil("2026-10-20", now) === -1);
  check("lewat = OVERDUE", reminderLevel("2026-10-20", 30) === "OVERDUE");
  check("<=30 hari = DUE_SOON", reminderLevel("2026-11-10", 30) === "DUE_SOON");
  check(">30 hari = OK", reminderLevel("2027-01-01", 30) === "OK");
  check("tanpa tanggal = NONE", reminderLevel(null) === "NONE");

  const columns = await db.$queryRawUnsafe<{ column_name: string; data_type: string }[]>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'credit_collaterals'`
  );
  const names = columns.map((c) => c.column_name);
  for (const required of [
    "customer_id", "credit_application_id", "collateral_code", "collateral_type",
    "ownership_proof", "legal_owner_name", "owner_relationship", "market_value",
    "njop_value", "appraised_value", "appraiser_name", "appraisal_date",
    "next_appraisal_date", "binding_type", "binding_expiry_date",
    "insurance_expiry_date", "status", "created_by_id",
  ]) {
    check(`kolom ${required} ada`, names.includes(required));
  }
  check("market_value numeric", columns.find((c) => c.column_name === "market_value")?.data_type === "numeric");

  const appraisals = await db.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'collateral_appraisals'`
  );
  check("riwayat penilaian punya collateral_id", appraisals.some((c) => c.column_name === "collateral_id"));

  await db.$disconnect();
  console.log(`\n${failed === 0 ? "LULUS" : `${failed} GAGAL`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
