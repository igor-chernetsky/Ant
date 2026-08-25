import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  return proxyBackendJson(`/v1/admin/clients${qs ? `?${qs}` : ''}`);
}
