import { NextResponse } from 'next/server';
import {
  repairKeycloakUserAuth,
  shouldAttemptKeycloakAuthRepair,
} from '@/lib/auth-keycloak-admin';
import {
  exchangePasswordCredentials,
  isWrongPasswordError,
  persistAndApplyAuthCookies,
} from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

interface LoginBody {
  username?: string;
  password?: string;
}

function authErrorPayload(result: {
  error: string;
  description?: string;
}): { message: string; code: string; detail?: string } {
  if (isWrongPasswordError(result)) {
    return {
      message: 'Invalid username or password',
      code: 'invalid_credentials',
    };
  }

  if (result.error === 'bff_not_configured') {
    return {
      message: 'Authentication service is not configured',
      code: result.error,
      detail: result.description,
    };
  }

  if (result.error === 'unauthorized_client' || result.error === 'invalid_client') {
    return {
      message: 'Authentication service misconfigured',
      code: result.error,
      detail: result.description,
    };
  }

  const description = (result.description ?? '').toLowerCase();
  if (description.includes('not fully set up')) {
    return {
      message: 'Account setup is incomplete. Try again or contact support.',
      code: 'account_not_ready',
      detail: result.description,
    };
  }

  return {
    message: 'Sign in failed',
    code: result.error,
    detail: result.description,
  };
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

  let result = await exchangePasswordCredentials(username, password);

  if (!result.ok && shouldAttemptKeycloakAuthRepair(result)) {
    const repaired = await repairKeycloakUserAuth(username);
    if (repaired) {
      result = await exchangePasswordCredentials(username, password);
    }
  }

  if (!result.ok) {
    console.error(
      '[auth/login] Keycloak token exchange failed:',
      result.error,
      result.description ?? '',
    );
    const payload = authErrorPayload(result);
    return NextResponse.json(payload, { status: 401 });
  }

  if (!result.tokens.refresh_token) {
    console.warn(
      '[auth/login] No refresh_token from Keycloak — add offline_access to platform-bff client scopes',
    );
  }

  const response = NextResponse.json({ ok: true });
  await persistAndApplyAuthCookies(result.tokens, response);
  return response;
}
