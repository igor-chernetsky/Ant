import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ tenderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { tenderId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/tenders/${encodeURIComponent(tenderId)}/invitations/respond`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
