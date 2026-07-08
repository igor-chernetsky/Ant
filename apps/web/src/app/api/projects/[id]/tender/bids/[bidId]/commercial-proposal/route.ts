import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; bidId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id, bidId } = await context.params;
  const url = new URL(request.url);
  const withAttachments = url.searchParams.get('withAttachments');
  const query = withAttachments
    ? `?withAttachments=${encodeURIComponent(withAttachments)}`
    : '';

  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/commercial-proposal${query}`,
  );
}
