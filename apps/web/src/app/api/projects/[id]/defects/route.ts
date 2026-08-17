import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendJson(`/v1/projects/${encodeURIComponent(id)}/defects`);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return proxyBackendJson(`/v1/projects/${encodeURIComponent(id)}/defects`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
