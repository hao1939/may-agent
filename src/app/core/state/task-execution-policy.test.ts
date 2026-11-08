import { afterEach, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { TaskBudgetAdmissionStore, TaskBudgetDeferredError } from "./task-budget-admission.js";
import { TaskExecutionStore } from "./task-execution-store.js";
import { installTaskExecutionLimit } from "./task-execution-admission.js";
import { appTaskContext, observeAppTaskIntent, claimObservedAppTask } from "../tasks/app-task-reconciler.js";

const databases: SqliteDb[] = [];
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});
const recipient = { kind: "programmatic" as const, id: "fixture/owner" };
function fixture(dailyCredits = 20, rootExecutionSlots: number | null = 1) {
  const db = openDatabase(":memory:");
  databases.push(db);
  applyDbSchema(db);
  const budgets = new TaskBudgetAdmissionStore(db);
  const configs = new Map(
    ["source", "receiver"].map((appId) => {
      const tasks = AppTaskResourceStore.fromDb(db, appId);
      tasks.bootstrapSnapshot({ project: appId, groups: { root: { id: "root", parent_id: null } } }, "seed");
      return [
        appId,
        appTaskContext({
          appDir: `/fixture/${appId}.app`,
          projectDir: "/fixture",
          agent: "owner",
          maxConcurrent: 4,
          resourceStore: tasks,
        }),
      ];
    }),
  );
  for (const appId of ["source", "receiver"])
    budgets.install({
      appId,
      sponsor: { appId, agent: "owner" },
      dailyCredits,
      rootCredits: 20,
      ...(rootExecutionSlots === null ? {} : { rootExecutionSlots: appId === "source" ? rootExecutionSlots : 3 }),
    });
  installTaskExecutionLimit(db, { kind: "host" }, 6);
  installTaskExecutionLimit(db, { kind: "agent", recipient }, 6);
  const executions = new TaskExecutionStore(db);
  const add = (appId: string, taskId: string, creator?: { appId: string; taskId?: string }) =>
    observeAppTaskIntent(configs.get(appId)!, {
      appAgent: "owner",
      ...(creator ? { creator } : {}),
      intent: {
        id: taskId,
        parentId: "root",
        outcome: "Collect facts",
        acceptance: ["Facts retained"],
        executor: "inspect",
      },
    });
  const claim = (appId: string, taskId: string) =>
    claimObservedAppTask(configs.get(appId)!, {
      taskId,
      appAgent: "owner",
      handler: "auto",
      execution: { recipient: () => recipient, lane: "background" },
    });
  return { db, budgets, configs, executions, add, claim };
}

test("trusted source policy provisions a new root atomically and contributions keep that root's cap", () => {
  const f = fixture();
  const root = { appId: "source", taskId: "work" };
  f.add("source", "work");
  expect(f.executions.usage({ kind: "root", root }).limit).toBe(1);
  expect(f.claim("source", "work").kind).toBe("claimed");
  f.add("receiver", "contribution", root);
  expect(f.budgets.budget.binding({ appId: "receiver", taskId: "contribution" })).toEqual(root);
  expect(f.claim("receiver", "contribution")).toMatchObject({
    kind: "deferred",
    execution: { scope: { kind: "root", root } },
  });
  expect(f.executions.usage({ kind: "root", root: { appId: "receiver", taskId: "contribution" } }).limit).toBeNull();
  f.add("source", "work");
  expect(f.executions.usage({ kind: "root", root })).toEqual({ limit: 1, occupied: 1 });
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(3);
});

test("an App-created root in another App uses its creator's installed default rather than its executor's", () => {
  const f = fixture();
  f.add("receiver", "external", { appId: "source" });
  const root = { appId: "receiver", taskId: "external" };
  expect(f.budgets.budget.view(root, Date.now())?.sponsor).toEqual({ appId: "source", agent: "owner" });
  expect(f.executions.usage({ kind: "root", root }).limit).toBe(1);
});

test("an explicit root limit wins over the installed creation default", () => {
  const f = fixture();
  const root = { appId: "source", taskId: "work" };
  installTaskExecutionLimit(f.db, { kind: "root", root }, 2);
  f.add("source", "work");
  expect(f.executions.usage({ kind: "root", root }).limit).toBe(2);
});

test("a failed creation rolls back its root execution limit together with its binding and credit admission", () => {
  const f = fixture(0);
  const root = { appId: "source", taskId: "work" };
  expect(() => f.add("source", "work")).toThrow(TaskBudgetDeferredError);
  expect(f.configs.get("source")!.resourceStore.readTask("work")).toBeNull();
  expect(f.budgets.budget.binding(root)).toBeNull();
  expect(f.executions.usage({ kind: "root", root }).limit).toBeNull();
});

test("omitting the default preserves explicit configuration and fails closed at execution", () => {
  const f = fixture(20, null);
  f.add("source", "work");
  const root = { appId: "source", taskId: "work" };
  expect(f.executions.usage({ kind: "root", root }).limit).toBeNull();
  expect(f.claim("source", "work")).toMatchObject({
    kind: "deferred",
    execution: { reason: "execution-policy", scope: { kind: "root", root } },
  });
  expect(f.budgets.budget.view(root, Date.now())?.rootCharged).toBe(1);
});

test("installing a creation default does not silently adopt retained historical Tasks", () => {
  const f = fixture();
  const tasks = AppTaskResourceStore.fromDb(f.db, "retained");
  tasks.bootstrapSnapshot(
    {
      project: "retained",
      resources: {
        work: {
          metadata: { id: "work", generation: 1, resourceVersion: 1 },
          spec: { outcome: "Collect facts", acceptance: ["Facts retained"] },
          status: { observedGeneration: 0, phase: "pending", updatedAt: new Date().toISOString() },
        },
      },
    },
    "retained-facts",
  );
  f.budgets.install({
    appId: "retained",
    sponsor: { appId: "retained", agent: "owner" },
    dailyCredits: 20,
    rootCredits: 20,
    rootExecutionSlots: 2,
  });
  const root = { appId: "retained", taskId: "work" };
  expect(
    claimObservedAppTask(
      appTaskContext({ appDir: "/fixture/retained.app", projectDir: "/fixture", agent: "owner", resourceStore: tasks }),
      {
        taskId: "work",
        appAgent: "owner",
        handler: "auto",
        execution: { recipient: () => recipient, lane: "background" },
      },
    ),
  ).toMatchObject({ kind: "deferred", funding: { reason: "adoption-required" } });
  expect(f.budgets.budget.binding(root)).toBeNull();
  expect(f.executions.usage({ kind: "root", root }).limit).toBeNull();
});

test("invalid execution defaults are rejected before installing any policy", () => {
  const f = fixture();
  for (const rootExecutionSlots of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() =>
      f.budgets.install({
        appId: "invalid",
        sponsor: { appId: "invalid", agent: "owner" },
        dailyCredits: 20,
        rootCredits: 20,
        rootExecutionSlots,
      }),
    ).toThrow("positive safe integers");
    expect(f.budgets.policy("invalid")).toBeNull();
  }
});
