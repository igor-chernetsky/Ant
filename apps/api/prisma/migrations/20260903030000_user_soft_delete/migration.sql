-- Soft delete for platform users.
--
-- Removing the Keycloak identity is not enough: the platform row is referenced by
-- projects, contracts, addenda, progress claims, defects and reviews, and almost
-- every one of those relations is ON DELETE CASCADE. Physically deleting the row
-- would erase the counterparty's legal history too, so the user is marked deleted
-- instead: hidden from admin lists, unable to authenticate, history preserved.

ALTER TABLE "users"
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_user_id" TEXT;

CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
