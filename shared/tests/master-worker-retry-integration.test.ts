/**
 * Tests that master-worker.ts correctly imports and uses worker-retry.ts
 * for iteration-level retry with exponential backoff.
 */
import { describe, it, expect } from "vitest";
import { withWorkerRetry, isWorkerRetryable, calculateDelay } from "../workflows/worker-retry.ts";

describe("master-worker retry integration", () => {
  it("withWorkerRetry succeeds on first attempt when fn succeeds", async () => {
    const result = await withWorkerRetry(async () => "ok");
    expect(result.success).toBe(true);
    expect(result.result).toBe("ok");
    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("withWorkerRetry retries once and succeeds on second attempt", async () => {
    let calls = 0;
    const result = await withWorkerRetry(async () => {
      calls++;
      if (calls === 1) throw new Error("no output: worker produced 0 files on retry");
      return ["file1.md"];
    }, { maxRetries: 1, baseDelayMs: 10 });
    expect(result.success).toBe(true);
    expect(result.result).toEqual(["file1.md"]);
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(1);
  });

  it("withWorkerRetry gives up after maxRetries exhausted", async () => {
    const result = await withWorkerRetry(async () => {
      throw new Error("no output: zero files");
    }, { maxRetries: 1, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it("withWorkerRetry does not retry non-retryable errors", async () => {
    const result = await withWorkerRetry(async () => {
      throw new Error("authentication failed");
    }, { maxRetries: 2, baseDelayMs: 10 });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("isWorkerRetryable returns true for 'no output' errors", () => {
    expect(isWorkerRetryable(new Error("no output: worker produced 0 files on retry"))).toBe(true);
    expect(isWorkerRetryable(new Error("zero output from worker"))).toBe(true);
  });

  it("isWorkerRetryable returns false for auth errors", () => {
    expect(isWorkerRetryable(new Error("authentication failed"))).toBe(false);
    expect(isWorkerRetryable(new Error("permission denied"))).toBe(false);
  });

  it("isWorkerRetryable returns true for timeout errors", () => {
    expect(isWorkerRetryable(new Error("request timeout"))).toBe(true);
    expect(isWorkerRetryable(new Error("ECONNRESET"))).toBe(true);
  });

  it("calculateDelay applies exponential backoff", () => {
    const d1 = calculateDelay(1, 1000, 2, 30000);
    const d2 = calculateDelay(2, 1000, 2, 30000);
    const d3 = calculateDelay(3, 1000, 2, 30000);
    // With ±10% jitter: attempt 1 ≈ 1000, attempt 2 ≈ 2000, attempt 3 ≈ 4000
    expect(d1).toBeGreaterThan(800);
    expect(d1).toBeLessThan(1200);
    expect(d2).toBeGreaterThan(1600);
    expect(d2).toBeLessThan(2400);
    expect(d3).toBeGreaterThan(3200);
    expect(d3).toBeLessThan(4800);
  });

  it("calculateDelay respects maxDelayMs cap", () => {
    const d = calculateDelay(10, 1000, 2, 5000);
    // Should be capped at 5000 ± 10% jitter
    expect(d).toBeLessThanOrEqual(5500);
    expect(d).toBeGreaterThanOrEqual(4500);
  });

  it("withWorkerRetry calls onRetry callback", async () => {
    const retryCalls: number[] = [];
    let calls = 0;
    await withWorkerRetry(async () => {
      calls++;
      if (calls === 1) throw new Error("timeout");
      return "ok";
    }, {
      maxRetries: 1,
      baseDelayMs: 10,
      onRetry: (_err, attempt) => retryCalls.push(attempt),
    });
    expect(retryCalls).toEqual([1]);
  });

  it("withWorkerRetry tracks totalDelayMs", async () => {
    const result = await withWorkerRetry(async () => {
      throw new Error("fail");
    }, { maxRetries: 1, baseDelayMs: 50 });
    expect(result.totalDelayMs).toBeGreaterThan(0);
  });

  it("master-worker.ts does not use withWorkerRetry (retry block removed)", async () => {
    // Zero-output retry block was removed from master-worker.ts
    // withWorkerRetry is still available as a utility but no longer used in the main workflow
    const fs = await import("node:fs");
    const content = fs.readFileSync("/app/agents/shared/workflows/master-worker.ts", "utf-8");
    // Retry block was removed, so these should NOT be present
    expect(content).not.toContain("const retryResult = await withWorkerRetry(");
  });

  it("worker-retry module still exports withWorkerRetry for other consumers", async () => {
    // The module itself still works even though master-worker no longer uses it
    expect(typeof withWorkerRetry).toBe("function");
    expect(typeof isWorkerRetryable).toBe("function");
  });
});
