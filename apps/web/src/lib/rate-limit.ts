type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Simple in-memory sliding-window rate limiter for BFF routes.
 * Suitable for single-instance / best-effort protection.
 */
export function createMemoryRateLimiter(options: {
  windowMs: number;
  max: number;
}) {
  const hits = new Map<string, RateLimitEntry>();

  function prune(now: number) {
    if (hits.size < 2_000) {
      return;
    }
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      prune(now);
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + options.windowMs });
        return { ok: true };
      }
      if (entry.count >= options.max) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
        };
      }
      entry.count += 1;
      return { ok: true };
    },
  };
}
