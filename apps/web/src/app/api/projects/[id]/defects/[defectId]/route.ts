import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; defectId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, defectId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/defects/${encodeURIComponent(defectId)}`,
    { method: 'DELETE' },
  );
}
