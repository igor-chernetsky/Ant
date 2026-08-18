import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string; bidId: string; reviewId: string; attachmentId: string }>;
  },
) {
  const { id, bidId, reviewId, attachmentId } = await context.params;
  return proxyBackendJson(
    `/v1/projects/${encodeURIComponent(id)}/tender/bids/${encodeURIComponent(bidId)}/contractor-reviews/${encodeURIComponent(reviewId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
  );
}
