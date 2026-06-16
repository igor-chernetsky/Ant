-- Legacy invitation flow used collecting_participants; map to open before enum swap.
UPDATE "tenders"
SET "status" = 'open'
WHERE "status" = 'collecting_participants';

ALTER TYPE "TenderStatus" RENAME TO "TenderStatus_old";

CREATE TYPE "TenderStatus" AS ENUM (
  'draft',
  'open',
  'closed',
  'awarded',
  'cancelled'
);

ALTER TABLE "tenders"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tenders"
  ALTER COLUMN "status" TYPE "TenderStatus"
  USING ("status"::text::"TenderStatus");

ALTER TABLE "tenders"
  ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "TenderStatus_old";

-- Invitation table was removed in 20260605120000; drop orphaned enum if present.
DROP TYPE IF EXISTS "TenderInvitationStatus";
