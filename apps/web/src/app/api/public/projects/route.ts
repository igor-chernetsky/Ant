import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tagParams = url.searchParams.getAll('tag');
  const statusParams = url.searchParams.getAll('status');
  const qs = [
    ...tagParams.map((tag) => `tag=${encodeURIComponent(tag)}`),
    ...statusParams.map((status) => `status=${encodeURIComponent(status)}`),
  ].join('&');

  try {
    const backendResponse = await fetch(
      `${getBackendApiUrl()}/v1/public/projects${qs ? `?${qs}` : ''}`,
      { cache: 'no-store' },
    );
    const text = await backendResponse.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : [];
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
