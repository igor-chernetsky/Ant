-- Structured contractor clarification Q&A

CREATE TYPE "ClarificationMode" AS ENUM ('open_chat', 'structured_qa');

ALTER TABLE "projects"
  ADD COLUMN "clarification_mode" "ClarificationMode" NOT NULL DEFAULT 'open_chat',
  ADD COLUMN "clarification_summary" TEXT;

CREATE TABLE "bid_clarification_submissions" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_clarification_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bid_clarification_submissions_bid_id_key" ON "bid_clarification_submissions"("bid_id");

ALTER TABLE "bid_clarification_submissions" ADD CONSTRAINT "bid_clarification_submissions_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tender_clarification_questions" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "answer" TEXT,
    "answered_at" TIMESTAMP(3),
    "answered_by_id" TEXT,
    "source_bid_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_clarification_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_clarification_questions_tender_id_sort_order_idx" ON "tender_clarification_questions"("tender_id", "sort_order");

ALTER TABLE "tender_clarification_questions" ADD CONSTRAINT "tender_clarification_questions_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_clarification_questions" ADD CONSTRAINT "tender_clarification_questions_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
