-- AlterEnum
ALTER TYPE "ContractorVerificationStatus" ADD VALUE 'awaiting_review';

-- CreateEnum
CREATE TYPE "ContractorVerificationDocCategory" AS ENUM (
  'business_license',
  'registration',
  'insurance',
  'portfolio',
  'other'
);

-- AlterTable
ALTER TABLE "contractor_profiles"
  ADD COLUMN "verification_comment" TEXT,
  ADD COLUMN "verification_requested_at" TIMESTAMP(3),
  ADD COLUMN "verification_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_id" TEXT;

-- CreateTable
CREATE TABLE "contractor_verification_documents" (
    "id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "category" "ContractorVerificationDocCategory" NOT NULL DEFAULT 'other',
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "contractor_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_verification_documents_storage_key_key" ON "contractor_verification_documents"("storage_key");

-- CreateIndex
CREATE INDEX "contractor_verification_documents_contractor_id_idx" ON "contractor_verification_documents"("contractor_id");

-- AddForeignKey
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_profiles_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_verification_documents" ADD CONSTRAINT "contractor_verification_documents_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractor_verification_documents" ADD CONSTRAINT "contractor_verification_documents_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
