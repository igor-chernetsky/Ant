-- Thai Tax ID + preferred contact methods on contractor profiles

ALTER TABLE "contractor_profiles" ADD COLUMN "tax_id" TEXT;
ALTER TABLE "contractor_profiles" ADD COLUMN "preferred_contact_methods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
