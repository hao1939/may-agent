import { afterEach, beforeEach, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { readHostHealth, HOST_HEALTH_DETAIL_LIMIT, HOST_HEALTH_MAX_LOOKBACK_MS } from "./host-health.js";

let db: SqliteDb;
const now = 2_000_000_000_000;
beforeEach(() => {
  db = openDatabase(":memory:");
  applyDbSchema(db);
});
afterEach(() => db.close());

function execution(
  table: "sessions" | "workflow_runs",
  id: string,
  status: string,
  endedAt: number | null,
  startedAt = now - 500,
) {
  const identity = table === "sessions" ? "sessionId, agent" : "runId, workflow";
  db.prepare(
    `INSERT INTO ${table} (${identity}, task, status, startedAt, endedAt)
    VALUES (?, 'fixture-worker', 'private task text', ?, ?, ?)`,
  ).run(id, status, startedAt, endedAt);
}

test("snapshot keeps all execution outcomes, cutoff boundaries and missing dates explicit", () => {
  for (const table of ["sessions", "workflow_runs"] as const) {
    for (const state of ["done", "error", "blocked", "interrupted", "legacy-state"])
      execution(table, state, state, now - 1);
    execution(table, "old", "error", now - 1001);
    execution(table, "at-start", "done", now - 1000);
    execution(table, "at-end", "error", now);
    execution(table, "running", "running", null, now - 10000);
    execution(table, "undated", "error", null);
    execution(table, "old-undated", "error", null, now - 10000);
  }
  const snapshot = readHostHealth(db, { lookbackMs: 1000 }, now);
  expect(snapshot.window).toEqual({ start: now - 1000, end: now });
  expect(snapshot.coverage).toEqual({ retainedOnly: true, executionScope: "all" });
  for (const report of Object.values(snapshot.executions)) {
    expect(report).toEqual({
      running: 1,
      ended: 6,
      done: 2,
      error: 1,
      blocked: 1,
      interrupted: 1,
      other: 1,
      undated: 1,
      recentErrors: [{ executionId: "error", endedAt: now - 1 }],
      errorsTruncated: false,
    });
  }
  expect(JSON.stringify(snapshot)).not.toContain("private task text");
  expect(JSON.stringify(snapshot)).not.toContain("fixture-worker");
});

test("detail caps never cap totals, leak payloads or imply complete failure visibility", () => {
  const count = HOST_HEALTH_DETAIL_LIMIT + 3;
  for (let i = 0; i < count; i++) {
    execution("workflow_runs", `run-${i}`, "error", now - i - 1);
    db.prepare("INSERT INTO events(event_type, data, timestamp) VALUES ('subscriber.failed', ?, ?)").run(
      JSON.stringify({ error: "private provider text", credential: "not-for-the-report" }),
      now - i - 1,
    );
  }
  // A passive unhandled fact is not automatically a Host failure.
  db.prepare("INSERT INTO events(event_type, timestamp) VALUES ('sample.fact', ?)").run(now - 1);
  const snapshot = readHostHealth(db, {}, now);
  expect(snapshot.executions.workflows.error).toBe(count);
  expect(snapshot.executions.workflows.recentErrors).toHaveLength(HOST_HEALTH_DETAIL_LIMIT);
  expect(snapshot.executions.workflows.errorsTruncated).toBe(true);
  expect(snapshot.runtimeFailures).toMatchObject({
    total: count,
    byType: [{ type: "subscriber.failed", count }],
    truncated: true,
  });
  expect(snapshot.runtimeFailures.recent).toHaveLength(HOST_HEALTH_DETAIL_LIMIT);
  expect(snapshot.runtimeFailures.recent[0]).toEqual({ eventId: 1, type: "subscriber.failed", timestamp: now - 1 });
  expect(JSON.stringify(snapshot)).not.toContain("private");
  expect(JSON.stringify(snapshot)).not.toContain("credential");
});

test("reads remain read-only and unavailable/corrupt storage rejects instead of inventing zero health", () => {
  db.exec("PRAGMA query_only = ON");
  expect(readHostHealth(db, {}, now).executions.agents.ended).toBe(0);
  db.exec("PRAGMA query_only = OFF");
  for (const lookbackMs of [0, -1, NaN, Infinity, 1.5, HOST_HEALTH_MAX_LOOKBACK_MS + 1])
    expect(() => readHostHealth(db, { lookbackMs }, now)).toThrow("lookbackMs");
  db.exec("ALTER TABLE sessions RENAME TO missing_sessions");
  db.exec("BEGIN");
  db.prepare("INSERT INTO events(event_type, timestamp) VALUES ('fixture.outer-write', ?)").run(now);
  expect(() => readHostHealth(db, {}, now)).toThrow();
  // The failed read released its savepoint and did not roll back its caller.
  expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'fixture.outer-write'").get()!.count).toBe(
    1,
  );
  db.exec("ROLLBACK");
  db.exec("ALTER TABLE missing_sessions RENAME TO sessions");
  db.exec("BEGIN");
  execution("sessions", "within-transaction", "done", now - 1);
  expect(readHostHealth(db, {}, now).executions.agents.done).toBe(1);
  db.exec("ROLLBACK");
  expect(readHostHealth(db, {}, now).executions.agents.done).toBe(0);
});

test("selected failure events use the same half-open window as execution outcomes", () => {
  const insert = db.prepare("INSERT INTO events(event_type, timestamp) VALUES (?, ?)");
  for (const timestamp of [now - 1001, now - 1000, now - 1, now, now + 1]) {
    insert.run("app.observer.failed", timestamp);
    insert.run("sample.domain.failed", timestamp);
  }
  const report = readHostHealth(db, { lookbackMs: 1000 }, now).runtimeFailures;
  expect(report.total).toBe(2);
  expect(report.byType).toEqual([{ type: "app.observer.failed", count: 2 }]);
  expect(report.recent.map((row) => row.timestamp)).toEqual([now - 1, now - 1000]);
});
