import { NextRequest } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ projectId: string; addendumId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { projectId, addendumId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(projectId)}/contract/addenda/${encodeURIComponent(addendumId)}/document`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
