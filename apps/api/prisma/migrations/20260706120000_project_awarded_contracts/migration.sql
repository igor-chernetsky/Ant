-- Rename project status contractor_selected -> awarded
ALTER TYPE "ProjectStatus" RENAME VALUE 'contractor_selected' TO 'awarded';

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('pending_signatures', 'fully_signed');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'pending_signatures',
    "client_signed_at" TIMESTAMP(3),
    "contractor_signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_project_id_key" ON "contracts"("project_id");
CREATE UNIQUE INDEX "contracts_bid_id_key" ON "contracts"("bid_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill contracts for already-awarded projects
INSERT INTO "contracts" ("id", "project_id", "bid_id", "status", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    p.id,
    t.awarded_bid_id,
    'pending_signatures',
    NOW(),
    NOW()
FROM "projects" p
INNER JOIN "tenders" t ON t.project_id = p.id
WHERE p.status = 'awarded'
  AND t.awarded_bid_id IS NOT NULL;

-- Extend notification kinds
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contract_party_signed';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contract_fully_signed';
