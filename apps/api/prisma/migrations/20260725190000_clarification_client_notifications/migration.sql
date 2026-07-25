-- AlterEnum
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_clarification_questions';

-- AlterEnum
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_clarification_questions';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_bid_message';
