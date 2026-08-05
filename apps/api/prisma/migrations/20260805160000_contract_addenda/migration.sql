-- CreateEnum
CREATE TYPE "ContractAddendumStatus" AS ENUM ('pending_signatures', 'fully_signed');

-- AlterEnum NotificationEmailKind
ALTER TYPE "NotificationEmailKind" ADD VALUE 'contract_addendum_created';
ALTER TYPE "NotificationEmailKind" ADD VALUE 'contract_addendum_party_signed';
ALTER TYPE "NotificationEmailKind" ADD VALUE 'contract_addendum_fully_signed';

-- AlterEnum InAppNotificationKind
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contract_addendum_created';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contract_addendum_party_signed';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contract_addendum_fully_signed';

-- CreateTable
CREATE TABLE "contract_addenda" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source_description" TEXT,
    "english_body_html" TEXT,
    "status" "ContractAddendumStatus" NOT NULL DEFAULT 'pending_signatures',
    "contractor_signed_at" TIMESTAMP(3),
    "client_signed_at" TIMESTAMP(3),
    "contractor_signature_data_url" TEXT,
    "client_signature_data_url" TEXT,
    "custom_file_storage_key" TEXT,
    "custom_file_original_name" TEXT,
    "custom_file_content_type" TEXT,
    "custom_file_size_bytes" INTEGER,
    "custom_file_uploaded_by_user_id" TEXT,
    "custom_file_uploaded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_addenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_addenda_custom_file_storage_key_key" ON "contract_addenda"("custom_file_storage_key");

-- CreateIndex
CREATE INDEX "contract_addenda_contract_id_idx" ON "contract_addenda"("contract_id");

-- CreateIndex
CREATE INDEX "contract_addenda_project_id_idx" ON "contract_addenda"("project_id");

-- AddForeignKey
ALTER TABLE "contract_addenda" ADD CONSTRAINT "contract_addenda_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_addenda" ADD CONSTRAINT "contract_addenda_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_addenda" ADD CONSTRAINT "contract_addenda_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
