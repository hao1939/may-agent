import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  deferAppTask,
  observeAppTaskIntent,
} from "../tasks/app-task-reconciler.js";
import { retireAppState, type RetiredAppRetirementPlan } from "./retired-app-retirement.js";

const roots: string[] = [];
const connections: SqliteDb[] = [];
afterEach(() => {
  connections.splice(0).forEach((db) => db.close());
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
function snapshot(db: SqliteDb) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_%' ORDER BY name")
    .all()
    .map((row) => [
      row.name,
      db
        .prepare(`SELECT * FROM ${row.name}`)
        .all()
        .map((row) => JSON.stringify(row))
        .sort(),
    ]);
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-retirement-"));
  roots.push(root);
  const db = openDatabase(join(root, "may.db"));
  connections.push(db);
  applyDbSchema(db);
  const contextFor = (appId: string) => {
    const store = AppTaskResourceStore.fromDb(db, appId);
    store.bootstrapSnapshot(
      {
        project: appId,
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
      "fixture",
    );
    return appTaskContext({ appDir: root, projectDir: root, agent: appId, resourceStore: store });
  };
  const context = contextFor("retired-example");
  const other = contextFor("active-example");
  for (const ctx of [context, other]) {
    observeAppTaskIntent(ctx, {
      appAgent: ctx.agent,
      intent: {
        id: "waiting",
        parentId: "root",
        outcome: "Await external authority",
        acceptance: ["Authority supplies evidence"],
      },
    });
    const claim = claimObservedAppTask(ctx, { taskId: "waiting", appAgent: ctx.agent, handler: "agent" });
    if (claim.kind !== "claimed") throw new Error(claim.kind);
    deferAppTask(ctx, claim, {
      disposition: "waiting",
      summary: "Unfulfilled, waiting on external evidence",
      facts: ["Retained historical fact"],
      conditions: [
        {
          id: "authority",
          type: "evidence.ready",
          subject: "external:authority",
          expected: true,
          owner: "human:example",
        },
      ],
    });
  }
  observeAppTaskIntent(context, {
    appAgent: context.agent,
    intent: { id: "pending", parentId: "root", outcome: "Old controller", acceptance: ["Review work"] },
    trigger: { type: "manual.wake", data: {} },
  });
  for (const id of ["parent", "child"]) {
    createAppInboxItem(db, {
      id,
      appId: "retired-example",
      ...(id === "child" ? { parentId: "parent" } : {}),
      source: { kind: "system", id: "historical-controller" },
      input: { kind: "message", data: { message: id } },
      idempotencyKey: id,
      originEventId: 7,
      now: 1,
    });
  }
  // Deliberately seed legacy, unadmitted execution facts below current admission.
  db.exec(`UPDATE app_inbox_items SET status='handling', session_id='old-session',
    waiting_on_kind='session', waiting_on_id='old-session', started_at=2,
    handling='{"phase":"executing"}', lease_generation=3, lease_owner='old-worker',
    lease_expires_at=3, review_at=4 WHERE id='child'`);
  const plan: RetiredAppRetirementPlan = {
    id: "reviewed-withdrawal-v1",
    appId: "retired-example",
    quiesced: true,
    appRetired: true,
    tasks: db
      .prepare("SELECT task_id, resource_json, trigger_json FROM app_tasks WHERE app_id=? ORDER BY task_id")
      .all("retired-example")
      .map((row) => ({
        taskId: String(row.task_id),
        resourceJson: String(row.resource_json),
        triggerJson: row.trigger_json as string | null,
        reason: "Reviewed outcome withdrawn unfulfilled",
      })),
    inputs: db
      .prepare("SELECT * FROM app_inbox_items WHERE app_id=? ORDER BY id")
      .all("retired-example")
      .map((row) => ({ row, reason: "Reviewed historical caller chain withdrawn" })),
  };
  return { root, db, context, other, store: context.resourceStore, plan };
}

test("withdraws responsibility atomically, retaining accepted evidence, caller chain and unrelated authority waits", () => {
  const { db, context, other, store, plan } = fixture();
  const attempts = db.prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id").all();
  const otherBefore = other.resourceStore.readTaskContext({ taskIds: ["waiting"], conditionIds: ["authority"] });
  expect(retireAppState(context, plan, { now: 10 })).toEqual({ status: "retired", tasks: 2, inputs: 2 });
  expect(db.prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id").all()).toEqual(attempts);
  expect(other.resourceStore.readTaskContext({ taskIds: ["waiting"], conditionIds: ["authority"] })).toEqual(
    otherBefore,
  );
  for (const task of plan.tasks) {
    expect(store.readCancellation(task.taskId)?.kind).toBe("cancelled");
    expect(store.readCancellation(task.taskId)?.reason).toContain("withdrawn unfulfilled");
    expect(store.readTask(task.taskId)?.spec).toEqual(JSON.parse(task.resourceJson).spec);
    expect(store.readTrigger(task.taskId)).toBeNull();
    expect(store.readTask(task.taskId)?.status.conditionIds).toEqual([]);
  }
  const child = getAppInboxItem(db, "child")!;
  expect(child.status).toBe("done");
  expect(child.handling?.phase).toBe("stopped");
  expect(child.result).toBeUndefined();
  expect(child.parentId).toBe("parent");
  expect(child.sessionId).toBe("old-session");
  expect(child.waitingOn).toEqual({ kind: "session", id: "old-session" });
  expect(child.source).toEqual({ kind: "system", id: "historical-controller" });
  expect(child.originEventId).toBe(7);
  expect(child.lease).toBeUndefined();
  expect(child.reviewAt).toBeUndefined();
  expect(child.completedAt).toBe(10);
  const beforeReplay = snapshot(db);
  expect(retireAppState(context, plan).status).toBe("already-retired");
  expect(snapshot(db)).toEqual(beforeReplay);
  const changedPlan = structuredClone(plan);
  changedPlan.tasks[0]!.resourceJson += " ";
  expect(() => retireAppState(context, changedPlan)).toThrow("different terminal decision");
});

test("dry run exercises canonical withdrawal and rolls back every table", () => {
  const { db, context, plan } = fixture();
  const before = snapshot(db);
  expect(retireAppState(context, plan, { dryRun: true })).toEqual({ status: "would-retire", tasks: 2, inputs: 2 });
  expect(snapshot(db)).toEqual(before);
});

for (const [label, sql] of [
  [
    "resource",
    "UPDATE app_tasks SET resource_json=json_set(resource_json, '$.status.summary', 'new evidence') WHERE app_id='retired-example' AND task_id='waiting'",
  ],
  ["trigger", "UPDATE app_tasks SET trigger_json=NULL WHERE app_id='retired-example' AND task_id='pending'"],
  ["input", "UPDATE app_inbox_items SET waiting_on_id='different-session' WHERE id='child'"],
] as const)
  test(`rejects stale ${label} preimages before any retirement`, () => {
    const { db, context, plan } = fixture();
    db.exec(sql);
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow("changed");
    expect(snapshot(db)).toEqual(before);
  });

for (const kind of ["Task", "input"] as const)
  test(`requires complete ${kind} census`, () => {
    const { db, context, plan } = fixture();
    if (kind === "Task") plan.tasks.pop();
    else plan.inputs.pop();
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow("census");
    expect(snapshot(db)).toEqual(before);
  });

test("failure after canonical cancellations rolls back Tasks, Conditions, receipts and inputs together", () => {
  const { db, context, plan } = fixture();
  db.exec(`CREATE TRIGGER reject_retirement BEFORE UPDATE OF status ON app_inbox_items
    WHEN NEW.id='parent' AND NEW.status='done' BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END`);
  const before = snapshot(db);
  expect(() => retireAppState(context, plan)).toThrow("fixture write failure");
  expect(snapshot(db)).toEqual(before);
});

for (const field of ["execution_task_id", "task_admission_key", "target_task_id", "conversation_id", "result"])
  test(`refuses input with ${field}`, () => {
    const { db, context, plan } = fixture();
    db.prepare(`UPDATE app_inbox_items SET ${field}=? WHERE id='child'`).run(field === "result" ? "{}" : "identity");
    plan.inputs.find((input) => input.row.id === "child")!.row = db
      .prepare("SELECT * FROM app_inbox_items WHERE id='child'")
      .get()!;
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow("legacy inputs");
    expect(snapshot(db)).toEqual(before);
  });

test("refuses an active Task even when the reviewed plan includes its exact current resource", () => {
  const { db, context, plan } = fixture();
  expect(claimObservedAppTask(context, { taskId: "pending", appAgent: context.agent, handler: "agent" }).kind).toBe(
    "claimed",
  );
  plan.tasks.find((task) => task.taskId === "pending")!.resourceJson = String(
    db.prepare("SELECT resource_json FROM app_tasks WHERE app_id=? AND task_id='pending'").get(plan.appId)!
      .resource_json,
  );
  const before = snapshot(db);
  expect(() => retireAppState(context, plan)).toThrow("current attempt");
  expect(snapshot(db)).toEqual(before);
});

for (const change of ["mixed", "foreign", "reopened-input", "resource-version"] as const)
  test(`refuses ${change} replay`, () => {
    const { db, context, plan } = fixture();
    retireAppState(context, plan);
    if (change === "mixed")
      db.exec("DELETE FROM app_task_cancellations WHERE app_id='retired-example' AND task_id='pending'");
    if (change === "foreign")
      db.exec(
        "UPDATE app_task_cancellations SET cancellation_json=json_set(cancellation_json, '$.reason', 'foreign') WHERE app_id='retired-example'",
      );
    if (change === "reopened-input") db.exec("UPDATE app_inbox_items SET available_at=15 WHERE id='child'");
    if (change === "resource-version")
      db.exec(
        "UPDATE app_tasks SET resource_json=json_set(resource_json, '$.metadata.resourceVersion', 100) WHERE app_id='retired-example' AND task_id='waiting'",
      );
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow();
    expect(snapshot(db)).toEqual(before);
  });

test("CLI applies the reviewed file offline and replays after reopening the database", async () => {
  const { root, db, plan } = fixture();
  const file = join(root, "plan.json");
  writeFileSync(file, JSON.stringify(plan));
  db.close();
  connections.splice(connections.indexOf(db), 1);
  const run = async (dryRun = false) => {
    const child = Bun.spawn(
      [
        process.execPath,
        "scripts/operations/retire-app-state.ts",
        "--state-dir",
        root,
        "--plan",
        file,
        "--confirm-quiesced",
        "--confirm-app-retired",
        ...(dryRun ? ["--dry-run"] : []),
      ],
      { stdout: "pipe", stderr: "pipe", timeout: 10_000 },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    return JSON.parse(stdout);
  };
  expect((await run(true)).status).toBe("would-retire");
  expect((await run()).status).toBe("retired");
  expect((await run()).status).toBe("already-retired");
});

test("replays canonical withdrawal of legacy achieve/maintain resources without restoring retired modes", () => {
  const { db, context, store, plan } = fixture();
  for (const [index, task] of plan.tasks.entries()) {
    const resource = JSON.parse(task.resourceJson);
    resource.spec.mode = index === 0 ? "achieve" : "maintain";
    task.resourceJson = JSON.stringify(resource);
    db.prepare("UPDATE app_tasks SET resource_json=? WHERE app_id=? AND task_id=?").run(
      task.resourceJson,
      plan.appId,
      task.taskId,
    );
  }
  expect(retireAppState(context, plan).status).toBe("retired");
  for (const task of plan.tasks) {
    const { mode: _retiredMode, ...currentSpec } = JSON.parse(task.resourceJson).spec;
    expect(store.readTask(task.taskId)?.spec).toEqual(currentSpec);
  }
  const before = snapshot(db);
  expect(retireAppState(context, plan).status).toBe("already-retired");
  expect(snapshot(db)).toEqual(before);
});
