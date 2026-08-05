-- AlterEnum InAppNotificationKind
ALTER TYPE "InAppNotificationKind" ADD VALUE 'admin_signature_request_created';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contractor_signature_request_approved';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contractor_signature_request_rejected';

-- AlterEnum NotificationEmailKind
ALTER TYPE "NotificationEmailKind" ADD VALUE 'admin_signature_request_created';
ALTER TYPE "NotificationEmailKind" ADD VALUE 'contractor_signature_request_approved';
ALTER TYPE "NotificationEmailKind" ADD VALUE 'contractor_signature_request_rejected';

-- CreateEnum
CREATE TYPE "ContractSignatureRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "platform_fee_paid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "contract_signature_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "status" "ContractSignatureRequestStatus" NOT NULL DEFAULT 'pending',
    "contract_amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "access_fee_usd" DECIMAL(10,2) NOT NULL,
    "due_now_listed" DECIMAL(14,2),
    "due_now_payable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "success_fee_gross" DECIMAL(14,2),
    "trial_active" BOOLEAN NOT NULL DEFAULT true,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "company_name" TEXT,
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_signature_requests_status_created_at_idx" ON "contract_signature_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contract_signature_requests_project_id_status_idx" ON "contract_signature_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "contract_signature_requests_contractor_id_idx" ON "contract_signature_requests"("contractor_id");

-- AddForeignKey
ALTER TABLE "contract_signature_requests" ADD CONSTRAINT "contract_signature_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signature_requests" ADD CONSTRAINT "contract_signature_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signature_requests" ADD CONSTRAINT "contract_signature_requests_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signature_requests" ADD CONSTRAINT "contract_signature_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signature_requests" ADD CONSTRAINT "contract_signature_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
