/**
 * A small in-memory rate limiter.
 *
 * It stops the obvious abuse: a script hammering the sign-in form to guess a code, or the scan
 * route to fill the database. It is deliberately honest about its limits: on a serverless
 * platform each instance keeps its own counters, so the limit is per instance and not global.
 * It raises the cost of an attack rather than making it impossible, and it is not a substitute
 * for authentication.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound on a long-lived instance. */
const MAX_TRACKED_KEYS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      // Drop what has expired before adding, so a cold instance cannot grow forever.
      for (const [candidate, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(candidate);
        }
      }
    }

    buckets.set(key, { count: 1, resetAt: now + windowMs });

    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Best-effort client identity. Behind a proxy the platform sets x-forwarded-for; the leftmost
 * entry is the client. This is only used to key a rate limit, never to make a security
 * decision, because a header can be spoofed when there is no trusted proxy in front.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const address = forwarded?.split(',')[0]?.trim() || 'unknown';

  return `${scope}:${address}`;
}
