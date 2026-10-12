-- Guest projects: an anonymous visitor fills a project in before registering.
--
-- The project has no owner until it is claimed, so `client_id` becomes nullable
-- and the guest proves ownership with a bearer token whose SHA-256 is stored in
-- `guest_token_hash`. Unclaimed projects (and their documents) are removed once
-- `guest_expires_at` passes.

ALTER TABLE "projects" ALTER COLUMN "client_id" DROP NOT NULL;

ALTER TABLE "projects" ADD COLUMN "guest_token_hash" TEXT;
ALTER TABLE "projects" ADD COLUMN "guest_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "projects_guest_token_hash_key" ON "projects"("guest_token_hash");
CREATE INDEX "projects_guest_expires_at_idx" ON "projects"("guest_expires_at");

-- Guest uploads happen before there is a user to attribute them to.
ALTER TABLE "documents" ALTER COLUMN "uploader_id" DROP NOT NULL;
