/**
 * Best-effort client IP for BFF rate limiting.
 *
 * On Vercel the left-most `x-forwarded-for` entry is the caller; the header is
 * spoofable in general, so it is only a rate-limit key, never an auth decision.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
