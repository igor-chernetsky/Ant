import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { projectId } = await params;
  return proxyBackendJson(
    `/v1/contractor/projects/${encodeURIComponent(projectId)}/clarification-attachments`,
    { method: 'GET' },
  );
}
