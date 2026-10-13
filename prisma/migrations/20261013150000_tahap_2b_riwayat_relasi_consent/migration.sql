-- Tahap 2B (P0.2): riwayat identitas, hubungan antar-pihak, dan persetujuan data pribadi.
-- Migrasi ADITIF saja: membuat tiga tabel baru dan enum terkait. Tidak menyentuh
-- tabel/data yang sudah ada, tidak ada reset database, dan tidak ada data hilang.

-- CreateEnum
CREATE TYPE "CustomerRelationshipType" AS ENUM ('SPOUSE', 'GUARANTOR', 'UBO', 'FAMILY', 'BUSINESS_PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerConsentType" AS ENUM ('DATA_PROCESSING', 'DATA_SHARING', 'MARKETING', 'CREDIT_CHECK');

-- CreateTable
CREATE TABLE "customer_identity_histories" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "changed_by_id" UUID,
    "verified_by_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "changed_fields" JSONB,
    "old_values" JSONB,
    "new_values" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_identity_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_relationships" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "related_customer_id" UUID,
    "relationship_type" "CustomerRelationshipType" NOT NULL,
    "related_name" VARCHAR(200),
    "related_identity_number" VARCHAR(64),
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "consent_type" "CustomerConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "policy_version" VARCHAR(50),
    "evidence_ref" VARCHAR(255),
    "granted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "recorded_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_identity_histories_customer_id_created_at_idx" ON "customer_identity_histories"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_relationships_customer_id_idx" ON "customer_relationships"("customer_id");

-- CreateIndex
CREATE INDEX "customer_relationships_related_customer_id_idx" ON "customer_relationships"("related_customer_id");

-- CreateIndex
CREATE INDEX "customer_consents_customer_id_consent_type_idx" ON "customer_consents"("customer_id", "consent_type");

-- AddForeignKey
ALTER TABLE "customer_identity_histories" ADD CONSTRAINT "customer_identity_histories_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_identity_histories" ADD CONSTRAINT "customer_identity_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_identity_histories" ADD CONSTRAINT "customer_identity_histories_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_relationships" ADD CONSTRAINT "customer_relationships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_relationships" ADD CONSTRAINT "customer_relationships_related_customer_id_fkey" FOREIGN KEY ("related_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_relationships" ADD CONSTRAINT "customer_relationships_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
