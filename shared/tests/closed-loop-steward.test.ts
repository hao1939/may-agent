import { describe, expect, it, vi } from "vitest";
import { create } from "../../may/handlers/closed-loop-steward.js";

function makeDb(openAlerts: unknown[] = []) {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.startsWith("PRAGMA table_info(")) {
        const table = sql.match(/PRAGMA table_info\(([^)]+)\)/)?.[1] ?? "unknown";
        return { all: vi.fn(() => [{ name: `${table}_id`, type: "TEXT" }]) };
      }
      if (sql.includes("WHERE agent = 'may'") && sql.includes("status = 'running'")) {
        return { get: vi.fn(() => null) };
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
      if (sql.includes("FROM workflow_runs")) {
        return { get: vi.fn(() => null) };
      }
      if (sql.includes("FROM sessions") && sql.includes("source = 'closed-loop-steward'")) {
        return { all: vi.fn(() => []) };
      }
      return { all: vi.fn(() => []), get: vi.fn(() => null) };
    }),
  };
}

function makeCtx(db: ReturnType<typeof makeDb>, runAgent = vi.fn(() => new Promise(() => {}))) {
  return {
    sdk: {
      paths: { agents: "/app/agents" },
      getDb: () => db,
      runAgent,
      runWorkflow: vi.fn(() => Promise.resolve({ status: "done" })),
      log: vi.fn(),
    },
  } as any;
}

describe("closed-loop-steward handler", () => {
  it("injects runtime schema and returns immediately after dispatching may instead of awaiting the may session", async () => {
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
    const runAgent = vi.fn(() => new Promise(() => {}));
    const ctx = makeCtx(db, runAgent);
    const handler = create(ctx, { handlerConfig: {} } as any);

    const result = await Promise.race([
      handler().then(() => "returned"),
      new Promise((resolve) => setTimeout(() => resolve("timed-out"), 25)),
    ]);

    expect(result).toBe("returned");
    expect(runAgent).toHaveBeenCalledWith("may", expect.stringContaining("[cron:closed-loop-steward]"), { source: "closed-loop-steward" });
  });

  it("skips without dispatch when no alerts or delivery failures exist", async () => {
    const db = makeDb([]);
    const runAgent = vi.fn(() => Promise.resolve({ status: "done" }));
    const ctx = makeCtx(db, runAgent);
    const handler = create(ctx, { handlerConfig: {} } as any);

    await handler();

    expect(runAgent).not.toHaveBeenCalled();
  });
});
