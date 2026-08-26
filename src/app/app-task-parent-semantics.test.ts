import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  listRunnableAppTaskIds,
  markAppTaskAttention,
  readAppTaskIntent,
  readAppTaskTrigger,
  recordAppTaskTrigger,
  releaseStaleAppTaskResult,
  taskReconciliationConfig,
} from "./app-task-reconciler.ts";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { legacyTaskStateConfig, readTaskState } from "./app-task-store.js";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `app-task-parent-semantics-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const appDir = join(root, "projects", "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    `${JSON.stringify(
      {
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null, owner: "app-owner" },
        },
        resources: {
          parent: {
            metadata: { id: "parent", generation: 1, resourceVersion: 1 },
            spec: {
              parentId: "root",
              outcome: "Keep the parent responsibility healthy",
              acceptance: ["The parent is healthy"],
              mode: "maintain",
            },
            status: {
              observedGeneration: 1,
              phase: "waiting",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
          child: {
            metadata: { id: "child", generation: 1, resourceVersion: 1 },
            spec: {
              parentId: "parent",
              outcome: "Finish one bounded child",
              acceptance: ["The child is finished"],
              mode: "achieve",
            },
            status: {
              observedGeneration: 0,
              phase: "pending",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  const legacyConfig = legacyTaskStateConfig({
    appDir,
    projectDir: appDir,
    worker: "app-owner",
    maxConcurrent: 2,
  });
  const tree = readTaskState(legacyConfig);
  tree.project = "sample";
  tree.project_lifecycle = "active";
  const resourceStore = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "sample");
  resourceStore.bootstrapSnapshot(tree, "parent-semantics");
  return taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    agent: "app-owner",
    maxConcurrent: 2,
    resourceStore,
  });
}

function claimChild(config: ReturnType<typeof taskReconciliationConfig>) {
  const claim = claimObservedAppTask(config, {
    taskId: "child",
    appAgent: "app-owner",
    handler: "agent",
    reason: "test",
  });
  if (claim.kind !== "claimed") throw new Error(`expected child claim, got ${claim.kind}`);
  return claim;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("App task parent semantics", () => {
  it("durably wakes an executable parent when its child completes", () => {
    const config = fixture();
    expect(listRunnableAppTaskIds(config)).toEqual(["child"]);
    const result = completeAppTask(config, claimChild(config), {
      summary: "child complete",
      evidence: ["proof"],
    });

    expect(result).toMatchObject({ status: "applied", dependentTaskIds: ["parent"] });
    expect(readAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      taskId: "parent",
      childTaskId: "child",
      disposition: "converged",
    });
    expect(readAppTaskIntent(config, "parent")).not.toBeNull();
    expect(listRunnableAppTaskIds(config)).toEqual(["parent"]);
  });

  it("keeps a maintain parent nonterminal while its required child is live", () => {
    const config = fixture();
    recordAppTaskTrigger(config, "parent", {
      type: "project.task.tick",
      data: { taskId: "parent", reason: "review-live-child" },
    });
    const parentClaim = claimObservedAppTask(config, {
      taskId: "parent",
      appAgent: "app-owner",
      handler: "agent",
      reason: "test",
    });
    if (parentClaim.kind !== "claimed") throw new Error(`expected parent claim, got ${parentClaim.kind}`);

    expect(
      completeAppTask(config, parentClaim, {
        summary: "review identified required child work",
        evidence: ["task:child remains pending"],
      }),
    ).toMatchObject({ status: "applied", taskContinues: true });
    expect(readAppTaskIntent(config, "parent")).not.toBeNull();
    const parentStatus = readTaskState(config).resources?.parent?.status;
    expect(parentStatus).toMatchObject({ phase: "waiting" });
    expect(parentStatus).not.toHaveProperty("currentAttemptId");
    expect(listRunnableAppTaskIds(config)).toEqual(["child"]);

    completeAppTask(config, claimChild(config), {
      summary: "required child complete",
      evidence: ["artifact:repair", "test:regression", "metric:remeasured"],
    });
    expect(readAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      childTaskId: "child",
      disposition: "converged",
    });
    expect(listRunnableAppTaskIds(config)).toEqual(["parent"]);
  });

  it("retries a parent when its child completes while the parent is deciding to wait", () => {
    const config = fixture();
    recordAppTaskTrigger(config, "parent", {
      type: "project.task.tick",
      data: { taskId: "parent", reason: "review-live-child" },
    });
    const parentClaim = claimObservedAppTask(config, {
      taskId: "parent",
      appAgent: "app-owner",
      handler: "agent",
      reason: "test",
    });
    if (parentClaim.kind !== "claimed") throw new Error(`expected parent claim, got ${parentClaim.kind}`);

    completeAppTask(config, claimChild(config), {
      summary: "child completed while parent was running",
      evidence: ["proof"],
    });

    expect(() =>
      deferAppTask(config, parentClaim, {
        disposition: "waiting",
        summary: "waiting on the child observed at attempt start",
        evidence: ["child was running when reviewed"],
      }),
    ).toThrow("Handler action for parent is stale");

    expect(readAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      childTaskId: "child",
      disposition: "converged",
    });
    expect(releaseStaleAppTaskResult(config, parentClaim, "Child changed while parent was reconciling")).toMatchObject({
      status: "released",
    });
    expect(listRunnableAppTaskIds(config)).toEqual(["parent"]);
  });

  it("does not wake a parent merely because its child starts an external wait", () => {
    const config = fixture();
    const result = deferAppTask(config, claimChild(config), {
      disposition: "waiting",
      summary: "waiting for exact child evidence",
      evidence: ["wait registered"],
      conditions: [
        {
          id: "child-proof",
          type: "sample.child.observed",
          subject: "task:child",
          expected: "done",
        },
      ],
    });

    expect(result).toMatchObject({ status: "applied", reconcileTaskIds: [] });
    expect(readAppTaskTrigger(config, "parent")).toBeUndefined();
    expect(readAppTaskIntent(config, "parent")).not.toBeNull();
  });

  it("durably wakes an executable parent when its child needs attention", () => {
    const config = fixture();
    const result = markAppTaskAttention(config, claimChild(config), {
      summary: "child needs parent judgment",
      reason: "handler-blocked",
      evidence: ["child:blocked"],
    });

    expect(result).toEqual({ status: "applied", parentTaskId: "parent" });
    expect(readAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      childTaskId: "child",
      disposition: "attention",
    });
  });
});
