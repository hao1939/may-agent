import { describe, expect, it, vi } from "vitest";
import { createWorkflowHandler } from "../shared/lib/workflow-handler.ts";

function makeCtx(runWorkflow: ReturnType<typeof vi.fn>) {
  return {
    agentName: "may",
    sdk: {
      log: vi.fn(),
      emit: vi.fn(),
      runWorkflow,
    },
  } as any;
}

const entry = { name: "heartbeat-scout" } as any;

describe("createWorkflowHandler", () => {
  it("emits workflow dispatch evidence when the workflow completes", async () => {
    const runWorkflow = vi.fn().mockResolvedValue({ status: "done", runId: "wr_123" });
    const ctx = makeCtx(runWorkflow);
    const handler = createWorkflowHandler({
      workflow: "scout-heartbeat",
      source: "scout",
      task: "do scout heartbeat",
    })(ctx, entry);

    await handler();

    expect(runWorkflow).toHaveBeenCalledWith("scout-heartbeat", "do scout heartbeat", { source: "scout" });
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.workflow_dispatched", expect.objectContaining({
      handler: "heartbeat-scout",
      workflow: "scout-heartbeat",
      source: "scout",
      workflowRunId: "wr_123",
      status: "done",
    }));
  });

  it("emits workflow failure evidence without throwing when the workflow rejects", async () => {
    const runWorkflow = vi.fn().mockRejectedValue(new Error("Workflow blocked by guard: missing readback"));
    const ctx = makeCtx(runWorkflow);
    const handler = createWorkflowHandler({
      workflow: "scout-heartbeat",
      source: "scout",
      task: "do scout heartbeat",
    })(ctx, entry);

    await expect(handler()).resolves.toBeUndefined();

    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.workflow_failed", expect.objectContaining({
      handler: "heartbeat-scout",
      workflow: "scout-heartbeat",
      source: "scout",
      error: "Workflow blocked by guard: missing readback",
    }));
    expect(ctx.sdk.emit).not.toHaveBeenCalledWith("handler.failed", expect.anything());
  });

  it("emits skipped evidence when shouldRun returns false", async () => {
    const runWorkflow = vi.fn();
    const ctx = makeCtx(runWorkflow);
    const handler = createWorkflowHandler({
      workflow: "scout-heartbeat",
      source: "scout",
      task: "do scout heartbeat",
      shouldRun: () => false,
    })(ctx, entry);

    await handler();

    expect(runWorkflow).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "heartbeat-scout",
      workflow: "scout-heartbeat",
      reason: "shouldRun returned false",
    }));
  });
});
