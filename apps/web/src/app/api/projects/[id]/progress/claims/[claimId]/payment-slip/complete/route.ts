import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string; claimId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id, claimId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/progress/claims/${encodeURIComponent(claimId)}/payment-slip/complete`,
    { method: 'POST', body, headers: { 'Content-Type': 'application/json' } },
  );
}
