import { proxyBackendJson } from '@/lib/backend-proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/me/locale', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
