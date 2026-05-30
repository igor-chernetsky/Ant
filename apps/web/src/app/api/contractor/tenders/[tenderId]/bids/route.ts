import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ tenderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { tenderId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/tenders/${encodeURIComponent(tenderId)}/bids`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { tenderId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/tenders/${encodeURIComponent(tenderId)}/bids`,
    { method: 'DELETE' },
  );
}
