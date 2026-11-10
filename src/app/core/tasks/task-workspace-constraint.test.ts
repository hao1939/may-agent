import { afterEach, expect, test } from "bun:test";
import { appTaskTestContext } from "./app-task-test-support.js";
import { cancelAppTask, claimObservedAppTask, completeAppTask, deferAppTaskExecution, observeAppTaskIntent,
  recordAppTaskTrigger, refreshTaskWorkspaceConstraint } from "./app-task-reconciler.js";
import type { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import type { TaskWorkspaceConstraint } from "./workspace.js";
import { readTaskWorkload } from "../reads/task-workload.js";

const stores: AppTaskResourceStore[] = [];
afterEach(() => stores.splice(0).forEach(store => store.close()));

function fixture() {
  const config = appTaskTestContext({ appDir: "/tmp/workspace-constraint-fixture", appId: "sample",
    databasePath: ":memory:", agent: "owner", maxConcurrent: 2,
    tree: { groups: { root: { id: "root" } } } });
  const store = config.resourceStore;
  stores.push(store);
  const intent = { id: "work", parentId: "root", outcome: "Verify the change", acceptance: ["Checks pass"] };
  observeAppTaskIntent(config, { appAgent: "owner", intent });
  recordAppTaskTrigger(config, "work", { type: "fixture.input", eventId: 1, data: {} });
  const claim = () => claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "fixture" });
  const started = claim();
  if (started.kind !== "claimed") throw new Error(started.kind);
  const constraint: TaskWorkspaceConstraint = { resource: "workspace", reason: "workspace-capacity", generation: 1,
    repoDir: "/tmp/workspace-constraint-fixture/repo", destinationPath: "/tmp/workspace-constraint-fixture/worktrees/work",
    commit: "a".repeat(40), availableBytes: 0, requiredBytes: 4096, observedAt: Date.now(), retryAt: Date.now() + 60_000 };
  expect(deferAppTaskExecution(config, started, constraint)).toBe("applied");
  const resource = store.readTask("work")!;
  const expected = { taskId: "work", generation: resource.metadata.generation, resourceVersion: resource.metadata.resourceVersion };
  return { config, store, intent, claim, expected, constraint };
}

test("a delayed capacity observation cannot clear a new input or revive a cancelled assignment", () => {
  const f = fixture();
  recordAppTaskTrigger(f.config, "work", { type: "fixture.correction", eventId: 2, data: {} });
  const retained = f.store.readTask("work");
  const trigger = f.store.readTrigger("work");
  expect(refreshTaskWorkspaceConstraint(f.config, f.expected, undefined)).toBe(false);
  expect(f.store.readTask("work")).toEqual(retained);
  expect(f.store.readTrigger("work")).toEqual(trigger);
  expect(f.claim()).toMatchObject({ kind: "deferred", workspace: { reason: "workspace-capacity" } });

  const g = fixture();
  cancelAppTask(g.config, { taskId: "work", appId: "sample", expectedGeneration: g.expected.generation,
    expectedResourceVersion: g.expected.resourceVersion, reason: "Creator withdrew this assignment" });
  const ended = g.store.readTask("work");
  expect(refreshTaskWorkspaceConstraint(g.config, g.expected, undefined)).toBe(false);
  expect(g.store.readTask("work")).toEqual(ended);
  expect(g.claim().kind).toBe("completed");
});

test("a revised method does not inherit the obsolete checkout constraint", () => {
  const f = fixture();
  observeAppTaskIntent(f.config, { appAgent: "owner", intent: { ...f.intent, outcome: "Review existing evidence in shared workspace" } });
  expect(f.store.readTask("work")?.metadata.generation).toBe(2);
  expect(refreshTaskWorkspaceConstraint(f.config, f.expected, undefined)).toBe(false);
  expect(f.claim().kind).toBe("claimed");
  expect(f.store.readTask("work")?.status.workspaceConstraint).toBeUndefined();
});

test("refresh and recovery scheduling share the canonical resource fence and input", () => {
  const f = fixture();
  const input = f.store.readTrigger("work");
  const refreshed = { ...f.constraint, retryAt: f.constraint.retryAt + 60_000 };
  expect(refreshTaskWorkspaceConstraint(f.config, f.expected, refreshed)).toBe(true);
  expect(refreshTaskWorkspaceConstraint(f.config, f.expected, undefined)).toBe(false);
  expect(f.store.readTrigger("work")).toEqual(input);
  expect(f.store.db.prepare("SELECT ready, next_check_at FROM app_tasks WHERE task_id = 'work'").get())
    .toEqual({ ready: 0, next_check_at: refreshed.retryAt });
  const resource = f.store.readTask("work")!;
  expect(refreshTaskWorkspaceConstraint(f.config, { ...f.expected, resourceVersion: resource.metadata.resourceVersion }, undefined)).toBe(true);
  expect(f.store.db.prepare("SELECT ready FROM app_tasks WHERE task_id = 'work'").get()?.ready).toBe(1);
  expect(f.store.readTrigger("work")).toEqual(input);
  expect(f.claim().kind).toBe("claimed");
});

test("preclaim observations cannot pay for changed requirements or newly admitted input", () => {
  const f = fixture();
  expect(refreshTaskWorkspaceConstraint(f.config, f.expected, undefined)).toBe(true);
  const observed = f.store.readTask("work")!;
  const expectedResource = { generation: observed.metadata.generation, resourceVersion: observed.metadata.resourceVersion };
  recordAppTaskTrigger(f.config, "work", { type: "fixture.correction", eventId: 2, data: {} });
  const before = f.store.readTask("work");
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "fixture", expectedResource }))
    .toMatchObject({ kind: "stale" });
  expect(f.store.readTask("work")).toEqual(before);
  expect(f.store.readTrigger("work")?.events).toHaveLength(2);
  expect(f.store.db.prepare("SELECT count(*) AS n FROM app_task_attempts WHERE task_id = 'work'").get()?.n).toBe(1);
  expect(f.claim().kind).toBe("claimed");
});

test("a known prerequisite on new input preserves the prior result and reports waiting demand", () => {
  const f = fixture();
  refreshTaskWorkspaceConstraint(f.config, f.expected, undefined);
  const claim = f.claim();
  if (claim.kind !== "claimed") throw new Error(claim.kind);
  completeAppTask(f.config, claim, { summary: "Original input answered" });
  recordAppTaskTrigger(f.config, "work", { type: "fixture.more-input", eventId: 3, data: {} });
  const task = f.store.readTask("work")!;
  expect(refreshTaskWorkspaceConstraint(f.config, { taskId: "work", generation: task.metadata.generation,
    resourceVersion: task.metadata.resourceVersion }, f.constraint)).toBe(true);
  expect(f.store.readTask("work")?.status).toMatchObject({ phase: "pending", observedAttemptId: claim.attemptId });
  expect(readTaskWorkload({ taskStateConfig: f.config }).counts).toMatchObject({ waiting: 1, idle: 0, pendingInputTasks: 1 });
  expect(f.store.readAttempt(claim.attemptId)?.acceptedResult?.summary).toBe("Original input answered");
});
