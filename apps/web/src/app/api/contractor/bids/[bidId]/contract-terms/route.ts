import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ bidId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { bidId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/bids/${encodeURIComponent(bidId)}/contract-terms`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
