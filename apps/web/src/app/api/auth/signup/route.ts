import { NextResponse } from 'next/server';
import { createKeycloakUser } from '@/lib/auth-keycloak-admin';
import { applyAuthCookies, exchangeKeycloakTokens } from '@/lib/auth-tokens';

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

  // Auto-login after successful signup
  const params = new URLSearchParams({
    grant_type: 'password',
    username: email,
    password,
    scope: 'openid profile email offline_access',
  });
  const tokenData = await exchangeKeycloakTokens(params);

  if (!tokenData?.access_token) {
    return NextResponse.json(
      {
        ok: true,
        message: 'Account created. Please sign in.',
      },
      { status: 201 },
    );
  }

  const response = NextResponse.json({ ok: true }, { status: 201 });
  applyAuthCookies(response, tokenData);
  return response;
}

