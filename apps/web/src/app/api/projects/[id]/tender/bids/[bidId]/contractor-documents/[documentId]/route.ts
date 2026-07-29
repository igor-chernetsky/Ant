import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string; bidId: string; documentId: string }>;
  },
) {
  const { id, bidId, documentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/contractor-documents/${encodeURIComponent(documentId)}/download-url`,
  );
}
