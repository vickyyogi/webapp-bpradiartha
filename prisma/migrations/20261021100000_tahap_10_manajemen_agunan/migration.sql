-- CreateEnum
CREATE TYPE "CollateralStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateTable
CREATE TABLE "credit_collaterals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "customer_id" UUID NOT NULL,
    "credit_application_id" UUID,
    "collateral_code" VARCHAR(50) NOT NULL,
    "collateral_type" VARCHAR(100) NOT NULL,
    "ownership_proof" VARCHAR(200),
    "legal_owner_name" VARCHAR(200) NOT NULL,
    "owner_relationship" VARCHAR(100),
    "market_value" DECIMAL(18,0),
    "njop_value" DECIMAL(18,0),
    "appraised_value" DECIMAL(18,0),
    "appraiser_name" VARCHAR(200),
    "appraisal_method" VARCHAR(100),
    "appraisal_date" TIMESTAMPTZ,
    "next_appraisal_date" TIMESTAMPTZ,
    "binding_type" VARCHAR(100),
    "binding_number" VARCHAR(100),
    "binding_date" TIMESTAMPTZ,
    "binding_expiry_date" TIMESTAMPTZ,
    "insurance_provider" VARCHAR(200),
    "insurance_policy_number" VARCHAR(100),
    "insurance_expiry_date" TIMESTAMPTZ,
    "location_address" TEXT,
    "status" "CollateralStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral_appraisals" (
    "id" UUID NOT NULL,
    "collateral_id" UUID NOT NULL,
    "market_value" DECIMAL(18,0),
    "njop_value" DECIMAL(18,0),
    "appraised_value" DECIMAL(18,0),
    "appraiser_name" VARCHAR(200),
    "method" VARCHAR(100),
    "appraisal_date" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collateral_appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_collaterals_organization_id_collateral_code_key" ON "credit_collaterals"("organization_id", "collateral_code");

-- CreateIndex
CREATE INDEX "credit_collaterals_organization_id_customer_id_idx" ON "credit_collaterals"("organization_id", "customer_id");

-- CreateIndex
CREATE INDEX "credit_collaterals_organization_id_credit_application_id_idx" ON "credit_collaterals"("organization_id", "credit_application_id");

-- CreateIndex
CREATE INDEX "credit_collaterals_organization_id_next_appraisal_date_idx" ON "credit_collaterals"("organization_id", "next_appraisal_date");

-- CreateIndex
CREATE INDEX "credit_collaterals_organization_id_insurance_expiry_date_idx" ON "credit_collaterals"("organization_id", "insurance_expiry_date");

-- CreateIndex
CREATE INDEX "collateral_appraisals_collateral_id_appraisal_date_idx" ON "collateral_appraisals"("collateral_id", "appraisal_date");

-- AddForeignKey
ALTER TABLE "credit_collaterals" ADD CONSTRAINT "credit_collaterals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_collaterals" ADD CONSTRAINT "credit_collaterals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_collaterals" ADD CONSTRAINT "credit_collaterals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_collaterals" ADD CONSTRAINT "credit_collaterals_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_collaterals" ADD CONSTRAINT "credit_collaterals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_appraisals" ADD CONSTRAINT "collateral_appraisals_collateral_id_fkey" FOREIGN KEY ("collateral_id") REFERENCES "credit_collaterals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_appraisals" ADD CONSTRAINT "collateral_appraisals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
