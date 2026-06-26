import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/portfolio/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { itemId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/portfolio/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
}
