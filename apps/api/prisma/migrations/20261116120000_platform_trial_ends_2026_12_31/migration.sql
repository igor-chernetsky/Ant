-- Extend the platform-fee free trial to the end of 2026 (31 December, 23:59:59.999 UTC).
--
-- The trial end is data, not code: `PlatformSettings.trialEndsAt`, edited in
-- Admin → Settings and resolved by `resolveTrialActive` in
-- `apps/api/src/notifications/platform-fees.ts`. Without a date the trial state
-- falls back to the compile-time `PLATFORM_FEES_TRIAL_ACTIVE` flag, i.e. it never
-- ends on its own — so the extension has to be written into the row here.
--
-- Only moves the date forward: an admin may already have configured a later date,
-- and a later date must win. `ON CONFLICT` covers a database where the singleton
-- row has not been created yet.
--
-- Signature requests snapshot `trial_active` / `due_now_payable` when they are
-- created, so contracts started during the trial stay at zero afterwards.

INSERT INTO "platform_settings" (
  "id",
  "contract_signed_notify_emails",
  "trial_ends_at",
  "created_at",
  "updated_at"
)
VALUES (
  'default',
  ARRAY[]::TEXT[],
  TIMESTAMP '2026-12-31 23:59:59.999',
  now(),
  now()
)
ON CONFLICT ("id") DO UPDATE
SET
  "trial_ends_at" = EXCLUDED."trial_ends_at",
  "updated_at" = now()
WHERE
  "platform_settings"."trial_ends_at" IS NULL
  OR "platform_settings"."trial_ends_at" < EXCLUDED."trial_ends_at";
