-- CreateTable
CREATE TABLE "cms_galleries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'KEGIATAN',
    "event_date" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cms_galleries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'KREDIT',
    "description" TEXT NOT NULL,
    "features" TEXT NOT NULL DEFAULT '[]',
    "icon" VARCHAR(50) DEFAULT 'Briefcase',
    "badge" VARCHAR(100),
    "cta_text" VARCHAR(100) DEFAULT 'Ajukan Pinjaman',
    "cta_link" VARCHAR(255) DEFAULT '#form-pengajuan',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cms_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_galleries_organization_id_is_active_idx" ON "cms_galleries"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "cms_products_organization_id_is_active_idx" ON "cms_products"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cms_products_organization_id_slug_key" ON "cms_products"("organization_id", "slug");

-- AddForeignKey
ALTER TABLE "cms_galleries" ADD CONSTRAINT "cms_galleries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_products" ADD CONSTRAINT "cms_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
