-- Backfill location slugs from legacy free-text district (migration default was bangkok).

UPDATE "projects"
SET "location_region_slug" = 'phuket'
WHERE "location_region_slug" = 'bangkok'
  AND "district" IS NOT NULL
  AND (
    "district" ILIKE '%phuket%'
    OR "district" ILIKE '%kathu%'
    OR "district" ILIKE '%patong%'
    OR "district" ILIKE '%bang tao%'
    OR "district" ILIKE '%laguna%'
  );

UPDATE "projects"
SET "location_region_slug" = 'chiang_mai'
WHERE "location_region_slug" = 'bangkok'
  AND "district" IS NOT NULL
  AND "district" ILIKE '%chiang mai%';

UPDATE "projects"
SET "location_region_slug" = 'pattaya'
WHERE "location_region_slug" = 'bangkok'
  AND "district" IS NOT NULL
  AND (
    "district" ILIKE '%pattaya%'
    OR "district" ILIKE '%jomtien%'
    OR "district" ILIKE '%chonburi%'
  );

UPDATE "projects"
SET "location_area_slug" = 'phuket_town'
WHERE "location_region_slug" = 'phuket'
  AND "location_area_slug" IS NULL
  AND "district" IS NOT NULL
  AND "district" ILIKE '%phuket town%';

UPDATE "projects"
SET "location_area_slug" = 'patong'
WHERE "location_region_slug" = 'phuket'
  AND "location_area_slug" IS NULL
  AND "district" IS NOT NULL
  AND "district" ILIKE '%patong%';

UPDATE "projects"
SET "location_area_slug" = 'sukhumvit'
WHERE "location_region_slug" = 'bangkok'
  AND "location_area_slug" IS NULL
  AND "district" IS NOT NULL
  AND (
    "district" ILIKE '%sukhumvit%'
    OR "district" ILIKE '%sukumvit%'
  );

UPDATE "projects"
SET "location_area_slug" = 'silom'
WHERE "location_region_slug" = 'bangkok'
  AND "location_area_slug" IS NULL
  AND "district" IS NOT NULL
  AND "district" ILIKE '%silom%';

UPDATE "projects"
SET "location_area_slug" = 'sathorn'
WHERE "location_region_slug" = 'bangkok'
  AND "location_area_slug" IS NULL
  AND "district" IS NOT NULL
  AND "district" ILIKE '%sathorn%';
