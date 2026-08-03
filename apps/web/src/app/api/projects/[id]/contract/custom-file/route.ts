import { NextRequest } from 'next/server';
import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/contract/custom-file`,
  );
}
