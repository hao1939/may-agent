import { afterEach, expect, setSystemTime, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { AppTaskController } from "../tasks/controller.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { failAppTaskAttempt } from "../tasks/app-task-reconciler.js";
import { adoptTaskBudget } from "./task-budget-funding.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "./task-budget-admission.js";
import {
  appTaskContext,
  observeAppTaskIntent,
  claimObservedAppTask,
  completeAppTask,
} from "../tasks/app-task-reconciler.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { defineApp, Type, type ResourceCreator } from "@may-agent/sdk";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { admitTaskInput } from "./inbox.js";
import { createAppInboxItem } from "./app-inbox-store.js";

const databases: SqliteDb[] = [];
afterEach(() => {
  setSystemTime();
  databases.splice(0).forEach((db) => db.close());
});
function fixture(dailyCredits = 10, rootCredits = 5, standing: Array<{ taskId: string; credits: number }> = []) {
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  const accounting = new TaskBudgetAdmissionStore(db);
  function app(appId: string, agent = "executor") {
    const store = AppTaskResourceStore.fromDb(db, appId);
    store.bootstrapSnapshot(
      { project: appId, root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
      "seed",
    );
    const config = appTaskContext({
      appDir: `/fixture/${appId}.app`,
      projectDir: `/fixture/${appId}.app`,
      agent,
      maxConcurrent: 2,
      resourceStore: store,
    });
    const add = (
      taskId: string,
      creator?: ResourceCreator,
      extra: { parentId?: string; outcome?: string; dependsOn?: string[] } = {},
    ) =>
      observeAppTaskIntent(config, {
        appAgent: agent,
        creator,
        intent: {
          id: taskId,
          parentId: "root",
          outcome: "Deliver the result",
          acceptance: ["Result accepted"],
          ...extra,
        },
      });
    const claim = (taskId: string) => claimObservedAppTask(config, { taskId, appAgent: agent, handler: "agent" });
    return { store, config, add, claim };
  }
  accounting.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "sponsor" },
    dailyCredits,
    rootCredits,
    ...(standing.length ? { standing } : {}),
  });
  const sample = app("sample");
  return {
    db,
    accounting,
    app,
    ...sample,
    view: (appId: string, taskId: string) => accounting.budget.view({ appId, taskId }, Date.now()),
  };
}

test("creation and claim spend once with canonical mutations; attachments, busy checks and settlement are free", () => {
  const f = fixture();
  f.add("work");
  expect(f.view("sample", "work")).toMatchObject({ rootCharged: 1, sponsor: { agent: "sponsor" } });
  f.add("work");
  expect(f.view("sample", "work")?.rootCharged).toBe(1);
  const claim = f.claim("work");
  expect(claim.kind).toBe("claimed");
  expect(f.claim("work").kind).toBe("busy");
  if (claim.kind !== "claimed") throw new Error("Expected claim");
  completeAppTask(f.config, claim, { summary: "Accepted" });
  expect(f.claim("work").kind).toBe("completed");
  expect(f.view("sample", "work")).toMatchObject({ rootCharged: 2, grant: { charged: 2 } });
});

test("new cross-App contributions inherit their creating Task account, independently of executor and structural parent", () => {
  const f = fixture();
  f.add("work");
  const destination = f.app("destination", "recipient");
  destination.add("contribution", { appId: "sample", taskId: "work" });
  expect(f.view("destination", "contribution")).toMatchObject({
    root: { appId: "sample", taskId: "work" },
    sponsor: { agent: "sponsor" },
    rootCharged: 2,
  });
  destination.add("contribution", { appId: "sample", taskId: "work" }, { outcome: "Refine the contribution" });
  expect(f.view("sample", "work")?.rootCharged).toBe(2);
  expect(destination.claim("contribution").kind).toBe("claimed");
  expect(f.view("sample", "work")?.rootCharged).toBe(3);
});

test("existing services keep their own sponsorship when another root supplies input", () => {
  const f = fixture();
  f.add("caller");
  f.accounting.install({
    appId: "service",
    sponsor: { appId: "service", agent: "service-sponsor" },
    dailyCredits: 5,
    rootCredits: 4,
  });
  const service = f.app("service");
  service.add("lookup");
  service.add("lookup", { appId: "sample", taskId: "caller" });
  expect(f.view("service", "lookup")).toMatchObject({
    root: { appId: "service", taskId: "lookup" },
    sponsor: { agent: "service-sponsor" },
    rootCharged: 1,
  });
  expect(f.view("sample", "caller")?.rootCharged).toBe(1);
});

test("funding denial rolls back Task, root binding, receipt and caller transaction writes", () => {
  const f = fixture(0);
  const revision = f.store.revision();
  expect(() => f.add("unfunded")).toThrow(TaskBudgetDeferredError);
  expect(f.store.readTask("unfunded")).toBeNull();
  expect(f.accounting.budget.binding({ appId: "sample", taskId: "unfunded" })).toBeNull();
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
  expect(f.store.revision()).toBe(revision);
  const funded = fixture();
  expect(() =>
    stateTransaction(funded.db, () => {
      funded.add("rollback");
      throw new Error("Caller link failed");
    }),
  ).toThrow("Caller link failed");
  expect(funded.store.readTask("rollback")).toBeNull();
  expect(funded.view("sample", "rollback")).toBeNull();
});

test("denied attempts preserve pending demand and retries; stale resource fences spend nothing", () => {
  const f = fixture(10, 1);
  f.add("work");
  const before = f.store.readTask("work")!;
  expect(f.claim("work")).toMatchObject({ kind: "deferred", funding: { reason: "root-credit", retryAt: null } });
  const held = f.store.readTask("work")!;
  expect(held.metadata.generation).toBe(before.metadata.generation);
  expect(held.status).toMatchObject({ phase: "pending", funding: { reason: "root-credit" } });
  expect(held.status.executionFailures).toBeUndefined();
  expect(held.status.currentAttemptId).toBeUndefined();
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  const changes = f.db.prepare("SELECT total_changes() AS n").get();
  expect(f.claim("work").kind).toBe("deferred");
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(changes);
  expect(f.view("sample", "work")?.rootCharged).toBe(1);
  const stale = structuredClone(before);
  stale.metadata.resourceVersion++;
  expect(
    f.store.commit({
      fences: [{ taskId: "work", resourceVersion: before.metadata.resourceVersion }],
      tasks: [{ resource: stale, ready: true }],
    }),
  ).toBe(false);
  expect(f.view("sample", "work")?.rootCharged).toBe(1);
});

test("historical work needs explicit adoption and an unbound creating Task cannot gain a fresh pot", () => {
  const f = fixture();
  const old = f.app("historical");
  old.add("retained");
  f.accounting.install({
    appId: "historical",
    sponsor: { appId: "historical", agent: "owner" },
    dailyCredits: 5,
    rootCredits: 3,
  });
  expect(old.claim("retained")).toMatchObject({ kind: "deferred", funding: { reason: "adoption-required" } });
  expect(() => f.add("child", { appId: "historical", taskId: "retained" })).toThrow("adoption-required");
  const root = { appId: "historical", taskId: "retained" };
  adoptTaskBudget(f.db, {
    task: root,
    root: {
      root,
      sponsor: { appId: "historical", agent: "owner" },
      purpose: "ordinary",
      credits: 3,
      renewal: "lifetime",
    },
    adoptionId: "installation-1",
    reason: "Future work only; past spending unknown",
  });
  expect(old.store.listRecoveryCandidates().items.map((item) => item.taskId)).toContain("retained");
  expect(old.claim("retained").kind).toBe("claimed");
  expect(f.view("historical", "retained")?.rootCharged).toBe(1);
});

test("dependency checks are free and explicit standing policy determines renewal independently of Task labels", () => {
  const f = fixture();
  f.add("gate");
  f.add("blocked", undefined, { dependsOn: ["gate"] });
  expect(f.claim("blocked").kind).toBe("waiting");
  expect(f.view("sample", "blocked")?.rootCharged).toBe(1);
  f.accounting.install({
    appId: "standing",
    sponsor: { appId: "standing", agent: "owner" },
    dailyCredits: 5,
    rootCredits: 3,
    standing: [{ taskId: "scheduled", credits: 2 }],
  });
  const standing = f.app("standing");
  standing.add("scheduled");
  standing.add("ordinary");
  expect(f.view("standing", "scheduled")).toMatchObject({ renewal: "utc-day", credits: 2 });
  expect(f.view("standing", "ordinary")).toMatchObject({ renewal: "lifetime", credits: 3 });
});

function inboxApp(id = "sample") {
  return defineApp({
    id,
    version: 1,
    agent: "executor",
    tasks: {},
    inputSchema: Type.Object({ kind: Type.Literal("work"), data: Type.Object({}) }),
    task: (input) => ({
      kind: "desired",
      intent: { id: input.id, parentId: "root", outcome: "Deliver the result", acceptance: ["Result accepted"] },
    }),
  });
}
const workInput = (id: string, appId = "sample") => ({
  id,
  appId,
  source: { kind: "app" as const, id: "caller" },
  input: { kind: "work", data: {} },
});

test("creation shortage retains exact input without failure or admission polling and retries at the UTC grant boundary", async () => {
  setSystemTime(new Date("2026-11-09T12:00:00Z"));
  const f = fixture(1, 5);
  let mappings = 0;
  const definition = inboxApp();
  const attachTask = (input: Parameters<typeof admitTaskInput>[1]) => {
    mappings++;
    return admitTaskInput(f.config, input);
  };
  const host = new AppInboxHost({ db: f.db, apps: [definition], attachTask });
  host.admit(workInput("first"));
  const denied = host.admit(workInput("second")).item;
  expect(denied).toMatchObject({
    status: "pending",
    source: { kind: "app", id: "caller" },
    handling: { phase: "deferred", funding: { reason: "sponsor-credit", task: { appId: "sample", taskId: "second" } } },
  });
  expect(denied.recovery).toBeUndefined();
  expect(f.store.readTask("second")).toBeNull();
  await host.recoverAdmissions();
  host.admit(workInput("second"));
  expect(mappings).toBe(2);
  host.close();
  const reopened = new AppInboxHost({ db: f.db, apps: [definition], attachTask });
  await reopened.recoverAdmissions();
  expect(mappings).toBe(2);
  if (denied.handling?.phase !== "deferred" || denied.handling.funding.retryAt === null)
    throw new Error("Expected UTC due time");
  setSystemTime(denied.handling.funding.retryAt);
  await reopened.recoverAdmissions();
  expect(reopened.get("second")).toMatchObject({ status: "handling", waitingOn: { kind: "task", id: "second" } });
  expect(reopened.get("second")?.handling).toBeUndefined();
  expect(f.view("sample", "second")).toMatchObject({ rootCharged: 1, grant: { charged: 1 } });
  reopened.close();
});

test("indefinite funding holds do not occupy the admission recovery page ahead of eligible input", async () => {
  const f = fixture(5, 0);
  const other = f.app("other");
  let mappings = 0;
  const host = new AppInboxHost({
    db: f.db,
    apps: [inboxApp(), inboxApp("other")],
    attachTask: (input) => {
      mappings++;
      return admitTaskInput(input.appId === "sample" ? f.config : other.config, input);
    },
  });
  for (let i = 0; i < 65; i++) host.admit(workInput(`hold-${String(i).padStart(3, "0")}`));
  expect(host.get("hold-000")?.handling).toMatchObject({
    phase: "deferred",
    funding: { reason: "root-credit", retryAt: null },
  });
  createAppInboxItem(f.db, workInput("zzz-eligible", "other"));
  await host.recoverAdmissions();
  expect(mappings).toBe(66);
  expect(host.get("zzz-eligible")?.waitingOn).toEqual({ kind: "task", id: "zzz-eligible" });
  await host.recoverAdmissions();
  expect(mappings).toBe(66);
  host.close();
});

test("a funding hold preserves the one fresh-human retry and its input until the next grant", () => {
  setSystemTime(new Date("2026-11-09T12:00:00Z"));
  const f = fixture(2, 3);
  f.config.maxConsecutiveFailures = 1;
  f.add("repair");
  const first = f.claim("repair");
  if (first.kind !== "claimed") throw new Error("Expected initial claim");
  failAppTaskAttempt(f.config, first, "Needs corrected source");
  admitTaskInput(f.config, {
    appId: "sample",
    attachment: { kind: "existing", taskId: "repair" },
    idempotencyKey: "human:correction",
    inputContext: { id: "correction", source: { kind: "human", id: "person" }, input: { kind: "work", data: {} } },
  });
  const exhausted = f.store.readTask("repair")!.status.retryExhausted;
  const denied = f.claim("repair");
  expect(denied).toMatchObject({ kind: "deferred", funding: { reason: "sponsor-credit" } });
  expect(f.store.readTask("repair")!.status).toMatchObject({
    retryExhausted: exhausted,
    executionFailures: 1,
    freshHumanInput: true,
  });
  expect(f.store.readTrigger("repair")?.events?.some(({ event }) => event.idempotencyKey === "human:correction")).toBe(
    true,
  );
  if (denied.kind !== "deferred" || denied.funding.retryAt === null) throw new Error("Expected next grant time");
  setSystemTime(denied.funding.retryAt);
  const retry = f.claim("repair");
  expect(retry.kind).toBe("claimed");
  expect(f.store.readTask("repair")!.status.freshHumanInput).toBeUndefined();
  expect(f.store.readTask("repair")!.status.funding).toBeUndefined();
  expect(f.view("sample", "repair")?.rootCharged).toBe(3);
});

test("funding denial commits confirmed old-runtime cleanup while preserving its unaccepted input", () => {
  const f = fixture(2, 5);
  f.add("work");
  admitTaskInput(f.config, {
    appId: "sample",
    attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "ask:original",
    inputContext: { id: "original", source: { kind: "app", id: "caller" }, input: { kind: "work", data: {} } },
  });
  const first = f.claim("work");
  if (first.kind !== "claimed") throw new Error("Expected claim");
  const attempt = f.store.readAttempt(first.attemptId)!;
  attempt.runtimeId = "previous-runtime";
  attempt.sessionId = "old-session";
  attempt.metadata.resourceVersion++;
  f.store.commit({ fences: [{ taskId: "work", resourceVersion: first.resourceVersion }], attempts: [attempt] });
  let drains = 0;
  expect(
    claimObservedAppTask(f.config, {
      taskId: "work",
      appAgent: "executor",
      handler: "agent",
      reason: "attempt-recovery:work",
      recoverPreviousSession: (saved) => {
        expect(saved.sessionId).toBe("old-session");
        drains++;
        return true;
      },
    }),
  ).toMatchObject({ kind: "deferred", funding: { reason: "sponsor-credit" } });
  expect(drains).toBe(1);
  expect(f.store.readAttempt(first.attemptId)!.state).toBe("interrupted");
  expect(f.store.readTask("work")!.status.currentAttemptId).toBeUndefined();
  expect(f.store.readTask("work")!.status.phase).toBe("pending");
  expect(f.store.readTrigger("work")?.events?.some(({ event }) => event.idempotencyKey === "ask:original")).toBe(true);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(f.view("sample", "work")?.rootCharged).toBe(2);
});

test("adoption arriving after failed admission but before the hold cannot be lost", () => {
  const f = fixture();
  const old = f.app("old");
  old.add("retained");
  f.accounting.install({ appId: "old", sponsor: { appId: "old", agent: "owner" }, dailyCredits: 3, rootCredits: 3 });
  const commit = old.store.commit.bind(old.store);
  let adopted = false;
  old.store.commit = (mutation) => {
    try {
      return commit(mutation);
    } catch (error) {
      if (error instanceof TaskBudgetDeferredError && !adopted) {
        adopted = true;
        const task = { appId: "old", taskId: "retained" };
        adoptTaskBudget(f.db, {
          task,
          root: {
            root: task,
            sponsor: { appId: "old", agent: "owner" },
            purpose: "ordinary",
            credits: 3,
            renewal: "lifetime",
          },
          adoptionId: "racing-adoption",
          reason: "Future work",
        });
      }
      throw error;
    }
  };
  expect(old.claim("retained").kind).toBe("deferred");
  expect(old.store.readTask("retained")!.status.funding).toBeUndefined();
  expect(old.store.listRecoveryCandidates().items.map((item) => item.taskId)).toContain("retained");
  expect(old.claim("retained").kind).toBe("claimed");
  expect(f.view("old", "retained")?.rootCharged).toBe(1);
});

test("an unfunded queue head releases Host capacity and lets eligible work proceed without controller errors", async () => {
  const f = fixture(10, 1, [{ taskId: "eligible", credits: 3 }]);
  f.add("unfunded");
  f.add("eligible");
  const capacity = new HostCapacity(1);
  const done = Promise.withResolvers<void>();
  const outcomes: string[] = [];
  const errors: unknown[] = [];
  const controller = new AppTaskController({
    maxConcurrent: 1,
    capacity,
    reconcile: async (taskId) => {
      const result = f.claim(taskId);
      outcomes.push(`${taskId}:${result.kind}`);
      if (result.kind === "claimed") completeAppTask(f.config, result, { summary: "Accepted" });
      if (outcomes.length === 2) done.resolve();
    },
    onError: (_taskId, error) => {
      errors.push(error);
      done.reject(error);
    },
  });
  try {
    controller.enqueue("unfunded");
    controller.enqueue("eligible");
    await done.promise;
    controller.close();
    await controller.whenDrained();
    expect(outcomes).toEqual(["unfunded:deferred", "eligible:claimed"]);
    expect(errors).toEqual([]);
    const release = capacity.tryAcquire();
    expect(release).not.toBeNull();
    release?.();
    expect(f.store.readTask("eligible")!.status.phase).toBe("converged");
    expect(f.store.readTask("unfunded")!.status.executionFailures).toBeUndefined();
  } finally {
    controller.close();
    await controller.whenDrained();
  }
});

test("protected funds cannot sponsor a new ordinary Task or an unvalidated protected attempt", () => {
  const f = fixture();
  const service = f.app("review");
  service.add("coordination");
  const root = { appId: "review", taskId: "coordination" };
  f.accounting.budget.registerRoot({
    root,
    sponsor: { appId: "review", agent: "owner" },
    purpose: "coordination",
    credits: 5,
    renewal: "utc-day",
  });
  expect(() => f.add("business", { appId: "review", taskId: "coordination" })).toThrow("protected-contribution");
  expect(f.store.readTask("business")).toBeNull();
  expect(service.claim("coordination")).toMatchObject({ kind: "deferred", funding: { reason: "protected-policy" } });
  expect(f.view("review", "coordination")?.rootCharged).toBe(0);
});

test("historical adoption wakes only inputs waiting on that exact source account", async () => {
  const f = fixture();
  const old = f.app("old");
  old.add("first");
  old.add("second");
  f.accounting.install({ appId: "old", sponsor: { appId: "old", agent: "owner" }, dailyCredits: 5, rootCredits: 3 });
  const host = new AppInboxHost({
    db: f.db,
    apps: [inboxApp()],
    attachTask: (input) => admitTaskInput(f.config, input),
  });
  for (const id of ["first", "second"])
    createAppInboxItem(f.db, { ...workInput(id), creator: { appId: "old", taskId: id } });
  await host.recoverAdmissions();
  expect(host.get("first")?.handling).toMatchObject({
    phase: "deferred",
    funding: { reason: "adoption-required", root: { appId: "old", taskId: "first" } },
  });
  const task = { appId: "old", taskId: "first" };
  adoptTaskBudget(f.db, {
    task,
    root: {
      root: task,
      sponsor: { appId: "old", agent: "owner" },
      purpose: "ordinary",
      credits: 3,
      renewal: "lifetime",
    },
    adoptionId: "first-adoption",
    reason: "Future work",
  });
  await host.recoverAdmissions();
  expect(host.get("first")?.waitingOn).toEqual({ kind: "task", id: "first" });
  expect(host.get("second")?.handling).toMatchObject({ phase: "deferred", funding: { reason: "adoption-required" } });
  expect(f.view("sample", "first")).toMatchObject({ root: task, rootCharged: 1 });
  expect(f.store.readTask("second")).toBeNull();
  host.close();
});

test("late sponsor installation wakes only the exact policy's deferred input and rolls back its wake with installation", async () => {
  const f = fixture();
  const host = new AppInboxHost({
    db: f.db,
    apps: [inboxApp()],
    attachTask: (input) => admitTaskInput(f.config, input),
  });
  try {
    for (const id of ["late", "unrelated"])
      createAppInboxItem(f.db, { ...workInput(id), creator: { appId: id } });
    await host.recoverAdmissions();
    expect(host.get("late")?.handling).toMatchObject({
      phase: "deferred", funding: { reason: "sponsor-policy", policyAppId: "late", retryAt: null },
    });
    const policy = { appId: "late", sponsor: { appId: "late", agent: "owner" }, dailyCredits: 3, rootCredits: 2 };
    expect(() => stateTransaction(f.db, () => {
      f.accounting.install(policy);
      throw new Error("Installation rolled back");
    })).toThrow("Installation rolled back");
    expect(f.accounting.policy("late")).toBeNull();
    expect(host.get("late")?.handling?.phase).toBe("deferred");
    f.accounting.install(policy);
    expect(host.get("late")?.handling).toBeUndefined();
    await host.recoverAdmissions();
    expect(host.get("late")?.waitingOn).toEqual({ kind: "task", id: "late" });
    expect(f.view("sample", "late")).toMatchObject({ sponsor: policy.sponsor, rootCharged: 1 });
    expect(host.get("unrelated")?.handling).toMatchObject({
      phase: "deferred", funding: { reason: "sponsor-policy", policyAppId: "unrelated" },
    });
    expect(f.store.readTask("unrelated")).toBeNull();
  } finally { host.close(); }
});

for (const renewal of ["indefinite", "utc"] as const) {
  test(`held ${renewal} funding acknowledges an obsolete recovery wake without spending or repeated scheduling`, () => {
    setSystemTime(new Date("2026-11-09T12:00:00Z"));
    const f = fixture(renewal === "utc" ? 1 : 10, renewal === "utc" ? 5 : 1);
    f.add("held");
    const denied = f.claim("held");
    if (denied.kind !== "deferred") throw new Error("Expected funding hold");
    const resource = f.store.readTask("held");
    f.db.prepare("UPDATE app_tasks SET ready = 1, changed = 1, next_check_at = ? WHERE app_id = ? AND task_id = ?")
      .run(Date.now() - 1, "sample", "held");
    expect(f.store.listRecoveryCandidates().items.map((item) => item.taskId)).toContain("held");
    expect(f.claim("held")).toEqual(denied);
    expect(f.store.readTask("held")).toEqual(resource);
    expect(f.store.listRecoveryCandidates().items).toEqual([]);
    expect(f.db.prepare("SELECT next_check_at FROM app_tasks WHERE task_id = 'held'").get()?.next_check_at)
      .toBe(denied.funding.retryAt);
    const changes = f.db.prepare("SELECT total_changes() AS n").get();
    expect(f.claim("held")).toEqual(denied);
    expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(changes);
    expect(f.view("sample", "held")?.rootCharged).toBe(1);
  });
}
