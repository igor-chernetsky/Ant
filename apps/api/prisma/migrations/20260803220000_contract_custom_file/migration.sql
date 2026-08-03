-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "custom_file_storage_key" TEXT,
ADD COLUMN     "custom_file_original_name" TEXT,
ADD COLUMN     "custom_file_content_type" TEXT,
ADD COLUMN     "custom_file_size_bytes" INTEGER,
ADD COLUMN     "custom_file_uploaded_by_user_id" TEXT,
ADD COLUMN     "custom_file_uploaded_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_custom_file_storage_key_key" ON "contracts"("custom_file_storage_key");
