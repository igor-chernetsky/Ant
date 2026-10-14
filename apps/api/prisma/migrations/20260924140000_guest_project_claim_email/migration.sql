-- Attach an abandoned guest project to the account that registered with its
-- email.
--
-- The BFF records the address when the visitor submits signup (or signs in) from
-- the browser that holds the guest token. Claiming then matches on this column,
-- so the project survives a lost cookie and works across devices — the guest
-- can start a draft on a laptop, confirm the email on a phone, and still find
-- the project afterwards.

ALTER TABLE "projects" ADD COLUMN "guest_claim_email" TEXT;

CREATE INDEX "projects_guest_claim_email_idx" ON "projects"("guest_claim_email");
