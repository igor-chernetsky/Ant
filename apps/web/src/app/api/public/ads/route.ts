import { proxyOptionalBackendJson } from '@/lib/backend-proxy';

export async function GET() {
  return proxyOptionalBackendJson('/v1/public/ads');
}
