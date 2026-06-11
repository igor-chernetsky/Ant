import { NextResponse } from 'next/server';
import {
  persistAndApplyAuthCookies,
  readAuthCookies,
  refreshKeycloakTokensSingleFlight,
} from '@/lib/auth-tokens';
import { accessTokenNeedsRefresh } from '@/lib/jwt-utils';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { accessToken, refreshToken } = await readAuthCookies();

  if (accessToken && !accessTokenNeedsRefresh(accessToken)) {
    return NextResponse.json({ ok: true, refreshed: false });
  }

  if (!refreshToken) {
    return NextResponse.json(
      {
        message: 'Not authenticated',
        code: 'no_refresh_token',
      },
      { status: 401 },
    );
  }

  const result = await refreshKeycloakTokensSingleFlight(refreshToken);

  if (!result.ok) {
    if (accessToken && !accessTokenNeedsRefresh(accessToken)) {
      return NextResponse.json({ ok: true, refreshed: false });
    }

    const latest = await readAuthCookies();
    if (
      latest.accessToken &&
      latest.accessToken !== accessToken &&
      !accessTokenNeedsRefresh(latest.accessToken)
    ) {
      return NextResponse.json({ ok: true, refreshed: false });
    }

    console.error(
      '[auth/refresh] Keycloak refresh failed:',
      result.error,
      result.description ?? '',
    );

    return NextResponse.json(
      {
        message: 'Session expired',
        code: 'keycloak_refresh_failed',
        error: result.error,
        retryable: result.error === 'invalid_grant',
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: result.description }
          : {}),
      },
      { status: 401 },
    );
  }

  if (!result.tokens.refresh_token) {
    console.warn(
      '[auth/refresh] Keycloak did not return a new refresh_token — check offline_access scope on platform-bff',
    );
  }

  const response = NextResponse.json({ ok: true, refreshed: true });
  await persistAndApplyAuthCookies(result.tokens, response);
  return response;
}
