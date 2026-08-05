import { NextRequest } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string; addendumId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, addendumId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/contract/addenda/${encodeURIComponent(addendumId)}/document`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
