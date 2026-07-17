import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/contract`,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const body = await request.text();
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/contract/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
}
