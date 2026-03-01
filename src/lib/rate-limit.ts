/**
 * Simple in-memory rate limiter for API routes.
 * Limits requests per user (by identifier) within a rolling time window.
 *
 * Note: This is process-local and resets on restart. For multi-instance
 * deployments, consider a Redis-backed solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  // Periodically clean up expired entries (every 60s)
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000).unref?.();

  return {
    /**
     * Check if the identifier is within the rate limit.
     * Returns `{ allowed: true, remaining }` or `{ allowed: false, retryAfterSeconds }`.
     */
    check(identifier: string): {
      allowed: boolean;
      remaining: number;
      retryAfterSeconds: number;
    } {
      const now = Date.now();
      const entry = store.get(identifier);

      if (!entry || now > entry.resetAt) {
        store.set(identifier, {
          count: 1,
          resetAt: now + options.windowSeconds * 1000,
        });
        return { allowed: true, remaining: options.maxRequests - 1, retryAfterSeconds: 0 };
      }

      if (entry.count < options.maxRequests) {
        entry.count++;
        return {
          allowed: true,
          remaining: options.maxRequests - entry.count,
          retryAfterSeconds: 0,
        };
      }

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
      };
    },
  };
}
