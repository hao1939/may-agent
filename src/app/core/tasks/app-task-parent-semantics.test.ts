import { afterEach, describe, expect, it } from "bun:test";
import type { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  claimObservedAppTask,
  completeAppTask,
  cancelAppTask,
  deferAppTask,
  listRunnableAppTaskIds,
  failAppTaskAttempt,
  readAppTaskTrigger,
  appTaskContext,
} from "./app-task-reconciler.ts";
import { appTaskTestContext } from "./app-task-test-support.js";
import { readTaskSnapshot } from "./app-task-store.js";

const stores: AppTaskResourceStore[] = [];

function fixture() {
  const config = appTaskTestContext({
    appDir: "/fixture/sample.app",
    agent: "app-owner",
    maxConcurrent: 2,
    databasePath: ":memory:",
    tree: {
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null, owner: "app-owner" } },
      resources: Object.fromEntries(
        ["parent", "child"].map((id) => [
          id,
          {
            metadata: { id, generation: 1, resourceVersion: 1 },
            spec: {
              parentId: id === "parent" ? "root" : "parent",
              outcome: `Finish ${id}`,
              acceptance: ["Verified result"],
            },
            status: {
              observedGeneration: id === "parent" ? 1 : 0,
              phase: id === "parent" ? "waiting" : "pending",
              updatedAt: "2026-07-20T00:00:00.000Z",
            },
          },
        ]),
      ),
    },
  });
  stores.push(config.resourceStore);
  return config;
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
  for (const store of stores.splice(0)) store.close();
});

describe("Task hierarchy is context, not a return protocol", () => {
  it.each(["answer", "failure", "closure"] as const)("does not wake a quiet structural parent on child %s", (kind) => {
    const config = fixture();
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("Structural children must not gate a claim");
    completeAppTask(config, parent, { summary: "No input needs handling" });
    const child = claimChild(config);
    if (kind === "answer") completeAppTask(config, child, { summary: "Child answer", facts: ["proof"] });
    if (kind === "failure")
      failAppTaskAttempt(config, child, "Provider failed", { facts: [], reason: "handler-blocked" });
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
  });

  it("rejects waiting without a Condition even when a child is pending", () => {
    const config = fixture();
    const parent = claimObservedAppTask(config, { taskId: "parent", appAgent: "app-owner", handler: "agent" });
    if (parent.kind !== "claimed") throw new Error("expected parent claim");
    expect(() => deferAppTask(config, parent, { disposition: "waiting", summary: "Child exists" })).toThrow(
      "requires at least one exact Condition",
    );
    expect(config.resourceStore.readTask("parent")?.status.currentAttemptId).toBe(parent.attemptId);
  });
});
