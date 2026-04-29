import { describe, it, expect, beforeEach } from "vitest";
import {
  estimateTurnsUsed,
  shouldBudgetCheckpoint,
  buildBudgetCheckpointEntry,
  resetBudgetState,
  CHECKPOINT_THRESHOLD,
  BLOCK_TURNS,
} from "../shared/workflows/budget-checkpoint.ts";

describe("budget-checkpoint", () => {
  describe("estimateTurnsUsed", () => {
    it("returns 1 for iteration 0 (just eval)", () => {
      expect(estimateTurnsUsed(0, false)).toBe(1);
    });

    it("counts 1 turn per iteration without review", () => {
      expect(estimateTurnsUsed(5, false)).toBe(6); // 1 + 5*1
    });

    it("counts 2 turns per iteration with review", () => {
      expect(estimateTurnsUsed(5, true)).toBe(11); // 1 + 5*2
    });
  });

  describe("shouldBudgetCheckpoint", () => {
    const pid = "test-project";

    beforeEach(() => {
      resetBudgetState(pid);
    });

    it("returns false when under threshold", () => {
      expect(shouldBudgetCheckpoint(pid, 5, 3)).toBe(false);
    });

    it("returns true when at/above threshold (48 turns)", () => {
      // iteration=47, reviewEvery=1 → hasReview=true → turns = 1 + 47*2 = 95 > 48
      expect(shouldBudgetCheckpoint(pid, 47, 1)).toBe(true);
    });

    it("returns true only once per project run", () => {
      expect(shouldBudgetCheckpoint(pid, 47, 1)).toBe(true);
      expect(shouldBudgetCheckpoint(pid, 48, 1)).toBe(false); // already checkpointed
    });

    it("works independently per project", () => {
      expect(shouldBudgetCheckpoint("a", 47, 1)).toBe(true);
      expect(shouldBudgetCheckpoint("b", 47, 1)).toBe(true);
      resetBudgetState("a");
      resetBudgetState("b");
    });

    it("considers review schedule for threshold calc", () => {
      // iteration=24, reviewEvery=2 → iteration%2==0 → hasReview=true → turns=1+24*2=49 ≥ 48
      expect(shouldBudgetCheckpoint(pid, 24, 2)).toBe(true);
    });
  });

  describe("buildBudgetCheckpointEntry", () => {
    it("includes iteration and turns info", () => {
      const entry = buildBudgetCheckpointEntry(10, 48);
      expect(entry).toContain("iteration 10");
      expect(entry).toContain("~48 turns used");
      expect(entry).toContain(`${CHECKPOINT_THRESHOLD}/${BLOCK_TURNS}`);
    });

    it("includes ISO timestamp", () => {
      const entry = buildBudgetCheckpointEntry(5, 30);
      expect(entry).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("resetBudgetState", () => {
    it("allows re-checkpointing after reset", () => {
      const pid = "reset-test";
      shouldBudgetCheckpoint(pid, 47, 1); // triggers checkpoint
      expect(shouldBudgetCheckpoint(pid, 48, 1)).toBe(false); // blocked
      resetBudgetState(pid);
      expect(shouldBudgetCheckpoint(pid, 47, 1)).toBe(true); // works again
      resetBudgetState(pid);
    });
  });

  describe("constants", () => {
    it("CHECKPOINT_THRESHOLD is 80% of BLOCK_TURNS", () => {
      expect(CHECKPOINT_THRESHOLD).toBe(Math.floor(BLOCK_TURNS * 0.8));
    });

    it("BLOCK_TURNS is 60", () => {
      expect(BLOCK_TURNS).toBe(60);
    });
  });
});
