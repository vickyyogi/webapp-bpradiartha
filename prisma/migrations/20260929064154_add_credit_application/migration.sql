-- CreateEnum
CREATE TYPE "CreditApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFICATION', 'ANALYSIS', 'SURVEY', 'REVIEW', 'DECISION', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateTable
CREATE TABLE "credit_applications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "applicationNumber" VARCHAR(50) NOT NULL,
    "applicant_id" UUID NOT NULL,
    "product" VARCHAR(200),
    "requestedAmount" DOUBLE PRECISION,
    "requestedTenorMonths" INTEGER,
    "purpose" TEXT,
    "source" VARCHAR(100),
    "assigned_marketing_officer_id" UUID,
    "assigned_analyst_id" UUID,
    "assigned_survey_officer_id" UUID,
    "status" "CreditApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submission_date" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_applications_applicationNumber_key" ON "credit_applications"("applicationNumber");

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_assigned_marketing_officer_id_fkey" FOREIGN KEY ("assigned_marketing_officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_assigned_analyst_id_fkey" FOREIGN KEY ("assigned_analyst_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_assigned_survey_officer_id_fkey" FOREIGN KEY ("assigned_survey_officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
