-- CreateEnum
CREATE TYPE "ContractorVerificationStatus" AS ENUM ('pending', 'verified', 'suspended', 'rejected');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('draft', 'collecting_participants', 'open', 'closed', 'awarded', 'cancelled');

-- CreateEnum
CREATE TYPE "TenderInvitationStatus" AS ENUM ('pending', 'declined', 'accepted', 'expired');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('submitted', 'withdrawn', 'selected', 'rejected');

-- CreateTable
CREATE TABLE "contractor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT,
    "region_code" TEXT NOT NULL DEFAULT 'TH',
    "project_types" "ProjectType"[] DEFAULT ARRAY[]::"ProjectType"[],
    "verification_status" "ContractorVerificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "TenderStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "min_bids" INTEGER NOT NULL DEFAULT 1,
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "awarded_bid_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_invitations" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "status" "TenderInvitationStatus" NOT NULL DEFAULT 'pending',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "tender_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'submitted',
    "amount" DECIMAL(14,2) NOT NULL,
    "duration_days" INTEGER,
    "terms_json" JSONB,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_profiles_user_id_key" ON "contractor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "contractor_profiles_region_code_idx" ON "contractor_profiles"("region_code");

-- CreateIndex
CREATE INDEX "contractor_profiles_verification_status_idx" ON "contractor_profiles"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_project_id_key" ON "tenders"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_awarded_bid_id_key" ON "tenders"("awarded_bid_id");

-- CreateIndex
CREATE INDEX "tenders_status_idx" ON "tenders"("status");

-- CreateIndex
CREATE INDEX "tender_invitations_contractor_id_idx" ON "tender_invitations"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_invitations_tender_id_contractor_id_key" ON "tender_invitations"("tender_id", "contractor_id");

-- CreateIndex
CREATE INDEX "bids_tender_id_idx" ON "bids"("tender_id");

-- CreateIndex
CREATE INDEX "bids_contractor_id_idx" ON "bids"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "bids_tender_id_contractor_id_key" ON "bids"("tender_id", "contractor_id");

-- AddForeignKey
ALTER TABLE "contractor_profiles" ADD CONSTRAINT "contractor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_invitations" ADD CONSTRAINT "tender_invitations_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_invitations" ADD CONSTRAINT "tender_invitations_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_awarded_bid_id_fkey" FOREIGN KEY ("awarded_bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;
