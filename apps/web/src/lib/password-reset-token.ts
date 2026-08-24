import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export interface PasswordResetPayload {
  purpose: 'password-reset';
  userId: string;
  email: string;
  exp: number;
}

function getResetSecret(): string | null {
  const secret =
    process.env.EMAIL_VERIFICATION_SECRET?.trim() ||
    process.env.PASSWORD_RESET_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createPasswordResetToken(
  userId: string,
  email: string,
): string | null {
  const secret = getResetSecret();
  if (!secret) return null;

  const payload: PasswordResetPayload = {
    purpose: 'password-reset',
    userId,
    email: email.trim().toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signBody(body, secret);
  return `${body}.${signature}`;
}

export function parsePasswordResetToken(
  token: string,
): PasswordResetPayload | 'invalid' | 'expired' {
  const secret = getResetSecret();
  if (!secret) return 'invalid';

  const parts = token.split('.');
  if (parts.length !== 2) return 'invalid';

  const [body, signature] = parts;
  if (!body || !signature) return 'invalid';

  const expected = signBody(body, secret);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return 'invalid';
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as PasswordResetPayload;
    if (
      payload.purpose !== 'password-reset' ||
      !payload.userId ||
      !payload.email ||
      !payload.exp
    ) {
      return 'invalid';
    }
    if (Date.now() > payload.exp) return 'expired';
    return payload;
  } catch {
    return 'invalid';
  }
}

export function isAppPasswordResetConfigured(): boolean {
  return (
    getResetSecret() != null &&
    Boolean(process.env.SMTP_HOST?.trim()) &&
    Boolean(process.env.SMTP_USER?.trim()) &&
    Boolean(process.env.SMTP_PASSWORD?.trim()) &&
    Boolean(process.env.SMTP_FROM?.trim())
  );
}
