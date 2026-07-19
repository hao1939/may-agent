import { describe, expect, it } from "bun:test";
import { prepareAgentExecution } from "../../src/lib/agent-execution.js";
import type { BeforeToolCallContext } from "../../src/lib/tools/compose-guards.js";

describe("agent guard observations", () => {
  it("reports a neutral observation for tool-level guard results", async () => {
    const observations: any[] = [];
    const prepared = prepareAgentExecution({
      definition: {
        name: "may",
        description: "test",
        domain: "test",
        systemPrompt: "test agent",
        model: { contextWindow: 4096 } as any,
        tools: [{
          name: "finish",
          description: "finish",
          parameters: {},
          execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
        } as any],
      },
      projectRoot: "/tmp",
      sessionId: "s_guard",
      task: "test guard",
      onGuard: (observation) => observations.push(observation),
    });
    const context: BeforeToolCallContext = {
      toolCall: { name: "finish", id: "tc_1" },
      args: { status: "success", summary: "Implemented the fix" },
      context: { messages: [] },
    };

    const result = await prepared.runner.beforeToolCall!(context as any);

    expect(result).toMatchObject({ block: false, reason: expect.stringContaining("Ghost Deliverable") });
    expect(observations).toEqual([
      expect.objectContaining({
        guard: "finish-evidence",
        block: false,
        reason: expect.stringContaining("Ghost Deliverable"),
        context: expect.objectContaining({ toolCall: { name: "finish", id: "tc_1" } }),
      }),
    ]);
  });
});
