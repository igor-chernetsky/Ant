-- Home-page slide images can be uploaded instead of only linked.
--
-- `image_url` keeps holding an external / static URL and becomes nullable;
-- `image_storage_key` holds the object-storage key of an uploaded file.
-- The service keeps exactly one of them set: saving a URL clears the key (and
-- deletes the object), completing an upload clears the URL.

ALTER TABLE "home_ad_slides"
  ALTER COLUMN "image_url" DROP NOT NULL,
  ADD COLUMN "image_storage_key" TEXT;
