import { describe, expect, it } from "bun:test";
import { createWorkflowHandler } from "./index.js";
import type { CronEntry, HandlerContext, TriggerEvent } from "./index.js";

describe("createWorkflowHandler", () => {
  function context() {
    const calls: Array<{ workflow: string; task: string; opts: unknown }> = [];
    const emitted: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const logs: Array<{ level: "info" | "warn" | "error"; msg: string }> = [];
    const ctx = {
      agentName: "may",
      sdk: {
        runWorkflow: async (workflow: string, task: string, opts?: unknown) => {
          calls.push({ workflow, task, opts });
          return { status: "done" as const, summary: "ok", runId: "wr_1" };
        },
        emit: (type: string, data?: Record<string, unknown>) => {
          emitted.push({ type, data });
        },
        log: (level: "info" | "warn" | "error", msg: string) => {
          logs.push({ level, msg });
        },
      },
    } as unknown as HandlerContext;
    return { ctx, calls, emitted, logs };
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
    const { ctx, calls, emitted } = context();
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
    expect(emitted).toContainEqual({
      type: "handler.workflow_dispatched",
      data: {
        handler: "bridge",
        workflow: "goal-driver",
        source: "scout",
        projectId: "p1",
        workflowRunId: "wr_1",
        status: "done",
      },
    });
  });

  it("skips dispatch when includeEvent is requested but no event payload is present", async () => {
    const { ctx, calls, emitted, logs } = context();
    const handler = createWorkflowHandler({
      workflow: "evaluator-aftermath",
      source: "evaluator",
      task: "Evaluate the completed session",
      includeEvent: true,
    })(ctx, entry);

    await handler(undefined);

    expect(calls).toHaveLength(0);
    expect(logs).toContainEqual({
      level: "warn",
      msg: "[workflow-handler:bridge] skipped includeEvent dispatch because no event payload was received",
    });
    expect(emitted).toContainEqual({
      type: "handler.skipped",
      data: {
        handler: "bridge",
        reason: "includeEvent requested but no event payload received",
        eventType: null,
      },
    });
  });

  it("skips dispatch when shouldRun returns false", async () => {
    const { ctx, calls, emitted, logs } = context();
    const handler = createWorkflowHandler({
      workflow: "goal-driver",
      task: "noop",
      shouldRun: () => false,
    })(ctx, entry);

    await handler(event);

    expect(calls).toHaveLength(0);
    expect(logs).toContainEqual({
      level: "info",
      msg: "[workflow-handler:bridge] skipped",
    });
    expect(emitted).toContainEqual({
      type: "handler.skipped",
      data: { handler: "bridge", reason: "shouldRun returned false", eventType: "project.commented" },
    });
  });
});
