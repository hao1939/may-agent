/**
 * Integration test: provider-retry wired into master-worker.ts
 * Verifies that transient provider errors (503) trigger retries with backoff.
 */
import { describe, it, expect, vi } from "vitest";
import { withRetry, classifyError, isRetryableError } from "../workflows/provider-retry.ts";

describe("master-worker retry integration", () => {
  it("retries on 503 server error and eventually succeeds", async () => {
    let callCount = 0;
    const mockPrompt = async () => {
      callCount++;
      if (callCount <= 2) {
        const err: any = new Error("Service Unavailable");
        err.status = 503;
        throw err;
      }
      return "Worker completed successfully";
    };

    const result = await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10, // fast for tests
      onRetry: (err, attempt, delay) => {
        // Simulates ctx.log in master-worker
      },
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe("Worker completed successfully");
    expect(result.attempts).toBe(3); // 2 failures + 1 success
  });

  it("retries on 429 rate limit", async () => {
    let callCount = 0;
    const mockPrompt = async () => {
      callCount++;
      if (callCount === 1) {
        const err: any = new Error("Rate limited");
        err.status = 429;
        throw err;
      }
      return "OK";
    };

    const result = await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("does NOT retry on 401 auth error", async () => {
    const mockPrompt = async () => {
      const err: any = new Error("Unauthorized");
      err.status = 401;
      throw err;
    };

    const result = await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // no retries
  });

  it("does NOT retry on 400 bad request", async () => {
    const mockPrompt = async () => {
      const err: any = new Error("Bad Request");
      err.status = 400;
      throw err;
    };

    const result = await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("retries on timeout errors", async () => {
    let callCount = 0;
    const mockPrompt = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Request timeout after 30000ms");
      }
      return "Completed";
    };

    const result = await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("exhausts all retries and returns failure", async () => {
    const mockPrompt = async () => {
      const err: any = new Error("Server Error");
      err.status = 500;
      throw err;
    };

    const result = await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(4); // 1 initial + 3 retries
  });

  it("onRetry callback is called with correct params", async () => {
    const retries: { attempt: number; delay: number }[] = [];
    let callCount = 0;

    const mockPrompt = async () => {
      callCount++;
      if (callCount <= 2) {
        const err: any = new Error("Server Error");
        err.status = 500;
        throw err;
      }
      return "done";
    };

    await withRetry(mockPrompt, {
      maxRetries: 3,
      baseDelayMs: 10,
      onRetry: (err, attempt, delay) => {
        retries.push({ attempt, delay });
      },
    });

    expect(retries).toHaveLength(2);
    expect(retries[0].attempt).toBe(1);
    expect(retries[0].delay).toBeGreaterThanOrEqual(10);
    expect(retries[1].attempt).toBe(2);
    expect(retries[1].delay).toBeGreaterThanOrEqual(20); // exponential backoff
  });
});
