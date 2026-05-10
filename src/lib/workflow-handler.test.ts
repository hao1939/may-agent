import { describe, expect, it } from "vitest";
import type { CronEntry } from "./cron-tool.js";
import type { HandlerContext, TriggerEvent } from "./handler-context.js";
import { createWorkflowHandler } from "./workflow-handler.js";

describe("createWorkflowHandler", () => {
  function context() {
    const calls: Array<{ workflow: string; task: string; opts: unknown }> = [];
    const logs: string[] = [];
    const ctx = {
      agentName: "may",
      sdk: {
        runWorkflow: async (workflow: string, task: string, opts?: unknown) => {
          calls.push({ workflow, task, opts });
          return { status: "done" as const, summary: "ok" };
        },
        log: (_level: "info" | "warn" | "error", msg: string) => {
          logs.push(msg);
        },
      },
    } as unknown as HandlerContext;
    return { ctx, calls, logs };
  }

  const entry: CronEntry = { name: "bridge", enabled: true, handler: "bridge" };
  const event: TriggerEvent = {
    type: "project.commented",
    source: "event",
    entry: "bridge",
    data: { projectId: "p1" },
    timestamp: 123,
  };

  it("dispatches a workflow with source, project, and trigger context", async () => {
    const { ctx, calls } = context();
    const handler = createWorkflowHandler({
      workflow: "goal-driver",
      source: "scout",
      projectId: (_ctx, trigger) => String(trigger?.data?.projectId),
      task: "review the comment and move the project",
      includeEvent: true,
    })(ctx, entry);

    await handler(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      workflow: "goal-driver",
      opts: { source: "scout", projectId: "p1" },
    });
    expect(calls[0].task).toContain("review the comment");
    expect(calls[0].task).toContain("## Trigger Event");
    expect(calls[0].task).toContain("project.commented");
  });

  it("skips dispatch when shouldRun returns false", async () => {
    const { ctx, calls, logs } = context();
    const handler = createWorkflowHandler({
      workflow: "goal-driver",
      task: "noop",
      shouldRun: () => false,
    })(ctx, entry);

    await handler(event);

    expect(calls).toHaveLength(0);
    expect(logs.some((line) => line.includes("skipped"))).toBe(true);
  });
});
