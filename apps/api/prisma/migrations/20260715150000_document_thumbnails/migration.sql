-- AlterTable
ALTER TABLE "documents" ADD COLUMN "thumbnail_storage_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "documents_thumbnail_storage_key_key" ON "documents"("thumbnail_storage_key");
