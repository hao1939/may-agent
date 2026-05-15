import { describe, it, expect, beforeEach } from "bun:test";
import {
  estimateTurnsUsed,
  shouldBudgetCheckpoint,
  buildBudgetCheckpointEntry,
  resetBudgetState,
  CHECKPOINT_THRESHOLD,
  BLOCK_TURNS,
} from "../workflows/budget-checkpoint.js";

describe("budget-checkpoint", () => {
  beforeEach(() => {
    resetBudgetState("test-project");
  });

  describe("constants", () => {
    it("BLOCK_TURNS is 60", () => {
      expect(BLOCK_TURNS).toBe(60);
    });

    it("CHECKPOINT_THRESHOLD is 48 (80% of 60)", () => {
      expect(CHECKPOINT_THRESHOLD).toBe(48);
    });
  });

  describe("estimateTurnsUsed", () => {
    it("returns 1 for iteration 0 without review", () => {
      expect(estimateTurnsUsed(0, false)).toBe(1);
    });

    it("returns 1 + iteration for no-review iterations", () => {
      expect(estimateTurnsUsed(5, false)).toBe(6);
    });

    it("adds review turn when hasReview is true", () => {
      expect(estimateTurnsUsed(5, true)).toBe(11);
    });

    it("iteration 1 with review = 3 turns", () => {
      expect(estimateTurnsUsed(1, true)).toBe(3);
    });

    it("high iteration without review", () => {
      expect(estimateTurnsUsed(47, false)).toBe(48);
    });
  });

  describe("shouldBudgetCheckpoint", () => {
    it("returns false for early iterations", () => {
      expect(shouldBudgetCheckpoint("test-project", 1, 3)).toBe(false);
    });

    it("returns false at iteration 20 with reviewEvery=3", () => {
      expect(shouldBudgetCheckpoint("test-project", 20, 3)).toBe(false);
    });

    it("returns true when turns reach threshold (iteration 47, no review)", () => {
      expect(shouldBudgetCheckpoint("test-project", 47, 3)).toBe(true);
    });

    it("returns true at threshold with review", () => {
      // iteration 24 with review: 1 + 24*(1+1) = 49 >= 48
      expect(shouldBudgetCheckpoint("test-project", 24, 3)).toBe(true);
    });

    it("only checkpoints once per project run", () => {
      shouldBudgetCheckpoint("test-project", 47, 3); // triggers
      expect(shouldBudgetCheckpoint("test-project", 48, 3)).toBe(false);
    });

    it("different projects are independent", () => {
      shouldBudgetCheckpoint("project-a", 47, 3);
      expect(shouldBudgetCheckpoint("project-b", 47, 3)).toBe(true);
      resetBudgetState("project-a");
      resetBudgetState("project-b");
    });
  });

  describe("buildBudgetCheckpointEntry", () => {
    it("includes iteration number", () => {
      const entry = buildBudgetCheckpointEntry(10, 21);
      expect(entry).toContain("iteration 10");
    });

    it("includes turns estimate", () => {
      const entry = buildBudgetCheckpointEntry(10, 21);
      expect(entry).toContain("~21 turns used");
    });

    it("includes threshold info", () => {
      const entry = buildBudgetCheckpointEntry(10, 48);
      expect(entry).toContain("48/60");
    });

    it("starts with markdown heading", () => {
      const entry = buildBudgetCheckpointEntry(5, 30);
      expect(entry.startsWith("### Budget Checkpoint")).toBe(true);
    });
  });

  describe("resetBudgetState", () => {
    it("allows re-checkpointing after reset", () => {
      shouldBudgetCheckpoint("test-project", 47, 3); // triggers, sets checkpointed
      resetBudgetState("test-project");
      expect(shouldBudgetCheckpoint("test-project", 47, 3)).toBe(true);
      resetBudgetState("test-project");
    });
  });
});
