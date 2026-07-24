import { proxyBackendJson } from '@/lib/backend-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/me/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
