import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  claimObservedAppTask,
  completeAppTask,
  cancelAppTask,
  deferAppTask,
  listRunnableAppTaskIds,
  markAppTaskAttention,
  readAppTaskTrigger,
  appTaskContext,
} from "./app-task-reconciler.ts";
import { appTaskTestContext } from "./app-task-test-support.js";
import { readTaskSnapshot } from "./app-task-store.js";

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
  return appTaskTestContext({
    appDir,
    agent: "app-owner",
    maxConcurrent: 2,
    databasePath: join(root, "host.sqlite"),
  });
}

function claimChild(config: ReturnType<typeof appTaskContext>) {
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

describe("Task hierarchy is context, not a return protocol", () => {
  it.each(["answer", "failure", "closure"] as const)("does not wake a quiet structural parent on child %s", (kind) => {
    const config = fixture();
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("Structural children must not gate a claim");
    completeAppTask(config, parent, { summary: "No input needs handling" });
    const child = claimChild(config);
    if (kind === "answer") completeAppTask(config, child, { summary: "Child answer", evidence: ["proof"] });
    if (kind === "failure")
      markAppTaskAttention(config, child, { summary: "Provider failed", reason: "handler-blocked" });
    if (kind === "closure") {
      const resource = config.resourceStore.readTask("child")!;
      cancelAppTask(config, {
        appId: "sample",
        taskId: "child",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
        reason: "Owner ended work",
      });
    }
    expect(readAppTaskTrigger(config, "parent")).toBeUndefined();
    expect(listRunnableAppTaskIds(config)).not.toContain("parent");
    expect(readTaskSnapshot(config).resources?.child?.spec.parentId).toBe("parent");
    config.resourceStore.close();
  });

  it("rejects waiting without a Condition even when a child is pending", () => {
    const config = fixture();
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("expected parent claim");
    expect(() => deferAppTask(config, parent, { disposition: "waiting", summary: "Child exists" })).toThrow(
      "requires at least one exact Condition",
    );
    expect(config.resourceStore.readTask("parent")?.status.currentAttemptId).toBe(parent.attemptId);
    config.resourceStore.close();
  });
});
