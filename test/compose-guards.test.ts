import { describe, it, expect } from "vitest";
import { composeGuards } from "../src/lib/tools/compose-guards.js";
import type { BeforeToolCallContext, BeforeToolCallResult } from "@mariozechner/pi-agent-core";

function makeCtx(): BeforeToolCallContext {
  return {
    toolCall: { id: "tc-1", name: "read", arguments: {} },
    args: {},
    context: { systemPrompt: "", messages: [], tools: [] },
  } as unknown as BeforeToolCallContext;
}

describe("composeGuards", () => {
  it("returns undefined when no guards fire", async () => {
    const composed = composeGuards(
      async () => undefined,
      async () => undefined,
    );
    expect(await composed(makeCtx())).toBeUndefined();
  });

  it("returns the first blocking result and stops", async () => {
    const calls: string[] = [];
    const composed = composeGuards(
      async () => {
        calls.push("a");
        return { block: true, reason: "blocked by A" };
      },
      async () => {
        calls.push("b");
        return { block: true, reason: "blocked by B" };
      },
    );
    const result = await composed(makeCtx());
    expect(result).toEqual({ block: true, reason: "blocked by A" });
    expect(calls).toEqual(["a"]); // B was never called
  });

  it("returns warning if no guard blocks", async () => {
    const composed = composeGuards(
      async () => undefined,
      async () => ({ block: false, reason: "just a warning" }),
    );
    const result = await composed(makeCtx());
    expect(result).toEqual({ block: false, reason: "just a warning" });
  });

  it("blocking guard takes priority over earlier warning", async () => {
    const composed = composeGuards(
      async () => ({ block: false, reason: "warning" }),
      async () => ({ block: true, reason: "blocked" }),
    );
    const result = await composed(makeCtx());
    expect(result).toEqual({ block: true, reason: "blocked" });
  });

  it("last warning wins when multiple warnings fire", async () => {
    const composed = composeGuards(
      async () => ({ block: false, reason: "warning 1" }),
      async () => ({ block: false, reason: "warning 2" }),
    );
    const result = await composed(makeCtx());
    expect(result).toEqual({ block: false, reason: "warning 2" });
  });

  it("works with zero guards", async () => {
    const composed = composeGuards();
    expect(await composed(makeCtx())).toBeUndefined();
  });
});
