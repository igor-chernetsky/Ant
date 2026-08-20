-- CreateEnum
CREATE TYPE "CompletionRequestRole" AS ENUM ('client', 'contractor');

-- AlterTable
ALTER TABLE "projects"
ADD COLUMN "completion_requested_by" "CompletionRequestRole",
ADD COLUMN "completion_requested_at" TIMESTAMP(3),
ADD COLUMN "completion_draft_review_json" JSONB;

-- AlterEnum
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_project_completion_requested';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_project_completion_requested';

-- AlterEnum
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_project_completion_requested';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_project_completion_requested';
