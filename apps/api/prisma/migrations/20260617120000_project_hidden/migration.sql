ALTER TABLE "projects" ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "projects_client_id_is_hidden_idx" ON "projects"("client_id", "is_hidden");
