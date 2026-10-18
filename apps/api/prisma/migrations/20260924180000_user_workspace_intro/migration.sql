-- Remember that the client has been taken to their newest project right after
-- registering, so the redirect runs once per account instead of on every visit.

ALTER TABLE "users" ADD COLUMN "workspace_intro_at" TIMESTAMP(3);
