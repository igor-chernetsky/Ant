-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('reported', 'declined', 'in_progress', 'submitted', 'closed');

-- CreateEnum
CREATE TYPE "DefectEventKind" AS ENUM ('created', 'declined', 'accepted', 'resubmitted', 'completed', 'completion_rejected', 'closed');

-- AlterEnum
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_defect_reported';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_defect_resubmitted';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_defect_completion_rejected';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_defect_closed';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_defect_declined';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_defect_accepted';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_defect_completed';

-- AlterEnum
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_defect_reported';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_defect_resubmitted';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_defect_completion_rejected';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_defect_closed';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_defect_declined';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_defect_accepted';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_defect_completed';

-- CreateTable
CREATE TABLE "defects" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DefectStatus" NOT NULL DEFAULT 'reported',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_events" (
    "id" TEXT NOT NULL,
    "defect_id" TEXT NOT NULL,
    "kind" "DefectEventKind" NOT NULL,
    "comment" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defect_events_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "defect_id" TEXT,
ADD COLUMN "defect_event_id" TEXT;

-- CreateIndex
CREATE INDEX "defects_project_id_idx" ON "defects"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "defects_project_id_sequence_number_key" ON "defects"("project_id", "sequence_number");

-- CreateIndex
CREATE INDEX "defect_events_defect_id_created_at_idx" ON "defect_events"("defect_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_defect_id_idx" ON "documents"("defect_id");

-- CreateIndex
CREATE INDEX "documents_defect_event_id_idx" ON "documents"("defect_event_id");

-- AddForeignKey
ALTER TABLE "defects" ADD CONSTRAINT "defects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_events" ADD CONSTRAINT "defect_events_defect_id_fkey" FOREIGN KEY ("defect_id") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_events" ADD CONSTRAINT "defect_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_defect_id_fkey" FOREIGN KEY ("defect_id") REFERENCES "defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_defect_event_id_fkey" FOREIGN KEY ("defect_event_id") REFERENCES "defect_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
