import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string; addendumId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, addendumId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/contract/addenda/${encodeURIComponent(addendumId)}`,
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, addendumId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/contract/addenda/${encodeURIComponent(addendumId)}`,
    { method: 'DELETE' },
  );
}
