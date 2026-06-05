-- CreateEnum
CREATE TYPE "AmendmentChangeType" AS ENUM ('clarification', 'scope_change', 'budget_change', 'timeline_change', 'other');

-- CreateTable
CREATE TABLE "project_amendments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "change_type" "AmendmentChangeType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "ai_result_json" JSONB,

    CONSTRAINT "project_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_amendments_project_id_idx" ON "project_amendments"("project_id");

-- CreateIndex
CREATE INDEX "project_amendments_project_id_processed_at_idx" ON "project_amendments"("project_id", "processed_at");

-- AddForeignKey
ALTER TABLE "project_amendments" ADD CONSTRAINT "project_amendments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
