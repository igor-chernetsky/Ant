-- Tender clarification flow: clarifying → enrolled → submitted + counter-offers

ALTER TYPE "BidStatus" ADD VALUE IF NOT EXISTS 'clarifying';
ALTER TYPE "BidStatus" ADD VALUE IF NOT EXISTS 'enrolled';

ALTER TABLE "bids" ALTER COLUMN "amount" DROP NOT NULL;
ALTER TABLE "bids" ALTER COLUMN "submitted_at" DROP NOT NULL;
ALTER TABLE "bids" ALTER COLUMN "submitted_at" DROP DEFAULT;

ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "next_contender_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "contender_number" INTEGER;
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "enrolled_at" TIMESTAMP(3);

CREATE TYPE "BidOfferAuthor" AS ENUM ('client', 'contractor');

CREATE TABLE "bid_offers" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "author_role" "BidOfferAuthor" NOT NULL,
    "author_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "duration_days" INTEGER,
    "terms_json" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bid_offers_bid_id_idx" ON "bid_offers"("bid_id");

ALTER TABLE "bid_offers" ADD CONSTRAINT "bid_offers_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bid_offers" ADD CONSTRAINT "bid_offers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
