import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';
import {
  clearAuthCookies,
  getValidAccessToken,
  persistAndApplyAuthCookies,
  refreshAccessTokenAfterUnauthorized,
  type KeycloakTokenResponse,
} from '@/lib/auth-tokens';

async function fetchBackend(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${getBackendApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

async function attachRefreshedCookies(
  response: NextResponse,
  refreshed?: KeycloakTokenResponse,
): Promise<NextResponse> {
  if (refreshed) {
    await persistAndApplyAuthCookies(refreshed, response);
  }
  return response;
}

export async function proxyBackend(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response | NextResponse; refreshed?: KeycloakTokenResponse }> {
  const auth = await getValidAccessToken();
  if (!auth.ok) {
    return {
      response: NextResponse.json({ message: 'Not authenticated' }, { status: 401 }),
    };
  }

  try {
    let backendResponse = await fetchBackend(path, auth.accessToken, init);

    if (backendResponse.status === 401) {
      const retryAuth = await refreshAccessTokenAfterUnauthorized();
      if (!retryAuth.ok) {
        const unauth = NextResponse.json(
          { message: 'Session expired' },
          { status: 401 },
        );
        clearAuthCookies(unauth);
        return { response: unauth };
      }

      backendResponse = await fetchBackend(path, retryAuth.accessToken, init);
      return {
        response: backendResponse,
        refreshed: retryAuth.refreshed ?? auth.refreshed,
      };
    }

    return { response: backendResponse, refreshed: auth.refreshed };
  } catch {
    return {
      response: NextResponse.json(
        { message: 'Unable to reach API server' },
        { status: 502 },
      ),
    };
  }
}

export async function proxyBackendJson(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const { response: backendResponse, refreshed } = await proxyBackend(path, init);

  if (backendResponse instanceof NextResponse) {
    return attachRefreshedCookies(backendResponse, refreshed);
  }

  if (
    backendResponse.status === 204 ||
    backendResponse.status === 205 ||
    backendResponse.status === 304
  ) {
    const response = new NextResponse(null, { status: backendResponse.status });
    return attachRefreshedCookies(response, refreshed);
  }

  const text = await backendResponse.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text };
  }

  const response = NextResponse.json(body, { status: backendResponse.status });

  if (backendResponse.status === 401) {
    clearAuthCookies(response);
    return response;
  }

  return attachRefreshedCookies(response, refreshed);
}
