import { NextResponse } from 'next/server';
import { getBackendApiUrl } from '@/lib/auth-server';
import { getValidAccessToken } from '@/lib/auth-tokens';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tagParams = url.searchParams.getAll('tag');
  const statusParams = url.searchParams.getAll('status');
  const region = url.searchParams.get('region');
  const area = url.searchParams.get('area');
  const serviceParams = url.searchParams.getAll('service');
  const ownershipParams = url.searchParams.getAll('ownership');
  const qs = [
    ...tagParams.map((tag) => `tag=${encodeURIComponent(tag)}`),
    ...statusParams.map((status) => `status=${encodeURIComponent(status)}`),
    ...serviceParams.map((service) => `service=${encodeURIComponent(service)}`),
    ...ownershipParams.map(
      (ownership) => `ownership=${encodeURIComponent(ownership)}`,
    ),
    ...(region ? [`region=${encodeURIComponent(region)}`] : []),
    ...(area ? [`area=${encodeURIComponent(area)}`] : []),
  ].join('&');

  const headers: HeadersInit = { Accept: 'application/json' };
  const auth = await getValidAccessToken();
  if (auth.ok) {
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  try {
    const backendResponse = await fetch(
      `${getBackendApiUrl()}/v1/public/projects${qs ? `?${qs}` : ''}`,
      { cache: 'no-store', headers },
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
