-- Migrate any legacy rows before removing the enum value.
UPDATE "projects"
SET "status" = 'estimated'
WHERE "status" = 'tender_ready';

ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";

CREATE TYPE "ProjectStatus" AS ENUM (
  'draft',
  'intake',
  'ready_for_estimate',
  'estimated',
  'in_tender',
  'contractor_selected',
  'active',
  'completed'
);

ALTER TABLE "projects"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "projects"
  ALTER COLUMN "status" TYPE "ProjectStatus"
  USING ("status"::text::"ProjectStatus");

ALTER TABLE "projects"
  ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "ProjectStatus_old";
