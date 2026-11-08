import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth-server';
import { REFRESH_TOKEN_COOKIE } from '@/lib/auth-tokens';

/**
 * Is this request from a visitor without a session?
 *
 * Read straight from the cookie jar — no API call, no session hydration — so the
 * first screen can be decided on the server. A guest-only hero rendered from
 * client state would appear after hydration and shift the grid, which is exactly
 * the layout jump the marketing pages cannot afford.
 */
export async function isGuestRequest(): Promise<boolean> {
  const jar = await cookies();
  return (
    !jar.get(ACCESS_TOKEN_COOKIE)?.value &&
    !jar.get(REFRESH_TOKEN_COOKIE)?.value
  );
}
