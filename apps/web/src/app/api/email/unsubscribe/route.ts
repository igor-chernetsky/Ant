import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

async function proxyUnsubscribe(
  request: Request,
  method: 'GET' | 'POST',
): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json(
      { message: 'Missing unsubscribe token' },
      { status: 400 },
    );
  }

  try {
    const backendUrl = `${getBackendApiUrl()}/v1/email/unsubscribe?token=${encodeURIComponent(token)}`;
    const backendResponse = await fetch(backendUrl, {
      method,
      cache: 'no-store',
      headers:
        method === 'POST'
          ? {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          : undefined,
      body: method === 'POST' ? 'List-Unsubscribe=One-Click' : undefined,
    });

    const text = await backendResponse.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : {};
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

/** One-click unsubscribe (RFC 8058) and programmatic GET. */
export async function POST(request: Request) {
  return proxyUnsubscribe(request, 'POST');
}

export async function GET(request: Request) {
  return proxyUnsubscribe(request, 'GET');
}
