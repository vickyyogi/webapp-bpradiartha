-- Tahap 2A (P0.2): master nasabah/debitur terpisah dari pegawai.
-- Migrasi ini ADITIF untuk tabel baru, lalu memindahkan relasi pengajuan kredit
-- dari akun pegawai (users) ke entitas nasabah (customers), disertai backfill
-- data lama di dalam migrasi agar tidak ada baris yang kehilangan relasi.
-- Tidak ada reset database.

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDU', 'BADAN');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PROSPEK', 'AKTIF', 'NONAKTIF', 'BLACKLIST');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "customer_number" VARCHAR(50) NOT NULL,
    "customer_type" "CustomerType" NOT NULL DEFAULT 'INDIVIDU',
    "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPEK',
    "legal_name" VARCHAR(200) NOT NULL,
    "nickname" VARCHAR(100),
    "identity_type" VARCHAR(50),
    "identity_number" VARCHAR(64),
    "npwp" VARCHAR(40),
    "birth_place" VARCHAR(150),
    "birth_date" TIMESTAMPTZ,
    "gender" VARCHAR(20),
    "address" TEXT,
    "rt_rw" VARCHAR(20),
    "kelurahan" VARCHAR(100),
    "kecamatan" VARCHAR(100),
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "postal_code" VARCHAR(10),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "occupation" VARCHAR(150),
    "employer_name" VARCHAR(200),
    "monthly_income" DOUBLE PRECISION,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "legacy_applicant_user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_customer_number_key" ON "customers"("organization_id", "customer_number");

-- CreateIndex
CREATE INDEX "customers_organization_id_identity_number_idx" ON "customers"("organization_id", "identity_number");

-- CreateIndex
CREATE INDEX "customers_organization_id_legal_name_idx" ON "customers"("organization_id", "legal_name");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: kolom relasi baru (nullable dulu agar backfill dapat dijalankan).
ALTER TABLE "credit_applications" ADD COLUMN "customer_id" UUID;

-- Backfill: buat satu nasabah untuk setiap akun pemohon lama yang dipakai pengajuan kredit.
-- id nasabah memakai id baris users lama agar relasi dapat ditelusuri (legacy_applicant_user_id),
-- tetapi nasabah ini adalah entitas terpisah dan tidak memberi hak login apa pun.
WITH legacy AS (
  SELECT DISTINCT u."id", u."organization_id", u."branch_id", u."full_name", u."phone", u."email"
  FROM "users" u
  JOIN "credit_applications" ca ON ca."applicant_id" = u."id"
),
numbered AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY "organization_id" ORDER BY "id") AS rn FROM legacy
)
INSERT INTO "customers" (
  "id", "organization_id", "branch_id", "customer_number", "customer_type", "status",
  "legal_name", "phone", "email", "legacy_applicant_user_id", "is_active", "created_at", "updated_at"
)
SELECT
  "id", "organization_id", "branch_id",
  'CUST-' || to_char(CURRENT_TIMESTAMP, 'YYYY') || '-' || lpad("rn"::text, 4, '0'),
  'INDIVIDU', 'PROSPEK',
  "full_name", "phone", "email", "id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM numbered;

-- Ekstraksi identitas terstruktur dari catatan bebas pengajuan lama
-- (format yang ditulis kode lama: "[NIK KTP: ...]" dan "[Alamat Pemohon: ...]").
UPDATE "customers" c
SET
  "identity_type"   = CASE WHEN sub."nik" IS NOT NULL THEN COALESCE(c."identity_type", 'KTP') ELSE c."identity_type" END,
  "identity_number" = COALESCE(c."identity_number", sub."nik"),
  "address"         = COALESCE(c."address", sub."addr")
FROM (
  SELECT
    ca."applicant_id" AS uid,
    max(NULLIF(regexp_replace(substring(ca."notes" from '\[NIK KTP:([^]]*)\]'), '[^0-9]', '', 'g'), '')) AS nik,
    max(NULLIF(btrim(substring(ca."notes" from '\[Alamat Pemohon:([^]]*)\]'), ' '), '')) AS addr
  FROM "credit_applications" ca
  WHERE ca."notes" ~ '\[NIK KTP:|\[Alamat Pemohon:'
  GROUP BY ca."applicant_id"
) sub
WHERE c."id" = sub.uid;

-- Hubungkan setiap pengajuan kredit ke nasabahnya (sebelumnya ke akun pemohon).
UPDATE "credit_applications" SET "customer_id" = "applicant_id" WHERE "customer_id" IS NULL;

-- Wajibkan relasi baru dan lepaskan ketergantungan pada akun pegawai.
ALTER TABLE "credit_applications" ALTER COLUMN "customer_id" SET NOT NULL;
ALTER TABLE "credit_applications" DROP CONSTRAINT "credit_applications_applicant_id_fkey";
ALTER TABLE "credit_applications" DROP COLUMN "applicant_id";

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bersihkan tag identitas bebas dari catatan lama karena sudah tersimpan terstruktur.
UPDATE "credit_applications"
SET "notes" = NULLIF(
  btrim(
    regexp_replace(
      regexp_replace("notes", '\[NIK KTP:[^]]*\]', '', 'g'),
      '\[Alamat Pemohon:[^]]*\]', '', 'g'
    ),
    E' \n\r\t'
  ),
  ''
)
WHERE "notes" ~ '\[NIK KTP:|\[Alamat Pemohon:';
