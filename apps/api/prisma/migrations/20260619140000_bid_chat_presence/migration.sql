CREATE TABLE "bid_chat_presence" (
  "user_id" TEXT NOT NULL,
  "bid_id" TEXT NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bid_chat_presence_pkey" PRIMARY KEY ("user_id","bid_id")
);

CREATE INDEX "bid_chat_presence_bid_id_last_seen_at_idx"
  ON "bid_chat_presence"("bid_id", "last_seen_at");

ALTER TABLE "bid_chat_presence"
  ADD CONSTRAINT "bid_chat_presence_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bid_chat_presence"
  ADD CONSTRAINT "bid_chat_presence_bid_id_fkey"
  FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
