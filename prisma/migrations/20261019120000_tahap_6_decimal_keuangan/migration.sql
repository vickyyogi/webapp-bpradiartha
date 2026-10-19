-- Tahap 6 (P0.6): presisi angka keuangan.
-- Semua nominal uang disimpan sebagai numeric(18,0) (rupiah penuh) dan
-- interest_rate sebagai numeric(6,4) (persen, hingga 99.9999).
-- Data lama di-cast langsung; nilai Float yang tidak bulat dibulatkan
-- setengah ke atas oleh PostgreSQL (tidak ada nilai pecahan di data saat ini).

ALTER TABLE "asset_maintenances" ALTER COLUMN "cost" TYPE numeric(18,0) USING "cost"::numeric(18,0);
ALTER TABLE "assets" ALTER COLUMN "purchase_price" TYPE numeric(18,0) USING "purchase_price"::numeric(18,0);
ALTER TABLE "credit_applications" ALTER COLUMN "approved_amount" TYPE numeric(18,0) USING "approved_amount"::numeric(18,0);
ALTER TABLE "credit_applications" ALTER COLUMN "interest_rate" TYPE numeric(6,4) USING "interest_rate"::numeric(6,4);
ALTER TABLE "credit_applications" ALTER COLUMN "realization_amount" TYPE numeric(18,0) USING "realization_amount"::numeric(18,0);
ALTER TABLE "credit_applications" ALTER COLUMN "requestedAmount" TYPE numeric(18,0) USING "requestedAmount"::numeric(18,0);
ALTER TABLE "credit_approval_limits" ALTER COLUMN "max_amount" TYPE numeric(18,0) USING "max_amount"::numeric(18,0);
ALTER TABLE "credit_approval_limits" ALTER COLUMN "min_amount" TYPE numeric(18,0) USING "min_amount"::numeric(18,0);
ALTER TABLE "credit_approval_records" ALTER COLUMN "approved_amount" TYPE numeric(18,0) USING "approved_amount"::numeric(18,0);
ALTER TABLE "customers" ALTER COLUMN "monthly_income" TYPE numeric(18,0) USING "monthly_income"::numeric(18,0);
ALTER TABLE "inventory_items" ALTER COLUMN "unit_price" TYPE numeric(18,0) USING "unit_price"::numeric(18,0);
ALTER TABLE "purchase_order_items" ALTER COLUMN "total_price" TYPE numeric(18,0) USING "total_price"::numeric(18,0);
ALTER TABLE "purchase_order_items" ALTER COLUMN "unit_price" TYPE numeric(18,0) USING "unit_price"::numeric(18,0);
ALTER TABLE "purchase_orders" ALTER COLUMN "subtotal" TYPE numeric(18,0) USING "subtotal"::numeric(18,0);
ALTER TABLE "purchase_orders" ALTER COLUMN "tax_amount" TYPE numeric(18,0) USING "tax_amount"::numeric(18,0);
ALTER TABLE "purchase_orders" ALTER COLUMN "total_amount" TYPE numeric(18,0) USING "total_amount"::numeric(18,0);
ALTER TABLE "purchase_request_items" ALTER COLUMN "estimated_price" TYPE numeric(18,0) USING "estimated_price"::numeric(18,0);
ALTER TABLE "purchase_request_items" ALTER COLUMN "total_price" TYPE numeric(18,0) USING "total_price"::numeric(18,0);
ALTER TABLE "purchase_requests" ALTER COLUMN "total_estimated_amount" TYPE numeric(18,0) USING "total_estimated_amount"::numeric(18,0);
ALTER TABLE "slik_analysis_verifications" ALTER COLUMN "ai_baki_debet" TYPE numeric(18,0) USING "ai_baki_debet"::numeric(18,0);
ALTER TABLE "slik_analysis_verifications" ALTER COLUMN "ai_tunggakan" TYPE numeric(18,0) USING "ai_tunggakan"::numeric(18,0);
ALTER TABLE "slik_analysis_verifications" ALTER COLUMN "confirmed_baki_debet" TYPE numeric(18,0) USING "confirmed_baki_debet"::numeric(18,0);
ALTER TABLE "slik_analysis_verifications" ALTER COLUMN "confirmed_tunggakan" TYPE numeric(18,0) USING "confirmed_tunggakan"::numeric(18,0);
ALTER TABLE "workflow_steps" ALTER COLUMN "max_amount" TYPE numeric(18,0) USING "max_amount"::numeric(18,0);
ALTER TABLE "workflow_steps" ALTER COLUMN "min_amount" TYPE numeric(18,0) USING "min_amount"::numeric(18,0);
