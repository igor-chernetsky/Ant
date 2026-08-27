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

export function accountHasRole(
  me: MeResponse | null,
  role: SelfServeAccountRole,
): boolean {
  if (!me) return false;
  if (me.roles?.includes(role)) return true;
  if (role === 'contractor' && me.isContractor) return true;
  if (role === 'designer' && me.isDesigner) return true;
  return false;
}

export function missingSelfServeRoles(
  me: MeResponse | null,
): SelfServeAccountRole[] {
  const all: SelfServeAccountRole[] = ['client', 'contractor', 'designer'];
  return all.filter((role) => !accountHasRole(me, role));
}
