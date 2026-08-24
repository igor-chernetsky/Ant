-- Replace legacy ops contact with hello@builthai.com in platform settings.
UPDATE "platform_settings"
SET
  "contract_signed_notify_emails" = array_replace(
    "contract_signed_notify_emails",
    'providercmp@gmail.com',
    'hello@builthai.com'
  ),
  "updated_at" = CURRENT_TIMESTAMP
WHERE 'providercmp@gmail.com' = ANY ("contract_signed_notify_emails");
