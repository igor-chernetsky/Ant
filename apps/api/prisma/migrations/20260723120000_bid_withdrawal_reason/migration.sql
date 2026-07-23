-- AlterEnum
CREATE TYPE "BidWithdrawalReason" AS ENUM (
  'specialization_mismatch',
  'incomplete_information',
  'capacity_insufficient',
  'commercial_terms_unacceptable',
  'other'
);

-- AlterEnum
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_contractor_declined_proposal';

-- AlterTable
ALTER TABLE "bids"
ADD COLUMN "withdrawal_reason" "BidWithdrawalReason",
ADD COLUMN "withdrawal_note" TEXT,
ADD COLUMN "withdrawn_at" TIMESTAMP(3);
