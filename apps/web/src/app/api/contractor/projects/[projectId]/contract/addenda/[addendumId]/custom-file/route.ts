import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ projectId: string; addendumId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId, addendumId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(projectId)}/contract/addenda/${encodeURIComponent(addendumId)}/custom-file`,
  );
}
