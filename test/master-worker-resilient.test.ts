/**
 * tests/master-worker-resilient.test.ts — Tests for resilient master-worker orchestration.
 */
import { describe, it, expect, vi } from "vitest";
import {
  classifyCircuit,
  buildPrompt,
  summarizeRun,
  shouldAbort,
  formatJournalEntry,
  successRate,
  mergeResilientConfig,
  getCircuitLabel,
  type IterationResult,
  type IterationSnapshot,
} from "../shared/workflows/master-worker-resilient.ts";
import { createInitialCircuitState } from "../shared/workflows/retry-wrapper.ts";

// ── Helper ──────────────────────────────────────────────────────────

function makeResult(overrides: Partial<IterationResult> = {}): IterationResult {
  return {
    iteration: 1,
    success: true,
    output: "done",
    retryAttempts: 0,
    circuitState: "closed",
    durationMs: 100,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<IterationSnapshot> = {}): IterationSnapshot {
  return {
    projectContent: "# Test Project",
    journalTail: "some journal",
    discussionContent: null,
    iteration: 1,
    maxIterations: 5,
    status: "active",
    ...overrides,
  };
}

// ── classifyCircuit ─────────────────────────────────────────────────

describe("classifyCircuit", () => {
  it("returns closed for initial state", () => {
    const circuit = createInitialCircuitState();
    expect(classifyCircuit(circuit, 60000)).toBe("closed");
  });

  it("returns open when isOpen and within recovery window", () => {
    const now = Date.now();
    const circuit = { state: "open" as const, consecutiveFailures: 3, lastFailureTime: now - 1000 };
    expect(classifyCircuit(circuit, 60000, now)).toBe("open");
  });

  it("returns half-open when recovery time elapsed", () => {
    const now = Date.now();
    const circuit = { state: "open" as const, consecutiveFailures: 3, lastFailureTime: now - 70000 };
    expect(classifyCircuit(circuit, 60000, now)).toBe("half-open");
  });

  it("returns closed when not open regardless of failure count", () => {
    const circuit = { state: "closed" as const, consecutiveFailures: 5, lastFailureTime: Date.now() };
    expect(classifyCircuit(circuit, 60000)).toBe("closed");
  });
});

// ── buildPrompt ─────────────────────────────────────────────────────

describe("buildPrompt", () => {
  it("includes iteration number", () => {
    const snapshot = makeSnapshot({ iteration: 3, maxIterations: 10 });
    const prompt = buildPrompt(snapshot, "ctx");
    expect(prompt).toContain("Iteration 3/10");
  });

  it("includes status", () => {
    const snapshot = makeSnapshot({ status: "blocked" });
    const prompt = buildPrompt(snapshot, "ctx");
    expect(prompt).toContain("Status: blocked");
  });

  it("includes orchestrator context", () => {
    const prompt = buildPrompt(makeSnapshot(), "my-context-here");
    expect(prompt).toContain("my-context-here");
  });

  it("includes journal tail", () => {
    const snapshot = makeSnapshot({ journalTail: "recent entry" });
    const prompt = buildPrompt(snapshot, "ctx");
    expect(prompt).toContain("recent entry");
  });

  it("includes discussion when present", () => {
    const snapshot = makeSnapshot({ discussionContent: "discussion text" });
    const prompt = buildPrompt(snapshot, "ctx");
    expect(prompt).toContain("discussion text");
  });

  it("omits discussion section when null", () => {
    const snapshot = makeSnapshot({ discussionContent: null });
    const prompt = buildPrompt(snapshot, "ctx");
    expect(prompt).not.toContain("### Discussion");
  });
});

// ── summarizeRun ────────────────────────────────────────────────────

describe("summarizeRun", () => {
  it("counts all successes", () => {
    const results = [makeResult(), makeResult(), makeResult()];
    expect(summarizeRun(results)).toEqual({ total: 3, succeeded: 3, failed: 0, circuitTrips: 0 });
  });

  it("counts failures", () => {
    const results = [makeResult({ success: false }), makeResult()];
    expect(summarizeRun(results).failed).toBe(1);
  });

  it("counts circuit trips", () => {
    const results = [makeResult({ circuitState: "open" }), makeResult({ circuitState: "open" })];
    expect(summarizeRun(results).circuitTrips).toBe(2);
  });

  it("handles empty results", () => {
    expect(summarizeRun([])).toEqual({ total: 0, succeeded: 0, failed: 0, circuitTrips: 0 });
  });

  it("mixed results", () => {
    const results = [
      makeResult({ success: true, circuitState: "closed" }),
      makeResult({ success: false, circuitState: "half-open" }),
      makeResult({ success: false, circuitState: "open" }),
    ];
    const s = summarizeRun(results);
    expect(s.succeeded).toBe(1);
    expect(s.failed).toBe(2);
    expect(s.circuitTrips).toBe(1);
  });
});

// ── shouldAbort ─────────────────────────────────────────────────────

describe("shouldAbort", () => {
  it("returns false with fewer than threshold results", () => {
    expect(shouldAbort([makeResult({ success: false })])).toBe(false);
  });

  it("returns true with 3 consecutive failures", () => {
    const results = [
      makeResult({ success: false }),
      makeResult({ success: false }),
      makeResult({ success: false }),
    ];
    expect(shouldAbort(results)).toBe(true);
  });

  it("returns false if last success breaks the streak", () => {
    const results = [
      makeResult({ success: false }),
      makeResult({ success: false }),
      makeResult({ success: true }),
    ];
    expect(shouldAbort(results)).toBe(false);
  });

  it("returns false with all successes", () => {
    const results = [makeResult(), makeResult(), makeResult()];
    expect(shouldAbort(results)).toBe(false);
  });

  it("respects custom threshold", () => {
    const results = [makeResult({ success: false }), makeResult({ success: false })];
    expect(shouldAbort(results, 2)).toBe(true);
    expect(shouldAbort(results, 3)).toBe(false);
  });

  it("only checks tail, not entire history", () => {
    const results = [
      makeResult({ success: false }),
      makeResult({ success: false }),
      makeResult({ success: true }),
      makeResult({ success: false }),
      makeResult({ success: false }),
    ];
    expect(shouldAbort(results, 3)).toBe(false);
  });
});

// ── formatJournalEntry ──────────────────────────────────────────────

describe("formatJournalEntry", () => {
  it("shows success emoji for success", () => {
    expect(formatJournalEntry(makeResult())).toContain("✅");
  });

  it("shows failure emoji for failure", () => {
    expect(formatJournalEntry(makeResult({ success: false }))).toContain("❌");
  });

  it("shows retry count when > 0", () => {
    const entry = formatJournalEntry(makeResult({ retryAttempts: 2 }));
    expect(entry).toContain("2 retries");
  });

  it("omits retry count when 0", () => {
    const entry = formatJournalEntry(makeResult({ retryAttempts: 0 }));
    expect(entry).not.toContain("retries");
  });

  it("shows circuit state when not closed", () => {
    const entry = formatJournalEntry(makeResult({ circuitState: "open" }));
    expect(entry).toContain("[circuit: open]");
  });

  it("omits circuit state when closed", () => {
    const entry = formatJournalEntry(makeResult({ circuitState: "closed" }));
    expect(entry).not.toContain("circuit");
  });

  it("shows error when present", () => {
    const entry = formatJournalEntry(makeResult({ success: false, error: "timeout" }));
    expect(entry).toContain("timeout");
  });

  it("includes duration", () => {
    const entry = formatJournalEntry(makeResult({ durationMs: 1234 }));
    expect(entry).toContain("1234ms");
  });

  it("includes iteration number", () => {
    const entry = formatJournalEntry(makeResult({ iteration: 7 }));
    expect(entry).toContain("Iteration 7");
  });
});

// ── successRate ─────────────────────────────────────────────────────

describe("successRate", () => {
  it("returns 0 for empty", () => {
    expect(successRate([])).toBe(0);
  });

  it("returns 1 for all success", () => {
    expect(successRate([makeResult(), makeResult()])).toBe(1);
  });

  it("returns 0 for all failure", () => {
    expect(successRate([makeResult({ success: false })])).toBe(0);
  });

  it("returns correct ratio", () => {
    const results = [makeResult(), makeResult({ success: false }), makeResult()];
    expect(successRate(results)).toBeCloseTo(0.6667, 3);
  });
});

// ── mergeResilientConfig ────────────────────────────────────────────

describe("mergeResilientConfig", () => {
  it("uses defaults", () => {
    const config = mergeResilientConfig({ projectDir: "/test" });
    expect(config.maxIterations).toBe(5);
    expect(config.cacheTtlMs).toBe(30000);
  });

  it("respects overrides", () => {
    const config = mergeResilientConfig({ projectDir: "/test", maxIterations: 10, cacheTtlMs: 5000 });
    expect(config.maxIterations).toBe(10);
    expect(config.cacheTtlMs).toBe(5000);
  });

  it("always includes projectDir", () => {
    const config = mergeResilientConfig({ projectDir: "/my/project" });
    expect(config.projectDir).toBe("/my/project");
  });
});
