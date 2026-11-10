import { afterEach, expect, test } from "bun:test";
import { defineApp, Type } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import { claimObservedAppTask, observeAppTaskIntent } from "./app-task-reconciler.js";
import { coordinationTaskIds, isTrustedTaskCoordination } from "./task-coordination.js";
import { readAppContract } from "../reads/app-contract.js";
import type { AppTaskRuntimeDescriptor } from "./runtime-definition.js";

const databases: SqliteDb[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function fixture() {
  const db = openDatabase(":memory:"); databases.push(db); applyDbSchema(db);
  const config = appTaskTestContext({ appDir: "/tmp/coordination/sample.app", appId: "sample", agent: "owner", maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.fromDb(db, "sample"), tree: { groups: { root: { id: "root", owner: "owner" } } } });
  const coordination = { taskId: "runtime/workload-review", workflow: "workload-review", maxAttemptMs: 60_000 };
  const app = defineApp({ id: "sample", version: 1, agent: "owner", inputSchema: Type.Object({}), tasks: { coordination } });
  const descriptor: AppTaskRuntimeDescriptor = { id: "sample", app, agent: "owner", appDir: config.appDir, projectDir: config.projectDir, reconciliationPaused: false, resourceStore: config.resourceStore };
  const intent = { id: coordination.taskId, parentId: "root", outcome: "Review useful work within existing authority", acceptance: ["Preserve obligations"], workflow: coordination.workflow };
  observeAppTaskIntent(config, { intent, appAgent: "owner", creator: { appId: "sample" } });
  return { config, descriptor, intent };
}

test("only the exact installed App-created owner workflow receives coordination eligibility", () => {
  const f = fixture();
  const task = f.config.resourceStore.readTask(f.intent.id)!;
  expect(isTrustedTaskCoordination(f.descriptor, task, "owner")).toBe(true);
  expect(coordinationTaskIds(f.descriptor)).toEqual(new Set([f.intent.id]));
  expect(readAppContract(f.descriptor.app).taskPolicy?.coordination).toEqual(f.descriptor.app.tasks!.coordination);
  for (const invalid of [
    { ...task, metadata: { ...task.metadata, creator: undefined } },
    { ...task, metadata: { ...task.metadata, creator: { appId: "sample", taskId: "caller" } } },
    { ...task, metadata: { ...task.metadata, creator: { appId: "other" } } },
    { ...task, metadata: { ...task.metadata, id: "ordinary" } },
    { ...task, spec: { ...task.spec, workflow: "business" } },
    { ...task, spec: { ...task.spec, executor: "agent" } },
  ]) expect(isTrustedTaskCoordination(f.descriptor, invalid, "owner")).toBe(false);
  expect(isTrustedTaskCoordination(f.descriptor, task, "another-agent")).toBe(false);
  f.config.resourceStore.setProjectLifecycle("paused");
  expect(coordinationTaskIds(f.descriptor).size).toBe(0);
});

test("a changed coordination assignment cannot use a previously selected reserve dispatch", () => {
  const f = fixture();
  expect(coordinationTaskIds(f.descriptor).size).toBe(1);
  observeAppTaskIntent(f.config, { intent: { ...f.intent, workflow: "business" }, appAgent: "owner" });
  // A legacy row would otherwise receive a failure-counter adoption write
  // before discovering that this dispatch has no reserve authority.
  f.config.resourceStore.db.prepare(`UPDATE app_tasks SET resource_json = json_remove(
    resource_json, '$.status.executionFailureAttemptId') WHERE app_id = ? AND task_id = ?`).run("sample", f.intent.id);
  const before = f.config.resourceStore.readTask(f.intent.id)!;
  const guarded = claimObservedAppTask(f.config, { taskId: f.intent.id, appAgent: "owner", handler: "auto",
    canUseCoordinationReserve: (task, agent) => isTrustedTaskCoordination(f.descriptor, task, agent) });
  expect(guarded.kind).toBe("waiting");
  expect(f.config.resourceStore.readTask(f.intent.id)).toEqual(before);
  const ordinary = claimObservedAppTask(f.config, { taskId: f.intent.id, appAgent: "owner", handler: "auto" });
  expect(ordinary.kind).toBe("claimed");
});
