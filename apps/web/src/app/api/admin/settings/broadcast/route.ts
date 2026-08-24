import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/admin/settings/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
