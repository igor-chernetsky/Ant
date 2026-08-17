import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return proxyBackendJson(`/v1/admin/ads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendJson(`/v1/admin/ads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
