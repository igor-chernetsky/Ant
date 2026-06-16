import { NextResponse } from 'next/server';
import {
  diagnoseKeycloakLoginFailure,
  repairKeycloakUserAuth,
  resolveKeycloakLoginIdentifiers,
  shouldAttemptKeycloakAuthRepair,
} from '@/lib/auth-keycloak-admin';
import {
  exchangePasswordCredentials,
  isWrongPasswordError,
  persistAndApplyAuthCookies,
  type TokenExchangeResult,
} from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

interface LoginBody {
  username?: string;
  password?: string;
}

function authErrorPayload(
  result: { error: string; description?: string },
  diagnosis?: { code: string; detail: string } | null,
): { message: string; code: string; detail?: string } {
  if (diagnosis) {
    return {
      message:
        diagnosis.code === 'password_not_configured'
          ? 'Account exists but has no password. Set it in Keycloak or sign up again.'
          : diagnosis.code === 'user_not_found'
            ? 'Invalid username or password'
            : diagnosis.code === 'user_disabled'
              ? 'Account is disabled'
              : diagnosis.code === 'account_not_ready'
                ? 'Account setup is incomplete. Try again.'
                : 'Invalid username or password',
      code: diagnosis.code,
      detail: diagnosis.detail,
    };
  }

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

async function attemptLogin(
  login: string,
  password: string,
): Promise<TokenExchangeResult> {
  const identifiers = await resolveKeycloakLoginIdentifiers(login);
  let lastResult: TokenExchangeResult = {
    ok: false,
    error: 'invalid_grant',
    description: 'Invalid user credentials',
  };

  for (const identifier of identifiers) {
    const result = await exchangePasswordCredentials(identifier, password);
    if (result.ok) {
      return result;
    }
    lastResult = result;
    if (!isWrongPasswordError(result)) {
      return result;
    }
  }

  return lastResult;
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

  let result = await attemptLogin(username, password);

  if (!result.ok && shouldAttemptKeycloakAuthRepair(result)) {
    const repaired = await repairKeycloakUserAuth(username);
    if (repaired) {
      result = await attemptLogin(username, password);
    }
  }

  if (!result.ok && isWrongPasswordError(result)) {
    const diagnosis = await diagnoseKeycloakLoginFailure(username);
    if (
      diagnosis?.code === 'password_not_configured' ||
      diagnosis?.code === 'account_not_ready'
    ) {
      const repaired = await repairKeycloakUserAuth(
        username,
        diagnosis.code === 'password_not_configured' ? password : undefined,
      );
      if (repaired) {
        result = await attemptLogin(username, password);
      }
    }
  }

  if (!result.ok) {
    console.error(
      '[auth/login] Keycloak token exchange failed:',
      result.error,
      result.description ?? '',
    );
    const diagnosis = isWrongPasswordError(result)
      ? await diagnoseKeycloakLoginFailure(username)
      : null;
    const payload = authErrorPayload(result, diagnosis);
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
