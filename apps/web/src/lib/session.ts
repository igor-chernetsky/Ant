export interface MeResponse {
  id: string;
  keycloakSub: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  isContractor?: boolean;
}

/** Only users with the client realm role may create projects. */
export function canCreateProject(me: MeResponse | null): boolean {
  return Boolean(me?.roles?.includes('client'));
}

export function isContractorUser(me: MeResponse | null): boolean {
  return Boolean(me?.isContractor || me?.roles?.includes('contractor'));
}

let clientRefreshFlight: Promise<boolean> | null = null;

export async function refreshSessionTokens(): Promise<boolean> {
  if (clientRefreshFlight) {
    return clientRefreshFlight;
  }

  clientRefreshFlight = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } finally {
      clientRefreshFlight = null;
    }
  })();

  return clientRefreshFlight;
}

/** Refresh cookies before a user action (forms, uploads). */
export async function ensureSessionFresh(): Promise<boolean> {
  return refreshSessionTokens();
}

export async function fetchSessionProfile(): Promise<MeResponse | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await refreshSessionTokens();
    if (!refreshed) {
      return null;
    }
    const retry = await fetch('/api/auth/me', { credentials: 'include' });
    if (retry.status === 401) {
      return null;
    }
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(text || `Session check failed (${retry.status})`);
    }
    return retry.json() as Promise<MeResponse>;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Session check failed (${response.status})`);
  }
  return response.json() as Promise<MeResponse>;
}

export async function loginWithPassword(
  username: string,
  password: string,
): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Sign in failed');
  }
}

export async function signupWithPassword(input: {
  email: string;
  password: string;
  displayName?: string;
  roles: string[];
}): Promise<void> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? 'Sign up failed');
  }
}

export async function logoutSession(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
