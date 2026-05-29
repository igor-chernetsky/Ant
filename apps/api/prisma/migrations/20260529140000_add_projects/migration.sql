-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM (
  'draft',
  'intake',
  'ready_for_estimate',
  'estimated',
  'tender_ready',
  'in_tender',
  'contractor_selected',
  'active',
  'completed'
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "region_code" TEXT NOT NULL DEFAULT 'TH',
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "brief_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
