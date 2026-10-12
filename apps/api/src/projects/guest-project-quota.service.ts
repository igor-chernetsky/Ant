import { Injectable } from '@nestjs/common';
import { GUEST_PROJECTS_PER_IP_PER_DAY } from './guest-project.util';

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type GuestQuotaResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Best-effort cap on how many anonymous projects one client IP may start per
 * day. In-memory and therefore per API instance: it exists to stop trivial
 * abuse of the guest path (OpenAI spend, S3 uploads), not as a payment-grade
 * control. The BFF keeps its own limiter on the real client IP as well.
 */
@Injectable()
export class GuestProjectQuotaService {
  private readonly hits = new Map<string, number[]>();

  consume(ip: string, now: number = Date.now()): GuestQuotaResult {
    const key = ip.trim() || 'unknown';
    const recent = (this.hits.get(key) ?? []).filter(
      (at) => now - at < WINDOW_MS,
    );

    if (recent.length >= GUEST_PROJECTS_PER_IP_PER_DAY) {
      const oldest = recent[0] ?? now;
      this.hits.set(key, recent);
      return {
        ok: false,
        retryAfterSec: Math.max(
          1,
          Math.ceil((oldest + WINDOW_MS - now) / 1000),
        ),
      };
    }

    recent.push(now);
    this.hits.set(key, recent);
    this.prune(now);
    return { ok: true };
  }

  private prune(now: number): void {
    if (this.hits.size < 5_000) {
      return;
    }
    for (const [key, times] of this.hits) {
      const recent = times.filter((at) => now - at < WINDOW_MS);
      if (recent.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, recent);
      }
    }
  }
}
