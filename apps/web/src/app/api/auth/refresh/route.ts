import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  clearAuthCookies,
  readAuthCookies,
  refreshKeycloakTokens,
} from '@/lib/auth-tokens';

export async function POST() {
  const { refreshToken } = await readAuthCookies();

  if (!refreshToken) {
    const response = NextResponse.json(
      { message: 'Not authenticated' },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const tokenData = await refreshKeycloakTokens(refreshToken);

  if (!tokenData?.access_token) {
    const response = NextResponse.json(
      { message: 'Session expired' },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  applyAuthCookies(response, tokenData);
  return response;
}
