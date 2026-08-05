-- AlterTable
ALTER TABLE "contract_addenda" ADD COLUMN "body_locale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "contract_addendum_attachments" (
    "id" TEXT NOT NULL,
    "addendum_id" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "contract_addendum_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_addendum_attachments_storage_key_key" ON "contract_addendum_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "contract_addendum_attachments_addendum_id_idx" ON "contract_addendum_attachments"("addendum_id");

-- AddForeignKey
ALTER TABLE "contract_addendum_attachments" ADD CONSTRAINT "contract_addendum_attachments_addendum_id_fkey" FOREIGN KEY ("addendum_id") REFERENCES "contract_addenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_addendum_attachments" ADD CONSTRAINT "contract_addendum_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
