import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; defectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id, defectId } = await context.params;
  const body = await request.json().catch(() => ({}));
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/defects/${encodeURIComponent(defectId)}/decline`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}
