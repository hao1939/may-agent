import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { createQueryService } from "../../src/lib/query-service.js";

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
    return { root, db, query };
  }

  it("exposes runtime facts without evaluator selection or alert-triage helpers", () => {
    const { query } = harness();
    expect(Object.keys(query).sort()).toEqual([
      "alerts",
      "eventDeliveryHealth",
      "events",
      "metrics",
      "projects",
      "sessions",
      "sql",
      "workflowRuns",
    ]);
  });

  it("queries core runtime tables with bounded filters", () => {
    const { db, query } = harness();
    const now = 10_000;

    db.run("INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)", [
      "s1",
      "may",
      "older",
      "done",
      "p1",
      now - 100,
    ]);
    db.run("INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)", [
      "s2",
      "may",
      "newer",
      "error",
      "p1",
      now,
    ]);
    db.run("INSERT INTO sessions (sessionId, agent, task, status, projectId, startedAt) VALUES (?, ?, ?, ?, ?, ?)", [
      "s3",
      "scout",
      "other",
      "done",
      "p2",
      now + 100,
    ]);
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
      db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)", [
        "example",
        "test",
        "may",
        JSON.stringify({ i }),
        i,
      ]);
    }

    const result = query.sql("SELECT id, event_type FROM events ORDER BY id ASC", [], { limit: 3 });
    expect(result.rowCount).toBe(3);
    expect(result.truncated).toBe(true);
    expect(result.rows.map((row) => row.event_type)).toEqual(["example", "example", "example"]);
  });

  it("matches event owners by exact owner value", () => {
    const { db, query } = harness();

    db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)", [
      "project.nudge",
      "test",
      "agent:may",
      JSON.stringify({ canonical: true }),
      2,
    ]);
    db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)", [
      "project.nudge",
      "test",
      "may",
      JSON.stringify({ legacy: true }),
      1,
    ]);

    expect(query.events({ owner: "agent:may" }).rows.map((row) => row.owner)).toEqual(["agent:may"]);
    expect(query.events({ owner: "may" }).rows.map((row) => row.owner)).toEqual(["may"]);
  });

  it("scopes events to one project", () => {
    const { db, query } = harness();

    db.run("INSERT INTO events (event_type, source, owner, project_id, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)", [
      "project.task.reconciled",
      "test",
      "agent:scout",
      "scout-knowledge-lib",
      JSON.stringify({ disposition: "converged" }),
      2,
    ]);
    db.run("INSERT INTO events (event_type, source, owner, project_id, data, timestamp) VALUES (?, ?, ?, ?, ?, ?)", [
      "project.task.reconciled",
      "test",
      "agent:owner",
      "another-project",
      JSON.stringify({ disposition: "attention" }),
      3,
    ]);

    expect(
      query.events({
        type: "project.task.reconciled",
        projectId: "scout-knowledge-lib",
      }).rows,
    ).toMatchObject([
      {
        event_type: "project.task.reconciled",
        project_id: "scout-knowledge-lib",
      },
    ]);
  });

  it("retains filtered metric, alert, and project diagnostics", () => {
    const { db, query } = harness();
    for (const id of ["p1", "p2"]) {
      db.run("INSERT INTO projects (id, path, name, owner, updated_at) VALUES (?, ?, ?, ?, ?)", [
        id,
        `projects/${id}`,
        id,
        `app:${id}`,
        100,
      ]);
      db.run("INSERT INTO metrics (id, name, project, owner, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
        `${id}.health`,
        "Health",
        id,
        `app:${id}`,
        "active",
        100,
      ]);
      db.run("INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)", [
        `${id}.health`,
        "threshold",
        "Inspect the evidence",
        100,
      ]);
    }
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at, resolved_at) VALUES (?, ?, ?, ?, ?)",
      ["p1.health", "threshold", "Historical alert", 50, 90],
    );

    expect(query.projects({ owner: "app:p1" }).rows.map((row) => row.id)).toEqual(["p1"]);
    expect(query.metrics({ project: "p1", status: "active" }).rows.map((row) => row.id)).toEqual(["p1.health"]);
    expect(query.alerts({ metricId: "p1.health", resolved: false }).rows).toMatchObject([
      { metric_id: "p1.health", message: "Inspect the evidence", resolved_at: null },
    ]);
    expect(query.alerts({ metricId: "p1.health", resolved: true, until: 80 }).rows).toMatchObject([
      { metric_id: "p1.health", message: "Historical alert", resolved_at: 90 },
    ]);
  });

  it("keeps stored evaluation history readable after reopening the database", () => {
    const { root, db } = harness();
    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)", [
      "reviewed-session",
      "dev",
      "Inspect result",
      "done",
      100,
    ]);
    db.run(
      "INSERT INTO evaluations (sessionId, agent, verdict, issues, evaluatedByHeuristic, skippedByJs, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["reviewed-session", "dev", "needs_improvement", '["missing evidence"]', 0, 0, 200],
    );
    closeDb(root);

    const query = createQueryService({ getDb: () => getDb(root) });
    expect(
      query.sql(
        `SELECT s.sessionId, s.status, e.verdict, e.issues FROM sessions s
      JOIN evaluations e ON e.sessionId = s.sessionId WHERE s.sessionId = ?`,
        ["reviewed-session"],
      ).rows,
    ).toEqual([
      { sessionId: "reviewed-session", status: "done", verdict: "needs_improvement", issues: '["missing evidence"]' },
    ]);
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
});
