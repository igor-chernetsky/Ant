import { NextResponse } from 'next/server';
import { clearAuthCookieStore, clearAuthCookies } from '@/lib/auth-tokens';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  await clearAuthCookieStore();
  return response;
}
