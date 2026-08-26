import { createHmac, timingSafeEqual } from 'crypto';
import type { ConfigService } from '@nestjs/config';

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export type EmailUnsubscribePurpose = 'matching_projects';

export interface EmailUnsubscribePayload {
  purpose: EmailUnsubscribePurpose;
  userId: string;
  exp: number;
}

function getUnsubscribeSecret(config: ConfigService): string | null {
  const explicit = config.get<string>('EMAIL_UNSUBSCRIBE_SECRET')?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  const smtpPass = config.get<string>('SMTP_PASSWORD')?.trim();
  if (smtpPass && smtpPass.length >= 16) return `unsub:${smtpPass}`;
  return null;
}

function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createEmailUnsubscribeToken(
  config: ConfigService,
  userId: string,
  purpose: EmailUnsubscribePurpose = 'matching_projects',
): string | null {
  const secret = getUnsubscribeSecret(config);
  if (!secret) return null;

  const payload: EmailUnsubscribePayload = {
    purpose,
    userId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signBody(body, secret)}`;
}

export function parseEmailUnsubscribeToken(
  config: ConfigService,
  token: string,
): EmailUnsubscribePayload | 'invalid' | 'expired' {
  const secret = getUnsubscribeSecret(config);
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
    ) as EmailUnsubscribePayload;
    if (
      payload.purpose !== 'matching_projects' ||
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.exp !== 'number'
    ) {
      return 'invalid';
    }
    if (payload.exp < Date.now()) return 'expired';
    return payload;
  } catch {
    return 'invalid';
  }
}

export function buildListUnsubscribeHeaders(params: {
  httpsUnsubscribeUrl: string;
  mailtoAddress: string;
}): Record<string, string> {
  return {
    'List-Unsubscribe': `<${params.httpsUnsubscribeUrl}>, <mailto:${params.mailtoAddress}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
