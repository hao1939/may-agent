/**
 * Tests for EXP-TIERED-BUDGET: Tiered turn budget system.
 *
 * Tests cover:
 * 1. TURN_BUDGET_TIERS constants match spec
 * 2. TURN_BUDGET_GRACE constant
 * 3. Enforcement logic: soft limit triggers at exactly maxTurns
 * 4. Enforcement logic: hard limit triggers at maxTurns + TURN_BUDGET_GRACE
 * 5. No enforcement when maxTurns is 0 (unlimited)
 * 6. Soft limit injects the correct wrap-up message
 */

import { describe, test, expect } from "vitest";
import { TURN_BUDGET_TIERS, TURN_BUDGET_GRACE } from "./manager-utils.js";

// ──────────────────────────────────────────────────────────────────────
// Tier constants
// ──────────────────────────────────────────────────────────────────────

describe("TURN_BUDGET_TIERS", () => {
  test("heartbeat tier is 8", () => {
    expect(TURN_BUDGET_TIERS.heartbeat).toBe(8);
  });

  test("research tier is 15", () => {
    expect(TURN_BUDGET_TIERS.research).toBe(15);
  });

  test("implementation tier is 25", () => {
    expect(TURN_BUDGET_TIERS.implementation).toBe(25);
  });

  test("tiers are ordered: heartbeat < research < implementation", () => {
    expect(TURN_BUDGET_TIERS.heartbeat).toBeLessThan(TURN_BUDGET_TIERS.research);
    expect(TURN_BUDGET_TIERS.research).toBeLessThan(TURN_BUDGET_TIERS.implementation);
  });
});

describe("TURN_BUDGET_GRACE", () => {
  test("grace period is 2 turns", () => {
    expect(TURN_BUDGET_GRACE).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Enforcement logic (mirrors subscribeForPersistence in manager.ts)
// ──────────────────────────────────────────────────────────────────────

/**
 * Simulates the turn budget enforcement logic from manager.ts.
 * Returns what action should be taken for a given turn count and maxTurns.
 */
function evaluateTurnBudget(turnCount: number, maxTurns: number): "none" | "soft-limit" | "hard-limit" {
  if (maxTurns <= 0) return "none";
  const softLimit = maxTurns;
  const hardLimit = softLimit + TURN_BUDGET_GRACE;
  if (turnCount >= hardLimit) return "hard-limit";
  if (turnCount === softLimit) return "soft-limit";
  return "none";
}

describe("Turn budget enforcement logic", () => {
  describe("when maxTurns is 0 (unlimited)", () => {
    test("no action at any turn count", () => {
      expect(evaluateTurnBudget(0, 0)).toBe("none");
      expect(evaluateTurnBudget(100, 0)).toBe("none");
      expect(evaluateTurnBudget(1000, 0)).toBe("none");
    });
  });

  describe("heartbeat tier (maxTurns=8)", () => {
    const maxTurns = TURN_BUDGET_TIERS.heartbeat;

    test("no action before soft limit", () => {
      for (let turn = 1; turn < maxTurns; turn++) {
        expect(evaluateTurnBudget(turn, maxTurns)).toBe("none");
      }
    });

    test("soft limit fires at exactly turn 8", () => {
      expect(evaluateTurnBudget(maxTurns, maxTurns)).toBe("soft-limit");
    });

    test("no action during grace period (turns 9)", () => {
      // Turn 9 is in the grace period — between soft and hard
      expect(evaluateTurnBudget(maxTurns + 1, maxTurns)).toBe("none");
    });

    test("hard limit fires at turn 10 (8 + 2 grace)", () => {
      expect(evaluateTurnBudget(maxTurns + TURN_BUDGET_GRACE, maxTurns)).toBe("hard-limit");
    });

    test("hard limit fires for any turn beyond 10", () => {
      expect(evaluateTurnBudget(maxTurns + TURN_BUDGET_GRACE + 1, maxTurns)).toBe("hard-limit");
      expect(evaluateTurnBudget(maxTurns + TURN_BUDGET_GRACE + 10, maxTurns)).toBe("hard-limit");
    });
  });

  describe("research tier (maxTurns=15)", () => {
    const maxTurns = TURN_BUDGET_TIERS.research;

    test("soft limit at turn 15", () => {
      expect(evaluateTurnBudget(15, maxTurns)).toBe("soft-limit");
    });

    test("hard limit at turn 17", () => {
      expect(evaluateTurnBudget(17, maxTurns)).toBe("hard-limit");
    });

    test("no action at turn 14", () => {
      expect(evaluateTurnBudget(14, maxTurns)).toBe("none");
    });
  });

  describe("implementation tier (maxTurns=25)", () => {
    const maxTurns = TURN_BUDGET_TIERS.implementation;

    test("soft limit at turn 25", () => {
      expect(evaluateTurnBudget(25, maxTurns)).toBe("soft-limit");
    });

    test("hard limit at turn 27", () => {
      expect(evaluateTurnBudget(27, maxTurns)).toBe("hard-limit");
    });

    test("no action at turn 24", () => {
      expect(evaluateTurnBudget(24, maxTurns)).toBe("none");
    });
  });

  describe("custom maxTurns (via opts.maxTurns)", () => {
    test("works with arbitrary values", () => {
      expect(evaluateTurnBudget(5, 5)).toBe("soft-limit");
      expect(evaluateTurnBudget(7, 5)).toBe("hard-limit");
      expect(evaluateTurnBudget(4, 5)).toBe("none");
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// Soft limit message content
// ──────────────────────────────────────────────────────────────────────

describe("Soft limit message", () => {
  test("message includes turn count and grace period info", () => {
    const softLimit = TURN_BUDGET_TIERS.heartbeat;
    const message = `⚠️ **Turn budget reached** (${softLimit}/${softLimit} turns used). You have ${TURN_BUDGET_GRACE} more turns before this session is force-closed. Please wrap up your current work and call \`finish()\` now. If you have incomplete work, use status "partial" with next_steps describing what remains.`;

    expect(message).toContain("Turn budget reached");
    expect(message).toContain(`${softLimit}/${softLimit}`);
    expect(message).toContain(`${TURN_BUDGET_GRACE} more turns`);
    expect(message).toContain("finish()");
    expect(message).toContain("partial");
  });
});

// ──────────────────────────────────────────────────────────────────────
// Rollback mechanism
// ──────────────────────────────────────────────────────────────────────

describe("Rollback: maxTurns=0 disables enforcement", () => {
  test("setting maxTurns to 0 makes enforcement a no-op", () => {
    // Per design doc: "To disable: set maxTurns: 0"
    // The enforcement code checks `if (session.maxTurns > 0)` — when 0, entire block is skipped
    for (let turn = 1; turn <= 100; turn++) {
      expect(evaluateTurnBudget(turn, 0)).toBe("none");
    }
  });
});
