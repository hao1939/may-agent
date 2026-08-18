import { describe, expect, it } from "bun:test";
import { createWorkflowHandler } from "./workflow-handler.js";

describe("createWorkflowHandler", () => {
  it("passes an exact session source to the workflow runtime", async () => {
    const calls: unknown[][] = [];
    const handler = createWorkflowHandler({
      workflow: "may-heartbeat",
      task: "review current state",
      source: "may",
      sessionSource: "heartbeat",
    })(
      {
        agentName: "may",
        sdk: {
          log: () => {},
          emit: () => {},
          runWorkflow: async (...args: unknown[]) => {
            calls.push(args);
            return { status: "done", summary: "ok", runId: "workflow-run-1" };
          },
        },
      } as any,
      { name: "heartbeat-may", enabled: true, category: "heartbeat" },
    );

    await handler();

    expect(calls).toEqual([["may-heartbeat", "review current state", { source: "may", sessionSource: "heartbeat" }]]);
  });
});
