-- In-app notifications for the contractor/designer verification decision.
--
-- Approval and rejection already send an email; these kinds put the same event
-- into the notification bell so a signed-in supply user sees the outcome
-- without waiting for (or opening) the email.

ALTER TYPE "InAppNotificationKind" ADD VALUE 'contractor_verification_approved';
ALTER TYPE "InAppNotificationKind" ADD VALUE 'contractor_verification_rejected';
