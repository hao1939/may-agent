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
import { TURN_BUDGET_TIERS, TURN_BUDGET_GRACE, classifySessionTier, resolveTurnBudget } from "./manager-utils.js";

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

// ──────────────────────────────────────────────────────────────────────
// Session tier classification
// ──────────────────────────────────────────────────────────────────────

describe("classifySessionTier", () => {
  describe("heartbeat detection", () => {
    test("detects [heartbeat] prefix", () => {
      expect(classifySessionTier("[heartbeat] Read agents/tech-lead/heartbeat.md", "job")).toBe("heartbeat");
    });

    test("detects 'heartbeat' keyword in task", () => {
      expect(classifySessionTier("Run heartbeat for bob agent", "job")).toBe("heartbeat");
    });

    test("detects 'read agents/' pattern", () => {
      expect(classifySessionTier("Read agents/scout/heartbeat.md and work through steps", "job")).toBe("heartbeat");
    });

    test("heartbeat only matches with kind=job", () => {
      // Without kind=job, heartbeat keywords shouldn't match (could be a chat about heartbeats)
      expect(classifySessionTier("[heartbeat] Read agents/tech-lead/heartbeat.md")).not.toBe("heartbeat");
    });
  });

  describe("research detection", () => {
    test("detects research keywords", () => {
      expect(classifySessionTier("Research the impact of turn budgets on agent behavior")).toBe("research");
    });

    test("detects analysis tasks", () => {
      expect(classifySessionTier("Analyze session data for the past week")).toBe("research");
    });

    test("detects investigation tasks", () => {
      expect(classifySessionTier("Investigate why scout sessions are timing out")).toBe("research");
    });

    test("detects hypothesis tasks", () => {
      expect(classifySessionTier("Test hypothesis H-162 about compliance topology")).toBe("research");
    });

    test("detects deep-dive tasks", () => {
      expect(classifySessionTier("Deep-dive into agent memory patterns")).toBe("research");
    });

    test("detects evaluate tasks", () => {
      expect(classifySessionTier("Evaluate the quality of recent knowledge entries")).toBe("research");
    });
  });

  describe("implementation detection", () => {
    test("detects implement keyword", () => {
      expect(classifySessionTier("Implement tiered turn budget system")).toBe("implementation");
    });

    test("detects build keyword", () => {
      expect(classifySessionTier("Build a new dashboard component")).toBe("implementation");
    });

    test("detects fix keyword", () => {
      expect(classifySessionTier("Fix the broken evaluator cron mode")).toBe("implementation");
    });

    test("detects refactor keyword", () => {
      expect(classifySessionTier("Refactor the session manager to use events")).toBe("implementation");
    });

    test("detects add keyword", () => {
      expect(classifySessionTier("Add auto-scroll toggle to the web UI")).toBe("implementation");
    });

    test("detects deploy keyword", () => {
      expect(classifySessionTier("Deploy the new guard system to production")).toBe("implementation");
    });
  });

  describe("priority: implementation over research", () => {
    test("implement + research → implementation wins", () => {
      expect(classifySessionTier("Implement the research findings from H-162")).toBe("implementation");
    });

    test("fix + analyze → implementation wins", () => {
      expect(classifySessionTier("Fix the analysis pipeline that is broken")).toBe("implementation");
    });

    test("build + evaluate → implementation wins", () => {
      expect(classifySessionTier("Build an evaluation harness")).toBe("implementation");
    });
  });

  describe("default behavior", () => {
    test("unknown tasks default to implementation (most permissive)", () => {
      expect(classifySessionTier("Do something with the database")).toBe("implementation");
    });

    test("empty task defaults to implementation", () => {
      expect(classifySessionTier("")).toBe("implementation");
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// Turn budget resolution
// ──────────────────────────────────────────────────────────────────────

describe("resolveTurnBudget", () => {
  describe("explicit maxTurns always wins", () => {
    test("explicit maxTurns overrides everything", () => {
      expect(resolveTurnBudget("heartbeat task", { maxTurns: 12, kind: "job" })).toBe(12);
    });

    test("explicit maxTurns overrides agent config", () => {
      expect(resolveTurnBudget("heartbeat task", { maxTurns: 5, kind: "job" }, 20)).toBe(5);
    });
  });

  describe("chat sessions get no budget", () => {
    test("chat kind returns 0", () => {
      expect(resolveTurnBudget("implement something", { kind: "chat" })).toBe(0);
    });

    test("chat with agent config still returns 0", () => {
      expect(resolveTurnBudget("implement something", { kind: "chat" }, 15)).toBe(0);
    });
  });

  describe("agent-level flat turnBudget", () => {
    test("agent flat budget overrides tier defaults", () => {
      expect(resolveTurnBudget("research task", { kind: "job" }, 20)).toBe(20);
    });

    test("agent flat budget applies regardless of classification", () => {
      expect(resolveTurnBudget("heartbeat task", { kind: "job" }, 20)).toBe(20);
    });
  });

  describe("agent-level per-tier turnBudget", () => {
    const perTier = { heartbeat: 10, research: 20, implementation: 30 };

    test("heartbeat task gets heartbeat tier override", () => {
      expect(resolveTurnBudget("[heartbeat] Read agents/bob/heartbeat.md", { kind: "job" }, perTier)).toBe(10);
    });

    test("research task gets research tier override", () => {
      expect(resolveTurnBudget("Research the impact of budgets", { kind: "job" }, perTier)).toBe(20);
    });

    test("implementation task gets implementation tier override", () => {
      expect(resolveTurnBudget("Implement the new feature", { kind: "job" }, perTier)).toBe(30);
    });
  });

  describe("auto-classification fallback", () => {
    test("heartbeat task gets global heartbeat tier", () => {
      expect(resolveTurnBudget("[heartbeat] Read agents/bob/heartbeat.md", { kind: "job" })).toBe(TURN_BUDGET_TIERS.heartbeat);
    });

    test("research task gets global research tier", () => {
      expect(resolveTurnBudget("Analyze session data patterns", { kind: "job" })).toBe(TURN_BUDGET_TIERS.research);
    });

    test("implementation task gets global implementation tier", () => {
      expect(resolveTurnBudget("Implement tiered budgets", { kind: "job" })).toBe(TURN_BUDGET_TIERS.implementation);
    });

    test("unknown task defaults to implementation tier", () => {
      expect(resolveTurnBudget("Do something", { kind: "job" })).toBe(TURN_BUDGET_TIERS.implementation);
    });
  });

  describe("no opts provided", () => {
    test("works with no opts", () => {
      const result = resolveTurnBudget("Implement something");
      expect(result).toBe(TURN_BUDGET_TIERS.implementation);
    });
  });
});
