import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return proxyBackendJson('/v1/admin/ads/image/presign', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
