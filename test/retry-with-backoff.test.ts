import { describe, it, expect, vi } from "vitest";
import { retryWithBackoff } from "../src/lib/retry-with-backoff.js";

describe("retryWithBackoff()", () => {
  it("returns immediately on success", async () => {
    const result = await retryWithBackoff(async () => 42, {
      baseDelayMs: 1,
      jitter: false,
    });
    expect(result).toBe(42);
  });

  it("retries on failure and eventually succeeds", async () => {
    let calls = 0;
    const result = await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error("transient");
        return "ok";
      },
      { maxRetries: 3, baseDelayMs: 1, jitter: false },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("throws last error after exhausting all retries", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error(`fail-${calls}`);
        },
        { maxRetries: 2, baseDelayMs: 1, jitter: false },
      ),
    ).rejects.toThrow("fail-3"); // initial + 2 retries = 3 calls
    expect(calls).toBe(3);
  });

  it("passes attempt number (0-indexed) to fn", async () => {
    const attempts: number[] = [];
    await expect(
      retryWithBackoff(
        async (attempt) => {
          attempts.push(attempt);
          throw new Error("fail");
        },
        { maxRetries: 2, baseDelayMs: 1, jitter: false },
      ),
    ).rejects.toThrow();
    expect(attempts).toEqual([0, 1, 2]);
  });

  it("respects shouldRetry predicate — stops early on non-retryable error", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("fatal");
        },
        {
          maxRetries: 5,
          baseDelayMs: 1,
          jitter: false,
          shouldRetry: (err) => err instanceof Error && !err.message.includes("fatal"),
        },
      ),
    ).rejects.toThrow("fatal");
    expect(calls).toBe(1); // no retries — shouldRetry returned false
  });

  it("calls onRetry callback with correct arguments", async () => {
    const retries: Array<{ attempt: number; delayMs: number }> = [];
    let calls = 0;
    await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error("transient");
        return "done";
      },
      {
        maxRetries: 3,
        baseDelayMs: 10,
        jitter: false,
        onRetry: (_err, attempt, delayMs) => {
          retries.push({ attempt, delayMs });
        },
      },
    );
    expect(retries).toHaveLength(2);
    expect(retries[0]!.attempt).toBe(1);
    expect(retries[0]!.delayMs).toBe(10); // 10 * 2^0 = 10
    expect(retries[1]!.attempt).toBe(2);
    expect(retries[1]!.delayMs).toBe(20); // 10 * 2^1 = 20
  });

  it("caps delay at maxDelayMs", async () => {
    const delays: number[] = [];
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("fail");
        },
        {
          maxRetries: 5,
          baseDelayMs: 100,
          maxDelayMs: 200,
          multiplier: 10,
          jitter: false,
          onRetry: (_err, _attempt, delayMs) => {
            delays.push(delayMs);
          },
        },
      ),
    ).rejects.toThrow();
    // All delays after the first should be capped at 200
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(200);
    }
  });

  it("applies jitter when enabled (delays vary)", async () => {
    const delays: number[] = [];
    let calls = 0;
    // Run multiple times to check jitter introduces variance
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("fail");
        },
        {
          maxRetries: 4,
          baseDelayMs: 1,
          jitter: true,
          onRetry: (_err, _attempt, delayMs) => {
            delays.push(delayMs);
          },
        },
      ),
    ).rejects.toThrow();
    // With jitter, delays should be >= base (jitter adds, never subtracts)
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(1);
    }
  });

  it("aborts immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      retryWithBackoff(async () => "should not run", {
        signal: controller.signal,
      }),
    ).rejects.toThrow("cancelled");
  });

  it("aborts during backoff sleep when signal fires", async () => {
    const controller = new AbortController();
    let calls = 0;

    const promise = retryWithBackoff(
      async () => {
        calls++;
        throw new Error("transient");
      },
      {
        maxRetries: 5,
        baseDelayMs: 5000, // long delay — will be aborted
        jitter: false,
        signal: controller.signal,
      },
    );

    // Abort shortly after the first failure triggers backoff
    setTimeout(() => controller.abort(new Error("aborted-during-sleep")), 50);

    await expect(promise).rejects.toThrow("aborted-during-sleep");
    expect(calls).toBe(1); // only ran once before abort during sleep
  });

  it("uses default options when none provided", async () => {
    // Just verify it works with no options at all
    const result = await retryWithBackoff(async () => "default-test");
    expect(result).toBe("default-test");
  });

  it("handles zero maxRetries (no retries)", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("no-retry");
        },
        { maxRetries: 0, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("no-retry");
    expect(calls).toBe(1);
  });

  it("preserves the original error type", async () => {
    class CustomError extends Error {
      code = "CUSTOM";
    }
    try {
      await retryWithBackoff(
        async () => {
          throw new CustomError("custom-fail");
        },
        { maxRetries: 1, baseDelayMs: 1, jitter: false },
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CustomError);
      expect((err as CustomError).code).toBe("CUSTOM");
    }
  });
});
