import { afterEach, beforeEach, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { readTaskAttempts, taskAttemptsQuery } from "./task-attempts.js";

let db: SqliteDb;
beforeEach(() => {
  db = openDatabase(":memory:");
  applyDbSchema(db);
});
afterEach(() => db.close());
const end = 2_000_000_000_000;
const windowMs = 1000;
function attempt(
  id: string,
  taskId: string,
  state: string,
  start: number,
  finish?: number,
  handler = "executor:conversation",
) {
  const value = {
    handler,
    state,
    startedAt: new Date(start).toISOString(),
    ...(finish !== undefined ? { finishedAt: new Date(finish).toISOString() } : {}),
    ...(state === "failed" ? { failureReason: "HandlerResultSettlementFailed" } : {}),
    sessionId: `s_${id}`,
  };
  db.prepare(
    `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
    VALUES ('sample', ?, ?, 1, ?, ?, ?)`,
  ).run(id, taskId, state, start, JSON.stringify(value));
}
const query = (extra = "") =>
  taskAttemptsQuery(new URLSearchParams(`appId=sample&taskId=chat${extra}&end=${end}&windowMs=${windowMs}`), end);

test("one snapshot counts task attempts across executors, preserves recovery and uses disjoint denominators", () => {
  attempt("earlier", "chat", "failed", end - 1500, end - 1400);
  attempt("failed", "chat", "failed", end - 700, end - 600);
  attempt("retry", "chat", "completed", end - 500, end - 400);
  attempt("workflow", "other", "completed", end - 300, end - 200, "workflow:build");
  attempt("native", "other", "interrupted", end - 200, end - 100, "agent:worker");
  attempt("cross-cut", "chat", "completed", end - 1100, end - 900);
  attempt("at-cut", "chat", "failed", end - 50, end);
  attempt("outside", "chat", "failed", end, end + 20);
  db.prepare(
    `INSERT INTO workflow_runs(runId,workflow,task,status,startedAt,parentWorkflowRunId)
    VALUES ('nested','helper','sample','error',?,'parent')`,
  ).run(end - 600);
  const report = readTaskAttempts(db, query());
  expect(report).toMatchObject({
    available: true,
    previous: { totals: { started: 2, terminal: 1, failed: 1, nonterminalAtCut: 1 } },
    current: {
      totals: { started: 5, terminal: 4, failed: 1, interrupted: 1, failurePercent: 25, failedWallMs: 100 },
      task: { terminal: 2, failed: 1, failurePercent: 50 },
      otherTasks: { terminal: 2, failed: 0, failurePercent: 0 },
    },
  });
  expect("current" in report && report.current.byFailureReason[0]?.examples[0]?.attemptId).toBe("failed");
});

test("failed attempts expose canonical session and workflow links without an accepted result", () => {
  attempt("failed", "chat", "failed", end - 700, end - 600);
  db.prepare(
    `INSERT INTO workflow_runs(runId,workflow,task,status,startedAt,app_id,task_id,task_generation,attempt_id)
    VALUES ('run','helper','sample','error',?,'sample','chat',1,'failed')`,
  ).run(end - 700);
  const report = readTaskAttempts(db, query("&attemptId=failed"));
  expect(report).toMatchObject({
    available: true,
    appId: "sample",
    taskId: "chat",
    generation: 1,
    attemptId: "failed",
    sessionId: "s_failed",
    state: "failed",
    workflows: [{ runId: "run" }],
  });
  expect(
    readTaskAttempts(db, taskAttemptsQuery(new URLSearchParams("appId=sample&taskId=wrong&attemptId=failed"))),
  ).toMatchObject({ available: false });
});

test("no activity has no rate and invalid windows cannot silently return a healthy zero", () => {
  expect(readTaskAttempts(db, query())).toMatchObject({ current: { totals: { terminal: 0, failurePercent: null } } });
  for (const extra of ["&end=0", `&end=${end + 1}`, "&windowMs=999999999999", "&windowMs=NaN"])
    expect(() => query(extra)).toThrow();
});
