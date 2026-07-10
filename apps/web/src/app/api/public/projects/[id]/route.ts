import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';
import { getValidAccessToken } from '@/lib/auth-tokens';
import {
  LOCALE_REQUEST_HEADER,
  readLocaleFromCookieHeader,
} from '@/lib/locale-request';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const headers: HeadersInit = {
    Accept: 'application/json',
    [LOCALE_REQUEST_HEADER]: readLocaleFromCookieHeader(
      request.headers.get('cookie'),
    ),
  };
  const auth = await getValidAccessToken();
  if (auth.ok) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  try {
    const backendResponse = await fetch(
      `${getBackendApiUrl()}/v1/public/projects/${encodeURIComponent(id)}`,
      { cache: 'no-store', headers },
    );
    const text = await backendResponse.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { message: text };
    }
    return NextResponse.json(body, { status: backendResponse.status });
  } catch {
    return NextResponse.json(
      { message: 'Unable to reach API server' },
      { status: 502 },
    );
  }
}
