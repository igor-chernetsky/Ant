import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET() {
  return proxyBackendJson('/v1/contractor/profile');
}

export async function PUT(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/contractor/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
