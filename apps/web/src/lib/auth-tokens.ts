import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  getKeycloakBffCredentials,
  getKeycloakTokenUrl,
} from '@/lib/auth-server';

export const REFRESH_TOKEN_COOKIE = 'platform_refresh_token';

export interface KeycloakTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function readAuthCookies(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}

export async function exchangeKeycloakTokens(
  params: URLSearchParams,
): Promise<KeycloakTokenResponse | null> {
  let bff: { clientId: string; clientSecret: string };
  try {
    bff = getKeycloakBffCredentials();
  } catch {
    return null;
  }

  params.set('client_id', bff.clientId);
  params.set('client_secret', bff.clientSecret);

  try {
    const response = await fetch(getKeycloakTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    const data = (await response.json()) as KeycloakTokenResponse;
    if (!response.ok || !data.access_token) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function refreshKeycloakTokens(
  refreshToken: string,
): Promise<KeycloakTokenResponse | null> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return exchangeKeycloakTokens(params);
}

export function applyAuthCookies(
  response: NextResponse,
  tokens: KeycloakTokenResponse,
): void {
  const accessMaxAge = tokens.expires_in ?? 300;
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token!, {
    ...cookieBase,
    maxAge: accessMaxAge,
  });

  if (tokens.refresh_token) {
    const refreshMaxAge = tokens.refresh_expires_in ?? 60 * 60 * 24 * 7;
    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
      ...cookieBase,
      maxAge: refreshMaxAge,
    });
  }
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', { ...cookieBase, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', { ...cookieBase, maxAge: 0 });
}

export type AuthRefreshResult =
  | { ok: true; accessToken: string; refreshed?: KeycloakTokenResponse }
  | { ok: false };

/** Use access token; on missing access try refresh; optionally retry after API 401. */
export async function getValidAccessToken(): Promise<AuthRefreshResult> {
  const { accessToken, refreshToken } = await readAuthCookies();

  if (accessToken) {
    return { ok: true, accessToken };
  }

  if (!refreshToken) {
    return { ok: false };
  }

  const refreshed = await refreshKeycloakTokens(refreshToken);
  if (!refreshed?.access_token) {
    return { ok: false };
  }

  return {
    ok: true,
    accessToken: refreshed.access_token,
    refreshed,
  };
}

export async function refreshAccessTokenAfterUnauthorized(): Promise<AuthRefreshResult> {
  const { refreshToken } = await readAuthCookies();
  if (!refreshToken) {
    return { ok: false };
  }

  const refreshed = await refreshKeycloakTokens(refreshToken);
  if (!refreshed?.access_token) {
    return { ok: false };
  }

  return {
    ok: true,
    accessToken: refreshed.access_token,
    refreshed,
  };
}
