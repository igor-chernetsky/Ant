import { createMemoryRateLimiter } from '@/lib/rate-limit';

/** One verification email per minute… */
const COOLDOWN_WINDOW_MS = 60 * 1000;
/** …and at most five per hour, per address + client IP. */
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const HOURLY_MAX = 5;

const cooldownLimiter = createMemoryRateLimiter({
  windowMs: COOLDOWN_WINDOW_MS,
  max: 1,
});
const hourlyLimiter = createMemoryRateLimiter({
  windowMs: HOURLY_WINDOW_MS,
  max: HOURLY_MAX,
});

export type ResendVerificationLimitResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'verification_resend_too_soon'
        | 'verification_resend_rate_limited';
      retryAfterSec: number;
    };

/**
 * Throttle for "send the verification email again".
 *
 * The cooldown is checked first and returns before the hourly counter is
 * touched, so a user clicking the button again is told to wait instead of
 * burning the hourly budget. In-memory: per serverless instance, best effort,
 * like the other BFF limiters.
 */
export function checkResendVerificationAllowed(
  key: string,
): ResendVerificationLimitResult {
  const cooldown = cooldownLimiter.check(key);
  if (!cooldown.ok) {
    return {
      ok: false,
      code: 'verification_resend_too_soon',
      retryAfterSec: cooldown.retryAfterSec,
    };
  }

  const hourly = hourlyLimiter.check(key);
  if (!hourly.ok) {
    return {
      ok: false,
      code: 'verification_resend_rate_limited',
      retryAfterSec: hourly.retryAfterSec,
    };
  }

  return { ok: true };
}
