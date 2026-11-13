import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
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

  it("exposes event and read-only SQL queries without evaluator selection or alert-triage helpers", () => {
    const { query } = harness();
    expect(Object.keys(query).sort()).toEqual(["eventDeliveryHealth", "events", "sql"]);
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

  it("keeps stored workflow run history readable after reopening the database", () => {
    const { root, db } = harness();
    db.run("INSERT INTO sessions (sessionId, agent, task, status, startedAt) VALUES (?, ?, ?, ?, ?)", [
      "reviewed-session",
      "dev",
      "Inspect result",
      "done",
      100,
    ]);
    db.run(
      "INSERT INTO workflow_runs (runId, workflow, task, status, parentSessionId, startedAt) VALUES (?, ?, ?, ?, ?, ?)",
      ["wr_1", "verify", "Inspect result", "done", "reviewed-session", 200],
    );
    closeDb(root);

    const query = createQueryService({ getDb: () => getDb(root) });
    expect(
      query.sql(
        `SELECT s.sessionId, s.status, w.workflow FROM sessions s
      JOIN workflow_runs w ON w.parentSessionId = s.sessionId WHERE s.sessionId = ?`,
        ["reviewed-session"],
      ).rows,
    ).toEqual([
      { sessionId: "reviewed-session", status: "done", workflow: "verify" },
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
