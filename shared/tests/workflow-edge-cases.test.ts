/**
 * workflow-edge-cases.test.ts — Adversarial/edge-case tests for workflow orchestration.
 * Tests timeout handling, partial failures, retry exhaustion, concurrent execution,
 * malformed responses, and empty task lists.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Import real modules ─────────────────────────────────────────────────
import { extractDecision } from "../workflows/master-worker.ts";
import { snapshotOutputs, diffSnapshots } from "../workflows/master-worker.ts";
import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../workflows/circuit-breaker.ts";
import {
  calculateDelay,
  isWorkerRetryable,
} from "../workflows/worker-retry.ts";

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Helpers ─────────────────────────────────────────────────────────────

function makeTempDir(): string {
  const dir = join(tmpdir(), `edge-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeFakeAgentsRoot(): string {
  const root = makeTempDir();
  mkdirSync(join(root, "shared"), { recursive: true });
  return root;
}

// ── 1. Timeout simulation tests ─────────────────────────────────────────

describe("Timeout handling", () => {
  it("should detect when a promise exceeds a timeout", async () => {
    const timeout = (ms: number) =>
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
    const slow = new Promise((resolve) => setTimeout(resolve, 500));

    const result = await Promise.race([slow, timeout(50)]).catch((e) => e);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("timeout");
  });

  it("should treat timeout errors as retryable", () => {
    expect(isWorkerRetryable(new Error("timeout exceeded"))).toBe(true);
    expect(isWorkerRetryable(new Error("ETIMEDOUT"))).toBe(true);
    expect(isWorkerRetryable(new Error("request timed out"))).toBe(true);
  });

  it("calculateDelay caps at maxDelayMs even with high attempt count", () => {
    const delay = calculateDelay(100, 1000, 2, 30000);
    expect(delay).toBeLessThanOrEqual(33000); // 30000 + 10% jitter
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});

// ── 2. Partial failure tests ────────────────────────────────────────────

describe("Partial failure (some steps succeed, some fail)", () => {
  it("extractDecision handles mixed success/failure text as CONTINUE", () => {
    const text = "CONTINUE\nStep 1 succeeded. Step 2 failed. Step 3 succeeded.";
    const d = extractDecision(text);
    expect(d.status).toBe("continue");
  });

  it("extractDecision picks up BLOCKED even after success mentions", () => {
    const text = "BLOCKED\nSteps 1-3 succeeded but step 4 is blocked on external API";
    const d = extractDecision(text);
    expect(d.status).toBe("blocked");
  });

  it("diffSnapshots correctly reports only changed files in partial success", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "a.txt"), "original");
    writeFileSync(join(dir, "b.txt"), "original");
    const before = snapshotOutputs(dir);

    // Only modify one file (different size to trigger snapshot diff)
    writeFileSync(join(dir, "a.txt"), "modified content that is significantly longer than the original to ensure size change is detected!!!");
    const after = snapshotOutputs(dir);

    const changed = diffSnapshots(before, after);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain("a.txt");

    rmSync(dir, { recursive: true, force: true });
  });

  it("diffSnapshots detects new files added during partial success", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "existing.txt"), "ok");
    const before = snapshotOutputs(dir);

    writeFileSync(join(dir, "new-file.txt"), "hello");
    const after = snapshotOutputs(dir);

    const changed = diffSnapshots(before, after);
    expect(changed.some((f) => f.includes("new-file.txt"))).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});

// ── 3. Retry exhaustion tests ───────────────────────────────────────────

describe("Retry exhaustion (max retries exceeded)", () => {
  it("calculateDelay uses exponential backoff", () => {
    const d1 = calculateDelay(1, 1000, 2, 60000);
    const d2 = calculateDelay(2, 1000, 2, 60000);
    const d3 = calculateDelay(3, 1000, 2, 60000);
    // With jitter, check approximate ranges
    expect(d1).toBeGreaterThan(800);
    expect(d1).toBeLessThan(1200);
    expect(d2).toBeGreaterThan(1600);
    expect(d2).toBeLessThan(2400);
    expect(d3).toBeGreaterThan(3200);
    expect(d3).toBeLessThan(4800);
  });

  it("circuit breaker trips after threshold consecutive errors", () => {
    const root = makeFakeAgentsRoot();
    const agent = "test-agent";
    mkdirSync(join(root, agent), { recursive: true });

    recordOutcome(root, agent, true);
    expect(checkCircuitBreaker(root, agent)).toBeNull();
    recordOutcome(root, agent, true);
    expect(checkCircuitBreaker(root, agent)).toBeNull();
    recordOutcome(root, agent, true); // 3rd consecutive error = trip
    const result = checkCircuitBreaker(root, agent);
    expect(result).not.toBeNull();
    expect(result).toContain("Circuit breaker OPEN");

    rmSync(root, { recursive: true, force: true });
  });

  it("non-retryable errors should not be retried", () => {
    expect(isWorkerRetryable(new Error("authentication failed"))).toBe(false);
    expect(isWorkerRetryable(new Error("invalid api key"))).toBe(false);
    expect(isWorkerRetryable(new Error("permission denied"))).toBe(false);
  });

  it("retryable errors are correctly identified", () => {
    expect(isWorkerRetryable(new Error("rate limit exceeded"))).toBe(true);
    expect(isWorkerRetryable(new Error("no output: worker produced 0 files"))).toBe(true);
    expect(isWorkerRetryable(new Error("503 service unavailable"))).toBe(true);
  });
});

// ── 4. Concurrent workflow execution tests ──────────────────────────────

describe("Concurrent workflow execution", () => {
  it("independent circuit breakers for different agents", () => {
    const root = makeFakeAgentsRoot();
    mkdirSync(join(root, "agent-a"), { recursive: true });
    mkdirSync(join(root, "agent-b"), { recursive: true });

    // Trip agent-a
    for (let i = 0; i < 3; i++) recordOutcome(root, "agent-a", true);
    // agent-b should still be fine
    recordOutcome(root, "agent-b", false);

    expect(checkCircuitBreaker(root, "agent-a")).not.toBeNull();
    expect(checkCircuitBreaker(root, "agent-b")).toBeNull();

    rmSync(root, { recursive: true, force: true });
  });

  it("concurrent snapshots on same directory are consistent", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "f1.txt"), "data1");
    writeFileSync(join(dir, "f2.txt"), "data2");

    const snap1 = snapshotOutputs(dir);
    const snap2 = snapshotOutputs(dir);

    expect(diffSnapshots(snap1, snap2)).toHaveLength(0);

    rmSync(dir, { recursive: true, force: true });
  });

  it("resetting one agent does not affect another", () => {
    const root = makeFakeAgentsRoot();
    mkdirSync(join(root, "a1"), { recursive: true });
    mkdirSync(join(root, "a2"), { recursive: true });

    for (let i = 0; i < 3; i++) recordOutcome(root, "a1", true);
    for (let i = 0; i < 3; i++) recordOutcome(root, "a2", true);

    resetCircuitBreaker(root, "a1");
    expect(checkCircuitBreaker(root, "a1")).toBeNull();
    expect(checkCircuitBreaker(root, "a2")).not.toBeNull();

    rmSync(root, { recursive: true, force: true });
  });
});

// ── 5. Malformed worker response tests ──────────────────────────────────

describe("Malformed worker responses", () => {
  it("extractDecision handles empty string", () => {
    const d = extractDecision("");
    expect(d.status).toBe("unknown");
  });

  it("extractDecision handles garbage text", () => {
    const d = extractDecision("asdf1234!@#$%^&*()");
    expect(d.status).toBe("unknown");
  });

  it("extractDecision handles very long text without crashing", () => {
    const longText = "CONTINUE\n" + "x".repeat(100000);
    const d = extractDecision(longText);
    expect(d.status).toBe("continue");
    expect(d.detail.length).toBeLessThanOrEqual(500);
  });

  it("extractDecision handles text with only whitespace", () => {
    const d = extractDecision("   \n\n\t  ");
    expect(d.status).toBe("unknown");
  });

  it("extractDecision handles decision keyword embedded in sentence", () => {
    // "proceed" triggers continue
    const d = extractDecision("I think we should proceed with the implementation");
    expect(d.status).toBe("continue");
  });

  it("snapshotOutputs handles non-existent directory gracefully", () => {
    const snap = snapshotOutputs("/tmp/nonexistent-dir-" + Date.now());
    expect(snap.size).toBe(0);
  });
});

// ── 6. Empty task list tests ────────────────────────────────────────────

describe("Empty task lists", () => {
  it("diffSnapshots returns empty array when nothing changed", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "stable.txt"), "content");
    const snap = snapshotOutputs(dir);
    expect(diffSnapshots(snap, snap)).toHaveLength(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it("diffSnapshots handles both snapshots empty", () => {
    const empty = new Map<string, number>();
    expect(diffSnapshots(empty, empty)).toHaveLength(0);
  });

  it("extractDecision with DONE status stops dispatch", () => {
    const d = extractDecision("DONE\nAll tasks completed successfully");
    expect(d.status).toBe("done");
  });

  it("circuit breaker on agent with no prior state returns null", () => {
    const root = makeFakeAgentsRoot();
    expect(checkCircuitBreaker(root, "never-seen-agent")).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });

  it("calculateDelay with attempt=0 returns reasonable value", () => {
    const d = calculateDelay(0, 1000, 2, 30000);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(33000);
  });
});
