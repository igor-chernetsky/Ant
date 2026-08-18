-- Progress claim retention, payable amounts, and payment slip attachments

ALTER TYPE "DocumentCategory" ADD VALUE 'payment_slip';

ALTER TABLE "progress_claims"
  ADD COLUMN "retention_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "retention_period" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "payable_period" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "payment_slip_document_id" TEXT,
  ADD COLUMN "payment_slip_uploaded_at" TIMESTAMP(3);

UPDATE "progress_claims"
SET "payable_period" = "grand_period"
WHERE "payable_period" = 0;

ALTER TABLE "projects"
  ADD COLUMN "advance_payment_slip_document_id" TEXT,
  ADD COLUMN "advance_payment_slip_uploaded_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "progress_claims_payment_slip_document_id_key"
  ON "progress_claims"("payment_slip_document_id");

CREATE UNIQUE INDEX "projects_advance_payment_slip_document_id_key"
  ON "projects"("advance_payment_slip_document_id");

ALTER TABLE "progress_claims"
  ADD CONSTRAINT "progress_claims_payment_slip_document_id_fkey"
  FOREIGN KEY ("payment_slip_document_id") REFERENCES "documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_advance_payment_slip_document_id_fkey"
  FOREIGN KEY ("advance_payment_slip_document_id") REFERENCES "documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
