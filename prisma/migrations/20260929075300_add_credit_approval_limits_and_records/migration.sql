-- CreateTable
CREATE TABLE "credit_approval_limits" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "level_name" VARCHAR(100) NOT NULL,
    "min_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_amount" DOUBLE PRECISION NOT NULL,
    "tier_order" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "credit_approval_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_approval_records" (
    "id" UUID NOT NULL,
    "credit_application_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "approver_role_name" VARCHAR(100) NOT NULL,
    "status" "CreditApplicationStatus" NOT NULL,
    "approved_amount" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_approval_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "credit_approval_limits" ADD CONSTRAINT "credit_approval_limits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_approval_limits" ADD CONSTRAINT "credit_approval_limits_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_approval_records" ADD CONSTRAINT "credit_approval_records_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_approval_records" ADD CONSTRAINT "credit_approval_records_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
