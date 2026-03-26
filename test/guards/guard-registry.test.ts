import { describe, test, expect } from "vitest";
import { GuardRegistry } from "../../src/lib/guards/index.js";
import type { Guard } from "../../src/lib/guards/index.js";
import type { BeforeToolCallContext } from "../../src/lib/tools/compose-guards.js";

function makeContext(toolName: string, args: Record<string, unknown> = {}): BeforeToolCallContext {
  return {
    toolCall: { name: toolName, id: "test-1" },
    args,
    context: { messages: [] },
  };
}

describe("GuardRegistry", () => {
  test("composeBeforeHooks returns undefined when no guards registered", async () => {
    const registry = new GuardRegistry();
    const hook = registry.composeBeforeHooks();
    const result = await hook(makeContext("bash", { command: "ls" }));
    expect(result).toBeUndefined();
  });

  test("composeBeforeHooks returns blocking result", async () => {
    const registry = new GuardRegistry();
    const guard: Guard = {
      name: "test-blocker",
      beforeToolCall: async () => ({ block: true, reason: "test block" }),
    };
    registry.register(guard);
    const hook = registry.composeBeforeHooks();
    const result = await hook(makeContext("bash", { command: "ls" }));
    expect(result).toEqual({ block: true, reason: "test block" });
  });

  test("composeBeforeHooks skips non-blocking and returns last warning", async () => {
    const registry = new GuardRegistry();
    registry.register({
      name: "warn-1",
      beforeToolCall: async () => ({ block: false, reason: "warning 1" }),
    });
    registry.register({
      name: "warn-2",
      beforeToolCall: async () => ({ block: false, reason: "warning 2" }),
    });
    const hook = registry.composeBeforeHooks();
    const result = await hook(makeContext("bash"));
    expect(result).toEqual({ block: false, reason: "warning 2" });
  });

  test("first blocker wins — subsequent guards not called", async () => {
    const registry = new GuardRegistry();
    let secondCalled = false;
    registry.register({
      name: "blocker",
      beforeToolCall: async () => ({ block: true, reason: "blocked" }),
    });
    registry.register({
      name: "second",
      beforeToolCall: async () => {
        secondCalled = true;
        return { block: true, reason: "also blocked" };
      },
    });
    const hook = registry.composeBeforeHooks();
    await hook(makeContext("bash"));
    expect(secondCalled).toBe(false);
  });

  test("composeAfterHooks merges warnings", async () => {
    const registry = new GuardRegistry();
    registry.register({
      name: "after-1",
      afterToolResult: async () => ({ appendWarning: "warn A" }),
    });
    registry.register({
      name: "after-2",
      afterToolResult: async () => ({ appendWarning: "warn B" }),
    });
    const hook = registry.composeAfterHooks();
    const result = await hook({
      toolCall: { name: "read", id: "t1" },
      args: {},
      result: "file content",
      context: { messages: [] },
    });
    expect(result?.appendWarning).toContain("warn A");
    expect(result?.appendWarning).toContain("warn B");
  });

  test("getGuardNames returns registered guard names", () => {
    const registry = new GuardRegistry();
    registry.register({ name: "alpha" });
    registry.register({ name: "beta" });
    expect(registry.getGuardNames()).toEqual(["alpha", "beta"]);
  });
});
