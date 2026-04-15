/**
 * Tests for cost-limit-guard.ts
 *
 * Validates the guard correctly tracks tool-call counts per session
 * and warns/blocks at the configured thresholds.
 */

import { describe, test, expect } from "vitest";
import { createCostLimitGuard } from "./cost-limit-guard.js";
import type { BeforeToolCallContext } from "./compose-guards.js";

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function makeContext(toolName = "bash"): BeforeToolCallContext {
  return {
    toolCall: { name: toolName, id: `call_${Math.random().toString(36).slice(2, 10)}` },
    args: { command: "echo hello" },
    context: { messages: [] },
  };
}

/** Call a guard N times, returning the last result. */
async function callTimes(
  guard: (ctx: BeforeToolCallContext) => Promise<unknown>,
  n: number,
): Promise<ReturnType<typeof guard>> {
  let result: Awaited<ReturnType<typeof guard>>;
  for (let i = 0; i < n; i++) {
    result = await guard(makeContext());
  }
  return result!;
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe("cost-limit-guard", () => {
  describe("default config", () => {
    test("returns undefined below warnAt (default 30)", async () => {
      const guard = createCostLimitGuard();
      // Call 29 times — all should be undefined
      for (let i = 0; i < 29; i++) {
        const result = await guard(makeContext());
        expect(result).toBeUndefined();
      }
    });

    test("returns warning at warnAt (default 30)", async () => {
      const guard = createCostLimitGuard();
      // 29 calls below threshold
      await callTimes(guard, 29);
      // 30th call should warn
      const result = await guard(makeContext());
      expect(result).toBeDefined();
      expect(result!.block).toBe(false);
      expect(result!.reason).toContain("30 tool calls");
      expect(result!.reason).toContain("Consider wrapping up");
    });

    test("returns block at blockAt (default 50)", async () => {
      const guard = createCostLimitGuard();
      // 49 calls below block threshold
      await callTimes(guard, 49);
      // 50th call should block
      const result = await guard(makeContext());
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("50 tool calls");
      expect(result!.reason).toContain("Blocked to prevent runaway cost");
    });

    test("warning fires only once", async () => {
      const guard = createCostLimitGuard();
      // Reach the warn threshold
      await callTimes(guard, 29);
      // 30th call — should warn
      const warn = await guard(makeContext());
      expect(warn).toBeDefined();
      expect(warn!.block).toBe(false);
      // 31st call — should NOT warn again (returns undefined)
      const afterWarn = await guard(makeContext());
      expect(afterWarn).toBeUndefined();
      // 32nd through 49th — all undefined
      for (let i = 32; i < 50; i++) {
        const result = await guard(makeContext());
        expect(result).toBeUndefined();
      }
    });

    test("continues blocking after blockAt", async () => {
      const guard = createCostLimitGuard();
      // Reach block threshold
      await callTimes(guard, 49);
      // 50th — block
      const block1 = await guard(makeContext());
      expect(block1!.block).toBe(true);
      // 51st — still blocked
      const block2 = await guard(makeContext());
      expect(block2!.block).toBe(true);
    });
  });

  describe("custom config", () => {
    test("custom warnAt and blockAt values work", async () => {
      const guard = createCostLimitGuard({ warnAt: 5, blockAt: 10 });
      // 4 calls — all undefined
      for (let i = 0; i < 4; i++) {
        const result = await guard(makeContext());
        expect(result).toBeUndefined();
      }
      // 5th call — warn
      const warn = await guard(makeContext());
      expect(warn).toBeDefined();
      expect(warn!.block).toBe(false);
      expect(warn!.reason).toContain("5 tool calls");

      // 6-9 — undefined (warn already fired)
      for (let i = 6; i < 10; i++) {
        const result = await guard(makeContext());
        expect(result).toBeUndefined();
      }

      // 10th — block
      const block = await guard(makeContext());
      expect(block).toBeDefined();
      expect(block!.block).toBe(true);
      expect(block!.reason).toContain("10 tool calls");
    });

    test("custom warnAt only (blockAt uses default)", async () => {
      const guard = createCostLimitGuard({ warnAt: 3 });
      await callTimes(guard, 2);
      const warn = await guard(makeContext());
      expect(warn).toBeDefined();
      expect(warn!.block).toBe(false);
      expect(warn!.reason).toContain("3 tool calls");
    });

    test("custom blockAt only (warnAt uses default)", async () => {
      const guard = createCostLimitGuard({ blockAt: 5 });
      await callTimes(guard, 4);
      const block = await guard(makeContext());
      expect(block).toBeDefined();
      expect(block!.block).toBe(true);
      expect(block!.reason).toContain("5 tool calls");
    });
  });

  describe("edge cases", () => {
    test("works with different tool names", async () => {
      const guard = createCostLimitGuard({ warnAt: 2, blockAt: 4 });
      await guard(makeContext("read"));
      const warn = await guard(makeContext("write"));
      expect(warn).toBeDefined();
      expect(warn!.block).toBe(false);
    });

    test("separate instances have independent counters", async () => {
      const guard1 = createCostLimitGuard({ warnAt: 3, blockAt: 5 });
      const guard2 = createCostLimitGuard({ warnAt: 3, blockAt: 5 });
      // Advance guard1 to warn threshold
      await callTimes(guard1, 3);
      // guard2 should still be at 0
      const result = await guard2(makeContext());
      expect(result).toBeUndefined();
    });

    test("empty config uses defaults", async () => {
      const guard = createCostLimitGuard({});
      // Should use default warnAt=30 — 29 calls should all be undefined
      for (let i = 0; i < 29; i++) {
        const result = await guard(makeContext());
        expect(result).toBeUndefined();
      }
      // 30th should warn
      const warn = await guard(makeContext());
      expect(warn).toBeDefined();
      expect(warn!.block).toBe(false);
    });
  });
});
