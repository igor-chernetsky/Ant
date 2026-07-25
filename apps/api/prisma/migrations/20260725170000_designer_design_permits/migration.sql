-- CreateEnum
CREATE TYPE "ProjectLinkKind" AS ENUM ('none', 'design_active', 'construction_pending');

-- CreateEnum
CREATE TYPE "SupplyProfileKind" AS ENUM ('contractor', 'designer');

-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'pending';

-- AlterTable
ALTER TABLE "projects"
ADD COLUMN "linked_project_id" TEXT,
ADD COLUMN "link_kind" "ProjectLinkKind" NOT NULL DEFAULT 'none',
ADD COLUMN "status_before_pending" "ProjectStatus",
ADD COLUMN "design_fee_percent" DOUBLE PRECISION,
ADD COLUMN "base_construction_totals_json" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "projects_linked_project_id_key" ON "projects"("linked_project_id");

-- CreateIndex
CREATE INDEX "projects_link_kind_idx" ON "projects"("link_kind");

-- AddForeignKey
ALTER TABLE "projects"
ADD CONSTRAINT "projects_linked_project_id_fkey"
FOREIGN KEY ("linked_project_id") REFERENCES "projects"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "contractor_profiles"
ADD COLUMN "kind" "SupplyProfileKind" NOT NULL DEFAULT 'contractor';

-- CreateIndex
CREATE INDEX "contractor_profiles_kind_idx" ON "contractor_profiles"("kind");
