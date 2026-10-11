import { isWrongPasswordError } from '@/lib/auth-tokens';

export interface LoginErrorDiagnosis {
  code: string;
  detail: string;
}

export interface LoginErrorPayload {
  message: string;
  code: string;
}

/**
 * Decide what a failed password grant tells the user.
 *
 * Only the email-verification state and infrastructure faults are surfaced;
 * every other account state collapses into the generic "invalid credentials"
 * so the login form cannot be used to enumerate accounts. The diagnosis comes
 * from the Keycloak Admin API, so it is only fetched when the failure could
 * actually be an account-state problem (see `shouldDiagnoseLoginFailure`).
 */
export function authErrorPayload(
  result: { error: string; description?: string },
  diagnosis?: LoginErrorDiagnosis | null,
): LoginErrorPayload {
  if (diagnosis?.code === 'email_not_verified') {
    return {
      message:
        'Verify your email before signing in. Check your inbox for the confirmation link.',
      code: 'email_not_verified',
    };
  }

  if (isWrongPasswordError(result) || diagnosis) {
    return {
      message: 'Invalid username or password',
      code: 'invalid_credentials',
    };
  }

  if (result.error === 'bff_not_configured') {
    return {
      message: 'Authentication service is not configured',
      code: result.error,
    };
  }

  if (result.error === 'unauthorized_client' || result.error === 'invalid_client') {
    return {
      message: 'Authentication service misconfigured',
      code: result.error,
    };
  }

  return {
    message: 'Invalid username or password',
    code: 'invalid_credentials',
  };
}
