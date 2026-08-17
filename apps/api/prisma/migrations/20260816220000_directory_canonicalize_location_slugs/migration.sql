-- Normalize legacy hyphenated region/area slugs (e.g. chiang-mai → chiang_mai)
-- left by the original supply-directory seed and the region_slug → JSON migration.

UPDATE "supply_directory_entries" AS e
SET "service_locations_json" = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(loc) = 'object' AND loc ? 'regionSlug' THEN
          jsonb_strip_nulls(
            jsonb_build_object(
              'regionSlug', replace(loc->>'regionSlug', '-', '_'),
              'areaSlug',
                CASE
                  WHEN loc ? 'areaSlug'
                    AND NULLIF(BTRIM(loc->>'areaSlug'), '') IS NOT NULL
                  THEN replace(loc->>'areaSlug', '-', '_')
                  ELSE NULL
                END
            )
          )
        ELSE loc
      END
    )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(e."service_locations_json") = 'array'
        THEN e."service_locations_json"
        ELSE '[]'::jsonb
      END
    ) AS loc
  ),
  '[]'::jsonb
)
WHERE e."service_locations_json"::text LIKE '%-%';
