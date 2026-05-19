import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import type { BeforeToolCallContext } from "../../src/lib/tools/compose-guards.js";

describe("SubagentManager guard signals", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function makeRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "manager-guard-signal-"));
    roots.push(root);
    return root;
  }

  it("emits durable guard.triggered context for tool-level guard results", async () => {
    const root = makeRoot();
    const emitted: any[] = [];
    const manager = new SubagentManager({
      persistDir: root,
      projectRoot: root,
      bus: { emit: (event: any) => emitted.push(event) } as any,
    });
    const hook = (manager as any).createGuardSignalHook(
      async () => ({ block: true, reason: "finish blocked by test guard" }),
      "s_guard",
      "may",
      { workflowRunId: "wr_guard", projectId: "p_guard", parentSessionId: "s_parent" },
    );
    const context: BeforeToolCallContext = {
      toolCall: { name: "finish", id: "tc_1" },
      args: { status: "success" },
      context: { messages: [] },
    };

    await hook(context);

    expect(emitted).toEqual([
      expect.objectContaining({
        type: "guard.triggered",
        source: "tool",
        owner: "agent:may",
        data: {
          workflowRunId: "wr_guard",
          projectId: "p_guard",
          parentSessionId: "s_parent",
          sessionId: "s_guard",
          guard: "beforeToolCall",
          demandType: "block",
          action: "blocked",
          reason: "finish blocked by test guard",
          sourceEventType: "tool.finish",
        },
      }),
    ]);
  });
});
