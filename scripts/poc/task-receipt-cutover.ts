/**
 * Write a temporary database with an old Host, close it, then import its real
 * completion receipt with this candidate. No installation state or model calls.
 *
 * bun scripts/poc/task-receipt-cutover.ts --legacy-source /path/to/old-host
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
import { buildAppTaskTreeProjection } from "../../src/app/core/tasks/app-task-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  readAppTaskAdmissionOutcome,
} from "../../src/app/core/tasks/app-task-reconciler.js";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--legacy-source")
  throw new Error("Usage: task-receipt-cutover.ts --legacy-source /path/to/old-host");
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
const root = mkdtempSync(join(tmpdir(), "may-real-receipt-cutover-"));
let oldStore: AppTaskResourceStore | undefined;
let store: AppTaskResourceStore | undefined;
let database: SqliteDb | undefined;
try {
  const path = join(root, "state.sqlite");
  const old = legacySupport.appTaskTestContext({
    appDir: root,
    databasePath: path,
    agent: "worker",
    maxConcurrent: 1,
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
  oldStore.close();
  oldStore = undefined;

  // Run the Host's schema upgrade first. The standalone test-store constructor
  // does not migrate old inbox columns before creating the new Task indexes.
  database = openDatabase(path);
  applyDbSchema(database);
  store = AppTaskResourceStore.fromDb(database, "sample");
  const current = appTaskContext({ appDir: root, resourceStore: store, agent: "worker" });
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
  console.log(
    JSON.stringify({
      status: "passed",
      importedReceipts: 1,
      closedTasks: 1,
      linkedInputs: 1,
      originalAttemptPreserved: true,
      newExecutions: 0,
    }),
  );
} finally {
  oldStore?.close();
  store?.close();
  database?.close();
  rmSync(root, { recursive: true, force: true });
}
