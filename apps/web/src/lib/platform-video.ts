/**
 * Public URL of the platform intro video shown on `/for-contractors`.
 *
 * Defaults to the file in `public/`, which Vercel serves from its CDN with
 * Range support. Set `NEXT_PUBLIC_PLATFORM_INTRO_VIDEO_URL` to move the asset
 * to object storage or a video host without touching the page code, then the
 * copy in `public/` can be deleted.
 *
 * The current asset is 11.5 MB, H.264/AAC, 101 s, 912x576, with the `moov`
 * atom before `mdat` (faststart) — so `preload="metadata"` is enough to show
 * the first frame without downloading the whole file.
 */
export const PLATFORM_INTRO_VIDEO_SRC =
  process.env.NEXT_PUBLIC_PLATFORM_INTRO_VIDEO_URL?.trim() || '/info.mp4';
