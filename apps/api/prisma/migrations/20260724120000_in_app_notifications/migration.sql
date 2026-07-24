-- CreateEnum
CREATE TYPE "InAppNotificationKind" AS ENUM (
  'client_bid_submitted',
  'client_bid_enrolled',
  'client_tender_deadline_reached',
  'client_contractor_declined_proposal',
  'contractor_counter_offer',
  'contractor_bid_selected',
  'contract_terms_updated',
  'contract_party_signed',
  'contract_fully_signed'
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "InAppNotificationKind" NOT NULL,
    "href" TEXT,
    "project_id" TEXT,
    "payload" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_created_at_idx" ON "in_app_notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "in_app_notifications_user_id_read_at_idx" ON "in_app_notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
