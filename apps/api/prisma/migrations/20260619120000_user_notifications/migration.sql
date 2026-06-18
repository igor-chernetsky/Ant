-- User notification preferences and email send log (rate limiting)

CREATE TYPE "NotificationEmailKind" AS ENUM (
  'client_bid_enrolled',
  'client_bid_submitted',
  'contractor_counter_offer',
  'contractor_bid_message',
  'contractor_bid_selected',
  'contractor_bid_rejected',
  'contractor_project_awarded',
  'contractor_matching_project'
);

CREATE TABLE "user_notification_preferences" (
  "user_id" TEXT NOT NULL,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_client_bid_activity" BOOLEAN NOT NULL DEFAULT true,
  "email_contractor_updates" BOOLEAN NOT NULL DEFAULT true,
  "email_matching_projects" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "notification_email_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" "NotificationEmailKind" NOT NULL,
  "project_id" TEXT,
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_email_logs_user_id_kind_sent_at_idx"
  ON "notification_email_logs"("user_id", "kind", "sent_at");

ALTER TABLE "user_notification_preferences"
  ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_email_logs"
  ADD CONSTRAINT "notification_email_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
