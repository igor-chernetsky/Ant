-- Contractor trade/specialty tags (same slugs as project tag catalog)
ALTER TABLE "contractor_profiles" ADD COLUMN "tag_slugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
