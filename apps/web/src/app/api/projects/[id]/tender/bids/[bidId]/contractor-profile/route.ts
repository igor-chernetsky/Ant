import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; bidId: string }> },
) {
  const { id, bidId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/contractor-profile`,
  );
}
