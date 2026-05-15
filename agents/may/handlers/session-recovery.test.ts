import { describe, expect, it, vi } from "vitest";
import { create } from "./session-recovery.js";

function makeCtx(action?: string | null) {
  const runWorkflow = vi.fn(async () => ({ status: "done" as const, summary: "ok", runId: "wr_recovery" }));
  return {
    agentName: "may",
    sdk: {
      runAgent: vi.fn(() => { throw new Error("session-recovery handler should dispatch a workflow, not run agents directly"); }),
      runWorkflow,
      emit: vi.fn(),
      log: vi.fn(),
      escalate: vi.fn(),
    },
    getLastDigest: vi.fn(() => action ? { action } : null),
    classifyError: vi.fn(() => "infra"),
    upsertDigest: vi.fn(async () => null),
  } as any;
}

describe("session-recovery handler", () => {
  it("dispatches recoverable failures through the session-recovery workflow", async () => {
    const ctx = makeCtx("requeue");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.failed",
      source: "event",
      entry: "session-recovery",
      timestamp: Date.now(),
      data: {
        sessionId: "s_failed",
        agent: "dev",
        error: "provider transient",
        task: "fix the bug",
      },
    });

    expect(ctx.sdk.runAgent).not.toHaveBeenCalled();
    expect(ctx.sdk.runWorkflow).toHaveBeenCalledWith(
      "session-recovery",
      expect.stringContaining('"action": "requeue"'),
      { source: "may" },
    );
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.workflow_dispatched", expect.objectContaining({
      handler: "session-recovery",
      workflow: "session-recovery",
      workflowRunId: "wr_recovery",
      sessionId: "s_failed",
      agent: "dev",
      action: "requeue",
    }));
  });

  it("records non-recoverable decisions as skipped", async () => {
    const ctx = makeCtx("nothing");
    const handler = create(ctx, {} as any);

    await handler({
      type: "session.failed",
      source: "event",
      entry: "session-recovery",
      timestamp: Date.now(),
      data: {
        sessionId: "s_failed",
        agent: "dev",
        error: "logic failure",
        task: "fix the bug",
      },
    });

    expect(ctx.sdk.runWorkflow).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "session-recovery",
      sessionId: "s_failed",
      reason: "classifier chose nothing",
    }));
  });
});
