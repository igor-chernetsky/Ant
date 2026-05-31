import { proxyBackendJson } from '@/lib/backend-proxy';

export async function GET() {
  return proxyBackendJson('/v1/contractor/verification/documents');
}
