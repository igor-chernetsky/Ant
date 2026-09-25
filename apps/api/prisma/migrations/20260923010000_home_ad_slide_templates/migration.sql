-- Home-page slides get a layout template.
--
-- `card` is the original layout (image plus title / description / call to
-- action) and is applied to every existing row, so current slides keep working.
-- `image` shows the picture alone.
--
-- `href` becomes optional: a `card` slide still requires it, while an `image`
-- slide without a link opens the full-size picture in a lightbox instead of
-- navigating. The service enforces that per template.

CREATE TYPE "HomeAdSlideTemplate" AS ENUM ('card', 'image');

ALTER TABLE "home_ad_slides"
  ADD COLUMN "template" "HomeAdSlideTemplate" NOT NULL DEFAULT 'card',
  ALTER COLUMN "href" DROP NOT NULL;
