export interface MeResponse {
  id: string;
  keycloakSub: string;
  email: string | null;
  displayName: string | null;
  companyName?: string | null;
  roles: string[];
  isContractor?: boolean;
  preferredLocale?: string;
}

/** Only users with the client realm role may create projects. */
export function canCreateProject(me: MeResponse | null): boolean {
  return Boolean(me?.roles?.includes('client'));
}

export function isContractorUser(me: MeResponse | null): boolean {
  return Boolean(me?.isContractor || me?.roles?.includes('contractor'));
}

/** Profile name shown in account and header — company name for contractors. */
export function accountProfileName(me: MeResponse): string | null {
  if (isContractorUser(me)) {
    const company = me.companyName?.trim();
    if (company) return company;
  }
  const name = me.displayName?.trim();
  return name || null;
}

export function accountProfileLabel(me: MeResponse): string {
  return isContractorUser(me) ? 'Company name' : 'Name';
}

/** Label in the site header — same full name as on the account page. */
export function headerUserLabel(
  me: MeResponse,
  signedInFallback = 'Signed in',
): string {
  return accountProfileName(me) ?? me.email ?? signedInFallback;
}

let clientRefreshFlight: Promise<boolean> | null = null;
let lastProactiveRefreshAt = 0;

/** Minimum gap between background refresh calls (focus / interval). */
export const PROACTIVE_REFRESH_MIN_INTERVAL_MS = 3 * 60 * 1000;

/** Background refresh while the tab stays open. */
export const PROACTIVE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callRefreshEndpoint(): Promise<boolean> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  return response.ok;
}

export async function refreshSessionTokens(options?: {
  force?: boolean;
}): Promise<boolean> {
  const force = options?.force ?? false;
  if (
    !force &&
    lastProactiveRefreshAt > 0 &&
    Date.now() - lastProactiveRefreshAt < PROACTIVE_REFRESH_MIN_INTERVAL_MS
  ) {
    return true;
  }

  if (clientRefreshFlight) {
    return clientRefreshFlight;
  }

  clientRefreshFlight = (async () => {
    try {
      if (await callRefreshEndpoint()) {
        lastProactiveRefreshAt = Date.now();
        return true;
      }
      // Another tab/request may have rotated the refresh token first.
      await sleep(400);
      const retryOk = await callRefreshEndpoint();
      if (retryOk) {
        lastProactiveRefreshAt = Date.now();
      }
      return retryOk;
    } finally {
      clientRefreshFlight = null;
    }
  })();

  return clientRefreshFlight;
}

/** Refresh cookies before a user action (forms, uploads). */
export async function ensureSessionFresh(): Promise<boolean> {
  return refreshSessionTokens({ force: true });
}

export async function fetchSessionProfile(): Promise<MeResponse | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await refreshSessionTokens({ force: true });
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
      detail?: string;
      code?: string;
    } | null;
    const hint = body?.detail ? ` (${body.detail})` : '';
    throw new Error((body?.message ?? 'Sign in failed') + hint);
  }
}

export interface SignupResult {
  verifyEmail: boolean;
  message?: string;
}

export async function signupWithPassword(input: {
  email: string;
  password: string;
  displayName?: string;
  roles: string[];
}): Promise<SignupResult> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => null)) as {
    signedIn?: boolean;
    verifyEmail?: boolean;
    message?: string;
    detail?: string;
    code?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.message ?? 'Sign up failed');
  }

  if (body?.verifyEmail) {
    return {
      verifyEmail: true,
      message: body.message,
    };
  }

  if (body?.signedIn === false) {
    const hint = body.detail ? ` (${body.detail})` : '';
    throw new Error(
      (body.message ??
        'Account created, but sign-in failed. Try signing in manually.') + hint,
    );
  }

  return { verifyEmail: false };
}

export async function logoutSession(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
