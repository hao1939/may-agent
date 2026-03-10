import { describe, it, expect } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  it("should allow requests under the limit", () => {
    const limiter = new RateLimiter(3, 1000);
    limiter.register("client-1");

    expect(limiter.allow("client-1", 100)).toBe(true);
    expect(limiter.allow("client-1", 200)).toBe(true);
    expect(limiter.allow("client-1", 300)).toBe(true);
  });

  it("should deny requests at the limit", () => {
    const limiter = new RateLimiter(3, 1000);
    limiter.register("client-1");

    // Use up all 3 allowed requests
    limiter.allow("client-1", 100);
    limiter.allow("client-1", 200);
    limiter.allow("client-1", 300);

    // 4th request should be denied — we're at the limit
    expect(limiter.allow("client-1", 400)).toBe(false);
  });

  it("should allow requests after window expires", () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.register("client-1");

    limiter.allow("client-1", 100);
    limiter.allow("client-1", 200);

    // At limit — should be denied
    expect(limiter.allow("client-1", 300)).toBe(false);

    // After window expires, should be allowed again
    expect(limiter.allow("client-1", 1200)).toBe(true);
  });

  it("should track remaining correctly", () => {
    const limiter = new RateLimiter(5, 1000);
    limiter.register("client-1");

    expect(limiter.remaining("client-1", 100)).toBe(5);
    limiter.allow("client-1", 100);
    expect(limiter.remaining("client-1", 100)).toBe(4);
  });

  it("should auto-register unknown clients", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.allow("unknown", 100)).toBe(true);
    expect(limiter.size).toBe(1);
  });

  it("should support custom per-client limits", () => {
    const limiter = new RateLimiter(10, 1000);
    limiter.register("vip", 100);
    limiter.register("basic", 2);

    limiter.allow("basic", 100);
    limiter.allow("basic", 200);
    // Basic at limit — should be denied
    expect(limiter.allow("basic", 300)).toBe(false);

    // VIP has plenty of room
    expect(limiter.allow("vip", 100)).toBe(true);
    expect(limiter.remaining("vip", 100)).toBe(99);
  });

  it("should reset a client window", () => {
    const limiter = new RateLimiter(2, 1000);
    limiter.register("client-1");

    limiter.allow("client-1", 100);
    limiter.allow("client-1", 200);
    expect(limiter.allow("client-1", 300)).toBe(false);

    limiter.reset("client-1");
    expect(limiter.allow("client-1", 300)).toBe(true);
    expect(limiter.remaining("client-1", 300)).toBe(1);
  });
});
