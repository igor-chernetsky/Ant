CREATE TYPE "PropertyType_new" AS ENUM (
  'residential',
  'commercial',
  'industrial_infrastructure',
  'public',
  'other'
);

ALTER TABLE "projects"
  ALTER COLUMN "property_type" TYPE TEXT
  USING "property_type"::TEXT;

UPDATE "projects"
SET "property_type" = CASE "property_type"
  WHEN 'apartment' THEN 'residential'
  WHEN 'house' THEN 'residential'
  WHEN 'commercial' THEN 'commercial'
  WHEN 'land' THEN 'industrial_infrastructure'
  WHEN 'other' THEN 'other'
  ELSE NULL
END
WHERE "property_type" IS NOT NULL;

DROP TYPE "PropertyType";

ALTER TYPE "PropertyType_new" RENAME TO "PropertyType";

ALTER TABLE "projects"
  ALTER COLUMN "property_type" TYPE "PropertyType"
  USING "property_type"::"PropertyType";
