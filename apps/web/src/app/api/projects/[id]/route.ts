import { proxyBackendJson } from '@/lib/backend-proxy';
import { clearGuestProjectToken } from '@/lib/guest-project';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendJson(`/v1/projects/${encodeURIComponent(id)}`);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.text();
  return proxyBackendJson(`/v1/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const response = await proxyBackendJson(`/v1/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (response.ok) {
    // A deleted draft must not stay referenced by the guest cookie.
    await clearGuestProjectToken(id);
  }
  return response;
}
