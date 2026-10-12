import { cookies, headers as nextHeaders } from 'next/headers';
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
import {
  guestApiPathForProjectPath,
  readGuestProjectToken,
} from '@/lib/guest-project';

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
  accessToken: string | null,
  init?: RequestInit,
  locale?: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const merged: Record<string, string> = {
    Accept: 'application/json',
  };
  if (accessToken) {
    merged.Authorization = `Bearer ${accessToken}`;
  }
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      merged[key] = value;
    });
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      merged[key] = value;
    }
  }
  const hasContentType = Object.keys(merged).some(
    (key) => key.toLowerCase() === 'content-type',
  );
  if (
    !hasContentType &&
    init?.body != null &&
    typeof init.body === 'string'
  ) {
    merged['Content-Type'] = 'application/json';
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

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Cookie-session CSRF mitigation: browser mutations must come from this app.
 * Missing Origin/Referer is allowed (non-browser / same-site navigations).
 */
async function assertSameOriginMutation(
  method?: string,
): Promise<NextResponse | null> {
  const normalized = (method ?? 'GET').toUpperCase();
  if (
    normalized === 'GET' ||
    normalized === 'HEAD' ||
    normalized === 'OPTIONS'
  ) {
    return null;
  }

  let headerStore: Headers;
  try {
    headerStore = await nextHeaders();
  } catch {
    return null;
  }

  const origin = headerStore.get('origin');
  const referer = headerStore.get('referer');
  if (!origin && !referer) {
    return null;
  }

  const host =
    headerStore.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headerStore.get('host')?.trim() ||
    '';
  if (!host) {
    return null;
  }
  const expectedHost = host.toLowerCase();

  if (origin) {
    const originHost = hostFromUrl(origin);
    if (!originHost || originHost !== expectedHost) {
      return NextResponse.json(
        { message: 'Invalid request origin' },
        { status: 403 },
      );
    }
  }

  if (referer) {
    const refererHost = hostFromUrl(referer);
    if (!refererHost || refererHost !== expectedHost) {
      return NextResponse.json(
        { message: 'Invalid request referer' },
        { status: 403 },
      );
    }
  }

  return null;
}

/**
 * Rewrite an authenticated project path for the anonymous guest who owns it.
 *
 * The project workspace routes are shared: the same BFF endpoints serve an
 * owner and a guest. When there is no access token but this browser holds the
 * guest token for the project, the request goes to the guest namespace instead
 * of failing with 401. Sub-resources the guest API does not implement (tenders,
 * contracts, amendments, progress) simply 404, which is the intended boundary:
 * publishing requires a registered owner.
 */
async function guestProxyTarget(path: string): Promise<{
  path: string;
  headers: Record<string, string>;
} | null> {
  const guestPath = guestApiPathForProjectPath(path);
  if (!guestPath) {
    return null;
  }

  const match = /^\/v1\/guest\/projects\/([^/?#]+)/.exec(guestPath);
  const projectId = match ? decodeURIComponent(match[1] ?? '') : '';
  if (!projectId) {
    return null;
  }

  const token = await readGuestProjectToken(projectId);
  if (!token) {
    return null;
  }

  return {
    path: guestPath,
    headers: { 'x-ant-guest-token': token },
  };
}

/** Client IP forwarded to the API so its guest quota sees the real visitor. */
async function clientIpHeader(): Promise<Record<string, string>> {
  try {
    const headerStore = await nextHeaders();
    const forwarded =
      headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerStore.get('x-real-ip')?.trim();
    if (forwarded) {
      return { 'x-forwarded-for': forwarded };
    }
  } catch {
    // headers() only works inside a request context.
  }
  return {};
}

export async function proxyBackend(
  path: string,
  init?: RequestInit,
): Promise<{ response: Response | NextResponse; refreshed?: KeycloakTokenResponse }> {
  const csrfBlock = await assertSameOriginMutation(init?.method);
  if (csrfBlock) {
    return { response: csrfBlock };
  }

  const locale = await resolveProxyLocale(init?.headers);
  const auth = await getValidAccessToken();

  if (!auth.ok) {
    const guest = await guestProxyTarget(path);
    if (!guest) {
      return {
        response: NextResponse.json({ message: 'Not authenticated' }, { status: 401 }),
      };
    }
    try {
      const guestResponse = await fetchBackend(
        guest.path,
        null,
        init,
        locale,
        { ...guest.headers, ...(await clientIpHeader()) },
      );
      return { response: guestResponse };
    } catch {
      return {
        response: NextResponse.json(
          { message: 'Unable to reach API server' },
          { status: 502 },
        ),
      };
    }
  }

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
        const guest = await guestProxyTarget(path);
        if (guest) {
          const guestResponse = await fetchBackend(
            guest.path,
            null,
            init,
            locale,
            { ...guest.headers, ...(await clientIpHeader()) },
          );
          return { response: guestResponse };
        }
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

/**
 * Proxy a request that only the guest namespace can serve — creating an
 * anonymous project. Carries the client IP for the API-side quota.
 */
export async function proxyGuestBackendJson(
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const csrfBlock = await assertSameOriginMutation(init?.method);
  if (csrfBlock) {
    return csrfBlock;
  }

  const locale = await resolveProxyLocale(init?.headers);
  try {
    const response = await fetchBackend(path, null, init, locale, await clientIpHeader());
    return await buildJsonProxyResponse(response);
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach API server' },
      { status: 502 },
    );
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
    contentType.includes('application/octet-stream') ||
    contentType.includes('wordprocessingml') ||
    contentType.includes('msword')
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
