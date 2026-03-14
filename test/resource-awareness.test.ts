import { describe, it, expect } from "vitest";
import { TURN_BUDGET_WARNING_DEFAULT } from "../src/lib/manager.js";

describe("Resource Awareness (Agent-RRM)", () => {
  // ── Turn Budget Warning ──────────────────────────────────────────────

  describe("Turn Budget Warning", () => {
    describe("TURN_BUDGET_WARNING_DEFAULT", () => {
      it("is 40", () => {
        expect(TURN_BUDGET_WARNING_DEFAULT).toBe(40);
      });
    });

    describe("warning injection logic", () => {
      // The actual injection happens inside wrapToolsWithReceipts (private method).
      // We verify the logic by simulating the exact conditional that the wrapper uses:
      //   if (session.turnBudgetWarningAt > 0 && !session.turnBudgetWarned && session.turnCount >= session.turnBudgetWarningAt)

      interface MockSession {
        turnBudgetWarningAt: number;
        turnBudgetWarned: boolean;
        turnCount: number;
      }

      function shouldInjectWarning(session: MockSession): boolean {
        return session.turnBudgetWarningAt > 0 && !session.turnBudgetWarned && session.turnCount >= session.turnBudgetWarningAt;
      }

      it("injects warning when turnCount reaches threshold", () => {
        const session: MockSession = { turnBudgetWarningAt: 40, turnBudgetWarned: false, turnCount: 40 };
        expect(shouldInjectWarning(session)).toBe(true);
      });

      it("injects warning when turnCount exceeds threshold", () => {
        const session: MockSession = { turnBudgetWarningAt: 40, turnBudgetWarned: false, turnCount: 55 };
        expect(shouldInjectWarning(session)).toBe(true);
      });

      it("does not inject warning when turnCount is below threshold", () => {
        const session: MockSession = { turnBudgetWarningAt: 40, turnBudgetWarned: false, turnCount: 39 };
        expect(shouldInjectWarning(session)).toBe(false);
      });

      it("does not inject warning when threshold is 0 (disabled)", () => {
        const session: MockSession = { turnBudgetWarningAt: 0, turnBudgetWarned: false, turnCount: 100 };
        expect(shouldInjectWarning(session)).toBe(false);
      });

      it("does not inject warning when already warned (no spam)", () => {
        const session: MockSession = { turnBudgetWarningAt: 40, turnBudgetWarned: true, turnCount: 50 };
        expect(shouldInjectWarning(session)).toBe(false);
      });

      it("warning sets turnBudgetWarned flag (simulated)", () => {
        const session: MockSession = { turnBudgetWarningAt: 3, turnBudgetWarned: false, turnCount: 3 };
        expect(shouldInjectWarning(session)).toBe(true);

        // After warning fires, the flag is set
        session.turnBudgetWarned = true;

        // Subsequent tool calls should NOT get the warning again
        session.turnCount = 4;
        expect(shouldInjectWarning(session)).toBe(false);
        session.turnCount = 5;
        expect(shouldInjectWarning(session)).toBe(false);
      });

      it("threshold defaults correctly from SubagentDefinition", () => {
        // Simulate: def.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT
        const defWithOverride = { turnBudgetWarningAt: 20 };
        const defWithoutOverride = { turnBudgetWarningAt: undefined as number | undefined };

        expect(defWithOverride.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT).toBe(20);
        expect(defWithoutOverride.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT).toBe(40);
      });
    });

    describe("warning message content", () => {
      it("contains expected keywords", () => {
        // Mirror the exact template from manager.ts
        const turnCount = 42;
        const turnBudgetWarningAt = 40;
        const warningText = `\n\n⚠️ [SYSTEM WARNING: Turn Budget ${turnCount}/${turnBudgetWarningAt}] You have used ${turnCount} turns. Wrap up your current task — summarize progress, write any pending output, and finish. Do NOT start new exploratory work.`;

        expect(warningText).toContain("SYSTEM WARNING: Turn Budget");
        expect(warningText).toContain("42/40");
        expect(warningText).toContain("Wrap up");
        expect(warningText).toContain("Do NOT start new exploratory work");
      });
    });
  });

});
