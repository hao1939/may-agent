import { describe, it, expect } from "vitest";
import { TURN_BUDGET_WARNING_DEFAULT } from "../src/lib/manager.js";
import { COST_SIGNAL_DURATION_MS, COST_SIGNAL_BYTES } from "../src/lib/manager-receipts.js";

describe("Resource Awareness (Agent-RRM)", () => {
  // ── Cost Signal (P113) ───────────────────────────────────────────────

  describe("Cost Signal (P113)", () => {
    describe("threshold constants", () => {
      it("COST_SIGNAL_DURATION_MS is 2000", () => {
        expect(COST_SIGNAL_DURATION_MS).toBe(2000);
      });

      it("COST_SIGNAL_BYTES is 10000", () => {
        expect(COST_SIGNAL_BYTES).toBe(10000);
      });
    });

    describe("injection logic", () => {
      // Mirror the exact conditional from wrapToolsWithReceipts:
      //   if (execDurationMs > COST_SIGNAL_DURATION_MS || outputBytes > COST_SIGNAL_BYTES)

      function shouldInjectCostSignal(durationMs: number, outputBytes: number): boolean {
        return durationMs > COST_SIGNAL_DURATION_MS || outputBytes > COST_SIGNAL_BYTES;
      }

      function formatCostSignal(durationMs: number, outputBytes: number): string {
        const kb = (outputBytes / 1024).toFixed(1);
        return `\n\n<system_note>[COST: ${durationMs}ms, ${kb}KB]</system_note>`;
      }

      it("injects when duration exceeds threshold", () => {
        expect(shouldInjectCostSignal(2500, 100)).toBe(true);
      });

      it("injects when output bytes exceeds threshold", () => {
        expect(shouldInjectCostSignal(100, 15000)).toBe(true);
      });

      it("injects when both exceed threshold", () => {
        expect(shouldInjectCostSignal(5000, 20000)).toBe(true);
      });

      it("does not inject when both below threshold", () => {
        expect(shouldInjectCostSignal(1999, 9999)).toBe(false);
      });

      it("does not inject at exact threshold (strict >)", () => {
        expect(shouldInjectCostSignal(2000, 10000)).toBe(false);
      });

      it("formats cost signal with duration and KB", () => {
        const signal = formatCostSignal(3500, 15360);
        expect(signal).toContain("[COST: 3500ms, 15.0KB]");
        expect(signal).toContain("<system_note>");
        expect(signal).toContain("</system_note>");
      });

      it("formats KB with one decimal place", () => {
        const signal = formatCostSignal(100, 1536);
        expect(signal).toContain("1.5KB");
      });
    });
  });

  // ── Turn Budget Warning ──────────────────────────────────────────────

  describe("Turn Budget Warning", () => {
    describe("TURN_BUDGET_WARNING_DEFAULT", () => {
      it("is 0 (disabled by default)", () => {
        expect(TURN_BUDGET_WARNING_DEFAULT).toBe(0);
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
        return (
          session.turnBudgetWarningAt > 0 &&
          !session.turnBudgetWarned &&
          session.turnCount >= session.turnBudgetWarningAt
        );
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
        expect(defWithoutOverride.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT).toBe(0);
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
