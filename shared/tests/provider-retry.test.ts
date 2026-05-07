import { describe, it, expect, vi } from "vitest";
import {
  classifyError,
  isRetryableError,
  withRetry,
  withRetryWrapper,
} from "../workflows/provider-retry.js";

describe("classifyError", () => {
  it("classifies 429 as retryable", () => {
    expect(classifyError({ status: 429, message: "Too Many Requests" })).toBe("retryable");
  });

  it("classifies 500 as retryable", () => {
    expect(classifyError({ status: 500, message: "Internal Server Error" })).toBe("retryable");
  });

  it("classifies 502 as retryable", () => {
    expect(classifyError({ status: 502, message: "Bad Gateway" })).toBe("retryable");
  });

  it("classifies 503 as retryable", () => {
    expect(classifyError({ status: 503, message: "Service Unavailable" })).toBe("retryable");
  });

  it("classifies provider deployment cooldowns as retryable even when embedded in 429 text", () => {
    const err = new Error('429 {"error":{"message":"No deployments available for selected model, Try again in 5 seconds"}}');
    expect(classifyError(err)).toBe("retryable");
  });

  it("classifies timeout errors as retryable", () => {
    expect(classifyError(new Error("Request timeout after 30s"))).toBe("retryable");
  });

  it("classifies network errors as retryable", () => {
    expect(classifyError(new Error("ECONNRESET"))).toBe("retryable");
    expect(classifyError(new Error("socket hang up"))).toBe("retryable");
  });

  it("classifies 401 as non-retryable", () => {
    expect(classifyError({ status: 401, message: "Unauthorized" })).toBe("non-retryable");
  });

  it("classifies 403 as non-retryable", () => {
    expect(classifyError({ status: 403, message: "Forbidden" })).toBe("non-retryable");
  });

  it("classifies 400 as non-retryable", () => {
    expect(classifyError({ status: 400, message: "Bad Request" })).toBe("non-retryable");
  });

  it("classifies invalid API key as non-retryable", () => {
    expect(classifyError(new Error("Invalid API key provided"))).toBe("non-retryable");
  });

  it("classifies unknown errors as unknown", () => {
    expect(classifyError(new Error("something weird happened"))).toBe("unknown");
  });

  it("handles null/undefined", () => {
    expect(classifyError(null)).toBe("unknown");
    expect(classifyError(undefined)).toBe("unknown");
  });
});

describe("isRetryableError", () => {
  it("returns true for retryable errors", () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError(new Error("timeout"))).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError({ status: 401 })).toBe(false);
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it("returns true for unknown errors (conservative)", () => {
    expect(isRetryableError(new Error("wat"))).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result.success).toBe(true);
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429, message: "rate limited" })
      .mockRejectedValueOnce({ status: 500, message: "server error" })
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result.success).toBe(true);
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("fails immediately on non-retryable error", async () => {
    const fn = vi.fn()
      .mockRejectedValue({ status: 401, message: "Unauthorized" });

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fails after exhausting retries", async () => {
    const fn = vi.fn()
      .mockRejectedValue({ status: 500, message: "Server Error" });

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(4); // 1 initial + 3 retries
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("calls onRetry callback", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok");

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      expect.any(Number)
    );
  });

  it("respects maxDelayMs cap", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValue(new Error("timeout"));

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 150, onRetry });
    // Third retry would be 100 * 2^2 = 400ms, but capped at 150ms
    const thirdDelay = onRetry.mock.calls[2]?.[2];
    if (thirdDelay !== undefined) {
      expect(thirdDelay).toBeLessThanOrEqual(150);
    }
  });

  it("tracks totalDelayMs", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result.totalDelayMs).toBeGreaterThan(0);
  });
});

describe("withRetryWrapper", () => {
  it("wraps a function with retry behavior", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("result");

    const wrapped = withRetryWrapper(fn, { maxRetries: 3, baseDelayMs: 10 });
    const result = await wrapped("arg1", "arg2");
    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("throws on non-retryable failure", async () => {
    const error = { status: 401, message: "Unauthorized" };
    const fn = vi.fn().mockRejectedValue(error);

    const wrapped = withRetryWrapper(fn, { maxRetries: 3, baseDelayMs: 10 });
    await expect(wrapped()).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
