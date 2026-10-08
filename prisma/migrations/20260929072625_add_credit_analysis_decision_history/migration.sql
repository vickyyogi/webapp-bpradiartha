-- AlterTable
ALTER TABLE "credit_applications" ADD COLUMN     "analysis_data" JSONB,
ADD COLUMN     "approved_amount" DOUBLE PRECISION,
ADD COLUMN     "approved_tenor_months" INTEGER,
ADD COLUMN     "conditions" TEXT,
ADD COLUMN     "decision_date" TIMESTAMPTZ,
ADD COLUMN     "decision_maker_id" UUID,
ADD COLUMN     "decision_notes" TEXT,
ADD COLUMN     "interest_rate" DOUBLE PRECISION,
ADD COLUMN     "realization_amount" DOUBLE PRECISION,
ADD COLUMN     "realization_date" TIMESTAMPTZ,
ADD COLUMN     "realization_reference" VARCHAR(100),
ADD COLUMN     "survey_data" JSONB;

-- CreateTable
CREATE TABLE "credit_status_history" (
    "id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "status" "CreditApplicationStatus" NOT NULL,
    "notes" TEXT,
    "changed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_decision_maker_id_fkey" FOREIGN KEY ("decision_maker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_status_history" ADD CONSTRAINT "credit_status_history_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_status_history" ADD CONSTRAINT "credit_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
