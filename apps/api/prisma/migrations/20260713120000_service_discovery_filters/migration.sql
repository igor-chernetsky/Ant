-- Extend project types for service discovery filters
ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'modernization_reconstruction';
ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'design';

-- Property ownership form for homepage filtering
CREATE TYPE "PropertyOwnershipForm" AS ENUM (
  'employer_title',
  'leasehold',
  'developer_consent'
);

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "property_ownership_form" "PropertyOwnershipForm";

-- Optional service tag for modernization projects
INSERT INTO "tag_groups" ("id", "slug", "label", "sort_order")
VALUES (gen_random_uuid(), 'service', 'Service category', 15)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "tags" ("id", "slug", "label", "group_id", "is_system")
SELECT gen_random_uuid(), 'modernization', 'Modernization & reconstruction', tg.id, true
FROM "tag_groups" tg
WHERE tg.slug = 'service'
ON CONFLICT ("slug") DO NOTHING;
