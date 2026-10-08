-- CreateTable
CREATE TABLE "cms_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'KEUANGAN',
    "period" VARCHAR(100),
    "year" INTEGER,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "published_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cms_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_reports_organization_id_is_active_idx" ON "cms_reports"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "cms_reports_organization_id_category_idx" ON "cms_reports"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "cms_reports_organization_id_slug_key" ON "cms_reports"("organization_id", "slug");

-- AddForeignKey
ALTER TABLE "cms_reports" ADD CONSTRAINT "cms_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
