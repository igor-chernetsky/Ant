import { proxyBackendJson } from '@/lib/backend-proxy';
import { getValidAccessToken } from '@/lib/auth-tokens';
import { clearGuestProjectToken } from '@/lib/guest-project';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getValidAccessToken();
  const response = await proxyBackendJson(`/v1/projects/${encodeURIComponent(id)}`);

  if (session.ok && response.ok) {
    // The signed-in caller opened the project — most likely its owner. The guest
    // token for it (if this browser still had one from the anonymous draft) is
    // stale now: with the claim by e-mail the account owns the project.
    await clearGuestProjectToken(id);
  }

  return response;
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
