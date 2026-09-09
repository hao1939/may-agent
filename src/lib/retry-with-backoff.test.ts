import { describe, it, expect, spyOn } from "bun:test";
import { retryWithBackoff } from "./retry-with-backoff.js";

describe("retryWithBackoff()", () => {
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
    expect(retries).toEqual([
      { attempt: 1, delayMs: 10 },
      { attempt: 2, delayMs: 20 },
    ]);
  });

  it("caps delay at maxDelayMs", async () => {
    const delays: number[] = [];
    await expect(
      retryWithBackoff(
        async () => {
          throw new Error("fail");
        },
        {
          maxRetries: 5,
          // Milliseconds are enough to exercise the same exponential cap.
          baseDelayMs: 2,
          maxDelayMs: 4,
          multiplier: 10,
          jitter: false,
          onRetry: (_err, _attempt, delayMs) => {
            delays.push(delayMs);
          },
        },
      ),
    ).rejects.toThrow();
    expect(delays).toEqual([2, 4, 4, 4, 4]);
  });

  it("adds the configured jitter to each exponentially increasing delay", async () => {
    const delays: number[] = [];
    const random = spyOn(Math, "random").mockReturnValue(0.5);
    try {
      await expect(
        retryWithBackoff(
          async () => {
            throw new Error("fail");
          },
          {
            maxRetries: 3,
            baseDelayMs: 2,
            jitter: true,
            onRetry: (_err, _attempt, delayMs) => delays.push(delayMs),
          },
        ),
      ).rejects.toThrow("fail");
      expect(delays).toEqual([2.5, 5, 10]);
      expect(random).toHaveBeenCalledTimes(3);
    } finally {
      random.mockRestore();
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
        // sleep() installs its listener synchronously after onRetry returns.
        onRetry: () => queueMicrotask(() => controller.abort(new Error("aborted-during-sleep"))),
      },
    );

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
