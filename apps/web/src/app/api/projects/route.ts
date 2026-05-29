import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET() {
  return proxyBackendJson('/v1/projects');
}

export async function POST(request: Request) {
  const body = await request.text();
  return proxyBackendJson('/v1/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
