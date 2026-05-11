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

    expect(query.sessions({ agent: "may" }).rows.map((row) => row.sessionId)).toEqual(["s2", "s1"]);
    expect(query.sessions({ projectId: "p1", status: "done" }).rows).toMatchObject([
      { sessionId: "s1", agent: "may", status: "done" },
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
});
