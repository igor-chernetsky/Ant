-- Replace legacy ops contact with hello@builthai.com in platform settings.
UPDATE "PlatformSettings"
SET
  "contractSignedNotifyEmails" = array_replace(
    "contractSignedNotifyEmails",
    'providercmp@gmail.com',
    'hello@builthai.com'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE 'providercmp@gmail.com' = ANY ("contractSignedNotifyEmails");
