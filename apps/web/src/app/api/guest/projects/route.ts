import { NextResponse } from 'next/server';
import { proxyBackendJson, proxyGuestBackendJson } from '@/lib/backend-proxy';
import { getValidAccessToken } from '@/lib/auth-tokens';
import { saveGuestProjectToken } from '@/lib/guest-project';

export const dynamic = 'force-dynamic';

/**
 * Start a project as an anonymous visitor.
 *
 * The API answers with the project plus the raw guest token. The token is kept
 * in an httpOnly cookie here and never handed to the browser, so only the BFF
 * can turn it into API authorization.
 *
 * With a session, the project is created in the account instead: an anonymous
 * draft for a signed-in visitor would later be claimed by e-mail as a *second*
 * project next to the one the account already has.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const session = await getValidAccessToken();

  if (session.ok) {
    const authenticated = await proxyBackendJson('/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!authenticated.ok) {
      return authenticated;
    }
    const project = await authenticated.json().catch(() => null);
    return NextResponse.json({ project: project ?? null });
  }

  const response = await proxyGuestBackendJson('/v1/guest/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    return response;
  }

  const payload = (await response.json().catch(() => null)) as {
    project?: { id?: string };
    guestToken?: string;
  } | null;

  const projectId = payload?.project?.id;
  if (projectId && payload?.guestToken) {
    await saveGuestProjectToken(projectId, payload.guestToken);
  }

  return NextResponse.json({ project: payload?.project ?? null });
}
