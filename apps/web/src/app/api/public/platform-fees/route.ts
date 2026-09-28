import { proxyBackendJson } from '@/lib/backend-proxy';

/** Fee configuration for the contractor pre-signing notice. */
export async function GET() {
  return proxyBackendJson('/v1/public/platform-fees');
}
