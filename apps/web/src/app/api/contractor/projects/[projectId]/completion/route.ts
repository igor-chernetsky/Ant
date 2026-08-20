import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/completion`,
  );
}
