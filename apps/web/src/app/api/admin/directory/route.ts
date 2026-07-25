import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return proxyBackendJson(`/v1/admin/directory${qs}`);
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/admin/directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
