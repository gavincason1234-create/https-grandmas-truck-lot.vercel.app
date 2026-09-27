/**
 * Small in-process rate limiter. On serverless each instance has its own bucket,
 * so this is a speed bump against accidental floods and simple abuse, not a wall.
 */
type Bucket = { tokens: number; updated: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export function rateLimit(key: string, opts: { limit: number; windowMs: number }): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const refillPerMs = opts.limit / opts.windowMs;
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    b = { tokens: opts.limit, updated: now };
    buckets.set(key, b);
  }
  b.tokens = Math.min(opts.limit, b.tokens + (now - b.updated) * refillPerMs);
  b.updated = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, retryAfterSec: 0 };
  }
  return { ok: false, retryAfterSec: Math.ceil((1 - b.tokens) / refillPerMs / 1000) };
}

export function _resetRateLimits(): void {
  buckets.clear();
}
