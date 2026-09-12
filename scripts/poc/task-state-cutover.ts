/**
 * Write a temporary database with an old Host, close it, then import its real
 * completed and open Task state with this candidate. No installation state or model calls.
 *
 * bun scripts/poc/task-state-cutover.ts --legacy-source /path/to/old-host
 * Validated with old Host a8f6518855aa5f85a697468665269124dda30479.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase, type SqliteDb } from "../../src/lib/db.js";
import { applyDbSchema } from "../../src/lib/db/schema.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { migrateTaskCompletionReceipts } from "../../src/app/core/state/task-receipt-cutover.js";
import { migrateOpenTaskState } from "../../src/app/core/state/task-state-cutover.js";
import { readAppTaskReconciliationEvents } from "../../src/app/core/tasks/app-task-context.js";
import { trackAppTaskConditionEventForTasks } from "../../src/app/core/tasks/app-task-condition-tracker.js";
import { buildAppTaskTreeProjection } from "../../src/app/core/tasks/app-task-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  closeAppTask,
  readAppTaskAdmissionOutcome,
} from "../../src/app/core/tasks/app-task-reconciler.js";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--legacy-source")
  throw new Error("Usage: task-state-cutover.ts --legacy-source /path/to/old-host");
const source = resolve(args[1]!);
const legacySupport = (await import(
  pathToFileURL(join(source, "src/app/core/tasks/app-task-test-support.ts")).href
)) as typeof import("../../src/app/core/tasks/app-task-test-support.js");
const legacyRuntime = (await import(
  pathToFileURL(join(source, "src/app/core/tasks/app-task-reconciler.ts")).href
)) as typeof import("../../src/app/core/tasks/app-task-reconciler.js");
const legacyInput = (await import(
  pathToFileURL(join(source, "src/app/core/state/inbox.ts")).href
)) as typeof import("../../src/app/core/state/inbox.js");
const root = mkdtempSync(join(tmpdir(), "may-real-task-cutover-"));
let oldStore: AppTaskResourceStore | undefined;
let store: AppTaskResourceStore | undefined;
let database: SqliteDb | undefined;
try {
  const path = join(root, "state.sqlite");
  const old = legacySupport.appTaskTestContext({
    appDir: root,
    databasePath: path,
    agent: "worker",
    maxConcurrent: 2,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "worker" } } },
  });
  oldStore = old.resourceStore;
  legacyInput.admitTaskRequest(old, {
    appId: "sample",
    idempotencyKey: "original-measurement",
    attachment: {
      kind: "intent",
      intent: {
        id: "measurement",
        parentId: "root",
        mode: "achieve",
        outcome: "Measure the sample",
        acceptance: ["Instrument evidence is retained"],
      },
    },
    request: {
      id: "original-measurement",
      appId: "sample",
      source: { kind: "human", id: "fixture" },
      input: { kind: "measure", data: { sample: "first" } },
    },
  });
  const claim = legacyRuntime.claimObservedAppTask(old, {
    taskId: "measurement",
    appAgent: "worker",
    handler: "agent",
  });
  assert.equal(claim.kind, "claimed");
  if (claim.kind !== "claimed") throw new Error("Old runtime did not claim the work");
  assert.equal(
    legacyRuntime.completeAppTask(old, claim, {
      summary: "Measured the sample",
      response: "The measurement is 17.",
      result: { value: 17 },
      evidence: ["fixture:instrument:17"],
      acceptanceBasis: { method: "deterministic", evidence: ["fixture:instrument:17"] },
    }).status,
    "applied",
  );
  const receipt = oldStore.readReceipt("measurement");
  assert.ok(receipt, "Source must use historical completion receipts");
  assert.equal(oldStore.readTask("measurement"), null);
  const priorAttempt = oldStore.readAttempt(claim.attemptId);
  const oldClaim = (id: string, mode: "achieve" | "maintain" = "achieve") => {
    legacyInput.admitTaskRequest(old, {
      appId: "sample",
      idempotencyKey: id,
      attachment: {
        kind: "intent",
        intent: { id, parentId: "root", mode, outcome: "Measure the sample", acceptance: ["Retain measured evidence"] },
      },
      request: { id, appId: "sample", source: { kind: "app", id: "caller" }, input: { kind: "measure", data: { id } } },
    });
    const attempt = legacyRuntime.claimObservedAppTask(old, { taskId: id, appAgent: "worker", handler: "agent" });
    if (attempt.kind !== "claimed") throw new Error(`Old ${id} claim failed: ${JSON.stringify(attempt)}`);
    return attempt;
  };
  const maintained = oldClaim("maintained", "maintain");
  legacyRuntime.completeAppTask(old, maintained, {
    summary: "Measured maintained cycle",
    result: { value: 23 },
    evidence: ["instrument:23"],
  });
  legacyRuntime.deferAppTask(old, oldClaim("waiting", "maintain"), {
    disposition: "waiting",
    summary: "Await measurement",
    evidence: ["instrument:requested"],
    conditions: [
      {
        id: "measurement",
        type: "project.task.reconciled",
        subject: "task:measurement",
        expected: "done",
        owner: "app:sampler",
        reviewAfterMs: 60_000,
      },
    ],
  });
  legacyRuntime.markAppTaskAttention(old, oldClaim("failed"), {
    reason: "provider-unavailable",
    summary: "Original provider unavailable",
  });
  const stopped = oldClaim("stopped");
  legacyRuntime.stopAppTask(old, stopped, { summary: "Instrument unavailable", evidence: ["instrument:offline"] });
  const selfStop = oldStore.readCancellation("stopped");
  const human = oldClaim("cancelled");
  legacyRuntime.cancelAppTask(old, {
    appId: "sample",
    taskId: "cancelled",
    expectedGeneration: human.generation,
    expectedResourceVersion: oldStore.readTask("cancelled")!.metadata.resourceVersion,
    reason: "No longer needed",
  });
  const humanClosure = oldStore.readCancellation("cancelled");
  const structural = oldClaim("structural", "maintain");
  legacyRuntime.observeAppTaskIntent(old, { appAgent: "worker", intent: {
    id: "structural-child", parentId: "structural", mode: "achieve", outcome: "Measure independently", acceptance: ["Return evidence"],
  } });
  legacyRuntime.deferAppTask(old, structural, { disposition: "waiting", summary: "Await implicit child", evidence: ["child:assigned"] });
  const inflight = oldClaim("inflight");
  const supervisor = oldClaim("conversation/follow-up", "maintain");
  oldStore.close();
  oldStore = undefined;

  // Run the Host's schema upgrade first. The standalone test-store constructor
  // does not migrate old inbox columns before creating the new Task indexes.
  database = openDatabase(path);
  applyDbSchema(database);
  store = AppTaskResourceStore.fromDb(database, "sample");
  const current = appTaskContext({
    appDir: root,
    projectDir: root,
    resourceStore: store,
    agent: "worker",
    maxConcurrent: 1,
  });
  assert.deepEqual(migrateTaskCompletionReceipts(current, { oldRuntimeStopped: true }), {
    imported: 1,
    closed: 1,
    linkedInputs: 1,
  });
  const answer = readAppTaskAdmissionOutcome(current, "measurement", "original-measurement");
  assert.deepEqual(answer?.result, { value: 17 });
  assert.equal(answer?.response, "The measurement is 17.");
  assert.equal(store.readCancellation("measurement")?.acceptedResultAttemptId, answer?.attemptId);
  assert.deepEqual(store.readReceipt("measurement"), receipt);
  assert.deepEqual(store.readAttempt(claim.attemptId), priorAttempt);
  assert.equal(buildAppTaskTreeProjection(store.readSnapshot(), 1).tasks.measurement?.attempt_count, 1);
  assert.equal(
    claimObservedAppTask(current, { taskId: "measurement", appAgent: "worker", handler: "agent" }).kind,
    "completed",
  );
  assert.deepEqual(migrateTaskCompletionReceipts(current, { oldRuntimeStopped: true }), {
    imported: 0,
    closed: 0,
    linkedInputs: 0,
  });
  assert.deepEqual(migrateOpenTaskState(current, { oldRuntimeStopped: true }), {
    tasks: 7,
    outcomes: 3,
    continued: 4,
    workerStops: 1,
    inputs: 7,
    coordination: { tasks: 2, replayedInputs: 1, reviews: 1 },
  });
  assert.deepEqual(readAppTaskAdmissionOutcome(current, "maintained", "maintained")?.result, { value: 23 });
  assert.equal(store.readTask("maintained")?.status.observedAttemptId, maintained.attemptId);
  assert.equal(store.isCancelled("maintained"), false);
  assert.deepEqual(store.readAttempt(stopped.attemptId)?.retiredCancellation, selfStop);
  assert.deepEqual(store.readCancellation("cancelled"), humanClosure);
  assert.equal(completeAppTask(current, inflight, { summary: "Obsolete result" }).status, "stale");
  // The assigning owner retires the former supervision role using normal closure.
  // Nothing closes the other maintained or unfinished Tasks as a side effect.
  const retired = store.readTask(supervisor.taskId)!;
  closeAppTask(current, {
    appId: "sample",
    taskId: supervisor.taskId,
    expectedGeneration: retired.metadata.generation,
    expectedResourceVersion: retired.metadata.resourceVersion,
    reason: "Owner moved follow-through into Conversation",
  });
  assert.equal(store.readCancellation(supervisor.taskId)?.kind, "closed");
  assert.equal(completeAppTask(current, supervisor, { summary: "Obsolete supervisor output" }).status, "stale");
  assert.equal(
    claimObservedAppTask(current, { taskId: supervisor.taskId, appAgent: "worker", handler: "agent" }).kind,
    "completed",
  );
  assert.equal(store.isCancelled("maintained"), false);
  assert.deepEqual(migrateOpenTaskState(current, { oldRuntimeStopped: true }), {
    tasks: 0,
    outcomes: 0,
    continued: 0,
    workerStops: 0,
    inputs: 0,
    coordination: { tasks: 0, replayedInputs: 0, reviews: 0 },
  });
  assert.equal(
    trackAppTaskConditionEventForTasks(
      current,
      { type: "project.task.reconciled", taskId: "measurement", state: "converged", eventId: 90 },
      ["waiting"],
    ).length,
    1,
  );
  const waiting = claimObservedAppTask(current, { taskId: "waiting", appAgent: "worker", handler: "agent" });
  if (waiting.kind !== "claimed") throw new Error("Migrated wait did not return");
  assert.equal(
    (readAppTaskReconciliationEvents(store, waiting).continuedInputs?.[0]?.event.data.request as { id: string }).id,
    "waiting",
  );
  completeAppTask(current, waiting, { summary: "Returned original measurement", result: { value: 17 } });
  assert.deepEqual(readAppTaskAdmissionOutcome(current, "waiting", "waiting")?.result, { value: 17 });
  for (const id of ["failed", "stopped", "inflight"]) {
    const retryAt = store.readTask(id)!.status.executionRetryAt!;
    await new Promise((done) => setTimeout(done, Math.max(0, retryAt - Date.now() + 1)));
    const resumed = claimObservedAppTask(current, { taskId: id, appAgent: "worker", handler: "agent" });
    if (resumed.kind !== "claimed") throw new Error(`Migrated ${id} did not continue: ${JSON.stringify(resumed)}`);
    assert.equal((resumed.events[0]?.event.data as { request: { id: string } }).request.id, id);
    if (id === "stopped") assert.equal(resumed.previousAttempt?.acceptedResult?.state, "stopped");
    completeAppTask(current, resumed, { summary: "Instrument restored", result: { value: 17 } });
    assert.deepEqual(readAppTaskAdmissionOutcome(current, id, id)?.result, { value: 17 });
    assert.equal(store.isCancelled(id), false);
  }
  assert.equal(readAppTaskAdmissionOutcome(current, "structural", "structural"), null);
  const review = claimObservedAppTask(current, { taskId: "structural", appAgent: "worker", handler: "agent" });
  assert.equal(review.kind, "claimed");
  if (review.kind !== "claimed") throw new Error("Retired wait must return for review");
  assert(review.events.some(({ event }) => event.type === "app.task.coordination-retired"));
  assert(JSON.stringify(review.events).includes('"id":"structural"'));
  assert.equal(store.readTask("structural-child")?.status.phase, "pending");
  completeAppTask(current, review, { summary: "Owner reviewed the original ask", result: { reviewed: true } });
  assert.deepEqual(readAppTaskAdmissionOutcome(current, "structural", "structural")?.result, { reviewed: true });
  console.log(
    JSON.stringify({
      status: "passed",
      importedReceipts: 1,
      closedTasks: 1,
      linkedInputs: 1,
      originalAttemptPreserved: true,
      receiptExecutions: 0,
      maintainedOutcomes: 1,
      continuedTasks: 4,
      humanClosurePreserved: true,
      retiredSupervisor: true,
      structuralWaitReviewed: true,
    }),
  );
} finally {
  oldStore?.close();
  store?.close();
  database?.close();
  rmSync(root, { recursive: true, force: true });
}
