import { refreshSessionTokens } from './session';

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  return error instanceof SessionExpiredError;
}

let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

function notifySessionExpired(): void {
  sessionExpiredHandler?.();
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const requestInit: RequestInit = {
    ...init,
    credentials: 'include',
  };

  let response = await fetch(input, requestInit);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSessionTokens();
  if (refreshed) {
    response = await fetch(input, requestInit);
    if (response.status !== 401) {
      return response;
    }
  }

  notifySessionExpired();
  throw new SessionExpiredError();
}
