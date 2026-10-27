import { NextResponse } from 'next/server';
import { authErrorPayload } from '@/lib/auth-login-error';
import {
  diagnoseKeycloakLoginFailure,
  resolveKeycloakLoginIdentifiers,
} from '@/lib/auth-keycloak-admin';
import {
  exchangePasswordCredentials,
  isAccountNotFullySetUpError,
  isWrongPasswordError,
  persistAndApplyAuthCookies,
  type TokenExchangeResult,
} from '@/lib/auth-tokens';
import { createMemoryRateLimiter } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';
import {
  clearGuestProjectTokens,
  tagGuestProjectsWithEmail,
} from '@/lib/guest-project';
import { resolveWorkspaceIntroRedirect } from '@/lib/workspace-intro';

export const dynamic = 'force-dynamic';

interface LoginBody {
  username?: string;
  password?: string;
}

const loginRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
});

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
    // An unverified email reaches us as "Account is not fully set up", not as a
    // wrong password, so both failures need the admin diagnosis.
    const accountStateFailure =
      isWrongPasswordError(result) || isAccountNotFullySetUpError(result);

    if (!accountStateFailure) {
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
    const diagnosis = accountStateFailure
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

  // Signing in adopts any draft this browser started as a guest: the API hands
  // tagged projects to the account on the next project list / project view. The
  // local guest tokens are dropped as soon as the address is recorded, so a stale
  // draft reference cannot outlive the claim.
  const taggedProjects = await tagGuestProjectsWithEmail(username);
  if (taggedProjects.length > 0) {
    await clearGuestProjectTokens(taggedProjects);
  }

  // First sign-in of a client: open the project they just claimed. Resolved here,
  // in the same request, so the marker is written before the browser navigates and
  // the home page stays reachable on every later visit.
  const accessToken = result.tokens.access_token;
  const redirectTo = accessToken
    ? await resolveWorkspaceIntroRedirect(accessToken)
    : null;

  const response = NextResponse.json(
    redirectTo ? { ok: true, redirectTo } : { ok: true },
  );
  await persistAndApplyAuthCookies(result.tokens, response);
  return response;
}
