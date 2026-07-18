import { NextResponse } from 'next/server';
import { requestKeycloakPasswordReset } from '@/lib/auth-keycloak-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { email?: string; username?: string } = {};
  try {
    body = (await request.json()) as { email?: string; username?: string };
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const email = (body.email ?? body.username ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { message: 'A valid email address is required' },
      { status: 400 },
    );
  }

  const result = await requestKeycloakPasswordReset(email);

  if (result === 'unavailable') {
    return NextResponse.json(
      {
        message:
          'Password reset is temporarily unavailable. Try again later or contact support.',
      },
      { status: 503 },
    );
  }

  // Always the same message — do not reveal whether the account exists.
  return NextResponse.json({
    ok: true,
    message:
      'If an account exists for that email, you will receive a password reset link shortly. Check your inbox and spam folder.',
  });
}
