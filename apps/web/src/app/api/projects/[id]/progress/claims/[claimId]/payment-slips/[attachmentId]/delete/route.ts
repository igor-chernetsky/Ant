import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ id: string; claimId: string; attachmentId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id, claimId, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/progress/claims/${encodeURIComponent(claimId)}/payment-slips/${encodeURIComponent(attachmentId)}/delete`,
    { method: 'POST' },
  );
}
