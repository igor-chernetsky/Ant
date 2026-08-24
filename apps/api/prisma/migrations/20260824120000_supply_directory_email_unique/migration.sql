-- Normalize emails, drop duplicate registry rows (keep oldest), then enforce uniqueness.
UPDATE "supply_directory_entries"
SET "email" = lower(trim("email"));

DELETE FROM "supply_directory_entries" AS a
USING "supply_directory_entries" AS b
WHERE a."email" = b."email"
  AND a."created_at" > b."created_at";

DELETE FROM "supply_directory_entries" AS a
USING "supply_directory_entries" AS b
WHERE a."email" = b."email"
  AND a."created_at" = b."created_at"
  AND a."id" > b."id";

DROP INDEX IF EXISTS "supply_directory_entries_email_idx";

CREATE UNIQUE INDEX "supply_directory_entries_email_key" ON "supply_directory_entries"("email");
