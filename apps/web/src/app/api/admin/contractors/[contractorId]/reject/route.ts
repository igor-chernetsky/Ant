import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ contractorId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { contractorId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/admin/contractors/${encodeURIComponent(contractorId)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
