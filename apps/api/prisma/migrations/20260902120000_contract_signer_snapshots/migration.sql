-- Snapshot party names at signing so later renames do not drift the
-- names printed on already-signed contract artifacts.
ALTER TABLE "contracts"
ADD COLUMN "client_org_name" TEXT,
ADD COLUMN "client_signatory_name" TEXT,
ADD COLUMN "contractor_org_name" TEXT,
ADD COLUMN "contractor_signatory_name" TEXT;
