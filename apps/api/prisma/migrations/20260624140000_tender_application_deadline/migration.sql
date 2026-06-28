-- Tender application deadline notification tracking + email kind

ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_tender_deadline_reached';

ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "deadline_notified_at" TIMESTAMP(3);
