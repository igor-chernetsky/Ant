import { NextResponse } from 'next/server';
import { completeKeycloakPasswordReset } from '@/lib/auth-keycloak-admin';
import { parsePasswordResetToken } from '@/lib/password-reset-token';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LEN = 8;

export async function POST(request: Request) {
  let body: { token?: string; password?: string } = {};
  try {
    body = (await request.json()) as { token?: string; password?: string };
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const token = body.token?.trim() ?? '';
  const password = body.password ?? '';

  if (!token) {
    return NextResponse.json(
      { message: 'Reset link is missing or invalid' },
      { status: 400 },
    );
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return NextResponse.json(
      { message: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
      { status: 400 },
    );
  }

  const parsed = parsePasswordResetToken(token);
  if (parsed === 'expired') {
    return NextResponse.json(
      { message: 'This reset link has expired. Request a new one.' },
      { status: 400 },
    );
  }
  if (parsed === 'invalid') {
    return NextResponse.json(
      { message: 'This reset link is invalid. Request a new one.' },
      { status: 400 },
    );
  }

  const result = await completeKeycloakPasswordReset(
    parsed.userId,
    parsed.email,
    password,
  );

  if (result === 'not_found') {
    return NextResponse.json(
      { message: 'This reset link is no longer valid.' },
      { status: 400 },
    );
  }
  if (result !== 'ok') {
    return NextResponse.json(
      {
        message:
          'Password reset is temporarily unavailable. Try again later or contact support.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Password updated. You can sign in with your new password.',
  });
}
