-- Locale of the editable contract body so the editor can regenerate/save in
-- the viewer's UI language (mirrors ContractAddendum.body_locale).
ALTER TABLE "contracts"
ADD COLUMN "body_locale" TEXT NOT NULL DEFAULT 'en';
