-- Tahap 5B (P0.5): alasan penerusan pengajuan meski rekomendasi AI = REJECT.
-- Migrasi ADITIF saja: membuat satu tabel baru beserta relasi & indeksnya.
-- Tidak menyentuh tabel/data yang sudah ada, tidak ada penghapusan, dan tidak
-- ada data yang hilang. Rollback: DROP TABLE "credit_slik_overrides".

-- CreateTable
CREATE TABLE "credit_slik_overrides" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "slik_analysis_record_id" UUID,
    "rekomendasi" VARCHAR(20) NOT NULL,
    "reason" TEXT NOT NULL,
    "recorded_by_id" UUID,
    "recorded_by_name" VARCHAR(200) NOT NULL,
    "recorded_by_role" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_slik_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_slik_overrides_credit_application_id_created_at_idx" ON "credit_slik_overrides"("credit_application_id", "created_at");

-- AddForeignKey
ALTER TABLE "credit_slik_overrides" ADD CONSTRAINT "credit_slik_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_slik_overrides" ADD CONSTRAINT "credit_slik_overrides_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_slik_overrides" ADD CONSTRAINT "credit_slik_overrides_slik_analysis_record_id_fkey" FOREIGN KEY ("slik_analysis_record_id") REFERENCES "slik_analysis_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_slik_overrides" ADD CONSTRAINT "credit_slik_overrides_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
