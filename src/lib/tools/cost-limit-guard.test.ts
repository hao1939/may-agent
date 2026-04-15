/**
 * Tests for cost-limit-guard.ts
 *
 * Validates the guard correctly tracks tool-call counts per session
 * and warns/blocks at the configured limit.
 *
 * Actual API: createCostLimitGuard(limit?: number)
 * - Warns at 90% of limit (block: false)
 * - Blocks above limit (block: true)
 * - Default limit: 200 (overridable via TOOL_CALL_LIMIT env)
 */

import { describe, test, expect, afterEach } from "vitest";
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
): Promise<Awaited<ReturnType<typeof guard>>> {
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
  describe("with custom limit", () => {
    test("returns undefined below 90% threshold", async () => {
      const guard = createCostLimitGuard(10);
      // 90% of 10 = 9, so calls 1-8 should be undefined
      for (let i = 0; i < 8; i++) {
        const result = await guard(makeContext());
        expect(result).toBeUndefined();
      }
    });

    test("warns at 90% of limit", async () => {
      const guard = createCostLimitGuard(10);
      // 90% of 10 = floor(9) → call #9 triggers warn
      await callTimes(guard, 8);
      // 9th call should warn
      const result = await guard(makeContext());
      expect(result).toBeDefined();
      expect(result!.block).toBe(false);
      expect(result!.reason).toContain("Approaching cost limit");
      expect(result!.reason).toContain("9/10");
    });

    test("blocks above limit", async () => {
      const guard = createCostLimitGuard(10);
      // Calls 1-10 are within limit
      await callTimes(guard, 10);
      // 11th call exceeds limit
      const result = await guard(makeContext());
      expect(result).toBeDefined();
      expect(result!.block).toBe(true);
      expect(result!.reason).toContain("Cost limit reached");
      expect(result!.reason).toContain("11");
    });

    test("continues blocking after limit exceeded", async () => {
      const guard = createCostLimitGuard(10);
      await callTimes(guard, 10);
      // 11th — block
      const block1 = await guard(makeContext());
      expect(block1!.block).toBe(true);
      // 12th — still blocked
      const block2 = await guard(makeContext());
      expect(block2!.block).toBe(true);
    });

    test("warn continues until block (not one-shot)", async () => {
      const guard = createCostLimitGuard(10);
      await callTimes(guard, 8);
      // Calls 9 and 10 are both in the 90%-100% range → both should warn
      const warn1 = await guard(makeContext());
      expect(warn1).toBeDefined();
      expect(warn1!.block).toBe(false);
      const warn2 = await guard(makeContext());
      expect(warn2).toBeDefined();
      expect(warn2!.block).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("works with different tool names", async () => {
      const guard = createCostLimitGuard(5);
      // 90% of 5 = floor(4.5) = 4, so call #4 triggers warn
      await guard(makeContext("read"));
      await guard(makeContext("write"));
      await guard(makeContext("bash"));
      // 4th call with different tool name
      const result = await guard(makeContext("edit"));
      expect(result).toBeDefined();
      expect(result!.block).toBe(false);
    });

    test("separate instances have independent counters", async () => {
      const guard1 = createCostLimitGuard(5);
      const guard2 = createCostLimitGuard(5);
      // Advance guard1 past the limit
      await callTimes(guard1, 6);
      // guard2 should still be at 0
      const result = await guard2(makeContext());
      expect(result).toBeUndefined();
    });

    test("default limit is 200 when no arg provided", async () => {
      // Can't easily test 200 calls, but we can verify first call returns undefined
      const guard = createCostLimitGuard();
      const result = await guard(makeContext());
      expect(result).toBeUndefined();
    });

    test("limit of 1 blocks on second call", async () => {
      const guard = createCostLimitGuard(1);
      // First call: at 90% threshold (floor(0.9) = 0), so call #1 is >=1 which is > 0.9
      // Actually: callCount=1, max=1. floor(1*0.9)=0. 1 >= 0 → true, so warns.
      // But also callCount(1) > max(1) is false, so no block yet.
      const first = await guard(makeContext());
      expect(first).toBeDefined();
      expect(first!.block).toBe(false); // warn, not block

      // Second call: callCount=2 > max=1 → block
      const second = await guard(makeContext());
      expect(second).toBeDefined();
      expect(second!.block).toBe(true);
    });
  });
});
