import { describe, expect, it } from "bun:test";
import { createAppTaskReadTool } from "./app-task-read-tool.js";
import { EventBus } from "./event-bus.js";

function text(result: Awaited<ReturnType<ReturnType<typeof createAppTaskReadTool>["execute"]>>): unknown {
  const content = result.content[0];
  if (!content || content.type !== "text") throw new Error("Expected text tool result");
  return JSON.parse(content.text);
}

describe("App Task read tool", () => {
  it("binds list and get to the current App without accepting an App argument", async () => {
    const calls: unknown[] = [];
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      appId: () => "evaluation",
      reader: {
        list(input) {
          calls.push(input);
          return { items: [{ id: "review", status: "running", generation: 2, outcome: "Review docs" }] };
        },
        get(input) {
          calls.push(input);
          return { id: input.taskId, status: "done", generation: 2, outcome: "Review docs" };
        },
      },
    });

    expect(text(await tool.execute("call-list", { action: "list", status: ["running"], limit: 10 }))).toEqual({
      items: [{ id: "review", status: "running", generation: 2, outcome: "Review docs" }],
    });
    expect(text(await tool.execute("call-get", { action: "get", taskId: "review" }))).toMatchObject({
      id: "review",
      status: "done",
    });
    expect(calls).toEqual([
      expect.objectContaining({ appId: "evaluation", options: { status: ["running"], limit: 10 } }),
      expect.objectContaining({ appId: "evaluation", taskId: "review" }),
    ]);
  });

  it("refuses reads outside an App Task scope", async () => {
    const tool = createAppTaskReadTool({
      bus: new EventBus(),
      appId: () => undefined,
      reader: {
        list: () => {
          throw new Error("must not run");
        },
        get: () => {
          throw new Error("must not run");
        },
      },
    });

    expect(text(await tool.execute("call", { action: "list" }))).toEqual({ error: "No current App Task scope" });
  });
});
