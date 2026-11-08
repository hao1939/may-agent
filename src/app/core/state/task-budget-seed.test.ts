import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { TaskBudgetAdmissionStore } from "./task-budget-admission.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { appTaskConfig, prepareAppTaskRuntimeDescriptors } from "../tasks/runtime-definition.js";
import { appTaskContext, claimObservedAppTask } from "../tasks/app-task-reconciler.js";
import type { TaskTree } from "../tasks/app-task-store.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture(credits = 5) {
  const root = mkdtempSync(join(tmpdir(), "may-budget-seed-"));
  roots.push(root);
  const appDir = join(root, "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  const db = getDb(root);
  const budgets = new TaskBudgetAdmissionStore(db);
  budgets.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "sponsor" },
    dailyCredits: credits,
    rootCredits: 3,
  });
  const tree: TaskTree = {
    project: "sample",
    root_task_id: "root",
    groups: { root: { id: "root", parent_id: null } },
    resources: {
      work: {
        metadata: { id: "work", generation: 1, resourceVersion: 1 },
        spec: { parentId: "root", owner: "executor", outcome: "Deliver the result", acceptance: ["Result accepted"] },
        status: { observedGeneration: 0, phase: "pending", updatedAt: new Date().toISOString() },
      },
    },
  };
  const definition = defineApp({
    id: "sample",
    version: 1,
    agent: "executor",
    tasks: {},
    inputSchema: Type.Object({}),
  });
  const prepare = () => {
    writeFileSync(join(appDir, "tasks", "seed.json"), JSON.stringify(tree));
    return prepareAppTaskRuntimeDescriptors({
      persistDir: root,
      projectsRoot: root,
      appRegistrySnapshot: { id: "seed", generation: 1, entries: [{ appDir, definition }] },
    });
  };
  return { root, appDir, db, budgets, tree, prepare };
}

test("production descriptor bootstrap accounts new seeded Tasks and records App-only provenance once", async () => {
  const f = fixture();
  const first = (await f.prepare())[0]!;
  expect(first.resourceStore.readTask("work")?.metadata.creator).toEqual({ appId: "sample" });
  expect(f.budgets.budget.view({ appId: "sample", taskId: "work" }, Date.now())).toMatchObject({
    rootCharged: 1,
    sponsor: { appId: "sample", agent: "sponsor" },
  });
  await f.prepare();
  expect(f.budgets.budget.view({ appId: "sample", taskId: "work" }, Date.now())?.rootCharged).toBe(1);
  expect(
    claimObservedAppTask(appTaskConfig(first), { taskId: "work", appAgent: "executor", handler: "agent" }).kind,
  ).toBe("claimed");
  expect(f.budgets.budget.view({ appId: "sample", taskId: "work" }, Date.now())?.rootCharged).toBe(2);
});

test("unfunded authored seed activation rolls back every new Task and accounting row", async () => {
  const f = fixture(1);
  f.tree.resources!.second = structuredClone(f.tree.resources!.work);
  f.tree.resources!.second.metadata.id = "second";
  await expect(f.prepare()).rejects.toThrow("sponsor-credit");
  expect(AppTaskResourceStore.activeFromDb(f.db, "sample")).toBeNull();
  expect(f.db.prepare("SELECT count(*) AS n FROM app_tasks WHERE app_id = 'sample'").get()?.n).toBe(0);
  expect(f.budgets.budget.binding({ appId: "sample", taskId: "work" })).toBeNull();
  expect(f.budgets.budget.binding({ appId: "sample", taskId: "second" })).toBeNull();
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_credit_grants").get()?.n).toBe(0);
});

test("retained snapshots keep unknown historical spending explicit instead of creating a new allowance", () => {
  const f = fixture();
  const store = AppTaskResourceStore.fromDb(f.db, "sample");
  store.bootstrapSnapshot(f.tree, "retained-installation-facts");
  expect(f.budgets.budget.binding({ appId: "sample", taskId: "work" })).toBeNull();
  expect(
    claimObservedAppTask(
      appTaskContext({ appDir: f.appDir, projectDir: f.appDir, agent: "executor", resourceStore: store }),
      {
        taskId: "work",
        appAgent: "executor",
        handler: "agent",
      },
    ),
  ).toMatchObject({ kind: "deferred", funding: { reason: "adoption-required" } });
});

test("a new seed cannot forge a funded Task creator or import execution history as freshly funded work", async () => {
  const f = fixture();
  f.tree.resources!.work.metadata.creator = { appId: "foreign", taskId: "caller" };
  await expect(f.prepare()).rejects.toThrow("App-only creator");
  delete f.tree.resources!.work.metadata.creator;
  f.tree.resources!.work.status.observedGeneration = 1;
  f.tree.resources!.work.status.phase = "converged";
  await expect(f.prepare()).rejects.toThrow("execution history");
  expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()?.n).toBe(0);
});
