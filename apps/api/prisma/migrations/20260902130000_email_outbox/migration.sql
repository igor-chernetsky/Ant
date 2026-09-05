-- Email outbox for reliable notification delivery (retry on transient SMTP
-- failures; critical notices are no longer lost on one-shot send errors).
CREATE TYPE "EmailOutboxStatus" AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "from" TEXT,
    "from_name" TEXT,
    "reply_to" TEXT,
    "headers_json" JSONB,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_outbox_status_next_attempt_at_idx"
    ON "email_outbox" ("status", "next_attempt_at");
