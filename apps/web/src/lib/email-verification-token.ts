import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface EmailVerificationPayload {
  userId: string;
  email: string;
  exp: number;
}

function getVerificationSecret(): string | null {
  const secret = process.env.EMAIL_VERIFICATION_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createEmailVerificationToken(
  userId: string,
  email: string,
): string | null {
  const secret = getVerificationSecret();
  if (!secret) return null;

  const payload: EmailVerificationPayload = {
    userId,
    email: email.trim().toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signBody(body, secret);
  return `${body}.${signature}`;
}

export function parseEmailVerificationToken(
  token: string,
): EmailVerificationPayload | 'invalid' | 'expired' {
  const secret = getVerificationSecret();
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
    ) as EmailVerificationPayload;
    if (!payload.userId || !payload.email || !payload.exp) return 'invalid';
    if (Date.now() > payload.exp) return 'expired';
    return payload;
  } catch {
    return 'invalid';
  }
}

export function isAppEmailVerificationConfigured(): boolean {
  return (
    getVerificationSecret() != null &&
    Boolean(process.env.SMTP_HOST?.trim()) &&
    Boolean(process.env.SMTP_USER?.trim()) &&
    Boolean(process.env.SMTP_PASSWORD?.trim()) &&
    Boolean(process.env.SMTP_FROM?.trim())
  );
}
