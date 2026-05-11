import { describe, expect, it, vi } from "vitest";
import { create } from "../../may/handlers/closed-loop-steward.js";

function makeStewardContext(alerts: unknown[] = []) {
  return {
    now: Date.now(),
    schemaBrief: [
      "- sessions: sessionId TEXT, agent TEXT, status TEXT, startedAt INTEGER",
      "- events: id INTEGER, event_type TEXT, data TEXT, timestamp INTEGER",
      "- metrics: id TEXT, owner TEXT, current REAL, threshold REAL",
      "- metric_alerts: id INTEGER, metric_id TEXT, message TEXT, created_at INTEGER",
    ],
    runningStewardRun: null,
    alerts: alerts.map((alert) => ({
      alert,
      latestJudgment: null,
      latestSnapshot: null,
      activeTriageRun: null,
    })),
    deliveryFailures: [],
    recentStewardRuns: [],
  };
}

function makeCtx(
  stewardContext = makeStewardContext(),
  runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" })),
) {
  const query = {
    closedLoopStewardContext: vi.fn(() => stewardContext),
    sessions: vi.fn(() => ({ rows: [], rowCount: 0, limit: 3, truncated: false })),
  };
  return {
    agentName: "may",
    sdk: {
      paths: { agents: "/app/agents" },
      query,
      runWorkflow,
      emit: vi.fn(),
      log: vi.fn(),
    },
  } as any;
}

describe("closed-loop-steward handler", () => {
  it("injects runtime schema and returns immediately after dispatching the may audit instead of awaiting it", async () => {
    const stewardContext = {
      ...makeStewardContext([
        {
          id: 123,
          metric_id: "handler.failed-count",
          message: "Handler failures above threshold",
          created_at: Date.now() - 60_000,
          metricName: "Handler failures",
          explicitOwner: "may",
          projectOwner: null,
          current: 5,
          threshold: 3,
          target: 0,
          priority: "P2",
          alertOp: ">",
        },
      ]),
      alerts: [
        {
          alert: {
            id: 123,
            metric_id: "handler.failed-count",
            message: "Handler failures above threshold",
            created_at: Date.now() - 60_000,
            metricName: "Handler failures",
            explicitOwner: "may",
            projectOwner: null,
            current: 5,
            threshold: 3,
            target: 0,
            priority: "P2",
            alertOp: ">",
          },
          latestJudgment: null,
          latestSnapshot: null,
          activeTriageRun: { runId: "wr_triage_inflight", status: "running", startedAt: Date.now() - 30_000 },
        },
      ],
    };
    const runWorkflow = vi.fn((name: string) => {
      if (name === "closed-loop-steward") return new Promise(() => {});
      return Promise.resolve({ status: "done", runId: "wr_triage" });
    });
    const ctx = makeCtx(stewardContext, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    const result = await Promise.race([
      handler().then(() => "returned"),
      new Promise((resolve) => setTimeout(() => resolve("timed-out"), 25)),
    ]);

    expect(result).toBe("returned");
    expect(runWorkflow).not.toHaveBeenCalledWith("metric-alert-triage", expect.any(String), { source: "may" });
    expect(runWorkflow).toHaveBeenCalledWith("closed-loop-steward", expect.stringContaining("[cron:closed-loop-steward]"), { source: "may" });
    const task = runWorkflow.mock.calls.find(([name]) => name === "closed-loop-steward")?.[1];
    expect(task).toContain("## Routed Triage This Run");
    expect(task).toContain("none");
  });

  it("skips the may audit when routing fully covers the remaining actionable work", async () => {
    const stewardContext = makeStewardContext([
      {
        id: 123,
        metric_id: "handler.failed-count",
        message: "Handler failures above threshold",
        created_at: Date.now() - 60_000,
        metricName: "Handler failures",
        explicitOwner: "may",
        projectOwner: null,
        current: 5,
        threshold: 3,
        target: 0,
        priority: "P2",
        alertOp: ">",
      },
    ]);
    const runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" }));
    const ctx = makeCtx(stewardContext, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    expect(runWorkflow).toHaveBeenCalledTimes(1);
    expect(runWorkflow).toHaveBeenCalledWith("metric-alert-triage", expect.any(String), { source: "may" });
    expect(runWorkflow).not.toHaveBeenCalledWith("closed-loop-steward", expect.anything(), { source: "may" });
    expect(ctx.sdk.emit).toHaveBeenCalledWith("handler.skipped", expect.objectContaining({
      handler: "closed-loop-steward",
      routedTriageCount: 1,
      remainingAlertCount: 0,
    }));
  });

  it("warns may not to attempt direct DB writes during the audit", async () => {
    const stewardContext = {
      ...makeStewardContext([
        {
          id: 123,
          metric_id: "handler.failed-count",
          message: "Handler failures above threshold",
          created_at: Date.now() - 60_000,
          metricName: "Handler failures",
          explicitOwner: "may",
          projectOwner: null,
          current: 5,
          threshold: 3,
          target: 0,
          priority: "P2",
          alertOp: ">",
        },
        {
          id: 124,
          metric_id: "scout.good-session-rate-24h",
          message: "Scout good session rate below threshold",
          created_at: Date.now() - 60_000,
          metricName: "Scout good session rate",
          explicitOwner: "scout",
          projectOwner: null,
          current: 0.24,
          threshold: 0.65,
          target: 0.85,
          priority: "P3",
          alertOp: "<",
        },
      ]),
      alerts: [
        {
          alert: {
            id: 123,
            metric_id: "handler.failed-count",
            message: "Handler failures above threshold",
            created_at: Date.now() - 60_000,
            metricName: "Handler failures",
            explicitOwner: "may",
            projectOwner: null,
            current: 5,
            threshold: 3,
            target: 0,
            priority: "P2",
            alertOp: ">",
          },
          latestJudgment: null,
          latestSnapshot: null,
          activeTriageRun: { runId: "wr_triage_inflight", status: "running", startedAt: Date.now() - 30_000 },
        },
        {
          alert: {
            id: 124,
            metric_id: "scout.good-session-rate-24h",
            message: "Scout good session rate below threshold",
            created_at: Date.now() - 60_000,
            metricName: "Scout good session rate",
            explicitOwner: "scout",
            projectOwner: null,
            current: 0.24,
            threshold: 0.65,
            target: 0.85,
            priority: "P3",
            alertOp: "<",
          },
          latestJudgment: null,
          latestSnapshot: null,
          activeTriageRun: null,
        },
      ],
    };
    const runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" }));
    const ctx = makeCtx(stewardContext, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    const task = runWorkflow.mock.calls.find(([name]) => name === "closed-loop-steward")?.[1];
    expect(task).toBeDefined();
    expect(task).toContain("Never attempt direct DB writes from bash/node/sqlite during this audit");
    expect(task).toContain("route/escalate or fix the handler/workflow code instead of improvising DB/event writes");
  });

  it("warns may that owner activity alone is not closure evidence", async () => {
    const stewardContext = {
      ...makeStewardContext([
        {
          id: 225,
          metric_id: "scout.good-session-rate-24h",
          message: "Scout good session rate below threshold",
          created_at: Date.now() - 60_000,
          metricName: "Scout good session rate",
          explicitOwner: "scout",
          projectOwner: null,
          current: 0.24,
          threshold: 0.65,
          target: 0.85,
          priority: "P3",
          alertOp: "<",
        },
        {
          id: 226,
          metric_id: "handler.failed-count",
          message: "Handler failures above threshold",
          created_at: Date.now() - 60_000,
          metricName: "Handler failures",
          explicitOwner: "may",
          projectOwner: null,
          current: 5,
          threshold: 3,
          target: 0,
          priority: "P2",
          alertOp: ">",
        },
      ]),
      alerts: [
        {
          alert: {
            id: 225,
            metric_id: "scout.good-session-rate-24h",
            message: "Scout good session rate below threshold",
            created_at: Date.now() - 60_000,
            metricName: "Scout good session rate",
            explicitOwner: "scout",
            projectOwner: null,
            current: 0.24,
            threshold: 0.65,
            target: 0.85,
            priority: "P3",
            alertOp: "<",
          },
          latestJudgment: null,
          latestSnapshot: null,
          activeTriageRun: null,
        },
        {
          alert: {
            id: 226,
            metric_id: "handler.failed-count",
            message: "Handler failures above threshold",
            created_at: Date.now() - 60_000,
            metricName: "Handler failures",
            explicitOwner: "may",
            projectOwner: null,
            current: 5,
            threshold: 3,
            target: 0,
            priority: "P2",
            alertOp: ">",
          },
          latestJudgment: null,
          latestSnapshot: null,
          activeTriageRun: { runId: "wr_triage_inflight", status: "running", startedAt: Date.now() - 30_000 },
        },
      ],
    };
    const runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" }));
    const ctx = makeCtx(stewardContext, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    const task = runWorkflow.mock.calls.find(([name]) => name === "closed-loop-steward")?.[1];
    expect(task).toBeDefined();
    expect(task).toContain("do not conclude 'no action' from owner activity alone");
    expect(task).toContain("Recent owner activity is context, not closure evidence");
    expect(task).toContain("Closure evidence is a resolved alert, an in-range latest snapshot");
  });

  it("skips without dispatch when no alerts or delivery failures exist", async () => {
    const runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" }));
    const ctx = makeCtx(makeStewardContext([]), runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    expect(runWorkflow).not.toHaveBeenCalled();
  });
});
