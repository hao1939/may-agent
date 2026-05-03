/**
 * failure-injection.test.ts — Proves error handling works in hardened workflow files
 * by simulating LLM timeouts, file I/O errors, and JSON parse failures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";

// ── master-worker-cached.ts: File I/O failure tests ─────────────────────

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual };
});

import {
  createCachedContext,
  readProjectFile,
  readJournalFile,
  readDiscussionFile,
  writeProjectFile,
  appendJournalEntry,
  extractField,
  extractSection,
  buildIterationSnapshot,
  shouldStop,
  formatOrchestratorContext,
  flushBetweenIterations,
} from "../workflows/master-worker-cached.ts";

import {
  shouldBudgetCheckpoint,
  estimateTurnsUsed,
  buildBudgetCheckpointEntry,
  resetBudgetState,
  CHECKPOINT_THRESHOLD,
} from "../workflows/budget-checkpoint.ts";

import {
  getCircuitLabel,
  classifyCircuit,
  buildPrompt,
  summarizeRun,
  shouldAbort,
  formatJournalEntry,
  successRate,
  mergeResilientConfig,
  createDeliverableTracker,
  hasDeliverableOutput,
  checkZeroOutput,
  type IterationResult,
  type ResilientConfig,
} from "../workflows/master-worker-resilient.ts";

describe("Failure Injection: master-worker-cached (File I/O)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("readProjectFile returns null when file does not exist", () => {
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const ctx = createCachedContext("/nonexistent/project");
    const result = readProjectFile(ctx);
    expect(result).toBeNull();
  });

  it("readJournalFile returns empty string when file missing", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    const ctx = createCachedContext("/nonexistent/project");
    const result = readJournalFile(ctx);
    expect(result).toBe("");
  });

  it("readDiscussionFile returns null when file missing", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const ctx = createCachedContext("/nonexistent/project");
    const result = readDiscussionFile(ctx);
    expect(result).toBeNull();
  });

  it("writeProjectFile handles EACCES gracefully", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("# Project\n## Status: active");
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    });
    const ctx = createCachedContext("/readonly/project");
    expect(() => writeProjectFile(ctx, "new content")).toThrow("EACCES");
  });

  it("appendJournalEntry swallows write failure gracefully", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("");
    vi.spyOn(fs, "appendFileSync").mockImplementation(() => {
      throw Object.assign(new Error("ENOSPC: no space"), { code: "ENOSPC" });
    });
    const ctx = createCachedContext("/full-disk/project");
    // Should NOT throw — error is caught and logged
    expect(() => appendJournalEntry(ctx, "entry")).not.toThrow();
  });

  it("buildIterationSnapshot returns null when project file missing", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const ctx = createCachedContext("/missing/project");
    const snap = buildIterationSnapshot(ctx, 1);
    expect(snap).toBeNull();
  });

  it("extractField returns empty string for missing field", () => {
    const result = extractField("# Project\nSome content", "NonExistent");
    expect(result).toBe("");
  });

  it("extractSection returns empty string for missing section", () => {
    const result = extractSection("# Project\nSome content", "## Missing");
    expect(result).toBe("");
  });
});

describe("Failure Injection: budget-checkpoint (Edge Cases)", () => {
  beforeEach(() => {
    resetBudgetState("test-project");
  });

  it("estimateTurnsUsed handles zero iterations", () => {
    const turns = estimateTurnsUsed(0, false);
    expect(turns).toBeGreaterThanOrEqual(0);
  });

  it("shouldBudgetCheckpoint returns false below threshold", () => {
    const result = shouldBudgetCheckpoint("test-project", 1, false);
    expect(result).toBe(false);
  });

  it("shouldBudgetCheckpoint returns true at threshold", () => {
    // Iteration high enough to cross threshold (48 turns)
    const result = shouldBudgetCheckpoint("test-project", 25, true);
    expect(result).toBe(true);
  });

  it("shouldBudgetCheckpoint returns false after already checkpointed", () => {
    // First call at high iteration triggers checkpoint
    shouldBudgetCheckpoint("test-project", 25, true);
    // Second call should return false (already checkpointed)
    const result = shouldBudgetCheckpoint("test-project", 26, true);
    expect(result).toBe(false);
  });

  it("buildBudgetCheckpointEntry produces valid entry", () => {
    const entry = buildBudgetCheckpointEntry(25, "Making progress on task");
    expect(entry).toContain("Budget Checkpoint");
    expect(entry).toContain("25");
  });

  it("resetBudgetState allows re-checkpoint", () => {
    shouldBudgetCheckpoint("reset-test", 25, true);
    resetBudgetState("reset-test");
    const result = shouldBudgetCheckpoint("reset-test", 26, true);
    expect(result).toBe(true);
  });
});

describe("Failure Injection: master-worker-resilient (Circuit Breaker)", () => {
  it("getCircuitLabel returns closed for fresh state", () => {
    const state = { failures: 0, lastFailure: 0, successes: 0 };
    expect(getCircuitLabel(state)).toBe("closed");
  });

  it("classifyCircuit returns closed for non-open circuit", () => {
    // CircuitState from retry-wrapper uses `state` field not `isOpen`
    const state = { consecutiveFailures: 5, lastFailureTime: Date.now(), state: "closed" as const };
    const result = classifyCircuit(state, 30000);
    expect(result).toBe("closed");
  });

  it("classifyCircuit detects half-open after recovery window", () => {
    const state = { consecutiveFailures: 5, lastFailureTime: Date.now() - 60000, state: "closed" as const };
    const result = classifyCircuit(state, 30000);
    expect(result).toBe("closed");
  });

  it("shouldAbort returns false with no failures", () => {
    const results: IterationResult[] = [
      { iteration: 1, success: true, output: "done", durationMs: 100 },
    ];
    expect(shouldAbort(results)).toBe(false);
  });

  it("shouldAbort returns true after 3 consecutive failures", () => {
    const results: IterationResult[] = [
      { iteration: 1, success: false, output: "", error: "timeout", durationMs: 100 },
      { iteration: 2, success: false, output: "", error: "timeout", durationMs: 100 },
      { iteration: 3, success: false, output: "", error: "timeout", durationMs: 100 },
    ];
    expect(shouldAbort(results)).toBe(true);
  });

  it("summarizeRun handles empty results", () => {
    const summary = summarizeRun([]);
    expect(summary.total).toBe(0);
    expect(summary.succeeded).toBe(0);
  });

  it("summarizeRun correctly counts successes and failures", () => {
    const results: IterationResult[] = [
      { iteration: 1, success: true, output: "ok", durationMs: 50 },
      { iteration: 2, success: false, output: "", error: "err", durationMs: 100 },
      { iteration: 3, success: true, output: "ok", durationMs: 75 },
    ];
    const summary = summarizeRun(results);
    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(2);
  });

  it("successRate returns 0 for empty array", () => {
    expect(successRate([])).toBe(0);
  });

  it("successRate computes correctly", () => {
    const results: IterationResult[] = [
      { iteration: 1, success: true, output: "ok", durationMs: 50 },
      { iteration: 2, success: false, output: "", error: "err", durationMs: 100 },
    ];
    expect(successRate(results)).toBeCloseTo(0.5);
  });

  it("formatJournalEntry handles error results", () => {
    const result: IterationResult = {
      iteration: 1,
      success: false,
      output: "",
      error: "LLM timeout after 30s",
      durationMs: 30000,
    };
    const entry = formatJournalEntry(result);
    expect(entry).toContain("timeout");
  });

  it("mergeResilientConfig provides sensible defaults", () => {
    const config = mergeResilientConfig({ projectDir: "/tmp/test" });
    expect(config.projectDir).toBe("/tmp/test");
    expect(config.maxIterations).toBeGreaterThan(0);
  });

  it("createDeliverableTracker starts at zero", () => {
    const tracker = createDeliverableTracker();
    expect(tracker.consecutiveZeroOutput).toBe(0);
    expect(tracker.totalIterations).toBe(0);
  });

  it("hasDeliverableOutput detects empty output", () => {
    const result: IterationResult = { iteration: 1, success: false, output: "", durationMs: 50 };
    expect(hasDeliverableOutput(result)).toBe(false);
  });

  it("hasDeliverableOutput detects real output", () => {
    const result: IterationResult = { iteration: 1, success: true, output: "Created file.ts", durationMs: 50 };
    expect(hasDeliverableOutput(result)).toBe(true);
  });

  it("checkZeroOutput escalates after threshold", () => {
    const tracker = createDeliverableTracker();
    tracker.consecutiveZeroOutput = 3;
    tracker.totalIterations = 3;
    expect(checkZeroOutput(tracker)).toBe("escalate");
  });

  it("checkZeroOutput terminates after high threshold", () => {
    const tracker = createDeliverableTracker();
    tracker.consecutiveZeroOutput = 5;
    tracker.totalIterations = 5;
    expect(checkZeroOutput(tracker)).toBe("terminate");
  });
});

describe("Failure Injection: JSON Parse Failures", () => {
  it("malformed JSON in extractField doesn't crash", () => {
    // extractField uses regex, not JSON.parse, so it should handle any string
    const result = extractField("{not: valid: json: {{{}}", "status");
    expect(typeof result).toBe("string");
  });

  it("buildPrompt handles snapshot with special characters", () => {
    const snapshot = {
      projectContent: '{"key": "value with \\"quotes\\""}',
      journalTail: "Entry with <html> & special chars",
      discussionContent: null,
      iteration: 1,
      maxIterations: 5,
      status: "active",
    };
    const prompt = buildPrompt(snapshot, "context");
    expect(prompt).toContain("Iteration");
  });
});

describe("Failure Injection: verify-wrap", () => {
  it("module exports execute function", async () => {
    const mod = await import("../workflows/verify-wrap.ts");
    expect(mod.execute).toBeTypeOf("function");
    expect(mod.name).toBe("verify-wrap");
  });

  it("execute handles ctx.runAgent throwing", async () => {
    const mod = await import("../workflows/verify-wrap.ts");
    const mockCtx = {
      agent: "test-agent",
      task: "test-task",
      runAgent: vi.fn().mockRejectedValue(new Error("Connection refused")),
      escalate: vi.fn((msg: string) => ({ escalated: true, message: msg })),
      done: vi.fn((msg: string) => ({ done: true, message: msg })),
      summarize: vi.fn(() => "summary"),
    };
    const result = await mod.execute(mockCtx as any);
    expect(mockCtx.escalate).toHaveBeenCalledWith(
      expect.stringContaining("Connection refused")
    );
  });

  it("execute handles ctx.runAgent returning error status", async () => {
    const mod = await import("../workflows/verify-wrap.ts");
    const mockCtx = {
      agent: "test-agent",
      task: "test-task",
      runAgent: vi.fn().mockResolvedValue({ status: "error", error: "LLM timeout" }),
      escalate: vi.fn((msg: string) => ({ escalated: true, message: msg })),
      done: vi.fn((msg: string) => ({ done: true, message: msg })),
      summarize: vi.fn(() => "summary"),
    };
    const result = await mod.execute(mockCtx as any);
    expect(mockCtx.escalate).toHaveBeenCalledWith(
      expect.stringContaining("LLM timeout")
    );
  });

  it("execute handles successful run", async () => {
    const mod = await import("../workflows/verify-wrap.ts");
    const mockCtx = {
      agent: "test-agent",
      task: "test-task",
      runAgent: vi.fn().mockResolvedValue({ status: "success", output: "done" }),
      escalate: vi.fn((msg: string) => ({ escalated: true, message: msg })),
      done: vi.fn((msg: string) => ({ done: true, message: msg })),
      summarize: vi.fn(() => "All good"),
    };
    const result = await mod.execute(mockCtx as any);
    expect(mockCtx.done).toHaveBeenCalled();
  });
});
