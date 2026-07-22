import { NextRequest } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const body = await request.json();
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/contract/document`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}
