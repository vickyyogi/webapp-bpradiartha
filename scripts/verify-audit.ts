/**
 * Tahap 7 (P1.6) — verifikasi audit trail dan logging.
 * Jalankan: npm run verify:audit
 */
import assert from "assert";
import { db } from "../src/lib/db";
import {
  AuditLogWriteError,
  buildAuditLogData,
  logAudit,
  sanitizeAuditValue,
} from "../src/lib/audit";

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

check("7: password/token/secret dan isi berkas tidak masuk data audit", () => {
  const data = buildAuditLogData({
    organizationId: "00000000-0000-0000-0000-000000000000",
    action: "UPDATE",
    entityType: "USER",
    entityId: "x",
    newValues: {
      password: "SandiRahasia123!",
      passwordHash: "$2b$12$hash",
      token: "jwt-token",
      mfaSecret: "totp-secret",
      backupCodes: ["ABC-123"],
      fileContent: "isi dokumen KTP",
      nested: { authorization: "Bearer abc", safe: "boleh" },
    },
    notes: "NIK 3171012345678901 dan password=SandiRahasia123!",
  });

  const serialized = JSON.stringify(data);
  assert.ok(!serialized.includes("SandiRahasia123!"));
  assert.ok(!serialized.includes("$2b$12$hash"));
  assert.ok(!serialized.includes("jwt-token"));
  assert.ok(!serialized.includes("totp-secret"));
  assert.ok(!serialized.includes("ABC-123"));
  assert.ok(!serialized.includes("isi dokumen KTP"));
  assert.ok(!serialized.includes("Bearer abc"));
  assert.ok(!serialized.includes("3171012345678901"));
  assert.ok(serialized.includes("3171**********01"));
  assert.ok(serialized.includes("boleh"));
});

check("7: NIK dan nomor rekening disamarkan, bukan dihapus sembarangan", () => {
  const value = sanitizeAuditValue({
    identityNumber: "3171012345678901",
    accountNumber: "1234567890",
    name: "Budi",
  }) as Record<string, string>;
  assert.strictEqual(value.identityNumber, "3171**********01");
  assert.strictEqual(value.accountNumber, "123****890");
  assert.strictEqual(value.name, "Budi");
});

async function databaseChecks() {
  const organization = await db.organization.findFirst({ select: { id: true } });
  const user = await db.user.findFirst({ select: { id: true } });
  assert.ok(organization, "Butuh minimal satu organisasi untuk uji audit.");

  const created = await logAudit({
    organizationId: organization!.id,
    userId: user?.id ?? null,
    action: "UPDATE",
    entityType: "USER",
    entityId: user?.id ?? "test",
    oldValues: { identityNumber: "3171012345678901" },
    newValues: {
      password: "TidakBolehMasukLog",
      documentContent: "IsiDokumenRahasia",
      safeField: "nilai-aman",
    },
    notes: "Uji audit; NIK 3171012345678901",
  });

  assert.ok(created?.id, "Audit log berhasil dibuat.");
  const stored = await db.auditLog.findUnique({ where: { id: created!.id } });
  const serialized = JSON.stringify(stored);
  assert.ok(!serialized.includes("TidakBolehMasukLog"));
  assert.ok(!serialized.includes("IsiDokumenRahasia"));
  assert.ok(!serialized.includes("3171012345678901"));
  assert.ok(serialized.includes("nilai-aman"));
  await db.auditLog.delete({ where: { id: created!.id } });

  const missingOrg = "00000000-0000-0000-0000-000000000000";
  await assert.rejects(
    () =>
      logAudit({
        organizationId: missingOrg,
        action: "LOGIN",
        entityType: "USER",
        entityId: "failure-test",
      }),
    (error: unknown) => error instanceof AuditLogWriteError && error.code === "AUDIT_LOG_WRITE_FAILED"
  );

  const bestEffort = await logAudit({
    organizationId: missingOrg,
    action: "LOGIN",
    entityType: "USER",
    entityId: "best-effort-test",
    critical: false,
  });
  assert.strictEqual(bestEffort, null);
}

databaseChecks()
  .then(() => {
    passed++;
    console.log("OK    7: audit sukses tersimpan bersih; kegagalan kritis melempar error");
  })
  .catch((error) => {
    console.error("FAIL  7: pengujian database audit");
    console.error("      " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    console.log(`\n${passed} pemeriksaan lulus${process.exitCode ? " (ada kegagalan)" : ""}.`);
  });
