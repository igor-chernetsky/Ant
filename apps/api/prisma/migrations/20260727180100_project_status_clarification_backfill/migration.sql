-- Backfill: structured Q&A projects still collecting answers (tender draft)
UPDATE "projects" p
SET "status" = 'clarification'
WHERE p."status" = 'in_tender'
  AND p."clarification_mode" = 'structured_qa'
  AND EXISTS (
    SELECT 1
    FROM "tenders" t
    WHERE t."project_id" = p."id"
      AND t."status" = 'draft'
  );
