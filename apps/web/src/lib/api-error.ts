/**
 * Error thrown for non-OK API responses. Keeps the machine-readable `code`
 * (and any `requiredRoles`) the API returns alongside the human message, so the
 * UI can react to a specific condition instead of matching message text.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requiredRoles?: string[];

  constructor(
    message: string,
    options: { status: number; code?: string; requiredRoles?: string[] },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.requiredRoles = options.requiredRoles;
  }
}

export function isApiErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
