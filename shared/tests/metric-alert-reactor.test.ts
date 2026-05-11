import { describe, expect, it, vi } from "vitest";
import { create } from "../../may/handlers/metric-alert-reactor.js";

function makeCtx() {
  const state = {
    metric: {
      id: "handler.failed-count",
      name: "Handler failures",
      explicitOwner: "arc",
      projectOwner: null,
      current: 5,
      threshold: 3,
      target: 0,
      priority: "P1",
      alertOp: ">",
      status: "active",
    },
    alert: {
      id: 42,
      metric_id: "handler.failed-count",
      message: "above threshold",
      created_at: Date.now() - 20 * 60_000,
    },
    latestJudgment: null,
    latestSnapshot: null,
    recentTriageRun: null,
    recentTriageJudgment: null,
    recentOwnerSession: null,
    recentOwnerSessionJudgment: null,
    metricId: "handler.failed-count",
    alertId: 42,
  };
  return {
    agentName: "may",
    sdk: {
      paths: { agents: "/no/such/agents" },
      getDb: vi.fn(() => { throw new Error("metric-alert-reactor should use sdk.query for preflight reads"); }),
      query: {
        metricAlertReactorState: vi.fn(() => state),
        alerts: vi.fn(() => ({ rows: [], rowCount: 0, limit: 50, truncated: false })),
      },
      runWorkflow: vi.fn(async () => ({ status: "done" as const, summary: "ok", runId: "wr_triage" })),
      emit: vi.fn(),
      log: vi.fn(),
    },
  } as any;
}

describe("metric-alert-reactor handler", () => {
  it("uses query facade preflight and dispatches metric-alert-triage", async () => {
    const ctx = makeCtx();
    const handler = create(ctx, {} as any);

    await handler({
      type: "metric.breach",
      source: "event",
      entry: "metric-alert-reactor",
      timestamp: Date.now(),
      data: {
        owner: "may",
        metricId: "handler.failed-count",
        metricName: "Handler failures",
        current: 5,
        threshold: 3,
        target: 0,
        message: "above threshold",
        priority: "P1",
      },
    });

    expect(ctx.sdk.getDb).not.toHaveBeenCalled();
    expect(ctx.sdk.query.metricAlertReactorState).toHaveBeenCalledWith(expect.objectContaining({
      metricId: "handler.failed-count",
      owner: "may",
    }));
    expect(ctx.sdk.query.metricAlertReactorState).toHaveBeenCalledWith(expect.objectContaining({
      metricId: "handler.failed-count",
      owner: "arc",
    }));
    expect(ctx.sdk.runWorkflow).toHaveBeenCalledWith(
      "metric-alert-triage",
      expect.stringContaining("handler.failed-count"),
      { source: "arc" },
    );
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.workflow_dispatched", expect.objectContaining({
      handler: "metric-alert-reactor",
      workflow: "metric-alert-triage",
      metricId: "handler.failed-count",
      owner: "arc",
      workflowRunId: "wr_triage",
    }));
  });

  it("treats an empty direct trigger as an unresolved-alert scan", async () => {
    const ctx = makeCtx();
    ctx.sdk.query.alerts = vi.fn(() => ({
      rows: [{ id: 42, metric_id: "handler.failed-count", message: "above threshold" }],
      rowCount: 1,
      limit: 50,
      truncated: false,
    }));
    const handler = create(ctx, {} as any);

    await handler({
      type: "trigger.metric-alert-reactor",
      source: "event",
      entry: "metric-alert-reactor",
      timestamp: Date.now(),
      data: { type: "trigger.metric-alert-reactor" },
    });

    expect(ctx.sdk.query.alerts).toHaveBeenCalledWith({ resolved: false, limit: 50 });
    expect(ctx.sdk.runWorkflow).toHaveBeenCalledWith(
      "metric-alert-triage",
      expect.stringContaining("handler.failed-count"),
      { source: "arc" },
    );
    expect(ctx.sdk.log).not.toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Missing metricId"),
    );
  });

  it("ignores retired metrics even if a stale breach event arrives", async () => {
    const ctx = makeCtx();
    const baseState = ctx.sdk.query.metricAlertReactorState();
    ctx.sdk.query.metricAlertReactorState = vi.fn(() => ({
      ...baseState,
      metric: {
        ...baseState.metric,
        status: "retired",
      },
    }));
    const handler = create(ctx, {} as any);

    await handler({
      type: "metric.breach",
      source: "event",
      entry: "metric-alert-reactor",
      timestamp: Date.now(),
      data: {
        owner: "arc",
        metricId: "guard.blocked-count-24h",
        metricName: "Old guard blocks",
        current: 1,
        threshold: 0,
        target: 0,
        message: "stale retired breach",
        priority: "P1",
      },
    });

    expect(ctx.sdk.runWorkflow).not.toHaveBeenCalled();
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "metric-alert-reactor",
      metricId: "guard.blocked-count-24h",
      reason: expect.stringContaining("missing or retired"),
      status: "retired",
    }));
  });
});
