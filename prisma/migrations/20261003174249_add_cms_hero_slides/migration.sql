-- CreateTable
CREATE TABLE "cms_hero_slides" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(200),
    "alt_text" VARCHAR(255),
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cms_hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_hero_slides_organization_id_is_active_idx" ON "cms_hero_slides"("organization_id", "is_active");

-- AddForeignKey
ALTER TABLE "cms_hero_slides" ADD CONSTRAINT "cms_hero_slides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

