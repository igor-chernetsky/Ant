import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  readAuthCookies,
  refreshKeycloakTokensSingleFlight,
} from '@/lib/auth-tokens';
import { accessTokenNeedsRefresh } from '@/lib/jwt-utils';

export async function POST() {
  const { accessToken, refreshToken } = await readAuthCookies();

  if (accessToken && !accessTokenNeedsRefresh(accessToken)) {
    return NextResponse.json({ ok: true });
  }

  if (!refreshToken) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const tokenData = await refreshKeycloakTokensSingleFlight(refreshToken);

  if (!tokenData?.access_token) {
    // Another in-flight refresh may have rotated tokens; keep cookies if access still valid.
    if (accessToken && !accessTokenNeedsRefresh(accessToken)) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ message: 'Session expired' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  applyAuthCookies(response, tokenData);
  return response;
}
