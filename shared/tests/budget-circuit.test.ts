/**
 * Integration tests for budget-checkpoint.ts and circuit-breaker.ts
 * Tests the resilience layer — error handling, budget limits, and circuit breaking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  estimateTurnsUsed,
  shouldBudgetCheckpoint,
  buildBudgetCheckpointEntry,
  resetBudgetState,
  CHECKPOINT_THRESHOLD,
  BLOCK_TURNS,
} from "../workflows/budget-checkpoint.js";

import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../workflows/circuit-breaker.js";

// ─── Budget Checkpoint Tests ─────────────────────────────────────────────────

describe("budget-checkpoint", () => {
  const projectId = "test-project-" + Date.now();

  beforeEach(() => {
    resetBudgetState(projectId);
  });

  it("exports correct constants", () => {
    expect(BLOCK_TURNS).toBe(60);
    expect(CHECKPOINT_THRESHOLD).toBe(48);
  });

  it("estimateTurnsUsed without review", () => {
    expect(estimateTurnsUsed(1, false)).toBe(2); // 1 + 1*(1+0)
    expect(estimateTurnsUsed(5, false)).toBe(6); // 1 + 5*1
  });

  it("estimateTurnsUsed with review", () => {
    expect(estimateTurnsUsed(1, true)).toBe(3); // 1 + 1*(1+1)
    expect(estimateTurnsUsed(5, true)).toBe(11); // 1 + 5*2
  });

  it("shouldBudgetCheckpoint returns false below threshold", () => {
    expect(shouldBudgetCheckpoint(projectId, 5, 3)).toBe(false);
  });

  it("shouldBudgetCheckpoint returns true at threshold", () => {
    // Need turns >= 48. With review: 1 + iteration*2 >= 48 → iteration >= 24
    expect(shouldBudgetCheckpoint(projectId, 24, 1)).toBe(true);
  });

  it("shouldBudgetCheckpoint only triggers once per project", () => {
    expect(shouldBudgetCheckpoint(projectId, 24, 1)).toBe(true);
    expect(shouldBudgetCheckpoint(projectId, 25, 1)).toBe(false);
  });

  it("resetBudgetState allows re-checkpoint", () => {
    shouldBudgetCheckpoint(projectId, 24, 1);
    resetBudgetState(projectId);
    expect(shouldBudgetCheckpoint(projectId, 24, 1)).toBe(true);
  });

  it("buildBudgetCheckpointEntry contains expected info", () => {
    const entry = buildBudgetCheckpointEntry(10, 45);
    expect(entry).toContain("Budget Checkpoint");
    expect(entry).toContain("iteration 10");
    expect(entry).toContain("~45 turns used");
    expect(entry).toContain(`${CHECKPOINT_THRESHOLD}/${BLOCK_TURNS}`);
  });

  it("reviewEvery affects when checkpoint triggers", () => {
    // reviewEvery=5, iteration=5 → hasReview=true → turns = 1+5*2=11
    expect(shouldBudgetCheckpoint(projectId, 5, 5)).toBe(false);
  });
});

// ─── Circuit Breaker Tests ───────────────────────────────────────────────────

describe("circuit-breaker", () => {
  let agentsRoot: string;

  beforeEach(() => {
    agentsRoot = mkdtempSync(join(tmpdir(), "cb-test-"));
    mkdirSync(join(agentsRoot, "shared"), { recursive: true });
  });

  afterEach(() => {
    rmSync(agentsRoot, { recursive: true, force: true });
  });

  it("checkCircuitBreaker returns null for unknown agent", () => {
    expect(checkCircuitBreaker(agentsRoot, "worker")).toBeNull();
  });

  it("recordOutcome success keeps circuit closed", () => {
    recordOutcome(agentsRoot, "worker", false);
    expect(checkCircuitBreaker(agentsRoot, "worker")).toBeNull();
  });

  it("recordOutcome error below threshold keeps circuit closed", () => {
    recordOutcome(agentsRoot, "worker", true, "timeout");
    recordOutcome(agentsRoot, "worker", true, "timeout");
    expect(checkCircuitBreaker(agentsRoot, "worker")).toBeNull();
  });

  it("recordOutcome trips breaker at 3 consecutive errors", () => {
    recordOutcome(agentsRoot, "worker", true, "err1");
    recordOutcome(agentsRoot, "worker", true, "err2");
    recordOutcome(agentsRoot, "worker", true, "err3");
    const result = checkCircuitBreaker(agentsRoot, "worker");
    expect(result).toContain("Circuit breaker OPEN");
    expect(result).toContain("3 consecutive errors");
  });

  it("success resets consecutive error count", () => {
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", false); // reset
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    expect(checkCircuitBreaker(agentsRoot, "worker")).toBeNull();
  });

  it("writes SIGNAL file when breaker trips", () => {
    mkdirSync(join(agentsRoot, "worker"), { recursive: true });
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    const signalPath = join(agentsRoot, "worker", "SIGNAL-circuit-breaker.md");
    expect(existsSync(signalPath)).toBe(true);
    const content = readFileSync(signalPath, "utf-8");
    expect(content).toContain("Circuit Breaker Tripped");
  });

  it("deleting SIGNAL file manually resets breaker", () => {
    mkdirSync(join(agentsRoot, "worker"), { recursive: true });
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    const signalPath = join(agentsRoot, "worker", "SIGNAL-circuit-breaker.md");
    rmSync(signalPath, { force: true });
    expect(checkCircuitBreaker(agentsRoot, "worker")).toBeNull();
  });

  it("resetCircuitBreaker programmatically resets", () => {
    mkdirSync(join(agentsRoot, "worker"), { recursive: true });
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    recordOutcome(agentsRoot, "worker", true);
    resetCircuitBreaker(agentsRoot, "worker");
    expect(checkCircuitBreaker(agentsRoot, "worker")).toBeNull();
  });

  it("independent agents have independent breakers", () => {
    mkdirSync(join(agentsRoot, "a"), { recursive: true });
    mkdirSync(join(agentsRoot, "b"), { recursive: true });
    recordOutcome(agentsRoot, "a", true);
    recordOutcome(agentsRoot, "a", true);
    recordOutcome(agentsRoot, "a", true);
    recordOutcome(agentsRoot, "b", false);
    expect(checkCircuitBreaker(agentsRoot, "a")).not.toBeNull();
    expect(checkCircuitBreaker(agentsRoot, "b")).toBeNull();
  });
});
