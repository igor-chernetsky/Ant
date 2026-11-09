/**
 * Public URLs of the platform tour videos.
 *
 * Each audience has its own file in `public/`, served by Vercel's CDN with Range
 * support. Override with an env var to move an asset to object storage or a video
 * host without touching the page code; the copy in `public/` can then be deleted.
 *
 * Assets (both H.264/AAC with the `moov` atom before `mdat`, i.e. faststart, so
 * `preload="metadata"` shows the first frame without downloading the file):
 *
 * - `/info.mp4`   — 11.5 MB, contractor walkthrough, `/for-contractors`
 * - `/client.mp4` — 22.0 MB, client walkthrough, `/for-clients`
 */
export type VideoAudience = 'clients' | 'contractors';

const INTRO_VIDEO_URL =
  process.env.NEXT_PUBLIC_PLATFORM_INTRO_VIDEO_URL?.trim() || '/info.mp4';
const CLIENT_VIDEO_URL =
  process.env.NEXT_PUBLIC_CLIENT_INTRO_VIDEO_URL?.trim() || '/client.mp4';

/** Tour video for the contractor side (`/for-contractors`). */
export const PLATFORM_INTRO_VIDEO_SRC = INTRO_VIDEO_URL;

/** Tour video for the client side (`/for-clients`). */
export const CLIENT_INTRO_VIDEO_SRC = CLIENT_VIDEO_URL;

/**
 * Pick the video for the audience being explained.
 *
 * Both landing pages share one component, so the choice lives here instead of
 * being repeated at each call site (and so it can be tested without rendering the
 * page).
 */
export function videoSrcForAudience(
  audience: VideoAudience,
  sources: { clients: string; contractors: string } = {
    clients: CLIENT_VIDEO_URL,
    contractors: INTRO_VIDEO_URL,
  },
): string {
  return audience === 'clients' ? sources.clients : sources.contractors;
}
