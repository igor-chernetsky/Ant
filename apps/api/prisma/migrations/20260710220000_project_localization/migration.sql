-- AlterTable
ALTER TABLE "projects" ADD COLUMN "source_locale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "target_locale" TEXT NOT NULL,
    "source_locale" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "translated_text" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_project_id_field_key_target_locale_key" ON "content_translations"("project_id", "field_key", "target_locale");

-- CreateIndex
CREATE INDEX "content_translations_project_id_target_locale_idx" ON "content_translations"("project_id", "target_locale");

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
