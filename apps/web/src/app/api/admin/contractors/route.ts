import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return proxyBackendJson(`/v1/admin/contractors${qs}`);
}
