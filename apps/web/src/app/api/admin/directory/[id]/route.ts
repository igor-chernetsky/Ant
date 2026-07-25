import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendJson(`/v1/admin/directory/${encodeURIComponent(id)}`);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyBackendJson(`/v1/admin/directory/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendJson(`/v1/admin/directory/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
