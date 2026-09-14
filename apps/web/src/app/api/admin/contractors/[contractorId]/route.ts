import { softDeleteUserViaBackend } from '@/lib/admin-user-delete';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ contractorId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { contractorId } = await context.params;
  return proxyBackendJson(
    `/v1/admin/contractors/${encodeURIComponent(contractorId)}`,
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { contractorId } = await context.params;
  return softDeleteUserViaBackend(
    `/v1/admin/contractors/${encodeURIComponent(contractorId)}`,
  );
}
