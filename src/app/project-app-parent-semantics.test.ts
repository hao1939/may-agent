import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claimObservedProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  listRunnableProjectAppTaskIds,
  markProjectAppTaskAttention,
  readProjectAppTaskIntent,
  readProjectAppTaskTrigger,
  recordProjectAppTaskTrigger,
  releaseStaleProjectAppTaskResult,
  taskReconciliationConfig,
} from "./project-app-task-reconciler.ts";

const roots: string[] = [];

function fixture() {
  const root = join(tmpdir(), `project-app-parent-semantics-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
  return taskReconciliationConfig({
    appDir,
    projectDir: appDir,
    owner: "app-owner",
    maxConcurrent: 2,
  });
}

function claimChild(config: ReturnType<typeof taskReconciliationConfig>) {
  const claim = claimObservedProjectAppTask(config, {
    taskId: "child",
    appOwner: "app-owner",
    handler: "owner",
    reason: "test",
  });
  if (claim.kind !== "claimed") throw new Error(`expected child claim, got ${claim.kind}`);
  return claim;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("project app parent semantics", () => {
  it("durably wakes an executable parent when its child completes", () => {
    const config = fixture();
    expect(listRunnableProjectAppTaskIds(config)).toEqual(["child"]);
    const result = completeProjectAppTask(config, claimChild(config), {
      summary: "child complete",
      evidence: ["proof"],
    });

    expect(result).toMatchObject({ status: "applied", dependentTaskIds: ["parent"] });
    expect(readProjectAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      taskId: "parent",
      childTaskId: "child",
      disposition: "converged",
    });
    expect(readProjectAppTaskIntent(config, "parent")).not.toBeNull();
    expect(listRunnableProjectAppTaskIds(config)).toEqual(["parent"]);
  });

  it("retries a parent when its child completes while the parent is deciding to wait", () => {
    const config = fixture();
    recordProjectAppTaskTrigger(config, "parent", {
      type: "project.task.tick",
      data: { taskId: "parent", reason: "review-live-child" },
    });
    const parentClaim = claimObservedProjectAppTask(config, {
      taskId: "parent",
      appOwner: "app-owner",
      handler: "owner",
      reason: "test",
    });
    if (parentClaim.kind !== "claimed") throw new Error(`expected parent claim, got ${parentClaim.kind}`);

    completeProjectAppTask(config, claimChild(config), {
      summary: "child completed while parent was running",
      evidence: ["proof"],
    });

    expect(() =>
      deferProjectAppTask(config, parentClaim, {
        disposition: "waiting",
        summary: "waiting on the child observed at attempt start",
        evidence: ["child was running when reviewed"],
      }),
    ).toThrow("Handler action for parent is stale");

    expect(readProjectAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      childTaskId: "child",
      disposition: "converged",
    });
    expect(
      releaseStaleProjectAppTaskResult(config, parentClaim, "Child changed while parent was reconciling"),
    ).toMatchObject({ status: "released" });
    expect(listRunnableProjectAppTaskIds(config)).toEqual(["parent"]);
  });

  it("does not wake a parent merely because its child starts an external wait", () => {
    const config = fixture();
    const result = deferProjectAppTask(config, claimChild(config), {
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
    expect(readProjectAppTaskTrigger(config, "parent")).toBeUndefined();
    expect(readProjectAppTaskIntent(config, "parent")).not.toBeNull();
  });

  it("durably wakes an executable parent when its child needs attention", () => {
    const config = fixture();
    const result = markProjectAppTaskAttention(config, claimChild(config), {
      summary: "child needs parent judgment",
      reason: "handler-blocked",
      evidence: ["child:blocked"],
    });

    expect(result).toEqual({ status: "applied", parentTaskId: "parent" });
    expect(readProjectAppTaskTrigger(config, "parent")).toMatchObject({
      type: "project.task.child-transitioned",
      childTaskId: "child",
      disposition: "attention",
    });
  });
});
