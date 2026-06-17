import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; bidId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, bidId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/counter-offers`,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { id, bidId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/counter-offers`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
