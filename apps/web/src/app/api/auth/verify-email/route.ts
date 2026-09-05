import { NextResponse } from 'next/server';
import {
  exchangeAdminTokenForUser,
  verifyUserEmailByToken,
} from '@/lib/auth-keycloak-admin';
import { applyAuthCookies } from '@/lib/auth-tokens';
import { parseEmailVerificationToken } from '@/lib/email-verification-token';

export const dynamic = 'force-dynamic';

function redirectToResult(
  request: Request,
  params: { error?: string; signedIn?: boolean } = {},
): NextResponse {
  const base = new URL('/email-verified', request.url);
  if (params.error) {
    base.searchParams.set('error', params.error);
  } else {
    base.searchParams.set('verified', '1');
    if (params.signedIn) {
      base.searchParams.set('signedIn', '1');
    }
  }
  return NextResponse.redirect(base);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim();

  if (!token) {
    return redirectToResult(request, { error: 'missing' });
  }

  const parsed = parseEmailVerificationToken(token);
  if (parsed === 'invalid') {
    return redirectToResult(request, { error: 'invalid' });
  }
  if (parsed === 'expired') {
    return redirectToResult(request, { error: 'expired' });
  }

  const result = await verifyUserEmailByToken(parsed.userId, parsed.email);
  if (result === 'success' || result === 'already') {
    // Auto sign-in: exchange the admin token for the user's tokens. If the
    // Keycloak side isn't configured for token-exchange this is a safe no-op
    // (null), and the user falls back to the normal sign-in flow.
    const tokens = await exchangeAdminTokenForUser(parsed.userId);
    if (tokens?.access_token) {
      const response = redirectToResult(request, { signedIn: true });
      applyAuthCookies(response, tokens);
      return response;
    }
    return redirectToResult(request);
  }
  if (result === 'expired') {
    return redirectToResult(request, { error: 'expired' });
  }
  if (result === 'mismatch') {
    return redirectToResult(request, { error: 'invalid' });
  }

  return redirectToResult(request, { error: 'failed' });
}
