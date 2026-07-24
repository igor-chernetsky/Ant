import { proxyBackendJson } from '@/lib/backend-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyBackendJson('/v1/me/notifications');
}
