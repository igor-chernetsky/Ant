import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/amendments`,
    { method: 'GET' },
  );
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/amendments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
