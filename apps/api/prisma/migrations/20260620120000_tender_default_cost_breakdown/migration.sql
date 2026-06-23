-- Default cost breakdown template for tender proposals

ALTER TABLE "tenders" ADD COLUMN "default_cost_breakdown" JSONB;
