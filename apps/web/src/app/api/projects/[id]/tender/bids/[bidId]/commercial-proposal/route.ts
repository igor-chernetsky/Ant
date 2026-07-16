import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; bidId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id, bidId } = await context.params;
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const withAttachments = url.searchParams.get('withAttachments');
  const locales = url.searchParams.get('locales');
  if (withAttachments) {
    params.set('withAttachments', withAttachments);
  }
  if (locales) {
    params.set('locales', locales);
  }
  const query = params.toString() ? `?${params.toString()}` : '';

  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/commercial-proposal${query}`,
  );
}
