/**
 * Tahap 7 (P1.6) — pembersihan audit log berdasarkan retensi.
 *
 * Retensi BUKAN keputusan teknis: nilai hari wajib disetujui pemilik proses.
 * Skrip tidak menghapus apa pun kecuali dua env diisi eksplisit:
 *   AUDIT_LOG_RETENTION_DAYS=365
 *   AUDIT_RETENTION_APPLY=YES
 * Tanpa itu, skrip hanya menghitung (dry-run).
 *
 * Jalankan: npm run audit:purge
 */
import { db } from "../src/lib/db";

async function main() {
  const rawDays = process.env.AUDIT_LOG_RETENTION_DAYS;
  const days = Number(rawDays);

  if (!rawDays || !Number.isInteger(days) || days < 1) {
    throw new Error("AUDIT_LOG_RETENTION_DAYS wajib bilangan bulat minimal 1 (hasil keputusan kebijakan).");
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { createdAt: { lt: cutoff } };
  const candidates = await db.auditLog.count({ where });
  const apply = process.env.AUDIT_RETENTION_APPLY === "YES";

  console.log(`Retensi: ${days} hari. Cutoff: ${cutoff.toISOString()}. Kandidat: ${candidates}.`);
  if (!apply) {
    console.log("Dry-run. Set AUDIT_RETENTION_APPLY=YES untuk menghapus permanen.");
    return;
  }

  const result = await db.auditLog.deleteMany({ where });
  console.log(`Selesai. ${result.count} audit log dihapus.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
