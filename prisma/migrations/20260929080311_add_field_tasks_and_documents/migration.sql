-- CreateEnum
CREATE TYPE "FieldTaskType" AS ENUM ('SURVEY', 'CUSTOMER_VISIT', 'FOLLOW_UP', 'DOCUMENT_PICKUP', 'COLLECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FieldTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('CREDIT_APPLICATION', 'LEAD', 'CUSTOMER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('KTP', 'KK', 'INCOME_PROOF', 'BUSINESS_DOC', 'SURVEY_PHOTO', 'COLLATERAL_DOC', 'APPROVAL_DOC', 'OTHER');

-- CreateTable
CREATE TABLE "field_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "assigned_officer_id" UUID NOT NULL,
    "credit_application_id" UUID,
    "lead_id" UUID,
    "task_type" "FieldTaskType" NOT NULL DEFAULT 'SURVEY',
    "priority" "FieldTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "FieldTaskStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "customer_name" VARCHAR(200),
    "customer_phone" VARCHAR(50),
    "customer_address" TEXT,
    "due_date" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "result_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "field_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_type" "DocumentOwnerType" NOT NULL,
    "owner_id" VARCHAR(100) NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_ext" VARCHAR(20),
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_credit_application_id_fkey" FOREIGN KEY ("credit_application_id") REFERENCES "credit_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_tasks" ADD CONSTRAINT "field_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
