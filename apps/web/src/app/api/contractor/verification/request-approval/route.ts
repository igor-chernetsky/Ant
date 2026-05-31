import { proxyBackendJson } from '@/lib/backend-proxy';

export async function POST() {
  return proxyBackendJson('/v1/contractor/verification/request-approval', {
    method: 'POST',
  });
}
