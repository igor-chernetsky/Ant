-- Rename Fire suppression → Fire protection (keep slug for existing data)
UPDATE "tags"
SET "label" = 'Fire protection'
WHERE "slug" = 'fire-suppression';

-- New Trades & scope tags
INSERT INTO "tags" ("id", "slug", "label", "group_id", "is_system")
VALUES
  ('10000000-0000-4000-8000-000000000020', 'piling', 'Piling', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000021', 'earthwork', 'Earthwork', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000022', 'low-voltage', 'Low-Voltage', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000023', 'built-in-furniture', 'Built-In Furniture', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000024', 'plastering', 'Plastering', '00000000-0000-4000-8000-000000000001', true),
  ('10000000-0000-4000-8000-000000000025', 'ceilings', 'Ceilings', '00000000-0000-4000-8000-000000000001', true)
ON CONFLICT ("slug") DO UPDATE SET
  "label" = EXCLUDED."label",
  "group_id" = EXCLUDED."group_id",
  "is_system" = true;
