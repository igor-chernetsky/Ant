import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; bidId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id, bidId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/contract-terms`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
