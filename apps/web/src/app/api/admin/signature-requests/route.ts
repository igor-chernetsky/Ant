import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return proxyBackendJson(`/v1/admin/signature-requests${qs}`);
}
