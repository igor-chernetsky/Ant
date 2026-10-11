import { NextResponse } from 'next/server';
import { resendVerificationEmail } from '@/lib/auth-keycloak-admin';
import { checkResendVerificationAllowed } from '@/lib/auth-resend-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';

interface ResendVerificationBody {
  email?: string;
}

function tooManyRequests(
  message: string,
  code: string,
  retryAfterSec: number,
): NextResponse {
  return NextResponse.json(
    { message, code, retryAfterSec },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    },
  );
}

export async function POST(request: Request) {
  let body: ResendVerificationBody;
  try {
    body = (await request.json()) as ResendVerificationBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { message: 'A valid email address is required' },
      { status: 400 },
    );
  }

  const limit = checkResendVerificationAllowed(`${clientIp(request)}:${email}`);
  if (!limit.ok) {
    return tooManyRequests(
      limit.code === 'verification_resend_too_soon'
        ? 'A verification email was sent recently. You can request another one a little later.'
        : 'Too many verification emails requested. You can request another one a little later.',
      limit.code,
      limit.retryAfterSec,
    );
  }

  const result = await resendVerificationEmail(email);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  // Same answer for a registered, unknown and already verified address.
  return NextResponse.json({
    ok: true,
    message:
      'If an account exists for that email, a new confirmation link is on its way. Check your inbox and spam folder.',
  });
}
