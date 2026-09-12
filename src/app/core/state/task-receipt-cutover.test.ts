import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appTaskTestContext } from "../tasks/app-task-test-support.js";
import {
  appTaskContext,
  appTaskSpecHash,
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
  recordAppTaskTrigger,
} from "../tasks/app-task-reconciler.js";
import type { AppTaskAdmission, TaskCompletionReceipt, TaskTree } from "../tasks/app-task-store.js";
import { buildAppTaskTreeProjection } from "../tasks/app-task-store.js";
import type { AppTaskResource } from "../tasks/app-task-state.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { migrateTaskCompletionReceipts } from "./task-receipt-cutover.js";

const roots: string[] = [];
const stores = new Set<AppTaskResourceStore>();
afterEach(() => {
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// The retained shape produced by completeAppTask at a8f65188: the finite
// resource is removed, while its receipt, attempts and admissions remain.
function receipt(id = "measurement", parentId = "root"): TaskCompletionReceipt {
  const spec = {
    parentId,
    outcome: "Measure the sample",
    acceptance: ["Read the instrument"],
    input: { sample: "first" },
  };
  return {
    metadata: { id, generation: 1, resourceVersion: 1 },
    parentId,
    outcome: spec.outcome,
    acceptance: spec.acceptance,
    input: spec.input,
    specHash: appTaskSpecHash({ id, ...spec }, "worker"),
    owner: "worker",
    handler: "agent:worker",
    summary: "Measured the sample",
    response: "The measurement is 17.",
    result: { value: 17 },
    evidence: ["measurement.json"],
    acceptanceBasis: { method: "deterministic", verifier: "instrument", evidence: ["checked:17"] },
    failureFingerprints: ["provider-interrupted"],
    completedAt: "2026-09-01T10:00:00.000Z",
  };
}

function admission(result: TaskCompletionReceipt): AppTaskAdmission {
  return {
    taskId: result.metadata.id,
    taskGeneration: result.metadata.generation,
    specHash: result.specHash,
    admittedAt: "2026-09-01T09:00:00.000Z",
  };
}

function resource(result: TaskCompletionReceipt, generation = 1): AppTaskResource {
  return {
    metadata: { id: result.metadata.id, generation, resourceVersion: 7 },
    spec: {
      parentId: result.parentId,
      outcome: result.outcome,
      acceptance: result.acceptance,
      input: result.input,
    },
    status: { phase: "pending", observedGeneration: 0, updatedAt: result.completedAt },
  };
}

function fixture(tree: TaskTree) {
  const root = mkdtempSync(join(tmpdir(), "may-receipt-cutover-"));
  roots.push(root);
  const path = join(root, "state.sqlite");
  let config = appTaskTestContext({
    appDir: root,
    databasePath: path,
    agent: "worker",
    maxConcurrent: 1,
    tree: {
      project: "sample",
      project_lifecycle: "paused",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null, owner: "worker" } },
      ...tree,
    },
  });
  stores.add(config.resourceStore);
  return {
    get config() {
      return config;
    },
    get store() {
      return config.resourceStore;
    },
    migrate: (oldRuntimeStopped = true) => migrateTaskCompletionReceipts(config, { oldRuntimeStopped }),
    reopen() {
      config.resourceStore.close();
      stores.delete(config.resourceStore);
      const store = AppTaskResourceStore.openStandalone(path, "sample");
      stores.add(store);
      config = appTaskContext({ appDir: root, agent: "worker", resourceStore: store });
    },
  };
}

test("historical completed work becomes a closed Task with exact result and caller correlation across reopen", () => {
  const result = receipt();
  const f = fixture({ receipts: { measurement: result }, appTaskAdmissions: { ask: admission(result) } });
  expect(f.migrate()).toEqual({ imported: 1, closed: 1, linkedInputs: 1 });
  const outcome = readAppTaskAdmissionOutcome(f.config, "measurement", "ask")!;
  expect(outcome).toMatchObject({
    state: "converged",
    generation: 1,
    summary: result.summary,
    response: result.response,
    result: result.result,
    evidence: result.evidence,
    acceptanceBasis: result.acceptanceBasis,
  });
  expect(f.store.readCancellation("measurement")).toMatchObject({
    kind: "closed",
    acceptedResultAttemptId: outcome.attemptId,
    cancelledAt: result.completedAt,
  });
  expect(f.store.readTask("measurement")?.status.observedAttemptId).toBe(outcome.attemptId);
  expect(buildAppTaskTreeProjection(f.store.readSnapshot(), 1).tasks.measurement?.attempt_count).toBe(0);
  expect(f.store.readReceipt("measurement")).toEqual(result);
  expect(f.store.readSnapshot().project_lifecycle).toBe("paused");
  const version = f.store.revision();
  expect(f.migrate()).toEqual({ imported: 0, closed: 0, linkedInputs: 0 });
  expect(f.store.revision()).toBe(version);
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "measurement", "ask")).toEqual(outcome);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(f.store.nextDueAt()).toBeNull();
  recordAppTaskTrigger(f.config, "measurement", { type: "sample.changed", data: { sample: "later" } });
  expect(claimObservedAppTask(f.config, { taskId: "measurement", appAgent: "worker", handler: "agent" }).kind).toBe(
    "completed",
  );
  expect(() =>
    observeAppTaskIntent(f.config, {
      appAgent: "worker",
      intent: { id: "measurement", ...f.store.readTask("measurement")!.spec },
    }),
  ).toThrow("cancelled task");
});

test("compacted receipts retain their original payload and detail digests without inventing lost evidence", () => {
  const result = {
    ...receipt(),
    acceptance: [],
    evidence: [],
    result: undefined,
    response: undefined,
    compactedDetailSha256: "1".repeat(64),
    compactedPayloadSha256: "2".repeat(64),
  };
  const f = fixture({ receipts: { measurement: result }, appTaskAdmissions: { ask: admission(result) } });
  const before = f.store.readReceipt("measurement");
  f.migrate();
  expect(f.store.readReceipt("measurement")).toEqual(before);
  expect(readAppTaskAdmissionOutcome(f.config, "measurement", "ask")).toMatchObject({ evidence: [] });
  expect(readAppTaskAdmissionOutcome(f.config, "measurement", "ask")?.result).toBeUndefined();
});

test("a historical receipt answers only its generation and cannot close revised work", () => {
  const result = receipt();
  const revised = resource(result, 2);
  revised.spec.input = { sample: "second" };
  const f = fixture({
    receipts: { measurement: result },
    resources: { measurement: revised },
    appTaskAdmissions: {
      first: admission(result),
      second: {
        ...admission(result),
        taskGeneration: 2,
        specHash: appTaskSpecHash({ id: "measurement", ...revised.spec }, "worker"),
      },
    },
  });
  expect(f.migrate()).toEqual({ imported: 1, closed: 0, linkedInputs: 1 });
  expect(readAppTaskAdmissionOutcome(f.config, "measurement", "first")?.result).toEqual({ value: 17 });
  expect(readAppTaskAdmissionOutcome(f.config, "measurement", "second")).toBeNull();
  expect(f.store.readTask("measurement")).toEqual(revised);
  expect(f.store.isCancelled("measurement")).toBe(false);
});

test("existing human closure remains unchanged when importing older completion evidence", () => {
  const result = receipt();
  const current = resource(result, 2);
  const f = fixture({ receipts: { measurement: result }, resources: { measurement: current } });
  cancelAppTask(f.config, {
    appId: "sample",
    taskId: "measurement",
    expectedGeneration: 2,
    expectedResourceVersion: 7,
    reason: "No longer needed",
  });
  const closed = f.store.readCancellation("measurement");
  const stopped = f.store.readTask("measurement");
  f.migrate();
  expect(f.store.readCancellation("measurement")).toEqual(closed);
  expect(f.store.readTask("measurement")).toEqual(stopped);
});

test("closed child history can be restored beneath an already cancelled parent", () => {
  const parent = resource(receipt("parent"));
  const result = receipt("measurement", "parent");
  const f = fixture({ receipts: { measurement: result }, resources: { parent } });
  cancelAppTask(f.config, {
    appId: "sample",
    taskId: "parent",
    expectedGeneration: 1,
    expectedResourceVersion: 7,
    reason: "Close the project",
  });
  const closedParent = f.store.readCancellation("parent");
  expect(f.migrate().closed).toBe(1);
  expect(f.store.readTask("measurement")?.spec.parentId).toBe("parent");
  expect(f.store.isCancelled("measurement")).toBe(true);
  expect(f.store.readCancellation("parent")).toEqual(closedParent);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
});

test("duplicate live claims are fenced without replacing the original completion", () => {
  const result = receipt();
  const current = resource(result);
  const f = fixture({ project_lifecycle: "active", resources: { measurement: current } });
  const claim = claimObservedAppTask(f.config, { taskId: "measurement", appAgent: "worker", handler: "agent" });
  if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${claim.kind}`);
  expect(
    f.store.commit({
      fences: [{ taskId: "measurement", resourceVersion: f.store.readTask("measurement")!.metadata.resourceVersion }],
      receipts: [result],
    }),
  ).toBe(true);
  expect(f.migrate().closed).toBe(1);
  expect(f.store.readAttempt(claim.attemptId)).toMatchObject({
    state: "interrupted",
    failureReason: "completion-receipt-cutover",
  });
  expect(f.store.readAttempt(claim.attemptId)?.lease).toBeUndefined();
  expect(buildAppTaskTreeProjection(f.store.readSnapshot(), 1).tasks.measurement?.attempt_count).toBe(1);
  expect(completeAppTask(f.config, claim, { summary: "Late wrong value", result: { value: 99 } }).status).toBe("stale");
  expect(f.store.readTask("measurement")?.status.result).toEqual({ value: 17 });
});

test("a failure during cutover rolls back every receipt, closure and admission link", () => {
  const result = receipt();
  const f = fixture({ receipts: { measurement: result }, appTaskAdmissions: { ask: admission(result) } });
  const before = f.store.readSnapshot();
  const version = f.store.revision();
  f.store.db.exec(
    "CREATE TRIGGER reject_closure BEFORE INSERT ON app_task_cancellations BEGIN SELECT RAISE(ABORT, 'cannot save closure'); END",
  );
  expect(() => f.migrate()).toThrow("cannot save closure");
  expect(f.store.readSnapshot()).toEqual(before);
  expect(f.store.revision()).toBe(version);
});

test("cutover refuses conflicting same-generation state and requires an explicit offline assertion", () => {
  const result = receipt();
  const current = resource(result);
  current.spec.outcome = "A different assignment";
  const f = fixture({ receipts: { measurement: result }, resources: { measurement: current } });
  const before = f.store.readSnapshot();
  expect(() => f.migrate(false)).toThrow("old Host and all workers to be stopped");
  expect(() => f.migrate()).toThrow("conflicts with the retained Task");
  expect(f.store.readSnapshot()).toEqual(before);
});
