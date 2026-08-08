-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "source_docx_storage_key" TEXT,
ADD COLUMN "source_docx_original_name" TEXT,
ADD COLUMN "source_docx_size_bytes" INTEGER;

-- AlterTable
ALTER TABLE "contract_addenda" ADD COLUMN "source_docx_storage_key" TEXT,
ADD COLUMN "source_docx_original_name" TEXT,
ADD COLUMN "source_docx_size_bytes" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "contracts_source_docx_storage_key_key" ON "contracts"("source_docx_storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_addenda_source_docx_storage_key_key" ON "contract_addenda"("source_docx_storage_key");
