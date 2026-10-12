import { cookies } from 'next/headers';

export const GUEST_PROJECT_COOKIE = 'ant_guest_project';
/** Mirrors the API's 24-hour lifetime for an unclaimed guest project. */
export const GUEST_PROJECT_TTL_SEC = 24 * 60 * 60;
/** A browser only ever holds a couple of drafts; keep the cookie small. */
const MAX_TRACKED_PROJECTS = 3;

type GuestProjectTokens = Record<string, string>;

/**
 * Map an authenticated project path onto the guest API for the anonymous owner
 * of that project. Returns null when the path is not a per-project route, or is
 * the claim hand-off (which needs a session).
 */
export function guestApiPathForProjectPath(path: string): string | null {
  const match = /^\/v1\/projects\/([^/?#]+)(\/.*)?$/.exec(path);
  if (!match) return null;
  const projectId = decodeURIComponent(match[1] ?? '');
  const rest = match[2] ?? '';
  if (!projectId || rest.startsWith('/claim')) return null;
  return `/v1/guest/projects/${encodeURIComponent(projectId)}${rest}`;
}

export function encodeGuestProjectTokens(tokens: GuestProjectTokens): string {
  return Buffer.from(JSON.stringify(tokens), 'utf8').toString('base64url');
}

export function decodeGuestProjectTokens(
  raw: string | undefined,
): GuestProjectTokens {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'string' &&
        entry[1].length > 0,
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function encode(tokens: GuestProjectTokens): string {
  return encodeGuestProjectTokens(tokens);
}


async function readTokens(): Promise<GuestProjectTokens> {
  try {
    const jar = await cookies();
    return decodeGuestProjectTokens(jar.get(GUEST_PROJECT_COOKIE)?.value);
  } catch {
    // cookies() only works inside a request context.
    return {};
  }
}

/** Guest token for one project, if this browser holds one. */
export async function readGuestProjectToken(
  projectId: string,
): Promise<string | null> {
  const tokens = await readTokens();
  return tokens[projectId] ?? null;
}

/**
 * Remember the token handed out when a guest project was created. It is an
 * httpOnly cookie: the browser never sees the token, and the BFF is the only
 * place that turns it into API authorization.
 */
export async function saveGuestProjectToken(
  projectId: string,
  token: string,
): Promise<void> {
  const tokens = await readTokens();
  const recent = Object.entries(tokens).filter(
    ([id]) => id !== projectId,
  );
  const trimmed = recent.slice(-(MAX_TRACKED_PROJECTS - 1));
  const next: GuestProjectTokens = {
    ...Object.fromEntries(trimmed),
    [projectId]: token,
  };

  const jar = await cookies();
  jar.set(GUEST_PROJECT_COOKIE, encode(next), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_PROJECT_TTL_SEC,
  });
}

/** Drop the token: after a claim, or once the draft expired. */
export async function clearGuestProjectToken(projectId?: string): Promise<void> {
  const jar = await cookies();
  if (!projectId) {
    jar.delete(GUEST_PROJECT_COOKIE);
    return;
  }

  const tokens = await readTokens();
  delete tokens[projectId];
  if (Object.keys(tokens).length === 0) {
    jar.delete(GUEST_PROJECT_COOKIE);
    return;
  }
  jar.set(GUEST_PROJECT_COOKIE, encode(tokens), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_PROJECT_TTL_SEC,
  });
}
