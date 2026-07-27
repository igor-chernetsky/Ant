-- Singleton platform settings (contract-signed notify emails, etc.)
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "contract_signed_notify_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id", "contract_signed_notify_emails", "created_at", "updated_at")
VALUES ('default', ARRAY['providercmp@gmail.com']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
