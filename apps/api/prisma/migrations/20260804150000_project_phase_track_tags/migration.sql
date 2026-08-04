-- Project Phase becomes track-level: Design & Permits vs Construction, Modernization & Repair.
-- Move speculative AI tags (design, permits) into Trades & scope so they stay available for intake.

UPDATE "tags"
SET "group_id" = '00000000-0000-4000-8000-000000000001'
WHERE "slug" IN ('design', 'permits');

INSERT INTO "tags" ("id", "slug", "label", "group_id", "is_system")
VALUES
  (
    '10000000-0000-4000-8000-000000000026',
    'design-permits',
    'Design & Permits',
    '00000000-0000-4000-8000-000000000002',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000027',
    'construction',
    'Construction, Modernization & Repair',
    '00000000-0000-4000-8000-000000000002',
    true
  )
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group_id" = EXCLUDED."group_id",
  "is_system" = true;
