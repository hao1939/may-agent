import { afterEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { currentProcessInstance } from "../../../lib/process-identity.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "./task-budget-admission.js";
import { readTaskWorkload } from "../reads/task-workload.js";
import { TaskExecutionStore } from "./task-execution-store.js";
import { installTaskExecutionLimit, releaseTaskExecutionReservation } from "./task-execution-admission.js";
import {
  appTaskContext, observeAppTaskIntent, claimObservedAppTask, completeAppTask, recordAppTaskTrigger,
} from "../tasks/app-task-reconciler.js";

const databases: SqliteDb[] = [];
afterEach(() => { setSystemTime(); databases.splice(0).forEach(db => db.close()); });
const recipient = { kind: "directory" as const, id: "projects/sample.app/agents/owner" };
const root = { appId: "sample", taskId: "work" };
function fixture(rootCredits = 20) {
  const db = openDatabase(":memory:"); databases.push(db); applyDbSchema(db);
  const budgets = new TaskBudgetAdmissionStore(db);
  budgets.install({ appId: "sample", sponsor: { appId: "sample", agent: "owner" }, dailyCredits: 40, rootCredits });
  const tasks = AppTaskResourceStore.fromDb(db, "sample");
  tasks.bootstrapSnapshot({ project: "sample", root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }, "seed");
  const config = appTaskContext({ appDir: "/fixture/sample.app", projectDir: "/fixture", agent: "owner", maxConcurrent: 4, resourceStore: tasks });
  const add = (taskId: string, child = false) => observeAppTaskIntent(config, {
    appAgent: "owner", ...(child ? { creator: { appId: root.appId, taskId: root.taskId } } : {}),
    intent: { id: taskId, parentId: "root", outcome: "Deliver the assignment", acceptance: ["Result accepted"] },
  });
  add("work");
  const executions = new TaskExecutionStore(db);
  installTaskExecutionLimit(db, { kind: "host" }, 4);
  installTaskExecutionLimit(db, { kind: "agent", recipient }, 4);
  installTaskExecutionLimit(db, { kind: "root", root }, 1);
  const claim = (taskId = "work") => claimObservedAppTask(config, {
    taskId, appAgent: "owner", handler: "agent",
    execution: { recipient: () => recipient, lane: "background" },
  });
  const occupied = () => executions.usage({ kind: "root", root }).occupied;
  return { db, budgets, tasks, config, add, claim, executions, occupied };
}

test("winning claims reserve capacity and spend together; constrained work retains demand without spending", () => {
  const f = fixture(); f.add("child", true);
  const first = f.claim();
  expect(first.kind).toBe("claimed");
  expect(f.occupied()).toBe(1);
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(3);
  const denied = f.claim("child");
  expect(denied).toMatchObject({ kind: "deferred", execution: { reason: "execution-capacity", scope: { kind: "root", root } } });
  expect(f.tasks.readTask("child")?.status).toMatchObject({ phase: "pending", executionConstraint: { reason: "execution-capacity" } });
  expect(f.tasks.readTask("child")?.status.currentAttemptId).toBeUndefined();
  expect(f.tasks.readTask("child")?.status.executionFailures).toBeUndefined();
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(3);
  expect(f.db.prepare("SELECT ready, changed FROM app_tasks WHERE task_id = 'child'").get()).toEqual({ ready: 0, changed: 0 });
  // A constrained root cannot block an independently funded assignment.
  f.add("other");
  installTaskExecutionLimit(f.db, { kind: "root", root: { ...root, taskId: "other" } }, 1);
  expect(f.claim("other").kind).toBe("claimed");
});

test("business settlement does not release execution; confirmed non-start wakes exact constrained work", () => {
  const f = fixture(); f.add("child", true);
  const claimed = f.claim(); if (claimed.kind !== "claimed") throw new Error("Expected claim");
  const saved = f.executions.read({ kind: "attempt", task: root, attemptId: claimed.attemptId });
  expect(saved?.receipt.owner).toEqual(currentProcessInstance());
  f.claim("child");
  completeAppTask(f.config, claimed, { summary: "Accepted outcome" });
  expect(f.occupied()).toBe(1);
  expect(f.claim("child").kind).toBe("deferred");
  if (!saved) throw new Error("Expected execution receipt");
  releaseTaskExecutionReservation(f.db, saved.receipt, { kind: "confirmed-nonstart", evidenceId: "fixture-never-dispatched" });
  expect(f.tasks.readTask("child")?.status.executionConstraint).toBeUndefined();
  expect(f.db.prepare("SELECT ready FROM app_tasks WHERE task_id = 'child'").get()?.ready).toBe(1);
  expect(f.claim("child").kind).toBe("claimed");
});

test("budget denial and outer rollback retain neither a place nor an attempt charge", () => {
  const f = fixture(1);
  expect(f.claim()).toMatchObject({ kind: "deferred", funding: { reason: "root-credit" } });
  expect(f.occupied()).toBe(0);
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(1);
  const g = fixture();
  expect(() => stateTransaction(g.db, () => { g.claim(); throw new Error("caller fence lost"); })).toThrow("caller fence lost");
  expect(g.occupied()).toBe(0);
  expect(g.tasks.readTask("work")?.status.currentAttemptId).toBeUndefined();
  expect(g.budgets.budget.view(root, Date.now())?.rootCharged).toBe(1);
});

test("a configured installation cannot charge a claim without its resolved execution recipient", () => {
  const f = fixture();
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" })).toMatchObject({
    kind: "deferred", execution: { reason: "execution-recipient" },
  });
  expect(f.occupied()).toBe(0);
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(1);
});

test("release between a denied claim and its saved constraint cannot lose the wake", () => {
  const f = fixture(); f.add("child", true);
  const claimed = f.claim(); if (claimed.kind !== "claimed") throw new Error("Expected claim");
  const saved = f.executions.read({ kind: "attempt", task: root, attemptId: claimed.attemptId });
  if (!saved) throw new Error("Expected execution receipt");
  const read = f.tasks.readTaskContext.bind(f.tasks);
  let reads = 0;
  const injected = spyOn(f.tasks, "readTaskContext").mockImplementation((...args) => {
    if (++reads === 2) releaseTaskExecutionReservation(f.db, saved.receipt,
      { kind: "confirmed-nonstart", evidenceId: "racing-confirmation" });
    return read(...args);
  });
  try {
    expect(f.claim("child").kind).toBe("deferred");
    expect(f.tasks.readTask("child")?.status.executionConstraint).toBeUndefined();
    expect(f.db.prepare("SELECT ready FROM app_tasks WHERE task_id = 'child'").get()?.ready).toBe(1);
  } finally { injected.mockRestore(); }
});

test("losing the exact resource fence rolls back a place before any attempt is charged", () => {
  const f = fixture();
  const read = f.tasks.readTaskContext.bind(f.tasks);
  let first = true;
  const injected = spyOn(f.tasks, "readTaskContext").mockImplementation((...args) => {
    const snapshot = read(...args);
    if (first) {
      first = false;
      const winner = f.tasks.readTask("work")!;
      winner.metadata.resourceVersion++;
      winner.status.summary = "Concurrent owner revision";
      f.tasks.commit({ fences: [{ taskId: "work", resourceVersion: winner.metadata.resourceVersion - 1 }],
        tasks: [{ resource: winner, ready: true }] });
    }
    return snapshot;
  });
  try { expect(f.claim).toThrow("Resource-backed task mutation was rejected by a stale fence"); }
  finally { injected.mockRestore(); }
  expect(f.occupied()).toBe(0);
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(1);
  expect(f.tasks.readTask("work")?.status.summary).toBe("Concurrent owner revision");
});

test("installing a missing root policy wakes only its exact retained constraint", () => {
  const f = fixture(); f.add("new-root"); f.add("another-root");
  expect(f.claim("new-root")).toMatchObject({ kind: "deferred", execution: { reason: "execution-policy" } });
  f.claim("another-root");
  installTaskExecutionLimit(f.db, { kind: "root", root: { ...root, taskId: "new-root" } }, 1);
  expect(f.tasks.readTask("new-root")?.status.executionConstraint).toBeUndefined();
  expect(f.tasks.readTask("another-root")?.status.executionConstraint?.reason).toBe("execution-policy");
  expect(f.claim("new-root").kind).toBe("claimed");
  expect(f.claim("another-root").kind).toBe("deferred");
  const plan = f.db.prepare(`EXPLAIN QUERY PLAN SELECT app_id, task_id FROM app_tasks
    WHERE json_valid(resource_json)
      AND json_extract(resource_json, '$.status.executionConstraint.scopeKey') = ?`).all("scope");
  expect(plan.some(row => String(row.detail).includes("idx_app_tasks_execution_constraint"))).toBe(true);
});

test("restart retains an indexed mechanical recheck and unclaimed input without spending or retry failure", () => {
  const f = fixture(); f.add("child", true); f.claim();
  recordAppTaskTrigger(f.config, "child", { type: "input.observed", eventId: 7, data: { message: "Still owed" } });
  const denied = f.claim("child");
  if (denied.kind !== "deferred" || !("execution" in denied)) throw new Error("Expected capacity hold");
  const original = f.tasks.readTrigger("child");
  const restarted = AppTaskResourceStore.fromDb(f.db, "sample");
  expect(restarted.listRecoveryCandidates().items.map(item => item.taskId)).not.toContain("child");
  expect(restarted.listRecoveryCandidates(denied.execution.retryAt).items.map(item => item.taskId)).toContain("child");
  restarted.setRecoveryState("child", { ready: true, changed: true });
  expect(restarted.listRecoveryCandidates().items.map(item => item.taskId)).not.toContain("child");
  setSystemTime(denied.execution.retryAt + 1);
  const retried = claimObservedAppTask({ ...f.config, resourceStore: restarted }, {
    taskId: "child", appAgent: "owner", handler: "agent", execution: { recipient: () => recipient, lane: "background" },
  });
  expect(retried).toMatchObject({ kind: "deferred", execution: { reason: "execution-capacity" } });
  expect(restarted.readTrigger("child")?.events).toEqual(original?.events);
  expect(restarted.readTask("child")?.status.executionFailures).toBeUndefined();
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(3);
});

test("capacity-held work remains runnable demand with a read-only exact blocker", () => {
  const f = fixture(); f.add("child", true); f.claim(); f.claim("child");
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  const workload = readTaskWorkload({ taskStateConfig: f.config });
  expect(workload.counts).toMatchObject({ running: 1, runnable: 1, waiting: 0 });
  expect(workload.examples.blockers).toEqual([{ taskId: "child", kind: "capacity",
    reason: "execution-capacity", retryAt: expect.any(Number), scope: "root", requiredSlots: 1 }]);
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
});

test("cross-App child execution shares its creating root despite a different local sponsor", () => {
  const f = fixture(); f.claim();
  f.budgets.install({ appId: "receiver", sponsor: { appId: "receiver", agent: "owner" }, dailyCredits: 20, rootCredits: 10 });
  const tasks = AppTaskResourceStore.fromDb(f.db, "receiver");
  tasks.bootstrapSnapshot({ project: "receiver", root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }, "seed");
  const config = appTaskContext({ ...f.config, appDir: "/fixture/receiver.app", resourceStore: tasks });
  observeAppTaskIntent(config, { appAgent: "owner", creator: root,
    intent: { id: "contribution", parentId: "root", outcome: "Contribute to the source assignment", acceptance: ["Evidence returned"] } });
  expect(claimObservedAppTask(config, { taskId: "contribution", appAgent: "owner", handler: "agent",
    execution: { recipient: () => recipient, lane: "background" } })).toMatchObject({
    kind: "deferred", execution: { scope: { kind: "root", root } },
  });
  expect(f.budgets.budget.view({ appId: "receiver", taskId: "contribution" }, Date.now())).toMatchObject({
    root, sponsor: { appId: "sample", agent: "owner" }, rootCharged: 3,
  });
});
