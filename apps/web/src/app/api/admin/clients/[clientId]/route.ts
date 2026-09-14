import { softDeleteUserViaBackend } from '@/lib/admin-user-delete';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { clientId } = await context.params;
  return proxyBackendJson(`/v1/admin/clients/${encodeURIComponent(clientId)}`);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { clientId } = await context.params;
  return softDeleteUserViaBackend(
    `/v1/admin/clients/${encodeURIComponent(clientId)}`,
  );
}
