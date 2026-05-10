import { describe, expect, it, vi } from "vitest";
import { create } from "../../may/handlers/closed-loop-steward.js";

function makeDb(openAlerts: unknown[] = []) {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.startsWith("PRAGMA table_info(")) {
        const table = sql.match(/PRAGMA table_info\(([^)]+)\)/)?.[1] ?? "unknown";
        return { all: vi.fn(() => [{ name: `${table}_id`, type: "TEXT" }]) };
      }
      if (sql.includes("FROM metric_alerts")) {
        return { all: vi.fn(() => openAlerts) };
      }
      if (sql.includes("message.delivery_failed")) {
        return { all: vi.fn(() => []) };
      }
      if (sql.includes("FROM sessions") && sql.includes("agent = ?")) {
        return { all: vi.fn(() => []) };
      }
      if (sql.includes("metric.alert_judged")) {
        return { get: vi.fn(() => null) };
      }
      if (sql.includes("FROM metric_snapshots")) {
        return { get: vi.fn(() => null) };
      }
      if (sql.includes("FROM workflow_runs") && sql.includes("status = 'running'")) {
        return { get: vi.fn(() => null) };
      }
      if (sql.includes("FROM workflow_runs")) {
        return { all: vi.fn(() => []) };
      }
      return { all: vi.fn(() => []), get: vi.fn(() => null) };
    }),
  };
}

function makeCtx(
  db: ReturnType<typeof makeDb>,
  runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" })),
) {
  return {
    agentName: "may",
    sdk: {
      paths: { agents: "/app/agents" },
      getDb: () => db,
      runWorkflow,
      emit: vi.fn(),
      log: vi.fn(),
    },
  } as any;
}

describe("closed-loop-steward handler", () => {
  it("injects runtime schema and returns immediately after dispatching workflows instead of awaiting the may audit", async () => {
    const db = makeDb([
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
    const runWorkflow = vi.fn((name: string) => {
      if (name === "closed-loop-steward") return new Promise(() => {});
      return Promise.resolve({ status: "done", runId: "wr_triage" });
    });
    const ctx = makeCtx(db, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    const result = await Promise.race([
      handler().then(() => "returned"),
      new Promise((resolve) => setTimeout(() => resolve("timed-out"), 25)),
    ]);

    expect(result).toBe("returned");
    expect(runWorkflow).toHaveBeenCalledWith("metric-alert-triage", expect.any(String), { source: "may" });
    expect(runWorkflow).toHaveBeenCalledWith("closed-loop-steward", expect.stringContaining("[cron:closed-loop-steward]"), { source: "may" });
    const task = runWorkflow.mock.calls.find(([name]) => name === "closed-loop-steward")?.[1];
    expect(task).toContain("## Routed Triage This Run");
    expect(task).toContain("handler.failed-count owner=may reason=missing metric.alert_judged event");
  });

  it("warns may not to attempt direct DB writes during the audit", async () => {
    const db = makeDb([
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
    const ctx = makeCtx(db, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    const task = runWorkflow.mock.calls.find(([name]) => name === "closed-loop-steward")?.[1];
    expect(task).toContain("Never attempt direct DB writes from bash/node/sqlite during this audit");
    expect(task).toContain("route/escalate or fix the handler/workflow code instead of improvising DB/event writes");
  });

  it("warns may that owner activity alone is not closure evidence", async () => {
    const db = makeDb([
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
    ]);
    const runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" }));
    const ctx = makeCtx(db, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    const task = runWorkflow.mock.calls.find(([name]) => name === "closed-loop-steward")?.[1];
    expect(task).toContain("do not conclude 'no action' from owner activity alone");
    expect(task).toContain("Recent owner activity is context, not closure evidence");
    expect(task).toContain("Closure evidence is a resolved alert, an in-range latest snapshot");
  });

  it("skips without dispatch when no alerts or delivery failures exist", async () => {
    const db = makeDb([]);
    const runWorkflow = vi.fn(() => Promise.resolve({ status: "done", runId: "wr_1" }));
    const ctx = makeCtx(db, runWorkflow);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    expect(runWorkflow).not.toHaveBeenCalled();
  });
});
