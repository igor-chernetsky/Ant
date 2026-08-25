-- Notify parties when the other side confirms project completion.
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'client_project_completion_confirmed';
ALTER TYPE "InAppNotificationKind" ADD VALUE IF NOT EXISTS 'contractor_project_completion_confirmed';

ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'client_project_completion_confirmed';
ALTER TYPE "NotificationEmailKind" ADD VALUE IF NOT EXISTS 'contractor_project_completion_confirmed';
