-- Platform-fee free trial gets an end date, set in Admin → Settings.
--
-- Before this the trial was a compile-time flag (`PLATFORM_FEES_TRIAL_ACTIVE`)
-- with no expiry, so it could only be stopped by editing code and redeploying.
-- `null` keeps the old behaviour: no date configured means the trial state still
-- comes from that flag, so deploying this migration does not start charging.
--
-- The value is stored as the last instant of the chosen day, and signature
-- requests snapshot `trial_active` / `due_now_payable` when they are created, so
-- requests made during the trial stay at zero afterwards.

ALTER TABLE "platform_settings"
  ADD COLUMN "trial_ends_at" TIMESTAMP(3);
