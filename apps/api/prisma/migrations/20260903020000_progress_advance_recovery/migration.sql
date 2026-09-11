-- Advance payment recovery (amortisation) on progress claims.
--
-- The advance paid at contract signature must be repaid through deductions from
-- the interim payment certificates. Both columns default to 0, so claims that
-- were approved before this rule existed keep their historical figures; the
-- outstanding advance is recovered from the following claims instead.
--
-- advance_recovery_percent: amortisation rate applied to the certificate amount
--   (works + Preliminary + OH&P, excluding VAT), taken from the contract terms
--   or derived so the advance is repaid in full by Practical Completion.
-- advance_recovery_period: amount recovered from this certificate, capped by the
--   advance amount outstanding before the claim.

ALTER TABLE "progress_claims"
  ADD COLUMN "advance_recovery_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "advance_recovery_period" DECIMAL(14,2) NOT NULL DEFAULT 0;
