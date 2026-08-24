import { describe, expect, it } from "bun:test";
import { createWorkflowHandler } from "../../../src/lib/workflow-handler.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import type { HandlerContext, EventEnvelope } from "../../../src/lib/handler-context.js";

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
  const event: EventEnvelope = {
    type: "project.commented",
    source: "web-ui",
    owner: "agent:may",
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
      opts: { source: "scout", projectId: "p1", input: { event } },
    });
    expect(calls[0].task).toContain("review the comment");
    expect(calls[0].task).not.toContain("project.commented");
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

  it("passes session.end event data through in trigger context", async () => {
    const { ctx, calls, emitted } = context();
    const completedEvent: EventEnvelope = {
      type: "session.end",
      source: "runtime",
      owner: "agent:dev",
      data: {
        sessionId: "s_done",
        agent: "dev",
        status: "done",
        outcome: "done",
        summary: "Done",
        durationMs: 42,
      },
      timestamp: 456,
    };
    const handler = createWorkflowHandler({
      workflow: "evaluator-aftermath",
      source: "evaluator",
      task: "Evaluate the completed session",
      includeEvent: true,
    })(ctx, { name: "evaluator-aftermath", enabled: true, handler: "run-workflow" });

    await handler(completedEvent);

    expect(calls).toHaveLength(1);
    expect(calls[0].opts).toMatchObject({ input: { event: completedEvent } });
    expect(emitted).toContainEqual({
      type: "handler.workflow_dispatched",
      data: {
        handler: "evaluator-aftermath",
        workflow: "evaluator-aftermath",
        source: "evaluator",
        projectId: null,
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
