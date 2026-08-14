ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_progress_claim_submitted';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_progress_claim_approved';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_progress_claim_rejected';
