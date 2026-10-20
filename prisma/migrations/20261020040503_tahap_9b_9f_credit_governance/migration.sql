-- AlterTable
ALTER TABLE "credit_approval_limits" ADD COLUMN     "branch_id" UUID;

-- CreateTable
CREATE TABLE "credit_document_checklists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "checked_by_id" UUID,
    "checked_by_name" VARCHAR(200),
    "checked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_document_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_committee_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL,
    "quorum_required" INTEGER NOT NULL,
    "participants" JSONB NOT NULL,
    "decision" "CreditApplicationStatus" NOT NULL,
    "notes" TEXT,
    "conditions" TEXT,
    "created_by_id" UUID,
    "created_by_name" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_committee_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_disbursement_conditions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "is_satisfied" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "satisfied_by_id" UUID,
    "satisfied_by_name" VARCHAR(200),
    "satisfied_at" TIMESTAMPTZ,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_disbursement_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_document_checklists_organization_id_credit_applicati_idx" ON "credit_document_checklists"("organization_id", "credit_application_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_document_checklists_credit_application_id_document_t_key" ON "credit_document_checklists"("credit_application_id", "document_type");

-- CreateIndex
CREATE INDEX "credit_committee_decisions_credit_application_id_decided_at_idx" ON "credit_committee_decisions"("credit_application_id", "decided_at");

-- CreateIndex
CREATE INDEX "credit_disbursement_conditions_credit_application_id_sort_o_idx" ON "credit_disbursement_conditions"("credit_application_id", "sort_order");

-- CreateIndex
CREATE INDEX "credit_approval_limits_organization_id_branch_id_idx" ON "credit_approval_limits"("organization_id", "branch_id");

-- AddForeignKey
ALTER TABLE "credit_approval_limits" ADD CONSTRAINT "credit_approval_limits_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_document_checklists" ADD CONSTRAINT "credit_document_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_document_checklists" ADD CONSTRAINT "credit_document_checklists_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_committee_decisions" ADD CONSTRAINT "credit_committee_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_committee_decisions" ADD CONSTRAINT "credit_committee_decisions_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_disbursement_conditions" ADD CONSTRAINT "credit_disbursement_conditions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_disbursement_conditions" ADD CONSTRAINT "credit_disbursement_conditions_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
