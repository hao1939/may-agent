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
  cancelAppTask,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  reportAppTaskFailure,
  reopenAppTask,
  retryFailedAppTask,
} from "../tasks/app-task-reconciler.js";
import { admitTaskInput } from "./inbox.js";
import { readRuntimeTaskView } from "../reads/app-read.js";
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
function databaseFixture() {
  const root = mkdtempSync(join(tmpdir(), "may-retirement-"));
  roots.push(root);
  const db = openDatabase(join(root, "may.db"));
  connections.push(db);
  applyDbSchema(db);
  return { root, db };
}
function fixture() {
  const { root, db } = databaseFixture();
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

function admittedFixture() {
  const f = fixture();
  const item = getAppInboxItem(f.db, "parent")!;
  const admit = (taskId: string, key: string) =>
    admitTaskInput(f.context, {
      appId: f.plan.appId,
      attachment: { kind: "existing", taskId },
      idempotencyKey: key,
      inputContext: { id: item.id, source: item.source, input: item.input },
    });
  admit("pending", "task:parent:existing:pending");
  observeAppTaskIntent(f.context, {
    appAgent: f.context.agent,
    intent: { id: "pending", parentId: "root", outcome: "Revised controller", acceptance: ["Review new work"] },
  });
  admit("pending", "task:parent:desired:pending");
  admit("waiting", "task:parent:existing:waiting");
  return reviewCaller(f);
}

function refreshReviewedTasks(f: ReturnType<typeof fixture>) {
  for (const task of f.plan.tasks) {
    const row = f.db
      .prepare("SELECT resource_json, trigger_json FROM app_tasks WHERE app_id=? AND task_id=?")
      .get(f.plan.appId, task.taskId)!;
    task.resourceJson = String(row.resource_json);
    task.triggerJson = row.trigger_json as string | null;
  }
}

function reviewCaller(f: ReturnType<typeof fixture>, admissionKeys?: string[]) {
  refreshReviewedTasks(f);
  const input = f.plan.inputs.find((input) => input.row.id === "parent")!;
  input.admissionWithdrawal = {
    decision: "withdraw-unfulfilled",
    rows: f.db
      .prepare("SELECT * FROM app_task_admissions WHERE app_id=? ORDER BY task_id")
      .all(f.plan.appId)
      .filter((row) => !admissionKeys || admissionKeys.includes(String(row.task_id)))
      .map((row) => ({
        app_id: String(row.app_id),
        task_id: String(row.task_id),
        admission_json: String(row.admission_json),
      })),
  };
  return { ...f, input };
}

async function runCli(root: string, plan: RetiredAppRetirementPlan, dryRun = false) {
  const file = join(root, "plan.json");
  writeFileSync(file, JSON.stringify(plan));
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
  return { stdout, stderr, code };
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

test("explicitly withdraws an unanswered caller across historical aliases without choosing or changing admission authority", () => {
  const { db, context, other, plan, input } = admittedFixture();
  expect(input.admissionWithdrawal!.rows).toHaveLength(3);
  const admissions = db.prepare("SELECT * FROM app_task_admissions ORDER BY app_id, task_id").all();
  const attempts = db.prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id").all();
  const independent = other.resourceStore.readTaskContext({ taskIds: ["waiting"], conditionIds: ["authority"] });
  const before = snapshot(db);
  expect(retireAppState(context, plan, { dryRun: true }).status).toBe("would-retire");
  expect(snapshot(db)).toEqual(before);
  expect(retireAppState(context, plan)).toEqual({ status: "retired", tasks: 2, inputs: 2 });
  expect(db.prepare("SELECT * FROM app_task_admissions ORDER BY app_id, task_id").all()).toEqual(admissions);
  expect(db.prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id").all()).toEqual(attempts);
  expect(other.resourceStore.readTaskContext({ taskIds: ["waiting"], conditionIds: ["authority"] })).toEqual(
    independent,
  );
  expect(getAppInboxItem(db, "parent")).toMatchObject({ status: "done", handling: { phase: "stopped" } });
  expect(getAppInboxItem(db, "parent")!.result).toBeUndefined();
  expect(getAppInboxItem(db, "child")!.parentId).toBe("parent");
  const retired = snapshot(db);
  expect(retireAppState(context, plan).status).toBe("already-retired");
  expect(snapshot(db)).toEqual(retired);
});

for (const receiptGeneration of [1, 2])
  test(`checks generation ${receiptGeneration} completion authority before withdrawing historical aliases`, () => {
    const { db, context, store, plan, input } = admittedFixture();
    expect(
      store.commit({
        fences: [{ taskId: "pending", resourceVersion: store.readTask("pending")!.metadata.resourceVersion }],
        receipts: [
          {
            metadata: { id: "legacy-done", generation: receiptGeneration, resourceVersion: 1 },
            specHash: "completed-later-spec",
            parentId: "root",
            outcome: "Later outcome completed",
            acceptance: ["Later evidence"],
            owner: context.agent,
            handler: "agent",
            summary: "Later outcome",
            facts: [],
            acceptanceBasis: { method: "workflow-contract", facts: [] },
            failureFingerprints: [],
            completedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toBe(true);
    observeAppTaskIntent(context, {
      appAgent: context.agent,
      intent: {
        id: "legacy-cancelled",
        parentId: "root",
        outcome: "Withdrawn historical work",
        acceptance: ["Old requirement"],
      },
    });
    const task = store.readTask("legacy-cancelled")!;
    cancelAppTask(context, {
      appId: plan.appId,
      taskId: "legacy-cancelled",
      expectedGeneration: task.metadata.generation,
      expectedResourceVersion: task.metadata.resourceVersion,
      reason: "Already withdrawn",
    });
    for (const taskId of ["legacy-done", "legacy-cancelled"]) {
      const admission = {
        ...JSON.parse(input.admissionWithdrawal!.rows[0]!.admission_json),
        taskId,
        taskGeneration: 1,
      };
      const row = {
        app_id: plan.appId,
        task_id: `task:parent:existing:${taskId}`,
        admission_json: JSON.stringify(admission),
      };
      db.prepare("INSERT INTO app_task_admissions(app_id, task_id, admission_json) VALUES (?, ?, ?)").run(
        row.app_id,
        row.task_id,
        row.admission_json,
      );
      input.admissionWithdrawal!.rows.push(row);
    }
    const receipt = store.readReceipt("legacy-done");
    const terminal = store.readCancellation("legacy-cancelled");
    if (receiptGeneration === 1) {
      const before = snapshot(db);
      expect(() => retireAppState(context, plan)).toThrow("must be settled before withdrawal");
      expect(snapshot(db)).toEqual(before);
      return;
    }
    expect(retireAppState(context, plan).status).toBe("retired");
    expect(store.readReceipt("legacy-done")).toEqual(receipt);
    expect(store.readCancellation("legacy-cancelled")).toEqual(terminal);
    expect(retireAppState(context, plan).status).toBe("already-retired");
  });

test("bounds the complete retirement plan including admission preimages", () => {
  const { db, context, plan, input } = admittedFixture();
  input.admissionWithdrawal!.rows = Array.from({ length: 1001 }, () => input.admissionWithdrawal!.rows[0]!);
  const before = snapshot(db);
  expect(() => retireAppState(context, plan)).toThrow("bounded explicit");
  expect(snapshot(db)).toEqual(before);
});

for (const { preserveLegacy, binding } of [false, true].flatMap((preserveLegacy) =>
  ["retained", "missing"].map((binding) => ({ preserveLegacy, binding })),
))
  test(`refuses a real accepted answer with ${binding} admission result binding (legacy archive: ${preserveLegacy})`, () => {
    const { db, context, plan, input } = admittedFixture();
    const claim = claimObservedAppTask(context, { taskId: "pending", appAgent: context.agent, handler: "agent" });
    if (claim.kind !== "claimed") throw new Error(claim.kind);
    expect(completeAppTask(context, claim, { summary: "Exact accepted answer" }).status).toBe("applied");
    if (binding === "missing")
      db.prepare(
        "UPDATE app_task_admissions SET admission_json=json_remove(admission_json, '$.resultAttemptId') WHERE app_id=?",
      ).run(plan.appId);
    for (const row of input.admissionWithdrawal!.rows)
      row.admission_json = String(
        db
          .prepare("SELECT admission_json FROM app_task_admissions WHERE app_id=? AND task_id=?")
          .get(row.app_id, row.task_id)!.admission_json,
      );
    const task = plan.tasks.find((task) => task.taskId === "pending")!;
    const current = db
      .prepare("SELECT resource_json, trigger_json FROM app_tasks WHERE app_id=? AND task_id=?")
      .get(plan.appId, task.taskId)!;
    task.resourceJson = String(current.resource_json);
    task.triggerJson = current.trigger_json as string | null;
    if (preserveLegacy)
      for (const entry of plan.tasks)
        entry.legacyObservation = { decision: "preserve-unverified", reason: "Retain original observations" };
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow("must be settled before withdrawal");
    expect(snapshot(db)).toEqual(before);
  });

for (const { preserveLegacy, answersOlderCaller } of [false, true].flatMap((preserveLegacy) =>
  [true, false].map((answersOlderCaller) => ({ preserveLegacy, answersOlderCaller })),
))
  test(`newer accepted outcome answers the older caller: ${answersOlderCaller} (legacy archive: ${preserveLegacy})`, () => {
    const f = fixture();
    const olderKey = "task:parent";
    const admit = (id: string, key: string) =>
      admitTaskInput(f.context, {
        appId: f.plan.appId,
        attachment: { kind: "existing", taskId: "pending" },
        idempotencyKey: key,
        inputContext: {
          id,
          source: { kind: "system", id: "review" },
          input: { kind: "message", data: { message: id } },
        },
      });
    admit("parent", olderKey);
    observeAppTaskIntent(f.context, {
      appAgent: f.context.agent,
      intent: { id: "pending", parentId: "root", outcome: "Revised controller", acceptance: ["Review new work"] },
    });
    const scope = answersOlderCaller ? olderKey : "unrelated-admission";
    if (!answersOlderCaller) admit("unrelated-input", scope);
    const claim = claimObservedAppTask(f.context, { taskId: "pending", appAgent: f.context.agent, handler: "agent" });
    if (claim.kind !== "claimed") throw new Error(claim.kind);
    expect(claim.generation).toBe(2);
    expect(
      completeAppTask(f.context, claim, {
        summary: "A scoped answer under newer requirements",
        result: { evidence: scope },
        inputKeys: [scope],
      }).status,
    ).toBe("applied");
    // Retain the answer's exact accepted scope while simulating a missing
    // admission result projection. No admission for this caller exists at g2.
    f.db
      .prepare(
        "UPDATE app_task_admissions SET admission_json=json_remove(admission_json, '$.resultAttemptId') WHERE app_id=? AND task_id=?",
      )
      .run(f.plan.appId, olderKey);
    const { db, context, store, plan, input } = reviewCaller(f, [olderKey]);
    if (preserveLegacy)
      for (const entry of plan.tasks)
        entry.legacyObservation = { decision: "preserve-unverified", reason: "Retain original observations" };
    expect(input.admissionWithdrawal!.rows).toHaveLength(1);
    expect(JSON.parse(input.admissionWithdrawal!.rows[0]!.admission_json).taskGeneration).toBe(1);
    const accepted = store.readAttempt(claim.attemptId)!;
    expect(accepted.acceptedResult?.inputKeys).toEqual([scope]);
    const before = snapshot(db);
    if (answersOlderCaller) {
      expect(() => retireAppState(context, plan)).toThrow("must be settled before withdrawal");
      expect(snapshot(db)).toEqual(before);
    } else {
      const unrelated = db
        .prepare("SELECT * FROM app_task_admissions WHERE app_id=? AND task_id=?")
        .get(plan.appId, scope);
      expect(retireAppState(context, plan).status).toBe("retired");
      expect(store.readAttempt(claim.attemptId)).toEqual(accepted);
      expect(
        db.prepare("SELECT * FROM app_task_admissions WHERE app_id=? AND task_id=?").get(plan.appId, scope),
      ).toEqual(unrelated);
      expect(getAppInboxItem(db, "parent")!.result).toBeUndefined();
      expect(retireAppState(context, plan).status).toBe("already-retired");
    }
  });

for (const scenario of [
  "admitted",
  "revised-after-answer",
  "newer-pending",
  "newer-converged",
  "newer-partial-evidence",
  "newer-retained-evidence",
])
  test(`preserves the exact legacy Task answer before withdrawal: ${scenario}`, () => {
    const f = fixture();
    const key = "task:parent";
    const newer = scenario.startsWith("newer-");
    const revise = () =>
      observeAppTaskIntent(f.context, {
        appAgent: f.context.agent,
        intent: { id: "pending", parentId: "root", outcome: "Revised controller", acceptance: ["Review new work"] },
      });
    admitTaskInput(f.context, {
      appId: f.plan.appId,
      attachment: { kind: "existing", taskId: "pending" },
      idempotencyKey: key,
      inputContext: {
        id: "parent",
        source: { kind: "system", id: "review" },
        input: { kind: "message", data: { message: "Review" } },
      },
    });
    if (newer) revise();
    const claim = claimObservedAppTask(f.context, { taskId: "pending", appAgent: f.context.agent, handler: "agent" });
    if (claim.kind !== "claimed") throw new Error(claim.kind);
    expect(
      completeAppTask(f.context, claim, {
        summary: "Retained legacy answer",
        response: "Original answer",
        result: { proof: "Task-only payload" },
        // A later outcome does not answer the original caller by implication.
        inputKeys: newer ? [] : [key],
      }).status,
    ).toBe("applied");
    const accepted = f.store.readAttempt(claim.attemptId)!;
    if (scenario !== "newer-retained-evidence") {
      f.db
        .prepare(
          "UPDATE app_task_attempts SET attempt_json=json_remove(attempt_json, ?) WHERE app_id=? AND attempt_id=?",
        )
        .run(
          scenario === "newer-partial-evidence" ? "$.acceptedResult.result" : "$.acceptedResult",
          f.plan.appId,
          claim.attemptId,
        );
    }
    f.db
      .prepare(
        "UPDATE app_task_admissions SET admission_json=json_remove(admission_json, '$.resultAttemptId') WHERE app_id=? AND task_id=?",
      )
      .run(f.plan.appId, key);
    if (scenario === "revised-after-answer") revise();
    if (newer && scenario !== "newer-pending") {
      // Historical Hosts could project a converged Task before correlating its
      // older unanswered caller. Keep the original answer payload and generation.
      f.db
        .prepare(`UPDATE app_tasks SET resource_json=json_set(resource_json, '$.status.phase', 'converged')
          WHERE app_id=? AND task_id='pending'`)
        .run(f.plan.appId);
    }
    const { db, context, store, plan, input } = reviewCaller(f, [key]);
    expect(JSON.parse(input.admissionWithdrawal!.rows[0]!.admission_json).resultAttemptId).toBeUndefined();
    const task = store.readTask("pending")!;
    expect(task.metadata.generation).toBe(scenario === "admitted" ? 1 : 2);
    expect(task.status).toMatchObject({
      phase: scenario === "newer-pending" ? "pending" : "converged",
      observedGeneration: newer ? 2 : 1,
      summary: "Retained legacy answer",
      response: "Original answer",
      result: { proof: "Task-only payload" },
    });
    const before = snapshot(db);
    if (scenario === "newer-retained-evidence") {
      expect(retireAppState(context, plan).status).toBe("retired");
      expect(store.readAttempt(claim.attemptId)).toEqual(accepted);
      expect(getAppInboxItem(db, "parent")!.result).toBeUndefined();
      const after = snapshot(db);
      expect(retireAppState(context, plan).status).toBe("already-retired");
      expect(snapshot(db)).toEqual(after);
    } else {
      expect(() => retireAppState(context, plan)).toThrow(
        newer ? "retained accepted evidence" : "must be settled before withdrawal",
      );
      expect(snapshot(db)).toEqual(before);
      expect(store.readTask("pending")).toEqual(task);
    }
  });

test("refuses cancellation when a waiting Task retains its only accepted outcome", () => {
  const { db, context, store, plan } = fixture();
  const task = store.readTask("waiting")!;
  db.prepare(
    "UPDATE app_task_attempts SET attempt_json=json_remove(attempt_json, '$.acceptedResult') WHERE app_id=? AND attempt_id=?",
  )
    .run(plan.appId, task.status.observedAttemptId!);
  const before = snapshot(db);
  expect(() => retireAppState(context, plan)).toThrow("retained accepted evidence");
  expect(snapshot(db)).toEqual(before);
  expect(store.readTask("waiting")).toEqual(task);
});


for (const phase of ["pending", "waiting", "attention", "converged"] as const)
  for (const reference of ["absent", "dangling"] as const)
    test(`retained outcome requires resolvable provenance (${phase}, ${reference})`, () => {
      const f = fixture();
      const task = f.store.readTask("waiting")!;
      task.status.phase = phase;
      if (reference === "absent") delete task.status.observedAttemptId;
      else task.status.observedAttemptId = "missing-observed-attempt";
      f.db
        .prepare(
          "UPDATE app_tasks SET resource_json=? WHERE app_id=? AND task_id='waiting'",
        )
        .run(JSON.stringify(task), f.plan.appId);
      refreshReviewedTasks(f);
      const before = snapshot(f.db);
      for (const dryRun of [true, false]) {
        expect(() => retireAppState(f.context, f.plan, { dryRun })).toThrow(
          "retained accepted evidence",
        );
        expect(snapshot(f.db)).toEqual(before);
      }
    });

for (const field of ["summary", "response", "result"] as const)
  test(`a legacy ${field} alone still requires outcome preservation`, () => {
    const f = fixture();
    const task = f.store.readTask("waiting")!;
    delete task.status.observedAttemptId;
    delete task.status.summary;
    delete task.status.response;
    delete task.status.result;
    task.status.phase = "pending";
    if (field === "result")
      task.status.result = { proof: "only retained payload" };
    else task.status[field] = "only retained payload";
    f.db
      .prepare(
        "UPDATE app_tasks SET resource_json=? WHERE app_id=? AND task_id='waiting'",
      )
      .run(JSON.stringify(task), f.plan.appId);
    refreshReviewedTasks(f);
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow(
      "retained accepted evidence",
    );
    expect(snapshot(f.db)).toEqual(before);
  });

function incompleteFixture(mode: "backoff" | "exhausted" | "retried") {
  const f = admittedFixture();
  f.context.maxConsecutiveFailures = mode === "backoff" ? "unlimited" : 1;
  const claim = claimObservedAppTask(f.context, {
    taskId: "pending",
    appAgent: f.context.agent,
    handler: "agent",
  });
  if (claim.kind !== "claimed") throw new Error(claim.kind);
  expect(
    reportAppTaskFailure(f.context, claim, {
      summary: "  Provider did not supply the required evidence  ",
      response: "Unable to finish the request",
      result: { missing: "provider authority" },
      facts: ["provider:unavailable"],
    }).status,
  ).toBe("applied");
  if (mode === "retried") {
    const task = f.store.readTask("pending")!;
    retryFailedAppTask(f.context, {
      appId: f.plan.appId,
      taskId: "pending",
      expectedGeneration: task.metadata.generation,
      expectedResourceVersion: task.metadata.resourceVersion,
      controlKey: "operator-retry",
    });
  }
  return { ...reviewCaller(f), claim };
}

for (const mode of ["backoff", "exhausted", "retried"] as const)
  test(`canonical incomplete evidence remains withdrawable without fulfilling its caller (${mode})`, () => {
    const { db, context, store, plan, claim } = incompleteFixture(mode);
    const task = store.readTask("pending")!;
    const accepted = store.readAttempt(claim.attemptId)!;
    expect(task.status.summary).not.toBe(accepted.acceptedResult!.summary);
    expect(task.status.summary).toBe(accepted.summary);
    if (mode === "retried")
      expect(task.status.observedGeneration).toBeLessThan(
        accepted.taskGeneration,
      );
    const admissions = db
      .prepare("SELECT * FROM app_task_admissions ORDER BY app_id, task_id")
      .all();
    const attempts = db
      .prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id")
      .all();
    const before = snapshot(db);
    expect(retireAppState(context, plan, { dryRun: true }).status).toBe(
      "would-retire",
    );
    expect(snapshot(db)).toEqual(before);
    expect(retireAppState(context, plan).status).toBe("retired");
    expect(
      db
        .prepare("SELECT * FROM app_task_admissions ORDER BY app_id, task_id")
        .all(),
    ).toEqual(admissions);
    expect(
      db
        .prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id")
        .all(),
    ).toEqual(attempts);
    expect(getAppInboxItem(db, "parent")!.result).toBeUndefined();
    const after = snapshot(db);
    expect(retireAppState(context, plan).status).toBe("already-retired");
    expect(snapshot(db)).toEqual(after);
  });

for (const field of ["summary", "response", "result"] as const)
  test(`diagnostic summaries cannot hide unretained ${field}`, () => {
    const f = incompleteFixture("backoff");
    const task = f.store.readTask("pending")!;
    if (field === "result")
      task.status.result = { missing: "unrecorded additional evidence" };
    else
      task.status[field] =
        "Outcome not achieved: unrecorded text; continuing after backoff";
    f.db
      .prepare(
        "UPDATE app_tasks SET resource_json=? WHERE app_id=? AND task_id='pending'",
      )
      .run(JSON.stringify(task), f.plan.appId);
    refreshReviewedTasks(f);
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow(
      "retained accepted evidence",
    );
    expect(snapshot(f.db)).toEqual(before);
  });

for (const change of [
  "attempt-id",
  "future-generation",
  "foreign-task",
] as const)
  test(`retained outcome requires the exact attempt identity (${change})`, () => {
    const f = fixture();
    const task = f.store.readTask("waiting")!;
    const attempt = f.store.readAttempt(task.status.observedAttemptId!)!;
    if (change === "attempt-id") attempt.metadata.id = "another-attempt";
    if (change === "future-generation")
      attempt.taskGeneration = task.metadata.generation + 1;
    if (change === "foreign-task") attempt.taskId = "pending";
    f.db
      .prepare(
        "UPDATE app_task_attempts SET attempt_json=?, task_id=?, task_generation=? WHERE app_id=? AND attempt_id=?",
      )
      .run(
        JSON.stringify(attempt),
        attempt.taskId,
        attempt.taskGeneration,
        f.plan.appId,
        task.status.observedAttemptId!,
      );
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow(
      "retained accepted evidence",
    );
    expect(snapshot(f.db)).toEqual(before);
  });

for (const change of ["missing", "changed"] as const)
  test(`replay still verifies the original outcome survives (${change})`, () => {
    const f = fixture();
    const observed = f.store.readTask("waiting")!.status.observedAttemptId!;
    expect(retireAppState(f.context, f.plan).status).toBe("retired");
    if (change === "missing") {
      f.db
        .prepare(
          "DELETE FROM app_task_attempts WHERE app_id=? AND attempt_id=?",
        )
        .run(f.plan.appId, observed);
    } else {
      f.db
        .prepare(
          "UPDATE app_task_attempts SET attempt_json=json_set(attempt_json, '$.acceptedResult.summary', 'changed') WHERE app_id=? AND attempt_id=?",
        )
        .run(f.plan.appId, observed);
      // Neither summary source may retain the original value after corruption.
      f.db
        .prepare(
          "UPDATE app_task_attempts SET attempt_json=json_set(attempt_json, '$.summary', 'changed') WHERE app_id=? AND attempt_id=?",
        )
        .run(f.plan.appId, observed);
    }
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow(
      "retained accepted evidence",
    );
    expect(snapshot(f.db)).toEqual(before);
  });

for (const field of ["response", "facts", "result"] as const)
  test(`replay refuses changed terminal ${field}`, () => {
    const f = fixture();
    expect(retireAppState(f.context, f.plan).status).toBe("retired");
    f.db
      .prepare(
        "UPDATE app_tasks SET resource_json=json_set(resource_json, ?, json(?)) WHERE app_id=? AND task_id='waiting'",
      )
      .run(
        `$.status.${field}`,
        JSON.stringify(
          field === "facts" ? ["changed"] : field === "result" ? {} : "changed",
        ),
        f.plan.appId,
      );
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow(
      "different terminal decision",
    );
    expect(snapshot(f.db)).toEqual(before);
  });

for (const kind of ["closed", "cancelled"] as const)
  for (const storage of ["current", "reopened"] as const)
    test(`terminal authority distinguishes an answer from withdrawal (${kind}, ${storage})`, () => {
      const f = fixture();
      const key = "task:parent";
      admitTaskInput(f.context, {
        appId: f.plan.appId,
        attachment: { kind: "existing", taskId: "pending" },
        idempotencyKey: key,
        inputContext: {
          id: "parent",
          source: { kind: "system", id: "review" },
          input: { kind: "message", data: { message: "Review" } },
        },
      });
      let answerId: string | undefined;
      if (kind === "closed") {
        const claim = claimObservedAppTask(f.context, {
          taskId: "pending",
          appAgent: f.context.agent,
          handler: "agent",
        });
        if (claim.kind !== "claimed") throw new Error(claim.kind);
        completeAppTask(f.context, claim, {
          summary: "Accepted answer",
          response: "Original response",
        });
        answerId = claim.attemptId;
      }
      const task = f.store.readTask("pending")!;
      const control = {
        appId: f.plan.appId,
        taskId: "pending",
        expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion,
        reason: "Prior owner decision",
      };
      if (kind === "closed")
        closeAppTask(f.context, { ...control, afterResult: answerId! });
      else cancelAppTask(f.context, control);
      if (storage === "reopened") {
        const closure = f.store.readCancellation("pending")!;
        reopenAppTask(f.context, {
          appId: f.plan.appId,
          taskId: "pending",
          expectedGeneration: closure.generation,
          expectedResourceVersion: closure.resourceVersion,
          reason: "Continue with a new requirement",
          controlKey: "prior-reopen",
        });
        const reopened = f.store.readTask("pending")!;
        cancelAppTask(f.context, {
          appId: f.plan.appId,
          taskId: "pending",
          expectedGeneration: reopened.metadata.generation,
          expectedResourceVersion: reopened.metadata.resourceVersion,
          reason: "Later requirement withdrawn",
        });
      }
      // Only the terminal authority remains in this historical storage shape.
      f.db
        .prepare("DELETE FROM app_tasks WHERE app_id=? AND task_id='pending'")
        .run(f.plan.appId);
      f.db
        .prepare(
          "DELETE FROM app_task_attempts WHERE app_id=? AND task_id='pending'",
        )
        .run(f.plan.appId);
      f.db
        .prepare(
          "UPDATE app_task_admissions SET admission_json=json_remove(admission_json, '$.resultAttemptId') WHERE app_id=? AND task_id=?",
        )
        .run(f.plan.appId, key);
      f.plan.tasks = f.plan.tasks.filter((entry) => entry.taskId !== "pending");
      const { db, context, store, plan } = reviewCaller(f, [key]);
      const terminal = store.readCancellation("pending")!;
      const before = snapshot(db);
      if (kind === "closed") {
        expect(() => retireAppState(context, plan)).toThrow(
          "must be settled before withdrawal",
        );
        expect(snapshot(db)).toEqual(before);
      } else {
        expect(retireAppState(context, plan).status).toBe("retired");
        expect(getAppInboxItem(db, "parent")!.result).toBeUndefined();
        expect(store.readCancellation("pending")).toEqual(terminal);
        expect(retireAppState(context, plan).status).toBe("already-retired");
      }
    });

for (const change of [
  "omitted",
  "extra",
  "duplicate",
  "changed",
  "accepted",
  "foreign",
  "unknown-task",
  "future-generation",
  "wrong-request",
  "wrong-decision",
] as const)
  test(`refuses ${change} admission withdrawal evidence without any writes`, () => {
    const { db, context, plan, input } = admittedFixture();
    const withdrawal = input.admissionWithdrawal!;
    if (change === "omitted") withdrawal.rows.pop();
    if (change === "extra")
      db.prepare("INSERT INTO app_task_admissions(app_id, task_id, admission_json) VALUES (?, ?, ?)").run(
        plan.appId,
        "task:parent:existing:new-alias",
        withdrawal.rows[0]!.admission_json,
      );
    if (change === "duplicate") withdrawal.rows.push(withdrawal.rows[0]!);
    if (change === "changed") withdrawal.rows[0]!.admission_json += " ";
    if (change === "wrong-decision") Object.assign(withdrawal, { decision: "mark-fulfilled" });
    if (["accepted", "foreign", "unknown-task", "future-generation", "wrong-request"].includes(change)) {
      const row = withdrawal.rows[0]!;
      const admission = JSON.parse(row.admission_json);
      if (change === "accepted") admission.resultAttemptId = "retained-answer";
      if (change === "foreign") row.app_id = "other-app";
      if (change === "unknown-task") admission.taskId = "missing-task";
      if (change === "future-generation") admission.taskGeneration = 1000;
      if (change === "wrong-request") admission.inputEvent.data.request.id = "another-input";
      row.admission_json = JSON.stringify(admission);
      db.prepare("UPDATE app_task_admissions SET app_id=?, admission_json=? WHERE app_id=? AND task_id=?").run(
        row.app_id,
        row.admission_json,
        plan.appId,
        row.task_id,
      );
    }
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow();
    expect(snapshot(db)).toEqual(before);
  });

test("withdrawal evidence cannot be removed or silently acquire an answer on replay", () => {
  const { db, context, plan, input } = admittedFixture();
  retireAppState(context, plan);
  const changedPlan = structuredClone(plan);
  delete changedPlan.inputs.find((input) => input.row.id === "parent")!.admissionWithdrawal;
  const before = snapshot(db);
  expect(() => retireAppState(context, changedPlan)).toThrow();
  expect(snapshot(db)).toEqual(before);
  const row = input.admissionWithdrawal!.rows[0]!;
  db.prepare(
    "UPDATE app_task_admissions SET admission_json=json_set(admission_json, '$.resultAttemptId', 'late-answer') WHERE app_id=? AND task_id=?",
  ).run(plan.appId, row.task_id);
  const afterAnswer = snapshot(db);
  expect(() => retireAppState(context, plan)).toThrow();
  expect(snapshot(db)).toEqual(afterAnswer);
});

test("CLI withdraws an explicitly reviewed admitted caller and replays after reopening", async () => {
  const { root, db, plan } = admittedFixture();
  const before = snapshot(db);
  const dryRun = await runCli(root, plan, true);
  expect({ code: dryRun.code, stderr: dryRun.stderr }).toEqual({ code: 0, stderr: "" });
  expect(JSON.parse(dryRun.stdout).status).toBe("would-retire");
  expect(snapshot(db)).toEqual(before);
  for (const status of ["retired", "already-retired"]) {
    const result = await runCli(root, plan);
    expect({ code: result.code, stderr: result.stderr }).toEqual({ code: 0, stderr: "" });
    expect(JSON.parse(result.stdout).status).toBe(status);
  }
});

for (const receiptGeneration of [1, 2, 3])
  test(`preserves generation ${receiptGeneration} completion history while retiring generation 2`, () => {
    const { db, context, store, plan } = fixture();
    observeAppTaskIntent(context, {
      appAgent: context.agent,
      intent: { id: "pending", parentId: "root", outcome: "Revised controller", acceptance: ["Review new work"] },
    });
    const resource = store.readTask("pending")!;
    expect(resource.metadata.generation).toBe(2);
    // Historical completion receipts can coexist with a retained resource.
    // Only a resource revised beyond that receipt is still live work.
    expect(
      store.commit({
        fences: [{ taskId: "pending", resourceVersion: resource.metadata.resourceVersion }],
        receipts: [
          {
            metadata: { id: "pending", generation: receiptGeneration, resourceVersion: 1 },
            specHash: "historical-spec",
            parentId: "root",
            outcome: "Historical completed outcome",
            acceptance: ["Historical acceptance"],
            owner: context.agent,
            handler: "agent",
            summary: "Completed with retained evidence",
            result: { evidence: "historical-result" },
            facts: ["historical-fact"],
            acceptanceBasis: { method: "workflow-contract", facts: ["historical-fact"] },
            failureFingerprints: [],
            completedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toBe(true);
    const retainedTask = db.prepare("SELECT * FROM app_tasks WHERE app_id=? AND task_id='pending'").get(plan.appId)!;
    const retainedReceipt = db.prepare("SELECT * FROM app_task_receipts WHERE app_id=?").all(plan.appId);
    const pending = plan.tasks.find((task) => task.taskId === "pending")!;
    pending.resourceJson = String(retainedTask.resource_json);
    pending.triggerJson = retainedTask.trigger_json as string | null;
    const livePlan = structuredClone(plan);
    livePlan.tasks = livePlan.tasks.filter((task) => task.taskId !== "pending");
    const ended = receiptGeneration >= resource.metadata.generation;
    const before = snapshot(db);
    expect(() => retireAppState(context, ended ? plan : livePlan)).toThrow("census");
    expect(snapshot(db)).toEqual(before);
    const applicablePlan = ended ? livePlan : plan;
    expect(retireAppState(context, applicablePlan)).toMatchObject({ status: "retired", tasks: ended ? 1 : 2 });
    expect(db.prepare("SELECT * FROM app_task_receipts WHERE app_id=?").all(plan.appId)).toEqual(retainedReceipt);
    expect(readRuntimeTaskView({ taskStateConfig: context }, "pending")?.status).toBe(ended ? "done" : "cancelled");
    if (ended) {
      expect(store.readCancellation("pending")).toBeNull();
      expect(db.prepare("SELECT * FROM app_tasks WHERE app_id=? AND task_id='pending'").get(plan.appId)).toEqual(
        retainedTask,
      );
    } else {
      expect(store.readCancellation("pending")?.generation).toBe(2);
    }
    const beforeReplay = snapshot(db);
    expect(retireAppState(context, applicablePlan).status).toBe("already-retired");
    expect(snapshot(db)).toEqual(beforeReplay);
  });

test("retires two Apps with matching plan and Task ids in one database and replays each independently", () => {
  const { db, context, other, plan } = fixture();
  const row = db
    .prepare("SELECT resource_json, trigger_json FROM app_tasks WHERE app_id=? AND task_id='waiting'")
    .get(other.resourceStore.appId)!;
  const otherPlan: RetiredAppRetirementPlan = {
    ...plan,
    appId: other.resourceStore.appId,
    tasks: [
      {
        taskId: "waiting",
        resourceJson: String(row.resource_json),
        triggerJson: row.trigger_json as string | null,
        reason: "Reviewed outcome withdrawn unfulfilled",
      },
    ],
    inputs: [],
  };
  expect(retireAppState(context, plan).status).toBe("retired");
  const beforeDryRun = snapshot(db);
  expect(retireAppState(other, otherPlan, { dryRun: true }).status).toBe("would-retire");
  expect(snapshot(db)).toEqual(beforeDryRun);
  expect(retireAppState(other, otherPlan)).toEqual({ status: "retired", tasks: 1, inputs: 0 });
  expect(other.resourceStore.readCancellation("waiting")?.kind).toBe("cancelled");
  const beforeReplay = snapshot(db);
  expect(retireAppState(context, plan).status).toBe("already-retired");
  expect(retireAppState(other, otherPlan).status).toBe("already-retired");
  expect(snapshot(db)).toEqual(beforeReplay);
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
  db.close();
  connections.splice(connections.indexOf(db), 1);
  const run = async (dryRun = false) => {
    const { stdout, stderr, code } = await runCli(root, plan, dryRun);
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

for (const key of [
  "task:parent",
  "task:parent:desired:pending",
  "task:parent:existing:pending",
  "conversation-input:parent",
  "conversation-follow-up:retired-example:parent",
  "opaque-historical-key",
])
  test(`preserves an accepted admission without inbox links: ${key}`, () => {
    const { db, context, store, plan } = fixture();
    const item = getAppInboxItem(db, "parent")!;
    // Model the released Host's crash boundary: the Task admission and answer
    // committed, but no inbox attachment or result was projected.
    admitTaskInput(context, {
      appId: plan.appId,
      attachment: { kind: "existing", taskId: "pending" },
      idempotencyKey: "task:parent",
      inputContext: { id: item.id, source: item.source, input: item.input },
    });
    const claim = claimObservedAppTask(context, { taskId: "pending", appAgent: context.agent, handler: "agent" });
    if (claim.kind !== "claimed") throw new Error(claim.kind);
    expect(completeAppTask(context, claim, { summary: "Accepted answer before inbox linkage" }).status).toBe("applied");
    const admission = store.readTaskContext({ taskIds: [], admissionIds: ["task:parent"] }).appTaskAdmissions![
      "task:parent"
    ]!;
    expect(admission.resultAttemptId).toBe(claim.attemptId);
    expect(getAppInboxItem(db, "parent")).toMatchObject({ status: "pending" });
    // Old canonical/alias keys can survive without an input-event envelope.
    // An opaque key must instead be recognized by its retained request identity.
    if (key !== "opaque-historical-key") delete admission.inputEvent;
    db.prepare(
      "UPDATE app_task_admissions SET task_id=?, admission_json=? WHERE app_id=? AND task_id='task:parent'",
    ).run(key, JSON.stringify(admission), plan.appId);
    const task = db
      .prepare("SELECT resource_json, trigger_json FROM app_tasks WHERE app_id=? AND task_id='pending'")
      .get(plan.appId)!;
    Object.assign(
      plan.tasks.find((task) => task.taskId === "pending")!,
      {
        resourceJson: task.resource_json,
        triggerJson: task.trigger_json,
      },
    );
    const before = snapshot(db);
    expect(() => retireAppState(context, plan)).toThrow("durable admission");
    expect(snapshot(db)).toEqual(before);
  });

test("refuses an unanswered durable admission before inbox linkage", () => {
  const { db, context, plan } = fixture();
  const item = getAppInboxItem(db, "parent")!;
  admitTaskInput(context, {
    appId: plan.appId,
    attachment: { kind: "existing", taskId: "pending" },
    idempotencyKey: "task:parent",
    inputContext: { id: item.id, source: item.source, input: item.input },
  });
  const task = db
    .prepare("SELECT resource_json, trigger_json FROM app_tasks WHERE app_id=? AND task_id='pending'")
    .get(plan.appId)!;
  Object.assign(
    plan.tasks.find((task) => task.taskId === "pending")!,
    {
      resourceJson: task.resource_json,
      triggerJson: task.trigger_json,
    },
  );
  const before = snapshot(db);
  expect(() => retireAppState(context, plan)).toThrow("durable admission");
  expect(snapshot(db)).toEqual(before);
});

test("replays unchanged withdrawal reasons ending in spaces and a newline", () => {
  const { db, context, plan } = fixture();
  for (const task of plan.tasks) task.reason += " \t\n";
  for (const input of plan.inputs) input.reason += " \t\n";
  expect(retireAppState(context, plan).status).toBe("retired");
  const before = snapshot(db);
  expect(retireAppState(context, plan).status).toBe("already-retired");
  expect(snapshot(db)).toEqual(before);
});

test("CLI retires only legacy inputs without creating or activating Task resource authority", async () => {
  const { root, db } = databaseFixture();
  createAppInboxItem(db, {
    id: "legacy-input",
    appId: "never-activated",
    source: { kind: "system", id: "retired-controller" },
    input: { kind: "message", data: { message: "Historical input" } },
    now: 1,
  });
  const plan: RetiredAppRetirementPlan = {
    id: "input-only-v1",
    appId: "never-activated",
    quiesced: true,
    appRetired: true,
    tasks: [],
    inputs: [
      {
        row: db.prepare("SELECT * FROM app_inbox_items WHERE id='legacy-input'").get()!,
        reason: "Controller responsibility explicitly withdrawn",
      },
    ],
  };
  expect(AppTaskResourceStore.activeFromDb(db, plan.appId)).toBeNull();
  const before = snapshot(db);
  const dryRun = await runCli(root, plan, true);
  expect({ code: dryRun.code, stderr: dryRun.stderr }).toEqual({ code: 0, stderr: "" });
  expect(JSON.parse(dryRun.stdout)).toEqual({ status: "would-retire", tasks: 0, inputs: 1 });
  expect(snapshot(db)).toEqual(before);
  for (const status of ["retired", "already-retired"]) {
    const result = await runCli(root, plan);
    expect({ code: result.code, stderr: result.stderr }).toEqual({ code: 0, stderr: "" });
    expect(JSON.parse(result.stdout)).toEqual({ status, tasks: 0, inputs: 1 });
    expect(db.prepare("SELECT * FROM app_task_store_meta WHERE app_id=?").all(plan.appId)).toEqual([]);
    expect(db.prepare("SELECT * FROM app_tasks WHERE app_id=?").all(plan.appId)).toEqual([]);
  }
  expect(getAppInboxItem(db, "legacy-input")).toMatchObject({ status: "done", handling: { phase: "stopped" } });
  expect(getAppInboxItem(db, "legacy-input")!.result).toBeUndefined();
});

for (const includeTasks of [true, false])
  test(`CLI preserves inactive Task state when plan includes Tasks: ${includeTasks}`, async () => {
    const { root, db, plan } = fixture();
    db.prepare("DELETE FROM app_task_store_meta WHERE app_id=?").run(plan.appId);
    if (!includeTasks) plan.tasks = [];
    const before = snapshot(db);
    const result = await runCli(root, plan);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain(includeTasks ? "no Task resource state" : "Task census changed");
    expect(snapshot(db)).toEqual(before);
  });

function legacyObservationFixture(
  phase: "pending" | "waiting" | "attention" | "converged" = "waiting",
  reference: "absent" | "dangling" | "unaccepted" = "absent",
) {
  const f = fixture();
  const task = f.store.readTask("waiting")!;
  if (reference === "unaccepted")
    f.db
      .prepare(
        "UPDATE app_task_attempts SET attempt_json=json_remove(attempt_json, '$.acceptedResult') WHERE app_id=? AND attempt_id=?",
      )
      .run(f.plan.appId, task.status.observedAttemptId!);
  else if (reference === "absent") delete task.status.observedAttemptId;
  else task.status.observedAttemptId = "missing-original-attempt";
  task.status.phase = phase;
  task.status.summary = "Original observation; fulfillment is unknown";
  task.status.response = "Original response";
  task.status.result = { nested: { retained: [false, 0, "", null] } };
  const raw = ` \n${JSON.stringify({ ...task, spec: { ...task.spec, mode: "maintain" }, legacyExtra: { retained: true } })}\n`;
  const trigger = f.plan.tasks.find((entry) => entry.taskId === "pending")!.triggerJson!;
  f.db
    .prepare("UPDATE app_tasks SET resource_json=?, trigger_json=? WHERE app_id=? AND task_id='waiting'")
    .run(raw, trigger, f.plan.appId);
  refreshReviewedTasks(f);
  const planned = f.plan.tasks.find((entry) => entry.taskId === "waiting")!;
  planned.legacyObservation = {
    decision: "preserve-unverified",
    reason: "Original acceptance identity cannot be established; retain observations without assigning fulfillment",
  };
  return { ...f, planned };
}

for (const phase of ["pending", "waiting", "attention", "converged"] as const)
  for (const reference of ["absent", "dangling", "unaccepted"] as const)
    test(`explicit legacy preservation retains raw observations without manufacturing acceptance (${phase}, ${reference})`, () => {
      const f = legacyObservationFixture(phase, reference);
      const attempts = f.db.prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id").all();
      const other = f.other.resourceStore.readSnapshot();
      const before = snapshot(f.db);
      expect(retireAppState(f.context, f.plan, { dryRun: true }).status).toBe("would-retire");
      expect(snapshot(f.db)).toEqual(before);
      expect(retireAppState(f.context, f.plan).status).toBe("retired");
      expect(f.db.prepare("SELECT * FROM app_task_attempts ORDER BY app_id, attempt_id").all()).toEqual(attempts);
      expect(f.other.resourceStore.readSnapshot()).toEqual(other);
      const controls = f.db
        .prepare("SELECT receipt_json FROM app_task_control_receipts WHERE app_id=? AND task_id='waiting'")
        .all(f.plan.appId);
      expect(controls).toHaveLength(1);
      const saved = JSON.parse(String(controls[0]!.receipt_json)).retainedObservation;
      expect(saved).toEqual({
        kind: "unverified-legacy-observation",
        resourceJson: f.planned.resourceJson,
        triggerJson: f.planned.triggerJson,
        reason: f.planned.legacyObservation!.reason,
      });
      expect(f.store.readCancellation("waiting")!.kind).toBe("cancelled");
      expect(f.store.readCancellation("waiting")!.result).toBeUndefined();
      expect(getAppInboxItem(f.db, "parent")!.result).toBeUndefined();
      const after = snapshot(f.db);
      expect(retireAppState(f.context, f.plan).status).toBe("already-retired");
      expect(snapshot(f.db)).toEqual(after);
    });

for (const change of ["missing", "resource", "trigger", "kind", "reason"] as const)
  test(`legacy replay requires the exact durable observation (${change})`, () => {
    const f = legacyObservationFixture();
    retireAppState(f.context, f.plan);
    if (change === "missing")
      f.db
        .prepare(
          "UPDATE app_task_control_receipts SET receipt_json=json_remove(receipt_json, '$.retainedObservation') WHERE app_id=? AND task_id='waiting'",
        )
        .run(f.plan.appId);
    else {
      const field = { resource: "resourceJson", trigger: "triggerJson", kind: "kind", reason: "reason" }[change];
      f.db
        .prepare(
          "UPDATE app_task_control_receipts SET receipt_json=json_set(receipt_json, ?, 'changed') WHERE app_id=? AND task_id='waiting'",
        )
        .run(`$.retainedObservation.${field}`, f.plan.appId);
    }
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow("different terminal decision");
    expect(snapshot(f.db)).toEqual(before);
  });

for (const failure of ["abort", "corrupt"] as const)
  test(`failure to retain an exact observation rolls back cancellations and callers (${failure})`, () => {
    const f = legacyObservationFixture();
    if (failure === "abort")
      f.db.exec(`CREATE TRIGGER reject_retirement_observation BEFORE UPDATE ON app_task_control_receipts
      BEGIN SELECT RAISE(ABORT, 'fixture observation write rejected'); END`);
    else
      f.db.exec(`CREATE TRIGGER corrupt_retirement_observation AFTER UPDATE ON app_task_control_receipts
      BEGIN UPDATE app_task_control_receipts SET receipt_json=json_remove(NEW.receipt_json, '$.retainedObservation')
        WHERE app_id=NEW.app_id AND control_key=NEW.control_key; END`);
    const before = snapshot(f.db);
    expect(() => retireAppState(f.context, f.plan)).toThrow(
      failure === "abort" ? "fixture observation write rejected" : "not retained",
    );
    expect(snapshot(f.db)).toEqual(before);
  });

test("legacy preservation requires an explicit reviewed decision and never changes default refusal", () => {
  const f = legacyObservationFixture();
  delete f.planned.legacyObservation;
  const before = snapshot(f.db);
  expect(() => retireAppState(f.context, f.plan)).toThrow("retained accepted evidence");
  const malformed = JSON.parse(JSON.stringify(f.plan));
  malformed.tasks.find((entry: { taskId: string }) => entry.taskId === "waiting").legacyObservation = {
    decision: "accept",
    reason: "Unknown origin",
  };
  expect(() => retireAppState(f.context, malformed)).toThrow("explicit preservation decision");
  malformed.tasks.find((entry: { taskId: string }) => entry.taskId === "waiting").legacyObservation = {
    decision: "preserve-unverified",
    reason: " ",
  };
  expect(() => retireAppState(f.context, malformed)).toThrow("preservation reason must be non-empty");
  expect(snapshot(f.db)).toEqual(before);
});

test("legacy observation does not substitute for settlement of a Task-only caller answer", () => {
  const f = admittedFixture();
  const task = f.store.readTask("pending")!;
  task.status.phase = "converged";
  task.status.observedGeneration = task.metadata.generation;
  task.status.summary = "The original answer exists on this Task alone";
  f.db
    .prepare("UPDATE app_tasks SET resource_json=? WHERE app_id=? AND task_id='pending'")
    .run(JSON.stringify(task), f.plan.appId);
  refreshReviewedTasks(f);
  for (const entry of f.plan.tasks)
    entry.legacyObservation = { decision: "preserve-unverified", reason: "Preserve exact original state" };
  const before = snapshot(f.db);
  expect(() => retireAppState(f.context, f.plan)).toThrow("must be settled before withdrawal");
  expect(snapshot(f.db)).toEqual(before);
});

test("CLI retains legacy bytes through database reopen and rejects changed archival evidence", async () => {
  const f = legacyObservationFixture("attention", "unaccepted");
  const before = snapshot(f.db);
  expect((await runCli(f.root, f.plan, true)).code).toBe(0);
  expect(snapshot(f.db)).toEqual(before);
  for (const status of ["retired", "already-retired"]) {
    const result = await runCli(f.root, f.plan);
    expect({ code: result.code, stderr: result.stderr }).toEqual({ code: 0, stderr: "" });
    expect(JSON.parse(result.stdout).status).toBe(status);
  }
  f.db
    .prepare(
      "UPDATE app_task_control_receipts SET receipt_json=json_remove(receipt_json, '$.retainedObservation') WHERE app_id=? AND task_id='waiting'",
    )
    .run(f.plan.appId);
  const after = snapshot(f.db);
  const replay = await runCli(f.root, f.plan);
  expect(replay.code).not.toBe(0);
  expect(replay.stderr).toContain("different terminal decision");
  expect(snapshot(f.db)).toEqual(after);
});
