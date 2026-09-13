import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { upsertSession } from "../../../lib/db/sessions.js";
import { markSessionActive, markSessionInactive, sessionDir } from "../../../lib/persistence.js";
import { readExecutionStatus } from "./execution-status.js";
import { observeDaemonLiveness } from "../../modes/maintenance.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-execution-status-"));
  roots.push(root);
  const db = getDb(root);
  // Indexed authority rows; deliberately no workflow session or process registry.
  db.prepare(
    `INSERT INTO app_tasks
    (app_id, task_id, generation, resource_version, observed_generation, phase, lane, changed, ready,
     current_attempt_id, updated_at, resource_json)
    VALUES ('sample', 'work', 2, 1, 1, 'running', 'normal', 0, 0, 'current', 0, '{}')`,
  ).run();
  db.prepare(
    `INSERT INTO app_task_attempts
    (app_id, attempt_id, task_id, task_generation, state, lease_until, started_at, attempt_json)
    VALUES ('sample', 'current', 'work', 2, 'running', ?, 0, '{}')`,
  ).run(Date.now() + 60_000);
  const session = (sessionId: string, overrides: Partial<Parameters<typeof upsertSession>[1]> = {}) => {
    upsertSession(root, {
      sessionId,
      agent: "owner",
      task: "work ".repeat(100),
      status: "running",
      startedAt: 0,
      taskBinding: { appId: "sample", taskId: "work", generation: 2, attemptId: "current" },
      ...overrides,
    });
    markSessionActive(root, sessionId);
  };
  return { root, db, session };
}

test("reports each live current session once and rejects stale bindings and markers", () => {
  const { root, session } = fixture();
  session("one");
  session("two");
  session("superseded", { taskBinding: { appId: "sample", taskId: "work", generation: 1, attemptId: "old" } });
  session("wrong-attempt", { taskBinding: { appId: "sample", taskId: "work", generation: 2, attemptId: "old" } });
  session("missing-task", { taskBinding: { appId: "sample", taskId: "missing", generation: 2, attemptId: "current" } });
  session("terminal", { status: "done" });
  session("ended", { endedAt: 1 });
  session("inactive");
  markSessionInactive(root, "inactive");
  session("dead");
  writeFileSync(join(sessionDir(root, "dead"), "[ACTIVE]"), JSON.stringify({ pid: 2147483647 }));
  const status = readExecutionStatus(root);
  expect(status.activeWork).toBe(true);
  expect(status.sessions.map((item) => item.sessionId)).toEqual(["one", "two"]);
  expect(status.sessions.every((item) => item.task.length === 100)).toBe(true);
});

test("workflow claims protect work only while current, running and unexpired", () => {
  const { root, db } = fixture();
  expect(readExecutionStatus(root)).toEqual({ sessions: [], activeWork: true });
  expect(readExecutionStatus(root, Date.now() + 120_000).activeWork).toBe(false);
  db.prepare("UPDATE app_task_attempts SET task_generation = 1").run();
  expect(readExecutionStatus(root).activeWork).toBe(false);
  db.prepare("UPDATE app_task_attempts SET task_generation = 2, state = 'completed'").run();
  expect(readExecutionStatus(root).activeWork).toBe(false);
  db.prepare("UPDATE app_task_attempts SET state = 'running'").run();
  db.prepare("UPDATE app_tasks SET phase = 'pending', current_attempt_id = NULL").run();
  expect(readExecutionStatus(root).activeWork).toBe(false);
});

test("idle standalone sessions are visible but do not protect active work; cancellation fences bound sessions", () => {
  const { root, db, session } = fixture();
  session("cancelled");
  session("chat", { status: "idle", taskBinding: undefined });
  db.prepare("UPDATE app_tasks SET phase = 'cancelled', current_attempt_id = NULL").run();
  const status = readExecutionStatus(root);
  expect(status.activeWork).toBe(false);
  expect(status.sessions.map((item) => item.sessionId)).toEqual(["chat"]);
});

test("maintenance falls back to shared work when the socket is absent and exposes storage failure", async () => {
  const { root, db } = fixture();
  expect(await observeDaemonLiveness(root)).toEqual({ responsive: false, activeWork: true });
  db.prepare("UPDATE app_task_attempts SET lease_until = 0").run();
  expect(await observeDaemonLiveness(root)).toEqual({ responsive: false, activeWork: false });
  db.prepare("DROP TABLE sessions").run();
  expect(() => readExecutionStatus(root)).toThrow();
  await expect(observeDaemonLiveness(root)).rejects.toThrow();
});
