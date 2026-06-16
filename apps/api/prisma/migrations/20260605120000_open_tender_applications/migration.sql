-- Open tender applications: drop invitations, add per-bid chat
DROP TABLE IF EXISTS "tender_invitations";

CREATE TABLE "bid_messages" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bid_messages_bid_id_idx" ON "bid_messages"("bid_id");

ALTER TABLE "bid_messages" ADD CONSTRAINT "bid_messages_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bid_messages" ADD CONSTRAINT "bid_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
