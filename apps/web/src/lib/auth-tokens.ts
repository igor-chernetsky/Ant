import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  getKeycloakBffCredentials,
  getKeycloakTokenUrl,
} from '@/lib/auth-server';
import { accessTokenNeedsRefresh } from '@/lib/jwt-utils';

export const REFRESH_TOKEN_COOKIE = 'platform_refresh_token';

export interface KeycloakTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
}

export type TokenExchangeResult =
  | { ok: true; tokens: KeycloakTokenResponse }
  | { ok: false; error: string; description?: string };

const DEFAULT_REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function useSecureCookies(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

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
): Promise<TokenExchangeResult> {
  let bff: { clientId: string; clientSecret: string };
  try {
    bff = getKeycloakBffCredentials();
  } catch (err) {
    return {
      ok: false,
      error: 'bff_not_configured',
      description: err instanceof Error ? err.message : String(err),
    };
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
      return {
        ok: false,
        error: data.error ?? 'token_exchange_failed',
        description: data.error_description,
      };
    }
    return { ok: true, tokens: data };
  } catch (err) {
    return {
      ok: false,
      error: 'token_exchange_network_error',
      description: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function refreshKeycloakTokens(
  refreshToken: string,
): Promise<TokenExchangeResult> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'openid offline_access',
  });
  return exchangeKeycloakTokens(params);
}

/**
 * One in-flight Keycloak refresh per server instance.
 * Keycloak rotates refresh tokens — parallel refreshes with the same token
 * cause invalid_grant on all but the first caller (common on Vercel).
 */
let refreshFlight: Promise<TokenExchangeResult> | null = null;

export function refreshKeycloakTokensSingleFlight(
  refreshToken: string,
): Promise<TokenExchangeResult> {
  if (refreshFlight) {
    return refreshFlight;
  }

  refreshFlight = refreshKeycloakTokens(refreshToken).finally(() => {
    refreshFlight = null;
  });
  return refreshFlight;
}

/** Persist auth cookies via next/headers (reliable in Route Handlers). */
export async function persistAuthCookies(
  tokens: KeycloakTokenResponse,
): Promise<void> {
  if (!tokens.access_token) {
    return;
  }

  const cookieStore = await cookies();
  const accessMaxAge = tokens.expires_in ?? 300;
  cookieStore.set(
    ACCESS_TOKEN_COOKIE,
    tokens.access_token,
    cookieOptions(accessMaxAge),
  );

  if (tokens.refresh_token) {
    const refreshMaxAge =
      tokens.refresh_expires_in ?? DEFAULT_REFRESH_MAX_AGE;
    cookieStore.set(
      REFRESH_TOKEN_COOKIE,
      tokens.refresh_token,
      cookieOptions(refreshMaxAge),
    );
  }
}

/** Also set Set-Cookie on a NextResponse (for proxy responses). */
export function applyAuthCookies(
  response: NextResponse,
  tokens: KeycloakTokenResponse,
): void {
  if (!tokens.access_token) {
    return;
  }

  const accessMaxAge = tokens.expires_in ?? 300;
  response.cookies.set(
    ACCESS_TOKEN_COOKIE,
    tokens.access_token,
    cookieOptions(accessMaxAge),
  );

  if (tokens.refresh_token) {
    const refreshMaxAge =
      tokens.refresh_expires_in ?? DEFAULT_REFRESH_MAX_AGE;
    response.cookies.set(
      REFRESH_TOKEN_COOKIE,
      tokens.refresh_token,
      cookieOptions(refreshMaxAge),
    );
  }
}

export async function persistAndApplyAuthCookies(
  tokens: KeycloakTokenResponse,
  response?: NextResponse,
): Promise<void> {
  await persistAuthCookies(tokens);
  if (response) {
    applyAuthCookies(response, tokens);
  }
}

export function clearAuthCookies(response: NextResponse): void {
  const cleared = cookieOptions(0);
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', cleared);
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', cleared);
}

export async function clearAuthCookieStore(): Promise<void> {
  const cookieStore = await cookies();
  const cleared = cookieOptions(0);
  cookieStore.set(ACCESS_TOKEN_COOKIE, '', cleared);
  cookieStore.set(REFRESH_TOKEN_COOKIE, '', cleared);
}

export type AuthRefreshResult =
  | { ok: true; accessToken: string; refreshed?: KeycloakTokenResponse }
  | { ok: false };

/** Use access token; refresh proactively before JWT expiry or when missing. */
export async function getValidAccessToken(): Promise<AuthRefreshResult> {
  const { accessToken, refreshToken } = await readAuthCookies();

  if (accessToken && !accessTokenNeedsRefresh(accessToken)) {
    return { ok: true, accessToken };
  }

  if (!refreshToken) {
    return { ok: false };
  }

  const result = await refreshKeycloakTokensSingleFlight(refreshToken);
  if (!result.ok) {
    return { ok: false };
  }

  await persistAuthCookies(result.tokens);

  return {
    ok: true,
    accessToken: result.tokens.access_token!,
    refreshed: result.tokens,
  };
}

export async function refreshAccessTokenAfterUnauthorized(): Promise<AuthRefreshResult> {
  const { refreshToken } = await readAuthCookies();
  if (!refreshToken) {
    return { ok: false };
  }

  const result = await refreshKeycloakTokensSingleFlight(refreshToken);
  if (!result.ok) {
    return { ok: false };
  }

  await persistAuthCookies(result.tokens);

  return {
    ok: true,
    accessToken: result.tokens.access_token!,
    refreshed: result.tokens,
  };
}
