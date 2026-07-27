import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET() {
  return proxyBackendJson('/v1/admin/settings');
}

export async function PATCH(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/admin/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
