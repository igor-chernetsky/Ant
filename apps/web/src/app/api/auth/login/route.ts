import { NextResponse } from 'next/server';
import {
  diagnoseKeycloakLoginFailure,
  resolveKeycloakLoginIdentifiers,
} from '@/lib/auth-keycloak-admin';
import {
  exchangePasswordCredentials,
  isWrongPasswordError,
  persistAndApplyAuthCookies,
  type TokenExchangeResult,
} from '@/lib/auth-tokens';
import { createMemoryRateLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface LoginBody {
  username?: string;
  password?: string;
}

const loginRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function authErrorPayload(
  result: { error: string; description?: string },
  diagnosis?: { code: string; detail: string } | null,
): { message: string; code: string } {
  // Avoid account-enumeration: only surface email verification and infra errors.
  if (diagnosis?.code === 'email_not_verified') {
    return {
      message:
        'Verify your email before signing in. Check your inbox for the confirmation link.',
      code: 'email_not_verified',
    };
  }

  if (isWrongPasswordError(result) || diagnosis) {
    return {
      message: 'Invalid username or password',
      code: 'invalid_credentials',
    };
  }

  if (result.error === 'bff_not_configured') {
    return {
      message: 'Authentication service is not configured',
      code: result.error,
    };
  }

  if (result.error === 'unauthorized_client' || result.error === 'invalid_client') {
    return {
      message: 'Authentication service misconfigured',
      code: result.error,
    };
  }

  return {
    message: 'Invalid username or password',
    code: 'invalid_credentials',
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

  const rateKey = `${clientIp(request)}:${username}`;
  const limited = loginRateLimiter.check(rateKey);
  if (!limited.ok) {
    return NextResponse.json(
      {
        message: 'Too many sign-in attempts. Try again later.',
        code: 'rate_limited',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfterSec) },
      },
    );
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (origin || referer) {
    try {
      const expectedHost = new URL(request.url).host.toLowerCase();
      if (origin && new URL(origin).host.toLowerCase() !== expectedHost) {
        return NextResponse.json(
          { message: 'Invalid request origin', code: 'forbidden_origin' },
          { status: 403 },
        );
      }
      if (referer && new URL(referer).host.toLowerCase() !== expectedHost) {
        return NextResponse.json(
          { message: 'Invalid request referer', code: 'forbidden_origin' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: 'Invalid request origin', code: 'forbidden_origin' },
        { status: 403 },
      );
    }
  }

  const result = await attemptLogin(username, password);

  if (!result.ok) {
    if (!isWrongPasswordError(result)) {
      console.error(
        '[auth/login] Keycloak token exchange failed:',
        result.error,
        result.description ?? '',
      );
    }

    // Only surface the email-verification state so the client can point the
    // user at the confirmation email. Every other account state returns the
    // same generic "invalid credentials". We intentionally never auto-repair a
    // password or account here: that path ran with the caller-supplied password
    // via the Keycloak Admin API and allowed account takeover for accounts
    // without a permanent password. Recovery must go through the verified
    // forgot-password / verify-email flows.
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
