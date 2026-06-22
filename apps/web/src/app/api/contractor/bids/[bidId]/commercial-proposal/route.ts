import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ bidId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { bidId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/bids/${encodeURIComponent(bidId)}/commercial-proposal`,
  );
}
