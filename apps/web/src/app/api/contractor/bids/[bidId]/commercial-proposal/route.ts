import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ bidId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { bidId } = await context.params;
  const url = new URL(request.url);
  const withAttachments = url.searchParams.get('withAttachments');
  const query = withAttachments
    ? `?withAttachments=${encodeURIComponent(withAttachments)}`
    : '';

  return proxyBackendJson(
    `/v1/contractor/bids/${encodeURIComponent(bidId)}/commercial-proposal${query}`,
  );
}
