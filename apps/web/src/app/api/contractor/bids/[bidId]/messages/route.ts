import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ bidId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { bidId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/bids/${encodeURIComponent(bidId)}/messages`,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { bidId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/bids/${encodeURIComponent(bidId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
