import { NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  getKeycloakClientId,
  getKeycloakTokenUrl,
} from '@/lib/auth-server';

interface LoginBody {
  username?: string;
  password?: string;
}

interface KeycloakTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
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

  const tokenUrl = getKeycloakTokenUrl();
  const clientId = getKeycloakClientId();

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: clientId,
    username,
    password,
    scope: 'openid profile email',
  });

  let keycloakResponse: Response;
  try {
    keycloakResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach authentication server' },
      { status: 502 },
    );
  }

  const tokenData = (await keycloakResponse.json()) as KeycloakTokenResponse;

  if (!keycloakResponse.ok || !tokenData.access_token) {
    return NextResponse.json(
      {
        message:
          tokenData.error_description ??
          tokenData.error ??
          'Invalid username or password',
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  const maxAge = tokenData.expires_in ?? 300;

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  return response;
}
