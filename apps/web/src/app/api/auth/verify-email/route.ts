import { NextResponse } from 'next/server';
import { verifyUserEmailByToken } from '@/lib/auth-keycloak-admin';
import { parseEmailVerificationToken } from '@/lib/email-verification-token';

export const dynamic = 'force-dynamic';

function redirectToResult(request: Request, error?: string): NextResponse {
  const base = new URL('/email-verified', request.url);
  if (error) {
    base.searchParams.set('error', error);
  } else {
    base.searchParams.set('verified', '1');
  }
  return NextResponse.redirect(base);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim();

  if (!token) {
    return redirectToResult(request, 'missing');
  }

  const parsed = parseEmailVerificationToken(token);
  if (parsed === 'invalid') {
    return redirectToResult(request, 'invalid');
  }
  if (parsed === 'expired') {
    return redirectToResult(request, 'expired');
  }

  const result = await verifyUserEmailByToken(parsed.userId, parsed.email);
  if (result === 'success' || result === 'already') {
    return redirectToResult(request);
  }
  if (result === 'expired') {
    return redirectToResult(request, 'expired');
  }
  if (result === 'mismatch') {
    return redirectToResult(request, 'invalid');
  }

  return redirectToResult(request, 'failed');
}
