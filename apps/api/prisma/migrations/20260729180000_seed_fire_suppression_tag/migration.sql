-- Trade tag for automatic fire suppression / sprinkler scope
INSERT INTO "tags" ("id", "slug", "label", "group_id", "is_system")
VALUES (
  '10000000-0000-4000-8000-000000000019',
  'fire-suppression',
  'Fire suppression',
  '00000000-0000-4000-8000-000000000001',
  true
)
ON CONFLICT ("slug") DO NOTHING;
