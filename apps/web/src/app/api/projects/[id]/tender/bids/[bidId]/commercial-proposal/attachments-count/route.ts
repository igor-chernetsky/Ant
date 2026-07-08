import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; bidId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, bidId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/commercial-proposal/attachments-count`,
  );
}
