/**
 * Tests for workflows/retry-wrapper.ts
 */
import { describe, it, expect, vi } from "bun:test";
import {
  mergeConfig,
  createInitialCircuitState,
  calculateDelay,
  getEffectiveCircuitState,
  recordSuccess,
  recordFailure,
  shouldRetry,
  createRetryWrapper,
  RetryWrapper,
} from "../workflows/retry-wrapper.js";

// ── mergeConfig ─────────────────────────────────────────────────────

describe("mergeConfig", () => {
  it("returns defaults when no overrides", () => {
    const cfg = mergeConfig();
    expect(cfg.maxRetries).toBe(3);
    expect(cfg.baseDelayMs).toBe(1000);
    expect(cfg.maxDelayMs).toBe(30000);
    expect(cfg.circuitBreakerThreshold).toBe(3);
    expect(cfg.circuitRecoveryMs).toBe(60000);
  });

  it("overrides specific fields", () => {
    const cfg = mergeConfig({ maxRetries: 5, baseDelayMs: 500 });
    expect(cfg.maxRetries).toBe(5);
    expect(cfg.baseDelayMs).toBe(500);
    expect(cfg.maxDelayMs).toBe(30000); // unchanged
  });
});

// ── createInitialCircuitState ───────────────────────────────────────

describe("createInitialCircuitState", () => {
  it("starts closed with 0 failures", () => {
    const s = createInitialCircuitState();
    expect(s.state).toBe("closed");
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastFailureTime).toBeNull();
  });
});

// ── calculateDelay ──────────────────────────────────────────────────

describe("calculateDelay", () => {
  it("doubles each attempt", () => {
    expect(calculateDelay(0, 1000, 30000)).toBe(1000);
    expect(calculateDelay(1, 1000, 30000)).toBe(2000);
    expect(calculateDelay(2, 1000, 30000)).toBe(4000);
    expect(calculateDelay(3, 1000, 30000)).toBe(8000);
  });

  it("caps at maxDelay", () => {
    expect(calculateDelay(10, 1000, 5000)).toBe(5000);
  });

  it("handles base delay of 0", () => {
    expect(calculateDelay(3, 0, 30000)).toBe(0);
  });
});

// ── getEffectiveCircuitState ────────────────────────────────────────

describe("getEffectiveCircuitState", () => {
  it("closed when failures below threshold", () => {
    const s = { consecutiveFailures: 2, lastFailureTime: Date.now(), state: "closed" as const };
    expect(getEffectiveCircuitState(s, 3, 60000, Date.now())).toBe("closed");
  });

  it("open when failures at threshold and within recovery window", () => {
    const now = Date.now();
    const s = { consecutiveFailures: 3, lastFailureTime: now - 1000, state: "open" as const };
    expect(getEffectiveCircuitState(s, 3, 60000, now)).toBe("open");
  });

  it("half-open when recovery period elapsed", () => {
    const now = Date.now();
    const s = { consecutiveFailures: 5, lastFailureTime: now - 70000, state: "open" as const };
    expect(getEffectiveCircuitState(s, 3, 60000, now)).toBe("half-open");
  });

  it("open when lastFailureTime is null", () => {
    const s = { consecutiveFailures: 5, lastFailureTime: null, state: "open" as const };
    expect(getEffectiveCircuitState(s, 3, 60000, Date.now())).toBe("open");
  });

  it("closed when 0 failures", () => {
    const s = createInitialCircuitState();
    expect(getEffectiveCircuitState(s, 3, 60000, Date.now())).toBe("closed");
  });
});

// ── recordSuccess / recordFailure ───────────────────────────────────

describe("recordSuccess", () => {
  it("resets to closed with 0 failures", () => {
    const s = { consecutiveFailures: 5, lastFailureTime: 12345, state: "open" as const };
    const result = recordSuccess(s);
    expect(result.state).toBe("closed");
    expect(result.consecutiveFailures).toBe(0);
    expect(result.lastFailureTime).toBeNull();
  });
});

describe("recordFailure", () => {
  it("increments failure count", () => {
    const s = createInitialCircuitState();
    const result = recordFailure(s, 3, Date.now());
    expect(result.consecutiveFailures).toBe(1);
    expect(result.state).toBe("closed");
  });

  it("opens circuit at threshold", () => {
    const s = { consecutiveFailures: 2, lastFailureTime: null, state: "closed" as const };
    const result = recordFailure(s, 3, Date.now());
    expect(result.consecutiveFailures).toBe(3);
    expect(result.state).toBe("open");
  });

  it("stays open beyond threshold", () => {
    const s = { consecutiveFailures: 5, lastFailureTime: Date.now(), state: "open" as const };
    const result = recordFailure(s, 3, Date.now());
    expect(result.consecutiveFailures).toBe(6);
    expect(result.state).toBe("open");
  });
});

// ── shouldRetry ─────────────────────────────────────────────────────

describe("shouldRetry", () => {
  it("true when attempts remain and circuit closed", () => {
    expect(shouldRetry(1, 3, "closed")).toBe(true);
  });

  it("false when max retries reached", () => {
    expect(shouldRetry(3, 3, "closed")).toBe(false);
  });

  it("false when circuit open", () => {
    expect(shouldRetry(1, 3, "open")).toBe(false);
  });

  it("true when circuit half-open", () => {
    expect(shouldRetry(1, 3, "half-open")).toBe(true);
  });
});

// ── RetryWrapper integration ────────────────────────────────────────

describe("RetryWrapper", () => {
  const noopSleep = async (_ms: number) => {};

  it("succeeds on first try", async () => {
    const w = createRetryWrapper({}, noopSleep);
    const result = await w.execute(async () => 42);
    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
    expect(result.attempts).toBe(1);
  });

  it("retries and succeeds on second try", async () => {
    const w = createRetryWrapper({ maxRetries: 3 }, noopSleep);
    let calls = 0;
    const result = await w.execute(async () => {
      calls++;
      if (calls === 1) throw new Error("fail");
      return "ok";
    });
    expect(result.success).toBe(true);
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(2);
  });

  it("fails after exhausting retries", async () => {
    const w = createRetryWrapper({ maxRetries: 2 }, noopSleep);
    const result = await w.execute(async () => { throw new Error("always fail"); });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(result.error?.message).toBe("always fail");
  });

  it("opens circuit after threshold failures", async () => {
    const w = createRetryWrapper({ maxRetries: 5, circuitBreakerThreshold: 3 }, noopSleep);
    const result = await w.execute(async () => { throw new Error("fail"); }, "agent-a");
    expect(result.success).toBe(false);
    expect(result.circuitState.state).toBe("open");
    expect(result.circuitState.consecutiveFailures).toBeGreaterThanOrEqual(3);
  });

  it("fast-fails when circuit already open", async () => {
    const w = createRetryWrapper({ maxRetries: 3, circuitBreakerThreshold: 2 }, noopSleep);
    // Trip the circuit
    await w.execute(async () => { throw new Error("fail"); }, "key1");
    // Now it should fast-fail
    const result = await w.execute(async () => 42, "key1");
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(0);
    expect(result.error?.message).toContain("Circuit breaker open");
  });

  it("isolates circuits by key", async () => {
    const w = createRetryWrapper({ maxRetries: 1, circuitBreakerThreshold: 2 }, noopSleep);
    await w.execute(async () => { throw new Error("fail"); }, "bad-agent");
    // Different key should work fine
    const result = await w.execute(async () => "good", "good-agent");
    expect(result.success).toBe(true);
    expect(result.value).toBe("good");
  });

  it("resetCircuit allows retries again", async () => {
    const w = createRetryWrapper({ maxRetries: 1, circuitBreakerThreshold: 2 }, noopSleep);
    await w.execute(async () => { throw new Error("fail"); }, "k");
    w.resetCircuit("k");
    const result = await w.execute(async () => "back", "k");
    expect(result.success).toBe(true);
    expect(result.value).toBe("back");
  });

  it("calls sleep between retries", async () => {
    const delays: number[] = [];
    const sleepFn = async (ms: number) => { delays.push(ms); };
    const w = createRetryWrapper({ maxRetries: 2, baseDelayMs: 100, maxDelayMs: 1000 }, sleepFn);
    await w.execute(async () => { throw new Error("fail"); });
    expect(delays.length).toBe(2);
    expect(delays[0]).toBe(100);  // 100 * 2^0
    expect(delays[1]).toBe(200);  // 100 * 2^1
  });

  it("handles non-Error throws", async () => {
    const w = createRetryWrapper({ maxRetries: 0 }, noopSleep);
    const result = await w.execute(async () => { throw "string error"; });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe("string error");
  });
});
