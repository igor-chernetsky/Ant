import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Anonymous guest projects live for a day: long enough to fill the intake in,
 * short enough that abandoned drafts and their S3 objects do not accumulate.
 */
export const GUEST_PROJECT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How many AI-authored intake questions a guest project may ask before the
 * deterministic fallback question set takes over. Keeps an anonymous visitor
 * from turning the OpenAI budget into a free chatbot.
 */
export const GUEST_AI_QUESTION_LIMIT = 8;

/** New projects one client IP may start per day. */
export const GUEST_PROJECTS_PER_IP_PER_DAY = 3;

/** Bearer token handed to the guest; only its hash is stored. */
export function createGuestProjectToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashGuestProjectToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

/** Constant-time comparison of two hex hashes. */
export function guestTokenHashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function guestProjectExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + GUEST_PROJECT_TTL_MS);
}

export function isGuestProjectExpired(
  guestExpiresAt: Date | null,
  now: Date = new Date(),
): boolean {
  return guestExpiresAt == null || guestExpiresAt.getTime() <= now.getTime();
}
