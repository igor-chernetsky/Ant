import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { requestId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/admin/signature-requests/${encodeURIComponent(requestId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
