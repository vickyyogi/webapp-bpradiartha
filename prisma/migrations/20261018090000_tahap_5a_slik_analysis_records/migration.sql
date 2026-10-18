-- Tahap 5A (P0.5): penyimpanan hasil analisa SLIK OJK yang terkait nasabah.
-- Migrasi ADITIF saja: membuat satu tabel baru beserta relasi & indeksnya.
-- Tidak menyentuh tabel/data yang sudah ada, tidak ada penghapusan, dan tidak
-- ada data yang hilang. Rollback: DROP TABLE "slik_analysis_records" (data hasil
-- analisa yang sudah tersimpan ikut hilang — cadangkan bila perlu).

-- CreateTable
CREATE TABLE "slik_analysis_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "customer_id" UUID NOT NULL,
    "credit_application_id" UUID,
    "customer_name" VARCHAR(200) NOT NULL,
    "source_file_names" JSONB,
    "mode" VARCHAR(20) NOT NULL,
    "rekomendasi" VARCHAR(20) NOT NULL,
    "risk_rating" VARCHAR(40),
    "model_used" VARCHAR(100),
    "elapsed_ms" INTEGER,
    "result" JSONB NOT NULL,
    "meta" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "slik_analysis_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slik_analysis_records_organization_id_created_at_idx" ON "slik_analysis_records"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "slik_analysis_records_organization_id_customer_id_idx" ON "slik_analysis_records"("organization_id", "customer_id");

-- AddForeignKey
ALTER TABLE "slik_analysis_records" ADD CONSTRAINT "slik_analysis_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slik_analysis_records" ADD CONSTRAINT "slik_analysis_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slik_analysis_records" ADD CONSTRAINT "slik_analysis_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slik_analysis_records" ADD CONSTRAINT "slik_analysis_records_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slik_analysis_records" ADD CONSTRAINT "slik_analysis_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
