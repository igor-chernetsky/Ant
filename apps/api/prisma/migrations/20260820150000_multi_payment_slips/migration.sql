-- Multi payment slips with draft → submit (locked after send)

CREATE TABLE "payment_slip_attachments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "progress_claim_id" TEXT,
    "document_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_slip_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_slip_attachments_document_id_key"
  ON "payment_slip_attachments"("document_id");

CREATE INDEX "payment_slip_attachments_project_id_progress_claim_id_idx"
  ON "payment_slip_attachments"("project_id", "progress_claim_id");

CREATE INDEX "payment_slip_attachments_progress_claim_id_idx"
  ON "payment_slip_attachments"("progress_claim_id");

ALTER TABLE "payment_slip_attachments"
  ADD CONSTRAINT "payment_slip_attachments_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_slip_attachments"
  ADD CONSTRAINT "payment_slip_attachments_progress_claim_id_fkey"
  FOREIGN KEY ("progress_claim_id") REFERENCES "progress_claims"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_slip_attachments"
  ADD CONSTRAINT "payment_slip_attachments_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single claim slips as already submitted
INSERT INTO "payment_slip_attachments" (
  "id", "project_id", "progress_claim_id", "document_id", "submitted_at", "created_at"
)
SELECT
  gen_random_uuid()::text,
  pc."project_id",
  pc."id",
  pc."payment_slip_document_id",
  COALESCE(pc."payment_slip_uploaded_at", CURRENT_TIMESTAMP),
  COALESCE(pc."payment_slip_uploaded_at", CURRENT_TIMESTAMP)
FROM "progress_claims" pc
WHERE pc."payment_slip_document_id" IS NOT NULL;

-- Backfill existing single advance slips as already submitted
INSERT INTO "payment_slip_attachments" (
  "id", "project_id", "progress_claim_id", "document_id", "submitted_at", "created_at"
)
SELECT
  gen_random_uuid()::text,
  p."id",
  NULL,
  p."advance_payment_slip_document_id",
  COALESCE(p."advance_payment_slip_uploaded_at", CURRENT_TIMESTAMP),
  COALESCE(p."advance_payment_slip_uploaded_at", CURRENT_TIMESTAMP)
FROM "projects" p
WHERE p."advance_payment_slip_document_id" IS NOT NULL;

ALTER TABLE "progress_claims"
  DROP CONSTRAINT IF EXISTS "progress_claims_payment_slip_document_id_fkey";

DROP INDEX IF EXISTS "progress_claims_payment_slip_document_id_key";

ALTER TABLE "progress_claims"
  DROP COLUMN IF EXISTS "payment_slip_document_id",
  DROP COLUMN IF EXISTS "payment_slip_uploaded_at";

ALTER TABLE "projects"
  DROP CONSTRAINT IF EXISTS "projects_advance_payment_slip_document_id_fkey";

DROP INDEX IF EXISTS "projects_advance_payment_slip_document_id_key";

ALTER TABLE "projects"
  DROP COLUMN IF EXISTS "advance_payment_slip_document_id",
  DROP COLUMN IF EXISTS "advance_payment_slip_uploaded_at";
