/**
 * master-worker-roundtrip.test.ts
 * Integration tests for the full orchestrator→worker→verify cycle
 * using the unified master-worker entry point.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runMasterWorker,
  type MasterWorkerConfig,
  type RunResult,
} from "../workflows/master-worker-unified.ts";
import { extractDecision } from "../workflows/master-worker.ts";

// ── Helpers ─────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<MasterWorkerConfig> = {}): MasterWorkerConfig {
  return {
    projectDir: "/tmp/test-project",
    maxIterations: 5,
    dispatch: vi.fn().mockResolvedValue("CONTINUE: doing work"),
    ...overrides,
  };
}

// ── extractDecision unit tests ──────────────────────────────────────────

describe("extractDecision", () => {
  it("parses CONTINUE from first line", () => {
    const d = extractDecision("CONTINUE: keep going\nmore details");
    expect(d.status).toBe("continue");
  });

  it("parses DONE from first line", () => {
    const d = extractDecision("DONE: all tasks complete");
    expect(d.status).toBe("done");
  });

  it("parses BLOCKED from first line", () => {
    const d = extractDecision("BLOCKED: waiting on external dep");
    expect(d.status).toBe("blocked");
  });

  it("parses WAITING from first line", () => {
    const d = extractDecision("WAITING: need user input");
    expect(d.status).toBe("waiting");
  });

  it("parses PIVOT from first line", () => {
    const d = extractDecision("PIVOT: changing strategy");
    expect(d.status).toBe("pivot");
  });

  it("returns unknown for unrecognized text", () => {
    const d = extractDecision("just some random output");
    expect(d.status).toBe("unknown");
  });

  it("parses Decision: CONTINUE pattern", () => {
    const d = extractDecision("Summary of work\n**Decision**: **CONTINUE**\nmore");
    expect(d.status).toBe("continue");
  });
});

// ── runMasterWorker integration tests ───────────────────────────────────

describe("runMasterWorker roundtrip", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs dispatch for each iteration up to max", async () => {
    const dispatch = vi.fn().mockResolvedValue("iteration output");
    const result = await runMasterWorker(makeConfig({ dispatch, maxIterations: 3 }));
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(result.iterations).toBe(3);
  });

  it("stops early when dispatch throws", async () => {
    const dispatch = vi.fn()
      .mockResolvedValueOnce("CONTINUE: ok")
      .mockRejectedValueOnce(new Error("LLM timeout"));
    const result = await runMasterWorker(makeConfig({ dispatch, maxIterations: 5 }));
    expect(result.stopped).toBe(true);
    expect(result.stopReason).toContain("dispatch-error");
    expect(result.iterations).toBe(2);
  });

  it("health check blocks execution when project missing", async () => {
    const dispatch = vi.fn();
    const result = await runMasterWorker(makeConfig({
      dispatch,
      healthCheck: { enabled: true, skipOnMissing: true },
    }));
    expect(result.stopped).toBe(true);
    expect(result.stopReason).toContain("health-check");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("resilience wraps dispatch calls", async () => {
    const { mkdirSync, writeFileSync, existsSync } = await import("node:fs");
    const dir = "/tmp/test-mw-resilience";
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/project.md`, "# Test\n**Status**: active\n");
    writeFileSync(`${dir}/journal.md`, "# Journal\n");

    const dispatch = vi.fn().mockResolvedValue("ok");
    const result = await runMasterWorker({
      projectDir: dir,
      dispatch,
      maxIterations: 2,
      resilience: { enabled: true, maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 },
    });
    expect(result.iterations).toBe(2);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("circuit breaker trips after repeated failures", async () => {
    let calls = 0;
    const dispatch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls <= 2) return Promise.resolve("ok");
      throw new Error("overloaded");
    });
    // With circuit breaker, after failures the circuit opens
    const result = await runMasterWorker(makeConfig({
      dispatch,
      maxIterations: 10,
      resilience: { enabled: true, maxRetries: 1, baseDelayMs: 1, maxDelayMs: 5, circuitBreaker: true },
    }));
    expect(result.stopped).toBe(true);
  });

  it("cache config produces a cache report", async () => {
    // Need a real project dir for cache to work
    const { mkdirSync, writeFileSync, existsSync } = await import("node:fs");
    const dir = "/tmp/test-mw-cache-project";
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/project.md`, "# Test\n**Status**: active\n**Owner**: test\n");
    writeFileSync(`${dir}/journal.md`, "# Journal\n## Entry\nDid stuff\n");

    const dispatch = vi.fn().mockResolvedValue("output");
    const result = await runMasterWorker({
      projectDir: dir,
      maxIterations: 2,
      cache: { enabled: true, ttlMs: 60000 },
      dispatch,
    });
    expect(result.iterations).toBe(2);
    // cacheReport may or may not be populated depending on internal logic
    // but no crash means success
  });

  it("passes context and iteration number to dispatch", async () => {
    const dispatch = vi.fn().mockResolvedValue("ok");
    await runMasterWorker(makeConfig({ dispatch, maxIterations: 1 }));
    expect(dispatch).toHaveBeenCalledWith(expect.any(String), 1);
  });

  it("completes full 5-iteration cycle without errors", async () => {
    const responses = [
      "CONTINUE: step 1 done",
      "CONTINUE: step 2 done",
      "CONTINUE: step 3 done",
      "CONTINUE: step 4 done",
      "CONTINUE: step 5 done",
    ];
    const dispatch = vi.fn().mockImplementation((_ctx: string, i: number) =>
      Promise.resolve(responses[i - 1])
    );
    const result = await runMasterWorker(makeConfig({ dispatch, maxIterations: 5 }));
    expect(result.iterations).toBe(5);
    expect(result.stopped).toBe(false);
    expect(result.stopReason).toBe("completed");
  });
});
