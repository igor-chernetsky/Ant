import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string; claimId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id, claimId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/progress/claims/${encodeURIComponent(claimId)}/submit`,
    { method: 'POST' },
  );
}
