-- Cost-breakdown template lifecycle fixes.
--
-- Two problems made the commercial-proposal form show a structure the client had
-- not approved:
--   * the template was generated from the ballpark estimate and never followed the
--     client's later edits to that estimate (and never froze once the client edited
--     the list by hand);
--   * reverting the tender to preparation deleted the breakdown, so the next
--     publication regenerated the initial structure.
--
-- `default_cost_breakdown_edited_at` records that the client submitted a list that
-- differs from the estimate-derived one, which stops the automatic sync.
-- `saved_cost_breakdown_json` keeps the list across a revert.

ALTER TABLE "tenders"
  ADD COLUMN "default_cost_breakdown_edited_at" TIMESTAMP(3);

ALTER TABLE "projects"
  ADD COLUMN "saved_cost_breakdown_json" JSONB;

-- Existing stored templates are treated as client-owned. Before this change the
-- rows could only be edited by hand in the publish modal, so auto-sync must not
-- replace them with the estimate-derived list.
UPDATE "tenders"
SET "default_cost_breakdown_edited_at" = "updated_at"
WHERE "default_cost_breakdown" IS NOT NULL
  AND jsonb_typeof("default_cost_breakdown") = 'array'
  AND jsonb_array_length("default_cost_breakdown") > 0;
