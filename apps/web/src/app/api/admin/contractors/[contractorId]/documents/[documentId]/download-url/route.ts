import { proxyBackendJson } from '@/lib/backend-proxy';

type RouteContext = {
  params: Promise<{ contractorId: string; documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { contractorId, documentId } = await context.params;
  return proxyBackendJson(
    `/v1/admin/contractors/${encodeURIComponent(contractorId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
}
