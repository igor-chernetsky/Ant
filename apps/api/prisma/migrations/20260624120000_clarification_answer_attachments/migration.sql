-- Clarification answer file attachments (images, PDFs, documents per Q&A item)

CREATE TABLE "clarification_answer_attachments" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "uploader_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "storage_key" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "clarification_answer_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clarification_answer_attachments_storage_key_key" ON "clarification_answer_attachments"("storage_key");
CREATE INDEX "clarification_answer_attachments_question_id_idx" ON "clarification_answer_attachments"("question_id");

ALTER TABLE "clarification_answer_attachments" ADD CONSTRAINT "clarification_answer_attachments_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "tender_clarification_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clarification_answer_attachments" ADD CONSTRAINT "clarification_answer_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
