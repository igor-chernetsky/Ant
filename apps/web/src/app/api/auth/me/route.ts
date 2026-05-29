import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  getBackendApiUrl,
} from '@/lib/auth-server';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${getBackendApiUrl()}/v1/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach API server' },
      { status: 502 },
    );
  }

  if (backendResponse.status === 401) {
    const response = NextResponse.json(
      { message: 'Session expired' },
      { status: 401 },
    );
    response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  if (!backendResponse.ok) {
    const text = await backendResponse.text();
    return NextResponse.json(
      { message: text || 'Failed to load profile' },
      { status: backendResponse.status },
    );
  }

  const profile = await backendResponse.json();
  return NextResponse.json(profile);
}
