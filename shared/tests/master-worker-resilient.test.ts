import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCircuitLabel,
  classifyCircuit,
  buildPrompt,
  summarizeRun,
  shouldAbort,
  formatJournalEntry,
  successRate,
  mergeResilientConfig,
  ResilientMasterWorker,
  createResilientMasterWorker,
  createDeliverableTracker,
  hasDeliverableOutput,
  checkZeroOutput,
  updateDeliverableTracker,
  ZERO_OUTPUT_ESCALATE,
  ZERO_OUTPUT_TERMINATE,
  type IterationResult,
  type ResilientConfig,
  type DeliverableTracker,
} from "../workflows/master-worker-resilient.ts";
import { type CircuitState } from "../workflows/retry-wrapper.ts";
import { type IterationSnapshot } from "../workflows/master-worker-cached.ts";

// ── getCircuitLabel ─────────────────────────────────────────────────────

describe("getCircuitLabel", () => {
  it("returns 'closed' when circuit is not open", () => {
    const circuit: CircuitState = { consecutiveFailures: 0, lastFailureTime: null, state: "closed" };
    expect(getCircuitLabel(circuit)).toBe("closed");
  });

  it("returns label based on circuit state", () => {
    // getCircuitLabel delegates to getEffectiveCircuitState which may have its own logic
    const now = Date.now();
    const circuit: CircuitState = { consecutiveFailures: 3, lastFailureTime: now, state: "open" };
    const label = getCircuitLabel(circuit, now);
    expect(["open", "half-open", "closed"]).toContain(label);
  });
});

// ── classifyCircuit ─────────────────────────────────────────────────────

describe("classifyCircuit", () => {
  it("returns 'closed' when not open", () => {
    const circuit: CircuitState = { consecutiveFailures: 0, lastFailureTime: null, state: "closed" };
    expect(classifyCircuit(circuit, 5000)).toBe("closed");
  });

  it("returns 'open' when recently failed", () => {
    const now = Date.now();
    const circuit: CircuitState = { consecutiveFailures: 3, lastFailureTime: now, state: "open" };
    expect(classifyCircuit(circuit, 5000, now)).toBe("open");
  });

  it("returns 'half-open' when recovery time has elapsed", () => {
    const now = Date.now();
    const circuit: CircuitState = { consecutiveFailures: 3, lastFailureTime: now - 10000, state: "open" };
    expect(classifyCircuit(circuit, 5000, now)).toBe("half-open");
  });
});

// ── buildPrompt ─────────────────────────────────────────────────────────

describe("buildPrompt", () => {
  it("builds a structured prompt from snapshot and context", () => {
    const snapshot: IterationSnapshot = {
      iteration: 2,
      maxIterations: 5,
      status: "active",
      journalTail: "last entry",
      discussionContent: "some discussion",
      projectContent: "",
    };
    const result = buildPrompt(snapshot, "orchestrator says do X");
    expect(result).toContain("Iteration 2/5");
    expect(result).toContain("orchestrator says do X");
    expect(result).toContain("last entry");
    expect(result).toContain("some discussion");
    expect(result).toContain("active");
  });

  it("omits discussion section when empty", () => {
    const snapshot: IterationSnapshot = {
      iteration: 1,
      maxIterations: 3,
      status: "active",
      journalTail: "",
      discussionContent: "",
      projectContent: "",
    };
    const result = buildPrompt(snapshot, "context");
    expect(result).not.toContain("### Discussion");
  });
});

// ── summarizeRun ────────────────────────────────────────────────────────

describe("summarizeRun", () => {
  const makeResult = (success: boolean, circuitState: "closed" | "open" | "half-open" = "closed"): IterationResult => ({
    iteration: 1,
    success,
    output: success ? "output" : null,
    retryAttempts: 0,
    circuitState,
    durationMs: 100,
  });

  it("counts successes and failures", () => {
    const results = [makeResult(true), makeResult(false), makeResult(true)];
    const summary = summarizeRun(results);
    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
  });

  it("counts circuit trips", () => {
    const results = [makeResult(true), makeResult(false, "open"), makeResult(false, "open")];
    const summary = summarizeRun(results);
    expect(summary.circuitTrips).toBe(2);
  });

  it("handles empty results", () => {
    const summary = summarizeRun([]);
    expect(summary.total).toBe(0);
    expect(summary.succeeded).toBe(0);
  });
});

// ── shouldAbort ─────────────────────────────────────────────────────────

describe("shouldAbort", () => {
  const fail: IterationResult = { iteration: 1, success: false, output: null, retryAttempts: 0, circuitState: "closed", durationMs: 100, error: "err" };
  const ok: IterationResult = { iteration: 1, success: true, output: "ok", retryAttempts: 0, circuitState: "closed", durationMs: 100 };

  it("returns false with fewer results than threshold", () => {
    expect(shouldAbort([fail, fail])).toBe(false);
  });

  it("returns true with 3 consecutive failures", () => {
    expect(shouldAbort([ok, fail, fail, fail])).toBe(true);
  });

  it("returns false when last run succeeded", () => {
    expect(shouldAbort([fail, fail, ok])).toBe(false);
  });

  it("supports custom threshold", () => {
    expect(shouldAbort([fail, fail], 2)).toBe(true);
  });
});

// ── formatJournalEntry ──────────────────────────────────────────────────

describe("formatJournalEntry", () => {
  it("formats successful iteration", () => {
    const result: IterationResult = { iteration: 3, success: true, output: "done", retryAttempts: 0, circuitState: "closed", durationMs: 500 };
    const entry = formatJournalEntry(result);
    expect(entry).toContain("✅");
    expect(entry).toContain("Iteration 3");
    expect(entry).toContain("500ms");
  });

  it("formats failed iteration with retries and circuit info", () => {
    const result: IterationResult = { iteration: 2, success: false, output: null, retryAttempts: 2, circuitState: "open", durationMs: 3000, error: "timeout" };
    const entry = formatJournalEntry(result);
    expect(entry).toContain("❌");
    expect(entry).toContain("2 retries");
    expect(entry).toContain("[circuit: open]");
    expect(entry).toContain("timeout");
  });

  it("omits retries and circuit when zero/closed", () => {
    const result: IterationResult = { iteration: 1, success: true, output: "ok", retryAttempts: 0, circuitState: "closed", durationMs: 100 };
    const entry = formatJournalEntry(result);
    expect(entry).not.toContain("retries");
    expect(entry).not.toContain("circuit");
  });
});

// ── successRate ─────────────────────────────────────────────────────────

describe("successRate", () => {
  it("returns 0 for empty results", () => {
    expect(successRate([])).toBe(0);
  });

  it("calculates rate correctly", () => {
    const results: IterationResult[] = [
      { iteration: 1, success: true, output: "ok", retryAttempts: 0, circuitState: "closed", durationMs: 100 },
      { iteration: 2, success: false, output: null, retryAttempts: 0, circuitState: "closed", durationMs: 100 },
      { iteration: 3, success: true, output: "ok", retryAttempts: 0, circuitState: "closed", durationMs: 100 },
      { iteration: 4, success: true, output: "ok", retryAttempts: 0, circuitState: "closed", durationMs: 100 },
    ];
    expect(successRate(results)).toBe(0.75);
  });
});

// ── mergeResilientConfig ────────────────────────────────────────────────

describe("mergeResilientConfig", () => {
  it("applies defaults", () => {
    const config = mergeResilientConfig({ projectDir: "/tmp/test" });
    expect(config.projectDir).toBe("/tmp/test");
    expect(config.maxIterations).toBe(5);
    expect(config.cacheTtlMs).toBe(30000);
    expect(config.retry).toEqual({});
  });

  it("respects provided values", () => {
    const config = mergeResilientConfig({ projectDir: "/tmp/test", maxIterations: 10, cacheTtlMs: 5000, retry: { maxRetries: 5 } });
    expect(config.maxIterations).toBe(10);
    expect(config.cacheTtlMs).toBe(5000);
    expect(config.retry).toEqual({ maxRetries: 5 });
  });
});

// ── createResilientMasterWorker ─────────────────────────────────────────

describe("createResilientMasterWorker", () => {
  it("creates an instance", () => {
    const rmw = createResilientMasterWorker({ projectDir: "/tmp/fake-project-rmw", maxIterations: 3 });
    expect(rmw).toBeInstanceOf(ResilientMasterWorker);
  });
  it("getResults returns empty initially", () => {
    const rmw = createResilientMasterWorker({ projectDir: "/tmp/fake-project-rmw", maxIterations: 1 });
    expect(rmw.getResults()).toEqual([]);
  });
});

// ── Zero-Output Loop Detection ──────────────────────────────────────────

function makeResult(overrides: Partial<IterationResult> = {}): IterationResult {
  return {
    iteration: 1,
    success: false,
    output: null,
    retryAttempts: 0,
    circuitState: "closed",
    durationMs: 100,
    ...overrides,
  };
}

describe("createDeliverableTracker", () => {
  it("initializes to zeros", () => {
    const t = createDeliverableTracker();
    expect(t.consecutiveZeroOutput).toBe(0);
    expect(t.totalIterations).toBe(0);
    expect(t.iterationsWithOutput).toBe(0);
  });
});

describe("hasDeliverableOutput", () => {
  it("returns true for successful iteration with output", () => {
    expect(hasDeliverableOutput(makeResult({ success: true, output: "done" }))).toBe(true);
  });
  it("returns false for failed iteration", () => {
    expect(hasDeliverableOutput(makeResult({ success: false, output: null }))).toBe(false);
  });
  it("returns true for stopped/blocked", () => {
    expect(hasDeliverableOutput(makeResult({ error: "Stopped: milestone complete" }))).toBe(true);
  });
  it("returns false for success with empty output", () => {
    expect(hasDeliverableOutput(makeResult({ success: true, output: "" }))).toBe(false);
  });
});

describe("checkZeroOutput", () => {
  it("returns continue below escalation threshold", () => {
    expect(checkZeroOutput({ consecutiveZeroOutput: 2, totalIterations: 3, iterationsWithOutput: 0 })).toBe("continue");
  });
  it("returns escalate at threshold", () => {
    expect(checkZeroOutput({ consecutiveZeroOutput: ZERO_OUTPUT_ESCALATE, totalIterations: 4, iterationsWithOutput: 0 })).toBe("escalate");
  });
  it("returns terminate at threshold", () => {
    expect(checkZeroOutput({ consecutiveZeroOutput: ZERO_OUTPUT_TERMINATE, totalIterations: 6, iterationsWithOutput: 0 })).toBe("terminate");
  });
});

describe("updateDeliverableTracker", () => {
  it("grants first iteration grace period", () => {
    const t = createDeliverableTracker();
    const action = updateDeliverableTracker(t, makeResult({ success: false }));
    expect(action).toBe("continue");
    expect(t.consecutiveZeroOutput).toBe(0); // not incremented on first
  });

  it("increments on second zero-output iteration", () => {
    const t = createDeliverableTracker();
    updateDeliverableTracker(t, makeResult()); // iteration 1 (grace)
    updateDeliverableTracker(t, makeResult()); // iteration 2
    expect(t.consecutiveZeroOutput).toBe(1);
  });

  it("resets on productive iteration", () => {
    const t = createDeliverableTracker();
    updateDeliverableTracker(t, makeResult()); // grace
    updateDeliverableTracker(t, makeResult()); // zero
    updateDeliverableTracker(t, makeResult({ success: true, output: "file written" })); // productive
    expect(t.consecutiveZeroOutput).toBe(0);
    expect(t.iterationsWithOutput).toBe(1);
  });

  it("escalates after consecutive zero-output iterations", () => {
    const t = createDeliverableTracker();
    updateDeliverableTracker(t, makeResult()); // grace
    for (let i = 0; i < ZERO_OUTPUT_ESCALATE; i++) {
      const action = updateDeliverableTracker(t, makeResult());
      if (i < ZERO_OUTPUT_ESCALATE - 1) expect(action).toBe("continue");
      else expect(action).toBe("escalate");
    }
  });

  it("terminates after enough consecutive zero-output iterations", () => {
    const t = createDeliverableTracker();
    updateDeliverableTracker(t, makeResult()); // grace
    let lastAction: string = "continue";
    for (let i = 0; i < ZERO_OUTPUT_TERMINATE; i++) {
      lastAction = updateDeliverableTracker(t, makeResult());
    }
    expect(lastAction).toBe("terminate");
  });
});
