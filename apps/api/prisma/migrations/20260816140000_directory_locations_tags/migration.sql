-- Add multi-location + trade tags; migrate legacy region_slug; drop unused columns.

ALTER TABLE "supply_directory_entries"
  ADD COLUMN "service_locations_json" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "tag_slugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migrate single region_slug into service_locations_json when present.
UPDATE "supply_directory_entries"
SET "service_locations_json" = jsonb_build_array(
  jsonb_build_object('regionSlug', "region_slug")
)
WHERE "region_slug" IS NOT NULL AND TRIM("region_slug") <> '';

DROP INDEX IF EXISTS "supply_directory_entries_kind_is_active_sort_order_idx";

ALTER TABLE "supply_directory_entries"
  DROP COLUMN IF EXISTS "region_slug",
  DROP COLUMN IF EXISTS "is_active",
  DROP COLUMN IF EXISTS "sort_order";

CREATE INDEX "supply_directory_entries_kind_company_name_idx"
  ON "supply_directory_entries"("kind", "company_name");
