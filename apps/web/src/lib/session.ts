export interface MeResponse {
  id: string;
  keycloakSub: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

export async function fetchSessionProfile(): Promise<MeResponse | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (response.status === 401) {
    return null;
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

export async function logoutSession(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
