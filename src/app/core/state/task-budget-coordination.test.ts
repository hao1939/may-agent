import { afterEach, expect, setSystemTime, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "./task-budget-admission.js";
import { admitManagedTaskStart } from "./task-budget-managed-start.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
} from "../tasks/app-task-reconciler.js";
import type { TaskIntent, ResourceCreator } from "@may-agent/sdk";
import { stateTransaction } from "../../../lib/db/transaction.js";

const databases: SqliteDb[] = [];
afterEach(() => {
  setSystemTime();
  databases.splice(0).forEach((db) => db.close());
});
function fixture(credits = 5) {
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  const accounting = new TaskBudgetAdmissionStore(db);
  const coordination = {
    taskId: "runtime/review",
    workflow: "workload-review",
    agent: "owner",
    maxAttemptMs: 60_000,
    dailyCredits: credits,
    credits,
  };
  const policy = {
    appId: "sample",
    sponsor: { appId: "sample", agent: "sponsor" },
    dailyCredits: 0,
    rootCredits: 5,
    coordination,
  };
  accounting.install(policy);
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.bootstrapSnapshot({ groups: { root: { id: "root", parent_id: null } } }, "seed");
  const config = appTaskContext({
    appDir: "/fixture/sample.app",
    projectDir: "/fixture/sample.app",
    agent: "owner",
    maxConcurrent: 2,
    resourceStore: store,
  });
  const intent: TaskIntent = {
    id: coordination.taskId,
    parentId: "root",
    workflow: coordination.workflow,
    outcome: "Review existing commitments",
    acceptance: ["Preserve obligations"],
  };
  const add = (change: Partial<TaskIntent> = {}, creator: ResourceCreator = { appId: "sample" }) =>
    observeAppTaskIntent(config, { intent: { ...intent, ...change }, creator, appAgent: "owner" });
  const claim = () => claimObservedAppTask(config, { taskId: intent.id, appAgent: "owner", handler: "auto" });
  const view = () => accounting.budget.view({ appId: "sample", taskId: intent.id }, Date.now());
  return { db, accounting, coordination, policy, config, store, intent, add, claim, view };
}

test("protected coordination creation, claim and helper remain available when ordinary funds are exhausted", () => {
  const f = fixture();
  expect(() => f.add({ id: "business" })).toThrow(TaskBudgetDeferredError);
  f.add();
  expect(f.view()).toMatchObject({
    purpose: "coordination",
    renewal: "utc-day",
    rootCharged: 1,
    grant: { credits: 5, charged: 1 },
  });
  const claim = f.claim();
  expect(claim.kind).toBe("claimed");
  if (claim.kind !== "claimed") throw new Error("Expected protected claim");
  const binding = { appId: "sample", taskId: claim.taskId, generation: claim.generation, attemptId: claim.attemptId };
  admitManagedTaskStart(f.db, { binding, sessionId: "review-helper" });
  expect(f.view()).toMatchObject({ rootCharged: 3, grant: { charged: 3 } });
  expect(() => f.add({ id: "child" }, { appId: "sample", taskId: f.intent.id })).toThrow("protected-contribution");
  expect(f.store.readTask("child")).toBeNull();
  completeAppTask(f.config, claim, { summary: "Reviewed commitments" });
  expect(f.view()?.rootCharged).toBe(3);
  expect(
    f.db.prepare("SELECT count(*) AS n FROM task_credit_grants WHERE purpose = 'ordinary' AND charged > 0").get()?.n,
  ).toBe(0);
});

test("protected identity never admits changed workflow, executor, owner or Task-created provenance", () => {
  for (const [change, creator] of [
    [{ workflow: "business" }, { appId: "sample" }],
    [{ workflow: undefined, executor: "agent" }, { appId: "sample" }],
    [{ agent: "different" }, { appId: "sample" }],
    [{}, { appId: "other" }],
    [{}, { appId: "sample", taskId: "caller" }],
  ] as Array<[Partial<TaskIntent>, ResourceCreator]>) {
    const f = fixture();
    expect(() => f.add(change, creator)).toThrow(TaskBudgetDeferredError);
    expect(f.store.readTask(f.intent.id)).toBeNull();
    expect(f.view()).toBeNull();
  }
});

test("a changed coordination specification cannot spend protected attempt or helper funds", () => {
  const f = fixture();
  f.add();
  f.add({ workflow: "business" });
  expect(f.claim()).toMatchObject({ kind: "deferred", funding: { reason: "protected-policy", retryAt: null } });
  expect(f.view()?.rootCharged).toBe(1);
  const g = fixture();
  g.add();
  const claim = g.claim();
  if (claim.kind !== "claimed") throw new Error("Expected protected claim");
  // Preserve the actor fence while changing a protected prerequisite, as an
  // independent runtime could between claim and external helper admission.
  g.db
    .prepare(
      "UPDATE app_tasks SET resource_json = json_set(resource_json, '$.spec.workflow', 'business') WHERE app_id = 'sample' AND task_id = ?",
    )
    .run(g.intent.id);
  expect(() =>
    admitManagedTaskStart(g.db, {
      binding: { appId: "sample", taskId: claim.taskId, generation: claim.generation, attemptId: claim.attemptId },
      sessionId: "denied-helper",
    }),
  ).toThrow("protected-policy");
  expect(g.view()?.rootCharged).toBe(2);
  expect(g.db.prepare("SELECT count(*) AS n FROM task_budget_managed_starts").get()?.n).toBe(0);
});

test("protected renewal, exhaustion and caller rollback preserve separate daily accounting", () => {
  setSystemTime(new Date("2026-07-01T23:59:00Z"));
  const f = fixture(2);
  f.add();
  const claim = f.claim();
  if (claim.kind !== "claimed") throw new Error("Expected protected claim");
  const binding = { appId: "sample", taskId: claim.taskId, generation: claim.generation, attemptId: claim.attemptId };
  expect(() => admitManagedTaskStart(f.db, { binding, sessionId: "exhausted" })).toThrow(TaskBudgetDeferredError);
  expect(f.view()?.rootCharged).toBe(2);
  setSystemTime(new Date("2026-07-02T00:01:00Z"));
  expect(() =>
    stateTransaction(f.db, () => {
      admitManagedTaskStart(f.db, { binding, sessionId: "rolled-back" });
      throw new Error("caller rollback");
    }),
  ).toThrow("caller rollback");
  expect(f.view()?.rootCharged).toBe(0);
  admitManagedTaskStart(f.db, { binding, sessionId: "renewed" });
  expect(f.view()).toMatchObject({ rootCharged: 1, grant: { charged: 1, credits: 2 } });
  expect(
    f.db.prepare("SELECT charged FROM task_credit_grants WHERE purpose = 'coordination' ORDER BY period").all(),
  ).toEqual([{ charged: 2 }, { charged: 1 }]);
});

test("protected attempts require their installed workflow handler, even through direct claim adapters", () => {
  const f = fixture();
  f.add();
  expect(claimObservedAppTask(f.config, { taskId: f.intent.id, appAgent: "owner", handler: "agent" })).toMatchObject({
    kind: "deferred",
    funding: { reason: "protected-policy" },
  });
  expect(f.view()?.rootCharged).toBe(1);
});

test("protected policy requires exact bounded eligibility and cannot alias an ordinary standing allowance", () => {
  const f = fixture();
  const { agent, credits: _credits, dailyCredits: _dailyCredits, ...declared } = f.coordination;
  expect(() => f.accounting.assertCoordinationPolicy("sample", agent, declared)).not.toThrow();
  for (const change of [{ workflow: "business" }, { maxAttemptMs: 120_000 }, { taskId: "another" }])
    expect(() => f.accounting.assertCoordinationPolicy("sample", agent, { ...declared, ...change })).toThrow("differs");
  expect(() => f.accounting.assertCoordinationPolicy("sample", "different", declared)).toThrow("differs");
  expect(() => f.accounting.assertCoordinationPolicy("sample", agent, undefined)).toThrow("differs");
  for (const change of [{ credits: -1 }, { dailyCredits: 1.5 }, { maxAttemptMs: 121_000 }, { taskId: " review" }])
    expect(() => f.accounting.install({ ...f.policy, coordination: { ...f.coordination, ...change } })).toThrow();
  expect(() => f.accounting.install({ ...f.policy, standing: [{ taskId: f.intent.id, credits: 5 }] })).toThrow(
    "unique exact",
  );
});

test("another funded root cannot occupy the installed protected Task identity", () => {
  const f = fixture();
  f.accounting.install({
    appId: "other",
    sponsor: { appId: "other", agent: "caller" },
    dailyCredits: 5,
    rootCredits: 5,
  });
  expect(() => f.add({}, { appId: "other" })).toThrow("protected-policy");
  expect(f.view()).toBeNull();
  f.add();
  expect(f.view()?.purpose).toBe("coordination");
});

test("correcting a protected assignment permits its next claim without renewing its spending", () => {
  const f = fixture();
  f.add();
  f.add({ workflow: "business" });
  expect(f.claim().kind).toBe("deferred");
  f.add();
  expect(f.claim().kind).toBe("claimed");
  expect(f.view()?.rootCharged).toBe(2);
});
