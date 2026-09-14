import { NextResponse } from 'next/server';
import { deleteKeycloakUser } from '@/lib/auth-keycloak-admin';
import { proxyBackend } from '@/lib/backend-proxy';

/**
 * Soft-delete an account through the API and then remove its Keycloak identity.
 *
 * The platform update runs first: it hides the user from the admin lists and
 * makes any still-valid token unusable, so a Keycloak outage cannot leave a
 * working account behind. The Keycloak cleanup is idempotent — an account that
 * was already removed is treated as success, which is the case when someone was
 * deleted in the Keycloak console by hand.
 */
export async function softDeleteUserViaBackend(
  path: string,
): Promise<NextResponse> {
  const { response } = await proxyBackend(path, { method: 'DELETE' });

  const payload = (await response.json().catch(() => null)) as {
    keycloakSub?: string;
    deletedAt?: string;
    message?: string;
  } | null;

  if (!response.ok) {
    return NextResponse.json(
      { message: payload?.message ?? 'Failed to delete the account' },
      { status: response.status },
    );
  }

  const keycloakSub =
    typeof payload?.keycloakSub === 'string' ? payload.keycloakSub : '';
  const keycloak = keycloakSub
    ? await deleteKeycloakUser({ keycloakUserId: keycloakSub })
    : {
        ok: false as const,
        status: 502,
        message: 'Keycloak identity is unknown',
      };

  return NextResponse.json({
    ok: true,
    deletedAt: payload?.deletedAt ?? null,
    keycloakRemoved: keycloak.ok,
    keycloakMessage: keycloak.ok ? null : keycloak.message,
  });
}
