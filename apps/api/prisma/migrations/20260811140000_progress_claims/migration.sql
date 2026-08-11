-- Progress / payment claims against awarded bids

CREATE TYPE "ProgressClaimStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

CREATE TABLE "progress_claims" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "status" "ProgressClaimStatus" NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "rejection_reason" TEXT,
    "preliminary_percent" DOUBLE PRECISION NOT NULL,
    "overhead_profit_percent" DOUBLE PRECISION NOT NULL,
    "vat_percent" DOUBLE PRECISION NOT NULL,
    "works_cumulative" DECIMAL(14,2) NOT NULL,
    "preliminary_cumulative" DECIMAL(14,2) NOT NULL,
    "overhead_profit_cumulative" DECIMAL(14,2) NOT NULL,
    "vat_cumulative" DECIMAL(14,2) NOT NULL,
    "grand_cumulative" DECIMAL(14,2) NOT NULL,
    "works_period" DECIMAL(14,2) NOT NULL,
    "preliminary_period" DECIMAL(14,2) NOT NULL,
    "overhead_profit_period" DECIMAL(14,2) NOT NULL,
    "vat_period" DECIMAL(14,2) NOT NULL,
    "grand_period" DECIMAL(14,2) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_claim_lines" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "trade" TEXT NOT NULL,
    "description" TEXT,
    "contract_amount" DECIMAL(14,2) NOT NULL,
    "percent_complete" DECIMAL(5,2) NOT NULL,
    "amount_previously_approved" DECIMAL(14,2) NOT NULL,
    "amount_cumulative" DECIMAL(14,2) NOT NULL,
    "amount_period" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "progress_claim_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "progress_claims_project_id_sequence_number_key" ON "progress_claims"("project_id", "sequence_number");
CREATE INDEX "progress_claims_project_id_status_idx" ON "progress_claims"("project_id", "status");
CREATE INDEX "progress_claims_bid_id_idx" ON "progress_claims"("bid_id");
CREATE INDEX "progress_claim_lines_claim_id_sort_order_idx" ON "progress_claim_lines"("claim_id", "sort_order");

ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "progress_claim_lines" ADD CONSTRAINT "progress_claim_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "progress_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "InAppNotificationKind" ADD VALUE 'client_progress_claim_submitted';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contractor_progress_claim_approved';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contractor_progress_claim_rejected';
