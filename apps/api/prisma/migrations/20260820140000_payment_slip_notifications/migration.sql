ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_advance_payment_slip_attached';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_progress_claim_payment_slip_attached';

ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_advance_payment_slip_attached';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_progress_claim_payment_slip_attached';
