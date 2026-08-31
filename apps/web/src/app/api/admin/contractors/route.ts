import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const includeNoProfile = url.searchParams.get('includeNoProfile');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (includeNoProfile) params.set('includeNoProfile', includeNoProfile);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return proxyBackendJson(`/v1/admin/contractors${qs}`);
}
