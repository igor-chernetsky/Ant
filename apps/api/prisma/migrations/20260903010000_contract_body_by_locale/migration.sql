-- Per-locale contract body HTML so the editor can follow the viewer's UI
-- language without losing edits made in other locales.
ALTER TABLE "contracts"
ADD COLUMN "body_html_by_locale" JSONB;
