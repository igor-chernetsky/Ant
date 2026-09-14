import type { MeResponse } from '@/lib/session';

export type SelfServeAccountRole = 'client' | 'contractor' | 'designer';

export async function addAccountRoles(params: {
  roles: SelfServeAccountRole[];
  acceptedAgreement: boolean;
}): Promise<{ added: string[]; alreadyHad: string[] }> {
  const response = await fetch('/api/auth/add-roles', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    added?: string[];
    alreadyHad?: string[];
  };

  if (!response.ok) {
    throw new Error(data.message || `Failed to add role (${response.status})`);
  }

  return {
    added: data.added ?? [],
    alreadyHad: data.alreadyHad ?? [],
  };
}

/**
 * Role check that mirrors the API guards: only the Keycloak realm role counts.
 * A contractor/designer profile row without the realm role cannot manage or use
 * supply features, so the "become a …" action must stay available for it.
 */
export function accountHasRole(
  me: MeResponse | null,
  role: SelfServeAccountRole,
): boolean {
  return Boolean(me?.roles?.includes(role));
}

export function missingSelfServeRoles(
  me: MeResponse | null,
): SelfServeAccountRole[] {
  const all: SelfServeAccountRole[] = ['client', 'contractor', 'designer'];
  return all.filter((role) => !accountHasRole(me, role));
}
