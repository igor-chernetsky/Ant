import { proxyBackendJson } from '@/lib/backend-proxy';

export const dynamic = 'force-dynamic';

/**
 * Records that the client has been taken to their newest project after
 * registering, so the redirect runs once per account.
 */
export async function POST() {
  return proxyBackendJson('/v1/me/workspace-intro', { method: 'POST' });
}
