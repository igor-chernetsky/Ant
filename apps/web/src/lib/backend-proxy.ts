import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';
import {
  clearAuthCookies,
  getValidAccessToken,
  persistAndApplyAuthCookies,
  refreshAccessTokenAfterUnauthorized,
  type KeycloakTokenResponse,
} from '@/lib/auth-tokens';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n';
import { LOCALE_REQUEST_HEADER } from '@/lib/locale-request';

async function resolveProxyLocale(
  initHeaders?: HeadersInit,
): Promise<string> {
  if (initHeaders) {
    const headers = new Headers(initHeaders);
    const fromInit = headers.get(LOCALE_REQUEST_HEADER)?.trim();
    if (fromInit && isLocale(fromInit)) {
      return fromInit;
    }
  }

  try {
    const jar = await cookies();
    const value = jar.get(LOCALE_COOKIE)?.value;
    if (value && isLocale(value)) {
      return value;
    }
  } catch {
    // cookies() only works in a request context
  }

  return DEFAULT_LOCALE;
}

function withLocaleHeader(
  headers: Record<string, string>,
  locale: string,
): Record<string, string> {
  const hasLocale = Object.keys(headers).some(
    (key) => key.toLowerCase() === 'x-ant-locale',
  );
  if (hasLocale) {
    return headers;
  }
  return {
    ...headers,
    [LOCALE_REQUEST_HEADER]: locale,
  };
}

async function fetchBackend(
  path: string,
  accessToken: string,
  init?: RequestInit,
  locale?: string,
): Promise<Response> {
  const merged: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      merged[key] = value;
    });
  }
  const headers = withLocaleHeader(merged, locale ?? DEFAULT_LOCALE);

  return fetch(`${getBackendApiUrl()}${path}`, {
    ...init,
    headers,
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

  const locale = await resolveProxyLocale(init?.headers);

  try {
    let backendResponse = await fetchBackend(
      path,
      auth.accessToken,
      init,
      locale,
    );

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

      backendResponse = await fetchBackend(
        path,
        retryAuth.accessToken,
        init,
        locale,
      );
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

  const contentType = backendResponse.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/pdf') ||
    contentType.includes('application/zip') ||
    contentType.includes('application/octet-stream')
  ) {
    const buffer = await backendResponse.arrayBuffer();
    const response = new NextResponse(buffer, {
      status: backendResponse.status,
      headers: {
        'Content-Type': contentType,
        ...(backendResponse.headers.get('content-disposition')
          ? {
              'Content-Disposition': backendResponse.headers.get(
                'content-disposition',
              )!,
            }
          : {}),
      },
    });
    if (backendResponse.status === 401) {
      clearAuthCookies(response);
      return response;
    }
    return attachRefreshedCookies(response, refreshed);
  }

  if (contentType.includes('text/html')) {
    const html = await backendResponse.text();
    const response = new NextResponse(html, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...(backendResponse.headers.get('content-disposition')
          ? {
              'Content-Disposition': backendResponse.headers.get(
                'content-disposition',
              )!,
            }
          : {}),
      },
    });
    if (backendResponse.status === 401) {
      clearAuthCookies(response);
      return response;
    }
    return attachRefreshedCookies(response, refreshed);
  }

  return buildJsonProxyResponse(backendResponse, refreshed);
}

async function buildJsonProxyResponse(
  backendResponse: Response,
  refreshed?: KeycloakTokenResponse,
): Promise<NextResponse> {
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

/** Proxy with optional auth — for public API routes that accept anonymous or JWT. */
export async function proxyOptionalBackendJson(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const apiUrl = getBackendApiUrl();
    const locale = await resolveProxyLocale(init?.headers);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (init?.headers) {
      const extra = new Headers(init.headers);
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    }
    const finalized = withLocaleHeader(headers, locale);

    let refreshed: KeycloakTokenResponse | undefined;
    const auth = await getValidAccessToken();
    if (auth.ok) {
      finalized.Authorization = `Bearer ${auth.accessToken}`;
      refreshed = auth.refreshed;
    }

    let backendResponse = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: finalized,
      cache: 'no-store',
    });

    if (auth.ok && backendResponse.status === 401) {
      const retryAuth = await refreshAccessTokenAfterUnauthorized();
      if (retryAuth.ok) {
        finalized.Authorization = `Bearer ${retryAuth.accessToken}`;
        refreshed = retryAuth.refreshed ?? refreshed;
        backendResponse = await fetch(`${apiUrl}${path}`, {
          ...init,
          headers: finalized,
          cache: 'no-store',
        });
      }
    }

    return buildJsonProxyResponse(backendResponse, refreshed);
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach API server' },
      { status: 502 },
    );
  }
}
