-- Project location slugs + contractor service areas for matching notifications.

ALTER TABLE "projects"
  ADD COLUMN "location_region_slug" TEXT NOT NULL DEFAULT 'bangkok',
  ADD COLUMN "location_area_slug" TEXT,
  ADD COLUMN "location_note" TEXT;

UPDATE "projects"
SET "location_region_slug" = 'bangkok'
WHERE "location_region_slug" IS NULL OR "location_region_slug" = '';

ALTER TABLE "contractor_profiles"
  ADD COLUMN "service_locations_json" JSONB NOT NULL DEFAULT '[{"regionSlug":"bangkok"}]'::jsonb;

UPDATE "contractor_profiles"
SET "service_locations_json" = '[{"regionSlug":"bangkok"}]'::jsonb
WHERE "service_locations_json" IS NULL
   OR "service_locations_json" = '[]'::jsonb;

CREATE INDEX "projects_location_region_slug_idx" ON "projects"("location_region_slug");
