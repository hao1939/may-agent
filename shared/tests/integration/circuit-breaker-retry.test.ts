/**
 * Integration tests: circuit-breaker + worker-retry combined behavior.
 *
 * Verifies that retry logic and circuit breaker work together correctly:
 * - Retries don't happen when circuit is open
 * - Circuit opens after retries are exhausted across iterations
 * - Circuit half-open allows a single retry probe
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../../workflows/circuit-breaker.js";

import {
  withWorkerRetry,
  isWorkerRetryable,
  calculateDelay,
  type WorkerRetryOptions,
} from "../../workflows/worker-retry.js";

let tempDir: string;
const AGENT = "test-worker";

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "cb-retry-"));
  mkdirSync(join(tempDir, "shared"), { recursive: true });
  mkdirSync(join(tempDir, AGENT), { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("circuit-breaker + worker-retry integration", () => {
  it("circuit stays closed when retries eventually succeed", async () => {
    let callCount = 0;
    const result = await withWorkerRetry(
      async () => {
        callCount++;
        if (callCount === 1) throw new Error("timeout: transient");
        return "ok";
      },
      { maxRetries: 1, baseDelayMs: 10 },
    );

    // Record the success to circuit breaker
    recordOutcome(tempDir, AGENT, !result.success);
    expect(result.success).toBe(true);
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull();
  });

  it("circuit opens after multiple retry-exhausted iterations", () => {
    // Simulate 3 iterations where retries are exhausted
    for (let i = 0; i < 3; i++) {
      recordOutcome(tempDir, AGENT, true, `iteration ${i} failed after retries`);
    }

    const blocked = checkCircuitBreaker(tempDir, AGENT);
    expect(blocked).not.toBeNull();
    expect(blocked).toContain("Circuit breaker OPEN");
    expect(blocked).toContain("3 consecutive errors");
  });

  it("retry should not be attempted when circuit is open", async () => {
    // Trip the circuit breaker
    for (let i = 0; i < 3; i++) {
      recordOutcome(tempDir, AGENT, true, "error");
    }

    const blocked = checkCircuitBreaker(tempDir, AGENT);
    expect(blocked).not.toBeNull();

    // Simulating: if circuit is open, skip the retry entirely
    let retryCalled = false;
    if (!blocked) {
      await withWorkerRetry(async () => {
        retryCalled = true;
        return "ok";
      });
    }
    expect(retryCalled).toBe(false);
  });

  it("circuit reset allows retries to proceed again", async () => {
    // Trip circuit
    for (let i = 0; i < 3; i++) {
      recordOutcome(tempDir, AGENT, true, "error");
    }
    expect(checkCircuitBreaker(tempDir, AGENT)).not.toBeNull();

    // Reset
    resetCircuitBreaker(tempDir, AGENT);
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull();

    // Now retry works
    const result = await withWorkerRetry(async () => "recovered", {
      maxRetries: 1,
      baseDelayMs: 10,
    });
    expect(result.success).toBe(true);
    expect(result.result).toBe("recovered");
  });

  it("non-retryable error trips circuit faster (no retry delay)", async () => {
    const result = await withWorkerRetry(
      async () => { throw new Error("authentication failed"); },
      { maxRetries: 3, baseDelayMs: 10 },
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // No retries for auth errors
    expect(result.totalDelayMs).toBe(0);

    // Record to circuit breaker
    recordOutcome(tempDir, AGENT, true, "auth failed");
    // One error isn't enough to trip (threshold=3)
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull();
  });

  it("success after retries resets circuit breaker counter", () => {
    // 2 consecutive errors (below threshold)
    recordOutcome(tempDir, AGENT, true, "error 1");
    recordOutcome(tempDir, AGENT, true, "error 2");
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull(); // still closed

    // Success resets
    recordOutcome(tempDir, AGENT, false);

    // 2 more errors — still below threshold because counter reset
    recordOutcome(tempDir, AGENT, true, "error 3");
    recordOutcome(tempDir, AGENT, true, "error 4");
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull();
  });

  it("combined workflow: retry-then-fail feeds into circuit breaker", async () => {
    for (let iteration = 0; iteration < 3; iteration++) {
      const result = await withWorkerRetry(
        async () => { throw new Error("timeout"); },
        { maxRetries: 1, baseDelayMs: 10 },
      );
      recordOutcome(tempDir, AGENT, !result.success, result.errors.join("; "));
    }

    const blocked = checkCircuitBreaker(tempDir, AGENT);
    expect(blocked).not.toBeNull();
    expect(blocked).toContain("3 consecutive errors");
  });

  it("circuit half-open: manual SIGNAL deletion allows one probe", () => {
    // Trip circuit
    for (let i = 0; i < 3; i++) {
      recordOutcome(tempDir, AGENT, true, "error");
    }
    expect(checkCircuitBreaker(tempDir, AGENT)).not.toBeNull();

    // Simulate manual re-enable by deleting SIGNAL file
    const signalPath = join(tempDir, AGENT, "SIGNAL-circuit-breaker.md");
    if (existsSync(signalPath)) {
      rmSync(signalPath);
    }

    // Circuit should now be closed (auto-reset on missing SIGNAL)
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull();
  });

  it("retry onRetry callback fires before circuit breaker recording", async () => {
    const retryLog: number[] = [];
    const result = await withWorkerRetry(
      async () => { throw new Error("503 service unavailable"); },
      {
        maxRetries: 2,
        baseDelayMs: 10,
        onRetry: (_err, attempt) => retryLog.push(attempt),
      },
    );

    expect(retryLog).toEqual([1, 2]);
    expect(result.attempts).toBe(3);
    expect(result.success).toBe(false);

    // Now record to circuit breaker
    recordOutcome(tempDir, AGENT, true, "503");
    // Only 1 circuit breaker error recorded per iteration, not per retry
    expect(checkCircuitBreaker(tempDir, AGENT)).toBeNull();
  });

  it("multiple agents have independent circuits and retries", async () => {
    const agent2 = "test-worker-2";
    mkdirSync(join(tempDir, agent2), { recursive: true });

    // Trip agent 1
    for (let i = 0; i < 3; i++) {
      recordOutcome(tempDir, AGENT, true, "error");
    }

    // Agent 2 still works
    expect(checkCircuitBreaker(tempDir, AGENT)).not.toBeNull();
    expect(checkCircuitBreaker(tempDir, agent2)).toBeNull();

    const result = await withWorkerRetry(async () => "agent2-ok", {
      maxRetries: 1,
      baseDelayMs: 10,
    });
    expect(result.success).toBe(true);
    recordOutcome(tempDir, agent2, false);
    expect(checkCircuitBreaker(tempDir, agent2)).toBeNull();
  });

  it("backoff delays accumulate but don't prevent circuit from tripping", async () => {
    const result = await withWorkerRetry(
      async () => { throw new Error("500 internal error"); },
      { maxRetries: 2, baseDelayMs: 10, backoffMultiplier: 2, maxDelayMs: 100 },
    );

    expect(result.success).toBe(false);
    expect(result.totalDelayMs).toBeGreaterThan(0);
    expect(result.errors.length).toBe(3);

    // Record failure — circuit doesn't care about retry delays
    recordOutcome(tempDir, AGENT, true);
    const state = JSON.parse(
      readFileSync(join(tempDir, ".state", "circuit-breaker-state.json"), "utf-8"),
    );
    expect(state.agents[AGENT].consecutiveErrors).toBe(1);
  });

  it("circuit breaker SIGNAL file contains useful error context", () => {
    for (let i = 0; i < 3; i++) {
      recordOutcome(tempDir, AGENT, true, `retry exhausted: attempt ${i}`);
    }

    const signalPath = join(tempDir, AGENT, "SIGNAL-circuit-breaker.md");
    expect(existsSync(signalPath)).toBe(true);

    const content = readFileSync(signalPath, "utf-8");
    expect(content).toContain("Circuit Breaker Tripped");
    expect(content).toContain(AGENT);
    expect(content).toContain("3 consecutive");
  });
});
