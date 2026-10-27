import { getBackendApiUrl } from '@/lib/auth-server';

/**
 * Where a freshly signed-in client should land.
 *
 * The first visit after registering opens the newest project — usually the guest
 * draft that the sign-in just claimed by e-mail. It runs **inside the login
 * request**, and marks the intro before answering, so the redirect happens once
 * per account. (The old version asked the browser to mark it after navigating,
 * which repeated on every visit and made the home page unreachable.)
 *
 * Returns `null` when no redirect is due: not a client, no projects, already
 * introduced, or the API could not answer.
 */
export async function resolveWorkspaceIntroRedirect(
  accessToken: string,
): Promise<string | null> {
  const base = getBackendApiUrl();
  const auth = { Authorization: `Bearer ${accessToken}` };

  try {
    const meResponse = await fetch(`${base}/v1/me`, {
      headers: auth,
      cache: 'no-store',
    });
    if (!meResponse.ok) {
      return null;
    }
    const me = (await meResponse.json().catch(() => null)) as {
      workspaceIntroAt?: string | null;
      roles?: string[];
    } | null;
    if (!me || me.workspaceIntroAt != null) {
      return null;
    }
    if (!Array.isArray(me.roles) || !me.roles.includes('client')) {
      return null;
    }

    // This call also claims the drafts tagged with the account's address, so the
    // newest entry is the project the visitor just finished as a guest.
    const listResponse = await fetch(`${base}/v1/projects`, {
      headers: auth,
      cache: 'no-store',
    });
    if (!listResponse.ok) {
      return null;
    }
    const projects = (await listResponse.json().catch(() => null)) as Array<{
      id?: string;
    }> | null;
    const newest = Array.isArray(projects) ? projects[0] : undefined;
    if (!newest?.id) {
      return null;
    }

    const markResponse = await fetch(`${base}/v1/me/workspace-intro`, {
      method: 'POST',
      headers: auth,
      cache: 'no-store',
    });
    if (!markResponse.ok) {
      // Without the marker the redirect would repeat on every visit — do not do it.
      return null;
    }

    return `/projects/${encodeURIComponent(newest.id)}`;
  } catch {
    return null;
  }
}
