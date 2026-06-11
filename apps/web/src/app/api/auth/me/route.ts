import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';
import {
  clearAuthCookieStore,
  clearAuthCookies,
  getValidAccessToken,
  persistAndApplyAuthCookies,
  refreshAccessTokenAfterUnauthorized,
} from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

async function fetchProfile(accessToken: string): Promise<Response> {
  return fetch(`${getBackendApiUrl()}/v1/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export async function GET() {
  const auth = await getValidAccessToken();
  if (!auth.ok) {
    const response = NextResponse.json(
      { message: 'Not authenticated' },
      { status: 401 },
    );
    clearAuthCookies(response);
    await clearAuthCookieStore();
    return response;
  }

  let backendResponse: Response;
  let refreshed = auth.refreshed;

  try {
    backendResponse = await fetchProfile(auth.accessToken);
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach API server' },
      { status: 502 },
    );
  }

  if (backendResponse.status === 401) {
    const retryAuth = await refreshAccessTokenAfterUnauthorized();
    if (!retryAuth.ok) {
      const response = NextResponse.json(
        { message: 'Session expired' },
        { status: 401 },
      );
      clearAuthCookies(response);
      await clearAuthCookieStore();
      return response;
    }

    refreshed = retryAuth.refreshed ?? refreshed;
    try {
      backendResponse = await fetchProfile(retryAuth.accessToken);
    } catch {
      return NextResponse.json(
        { message: 'Unable to reach API server' },
        { status: 502 },
      );
    }
  }

  if (backendResponse.status === 401) {
    const response = NextResponse.json(
      { message: 'Session expired' },
      { status: 401 },
    );
    clearAuthCookies(response);
    await clearAuthCookieStore();
    return response;
  }

  if (!backendResponse.ok) {
    const text = await backendResponse.text();
    return NextResponse.json(
      { message: text || 'Failed to load profile' },
      { status: backendResponse.status },
    );
  }

  const profile = await backendResponse.json();
  const response = NextResponse.json(profile);
  if (refreshed) {
    await persistAndApplyAuthCookies(refreshed, response);
  }
  return response;
}
