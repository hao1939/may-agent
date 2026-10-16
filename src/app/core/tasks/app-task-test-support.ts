import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { appTaskContext } from "./app-task-reconciler.js";
import { normalizeTaskStateInPlace, type AppTaskContext, type TaskTree } from "./app-task-store.js";

type AppTaskTestContextInput = {
  appDir: string;
  projectDir?: string;
  agent: string;
  maxConcurrent: number;
  appId?: string;
  databasePath?: string;
  resourceStore?: AppTaskResourceStore;
  tree?: TaskTree;
  lifecycle?: "active" | "paused";
};

/** Build a test runtime directly on the same resource authority used in production. */
export function appTaskTestContext(input: AppTaskTestContextInput): AppTaskContext {
  const appId = input.appId ?? "sample";
  let tree = input.tree ? structuredClone(input.tree) : undefined;
  if (!tree) {
    const seedPath = join(input.appDir, "tasks", "seed.json");
    tree = existsSync(seedPath) ? (JSON.parse(readFileSync(seedPath, "utf8")) as TaskTree) : {};
  }
  normalizeTaskStateInPlace(tree);
  tree.project ||= appId;
  tree.project_lifecycle = input.lifecycle ?? (tree.project_lifecycle === "paused" ? "paused" : "active");
  tree.groups ??= {};
  tree.resources ??= {};

  const store = input.resourceStore ??
    AppTaskResourceStore.openStandalone(
      input.databasePath ?? join(input.appDir, `task-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`),
      appId,
    );
  store.bootstrapSnapshot(tree, `test:${Date.now()}:${Math.random().toString(36).slice(2)}`);
  return appTaskContext({
    appDir: input.appDir,
    projectDir: input.projectDir ?? input.appDir,
    agent: input.agent,
    maxConcurrent: input.maxConcurrent,
    resourceStore: store,
  });
}

/** Start a fixture at an elapsed cooldown; the retry timer regression owns real pacing. */
export function makeTaskRetryDue(store: AppTaskResourceStore, taskId: string): number {
  const task = store.readTask(taskId);
  if (!task || !Number.isFinite(task.status.executionRetryAt)) throw new Error(`Expected retry deadline for ${taskId}`);
  const resourceVersion = task.metadata.resourceVersion;
  const due = Date.now() - 1;
  task.status.executionRetryAt = due;
  task.metadata.resourceVersion += 1;
  store.commit({
    fences: [{ taskId, resourceVersion }],
    tasks: [{ resource: task, trigger: store.readTrigger(taskId) ?? undefined, ready: true }],
  });
  return due;
}
