import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET() {
  return proxyBackendJson('/v1/tags');
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
