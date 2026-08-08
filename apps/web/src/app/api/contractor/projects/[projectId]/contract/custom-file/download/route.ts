import { NextRequest } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/contract/custom-file/download`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
