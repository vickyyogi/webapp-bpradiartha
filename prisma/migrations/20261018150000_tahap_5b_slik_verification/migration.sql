-- Tahap 5B (P0.5): verifikasi manual angka hasil ekstraksi AI (baki debet,
-- tunggakan, kolektibilitas) oleh petugas sebelum hasil AI dipakai di 5C.
-- Migrasi ADITIF saja: satu tabel baru + relasi & indeks. Tidak menyentuh
-- tabel/data yang sudah ada, tidak ada penghapusan, tidak ada data hilang.
-- Rollback: DROP TABLE "slik_analysis_verifications".

-- CreateTable
CREATE TABLE "slik_analysis_verifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slik_analysis_record_id" UUID,
    "ai_baki_debet" DOUBLE PRECISION,
    "ai_tunggakan" DOUBLE PRECISION,
    "ai_kolektibilitas" VARCHAR(100),
    "confirmed_baki_debet" DOUBLE PRECISION,
    "confirmed_tunggakan" DOUBLE PRECISION,
    "confirmed_kolektibilitas" VARCHAR(100),
    "note" TEXT,
    "verified_by_id" UUID,
    "verified_by_name" VARCHAR(200) NOT NULL,
    "verified_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slik_analysis_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slik_analysis_verifications_slik_analysis_record_id_verifie_idx" ON "slik_analysis_verifications"("slik_analysis_record_id", "verified_at");

-- AddForeignKey
ALTER TABLE "slik_analysis_verifications" ADD CONSTRAINT "slik_analysis_verifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slik_analysis_verifications" ADD CONSTRAINT "slik_analysis_verifications_slik_analysis_record_id_fkey" FOREIGN KEY ("slik_analysis_record_id") REFERENCES "slik_analysis_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slik_analysis_verifications" ADD CONSTRAINT "slik_analysis_verifications_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
