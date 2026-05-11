import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "./requests.js";
import { createQueryService } from "./query-service.js";

describe("QueryService", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });

  function harness() {
    const root = mkdtempSync(join(tmpdir(), "query-service-"));
    roots.push(root);
    const db = getDb(root);
    const query = createQueryService({ getDb: () => db, defaultLimit: 2, maxLimit: 3 });
    return { db, query };
  }

  it("queries core runtime tables with bounded filters", () => {
    const { db, query } = harness();
    const now = 10_000;

    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s1", "may", "older", "done", "p1", now - 100],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s2", "may", "newer", "error", "p1", now],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s3", "scout", "other", "done", "p2", now + 100],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wr1", "project", "project: p1", "running", "p1", now + 200],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wr2", "project", "project: p2", "done", "p2", now + 300],
    );

    expect(query.sessions({ agent: "may" }).rows.map((row) => row.sessionId)).toEqual(["s2", "s1"]);
    expect(query.sessions({ projectId: "p1", status: "done" }).rows).toMatchObject([
      { sessionId: "s1", agent: "may", status: "done" },
    ]);
    expect(query.workflowRuns({ status: "running" }).rows).toMatchObject([
      { runId: "wr1", workflow: "project", projectId: "p1" },
    ]);
  });

  it("keeps arbitrary SQL read-only and bounded", () => {
    const { db, query } = harness();

    for (let i = 0; i < 4; i++) {
      db.run(
        "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
        ["example", "test", "may", JSON.stringify({ i }), i],
      );
    }

    const result = query.sql("SELECT id, event_type FROM events ORDER BY id ASC", [], { limit: 3 });
    expect(result.rowCount).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.rows.map((row) => row.event_type)).toEqual(["example", "example", "example"]);
  });

  it("rejects writes and multi-statement SQL", () => {
    const { query } = harness();

    expect(() => query.sql("UPDATE sessions SET status = 'done'")).toThrow(/read-only|only allows/);
    expect(() => query.sql("SELECT 1; SELECT 2")).toThrow(/one statement/);
  });

  it("allows bounded schema inspection pragmas", () => {
    const { query } = harness();

    expect(query.sql("PRAGMA table_info(sessions)").rows.some((row) => row.name === "sessionId")).toBe(true);
    expect(() => query.sql("PRAGMA user_version = 1")).toThrow(/not allowed/);
  });

  it("loads metric alert context behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 20_000;

    db.run(
      "INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)",
      ["p1", "shared/projects/p1", "Project One", "arc", now],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["session.failed-triage-rate-3h", "Failed triage rate", "may", 0.4, 0.8, 1, "P1", "p1", "active", now, "<"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", "threshold", "below target", now - 100],
    );
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
      ["session.failed-triage-rate-3h", 0.4, 9, now, "may", "latest"],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["evaluation.reviewed", "evaluator", "may", JSON.stringify({ ok: true }), now],
    );

    const context = query.metricAlertContext({
      metricId: "session.failed-triage-rate-3h",
      relatedEventTypes: ["evaluation.reviewed"],
      snapshotLimit: 1,
      eventLimit: 1,
    });

    expect(context.metric).toMatchObject({
      id: "session.failed-triage-rate-3h",
      explicitOwner: "may",
      projectOwner: "arc",
      alertOp: "<",
    });
    expect(context.alert).toMatchObject({ metric_id: "session.failed-triage-rate-3h", message: "below target" });
    expect(context.snapshots).toMatchObject([{ value: 0.4, sample_size: 9, measured_by: "may" }]);
    expect(context.relatedEvents).toMatchObject([{ event_type: "evaluation.reviewed", owner: "may" }]);
  });

  it("loads metric alert reactor preflight state behind one schema-aware helper", () => {
    const { db, query } = harness();
    const now = 50_000;

    db.run(
      "INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)",
      ["p1", "shared/projects/p1", "Project One", "arc", now],
    );
    db.run(
      `INSERT INTO metrics
        (id, name, owner, current, threshold, target, priority, project, status, updated_at, alert_op)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["handler.failed-count", "Handler failures", "may", 5, 3, 0, "P1", "p1", "active", now, ">"],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      ["handler.failed-count", "threshold", "above threshold", now - 1_000],
    );
    const alert = db.prepare("SELECT id FROM metric_alerts WHERE metric_id = ?").get("handler.failed-count") as { id: number };
    db.run(
      "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?, ?, ?, ?, ?, ?)",
      ["handler.failed-count", 5, 12, now, "may", "latest"],
    );
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, startedAt) VALUES (?, ?, ?, ?, ?)",
      ["wr_triage", "metric-alert-triage", "Run metric alert triage for handler.failed-count", "done", now - 500],
    );
    db.run(
      "INSERT INTO sessions (sessionId, agent, task, status, source, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["s_owner", "arc", "handle alert", "done", "metric-alert-reactor:handler.failed-count", now - 400],
    );
    db.run(
      "INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
      ["metric.alert_judged", "arc", "may", JSON.stringify({ metricId: "handler.failed-count", alertId: alert.id }), now - 300],
    );

    const state = query.metricAlertReactorState({
      metricId: "handler.failed-count",
      owner: "arc",
      since: now - 2_000,
    });

    expect(state.metric).toMatchObject({
      id: "handler.failed-count",
      explicitOwner: "may",
      projectOwner: "arc",
      alertOp: ">",
    });
    expect(state.alert).toMatchObject({ id: alert.id, metric_id: "handler.failed-count" });
    expect(state.latestSnapshot).toMatchObject({ value: 5, sample_size: 12 });
    expect(state.latestJudgment).toMatchObject({ id: expect.any(Number) });
    expect(state.recentTriageRun).toMatchObject({ runId: "wr_triage", status: "done" });
    expect(state.recentTriageJudgment).toMatchObject({ id: expect.any(Number) });
    expect(state.recentOwnerSession).toMatchObject({ sessionId: "s_owner", status: "done" });
    expect(state.recentOwnerSessionJudgment).toMatchObject({ id: expect.any(Number) });
  });
});
