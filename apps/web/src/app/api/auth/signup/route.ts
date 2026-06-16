import { NextResponse } from 'next/server';
import {
  createKeycloakUser,
  repairKeycloakUserAuth,
  shouldAttemptKeycloakAuthRepair,
} from '@/lib/auth-keycloak-admin';
import {
  exchangePasswordCredentials,
  persistAndApplyAuthCookies,
} from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

interface SignupBody {
  email?: string;
  password?: string;
  displayName?: string;
  roles?: string[];
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const displayName = body.displayName?.trim();
  const roles = Array.isArray(body.roles) ? body.roles : ['client'];

  if (!email || !password) {
    return NextResponse.json(
      { message: 'Email and password are required' },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { message: 'Password must be at least 8 characters' },
      { status: 400 },
    );
  }

  const created = await createKeycloakUser({
    email,
    password,
    displayName,
    roles,
  });

  if (!created.ok) {
    return NextResponse.json(
      { message: created.message },
      { status: created.status },
    );
  }

  let result = await exchangePasswordCredentials(email, password);

  if (!result.ok && shouldAttemptKeycloakAuthRepair(result)) {
    const repaired = await repairKeycloakUserAuth(email);
    if (repaired) {
      result = await exchangePasswordCredentials(email, password);
    }
  }

  if (!result.ok) {
    console.error(
      '[auth/signup] User created but token exchange failed:',
      result.error,
      result.description ?? '',
    );
    return NextResponse.json(
      {
        ok: true,
        signedIn: false,
        message:
          'Account created, but automatic sign-in failed. Try signing in with your email and password.',
        code: result.error,
        detail: result.description,
      },
      { status: 201 },
    );
  }

  const response = NextResponse.json({ ok: true, signedIn: true }, { status: 201 });
  await persistAndApplyAuthCookies(result.tokens, response);
  return response;
}
