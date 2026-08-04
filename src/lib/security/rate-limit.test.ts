import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRateLimiter,
  rateLimitIdentity,
  resetRateLimiters,
} from "./rate-limit";

afterEach(() => {
  resetRateLimiters();
  vi.useRealTimers();
});

describe("rate limiter", () => {
  it("allows requests up to the limit and blocks beyond it", () => {
    const limiter = getRateLimiter({ name: "t1", max: 3, windowMs: 60_000 });

    expect(limiter.check("user:a").allowed).toBe(true);
    expect(limiter.check("user:a").allowed).toBe(true);
    expect(limiter.check("user:a").allowed).toBe(true);
    expect(limiter.check("user:a").allowed).toBe(false);
  });

  it("reports remaining capacity", () => {
    const limiter = getRateLimiter({ name: "t2", max: 3, windowMs: 60_000 });

    expect(limiter.check("user:a").remaining).toBe(2);
    expect(limiter.check("user:a").remaining).toBe(1);
    expect(limiter.check("user:a").remaining).toBe(0);
  });

  it("supplies a positive retry delay when blocked", () => {
    // A zero would tell the client to retry instantly and hammer us.
    const limiter = getRateLimiter({ name: "t3", max: 1, windowMs: 60_000 });
    limiter.check("user:a");

    const blocked = limiter.check("user:a");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("tracks identities independently", () => {
    // One heavy user must not lock everyone else out.
    const limiter = getRateLimiter({ name: "t4", max: 1, windowMs: 60_000 });

    expect(limiter.check("user:a").allowed).toBe(true);
    expect(limiter.check("user:a").allowed).toBe(false);
    expect(limiter.check("user:b").allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const limiter = getRateLimiter({ name: "t5", max: 1, windowMs: 1_000 });

    expect(limiter.check("user:a").allowed).toBe(true);
    expect(limiter.check("user:a").allowed).toBe(false);

    vi.advanceTimersByTime(1_100);

    expect(limiter.check("user:a").allowed).toBe(true);
  });
});

describe("rateLimitIdentity", () => {
  it("prefers the authenticated user id", () => {
    // A user id cannot be spoofed by a header, so it is the stronger key.
    const identity = rateLimitIdentity({
      userId: "user-123",
      headers: new Headers({ "x-forwarded-for": "1.2.3.4" }),
    });

    expect(identity).toBe("user:user-123");
  });

  it("falls back to the first forwarded address for anonymous traffic", () => {
    const identity = rateLimitIdentity({
      headers: new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
    });

    expect(identity).toBe("ip:1.2.3.4");
  });

  it("produces a stable key when no address is available", () => {
    const identity = rateLimitIdentity({ headers: new Headers() });

    expect(identity).toBe("ip:unknown");
  });
});
