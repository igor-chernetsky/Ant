import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/contractor/portfolio/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
