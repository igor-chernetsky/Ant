import { NextResponse } from 'next/server';
import {
  isKeycloakConsentOrSetupError,
  repairKeycloakUserAuth,
} from '@/lib/auth-keycloak-admin';
import {
  exchangeKeycloakTokens,
  persistAndApplyAuthCookies,
} from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  const password = body.password;

  if (!username || !password) {
    return NextResponse.json(
      { message: 'Username and password are required' },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    scope: 'openid profile email offline_access',
  });

  let result = await exchangeKeycloakTokens(params);

  if (
    !result.ok &&
    isKeycloakConsentOrSetupError({
      error: result.error,
      description: result.description,
    })
  ) {
    const repaired = await repairKeycloakUserAuth(username);
    if (repaired) {
      result = await exchangeKeycloakTokens(params);
    }
  }

  if (!result.ok) {
    console.error(
      '[auth/login] Keycloak token exchange failed:',
      result.error,
      result.description ?? '',
    );
    return NextResponse.json(
      { message: 'Invalid username or password' },
      { status: 401 },
    );
  }

  if (!result.tokens.refresh_token) {
    console.warn(
      '[auth/login] No refresh_token from Keycloak — enable offline_access on platform-bff client',
    );
  }

  const response = NextResponse.json({ ok: true });
  await persistAndApplyAuthCookies(result.tokens, response);
  return response;
}
