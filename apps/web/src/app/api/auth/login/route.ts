import { NextResponse } from 'next/server';
import { exchangeKeycloakTokens, applyAuthCookies } from '@/lib/auth-tokens';

interface LoginBody {
  username?: string;
  password?: string;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
  }

  const username = body.username?.trim();
  const password = body.password;

  if (!username || !password) {
    return NextResponse.json(
      { message: 'Username and password are required' },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    scope: 'openid profile email offline_access',
  });

  const tokenData = await exchangeKeycloakTokens(params);

  if (!tokenData?.access_token) {
    return NextResponse.json(
      { message: 'Invalid username or password' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  applyAuthCookies(response, tokenData);
  return response;
}
