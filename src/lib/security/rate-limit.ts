import "server-only";

/**
 * Rate limiting.
 *
 * Deliberately an abstraction over an in-memory store, not a distributed
 * limiter. On a single instance this genuinely limits abuse; across several
 * serverless instances each keeps its own window, so the effective limit is
 * per instance.
 *
 * That limitation is documented rather than hidden, and the interface is shaped
 * so a Redis or Upstash backend can be dropped in without touching call sites.
 * Do not describe this as a production-grade global limiter until that happens.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in the current window. */
  remaining: number;
  /** Seconds until the window resets. Only meaningful when blocked. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(identity: string): RateLimitResult;
}

interface Window {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  check(identity: string): RateLimitResult {
    const now = Date.now();
    const existing = this.windows.get(identity);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(identity, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return {
        allowed: true,
        remaining: this.max - 1,
        retryAfterSeconds: 0,
      };
    }

    if (existing.count >= this.max) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt - now) / 1000),
        ),
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      remaining: this.max - existing.count,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Drop expired windows so the map cannot grow without bound.
   *
   * Runs opportunistically on new windows rather than on a timer, which keeps
   * this safe in a serverless runtime where timers may never fire.
   */
  private sweep(now: number): void {
    if (this.windows.size < 1_000) {
      return;
    }

    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}

const limiters = new Map<string, RateLimiter>();

export function getRateLimiter(options: {
  name: string;
  max: number;
  windowMs: number;
}): RateLimiter {
  const key = `${options.name}:${options.max}:${options.windowMs}`;
  let limiter = limiters.get(key);

  if (!limiter) {
    limiter = new InMemoryRateLimiter(options.max, options.windowMs);
    limiters.set(key, limiter);
  }

  return limiter;
}

/**
 * Identity for rate limiting.
 *
 * Prefers the authenticated user id, which cannot be spoofed. Falls back to a
 * proxy-supplied client address for anonymous traffic; that header is
 * client-controllable in principle, so it is a mitigation rather than a
 * guarantee, and only the first hop is used.
 */
export function rateLimitIdentity(input: {
  userId?: string;
  headers: Headers;
}): string {
  if (input.userId) {
    return `user:${input.userId}`;
  }

  const forwarded = input.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim();

  return `ip:${address ?? "unknown"}`;
}

/** Test-only: clear limiter state between cases. */
export function resetRateLimiters(): void {
  limiters.clear();
}
