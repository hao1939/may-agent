import { afterEach, describe, expect, it } from "bun:test";
import {
  cancelAppTask,
  claimObservedAppTask,
  markAppTaskAttention,
  observeAppTaskIntent,
  retryFailedAppTask,
} from "../../app-task-reconciler.js";
import { appTaskTestContext } from "../../app-task-test-support.js";
import type { AppTaskResourceStore } from "../../app-task-resource-store.js";
import { recoverUnavailableTaskHandlers } from "./handler-recovery.js";

const stores: AppTaskResourceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

function fixture(handler = "executor:fixture") {
  const config = appTaskTestContext({
    appDir: "/fixture/sample.app",
    agent: "owner",
    maxConcurrent: 1,
    databasePath: ":memory:",
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, agent: "owner" } } },
  });
  stores.push(config.resourceStore);
  const intent = {
    id: "work",
    parentId: "root",
    outcome: "Verify the work",
    acceptance: ["Verified"],
    ...(handler.startsWith("workflow:") ? { workflow: handler.slice(9) } : { executor: "fixture" }),
  };
  observeAppTaskIntent(config, { intent, appAgent: "owner" });
  const fail = (reason = "HandlerUnavailable") => {
    const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler });
    if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${claim.kind}`);
    expect(markAppTaskAttention(config, claim, { reason, summary: "Backend unavailable" }).status).toBe("applied");
    return claim;
  };
  return { config, intent, fail, store: config.resourceStore };
}

describe("unavailable Task handler recovery", () => {
  it.each(["executor:fixture", "workflow:fixture"])("rechecks %s without a concrete backend", async (handler) => {
    const { config, store, fail } = fixture(handler);
    const claim = fail();
    const before = store.readTaskContext({ taskIds: ["work"] });
    let available = false;
    const recovered: string[] = [];
    const recover = () =>
      recoverUnavailableTaskHandlers({
        config,
        isCurrent: () => true,
        isAvailable: async (candidate) => {
          expect(candidate).toMatchObject({
            taskId: "work",
            handler,
            attemptId: claim.attemptId,
            generation: claim.generation,
          });
          return available;
        },
        onRecovered: (candidate) => recovered.push(candidate.taskId),
      });
    await recover();
    expect(store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
    available = true;
    await recover();
    await recover();
    expect(recovered).toEqual(["work"]);
    expect(store.readTask("work")).toMatchObject({
      metadata: { generation: claim.generation },
      status: { phase: "pending" },
    });
    expect(store.readAttempt(claim.attemptId)?.failureReason).toBe("HandlerUnavailable");
  });

  it.each(["generation", "attempt", "cancel", "pause", "definition"])(
    "discards a stale check after %s changes",
    async (change) => {
      const { config, store, intent, fail } = fixture();
      fail();
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<boolean>();
      let current = true;
      const recovered: string[] = [];
      const pass = recoverUnavailableTaskHandlers({
        config,
        isCurrent: () => current,
        isAvailable: async () => {
          started.resolve();
          return release.promise;
        },
        onRecovered: (candidate) => recovered.push(candidate.taskId),
      });
      await started.promise;
      const task = store.readTask("work")!;
      switch (change) {
        case "generation":
          observeAppTaskIntent(config, { intent: { ...intent, outcome: "A revised outcome" }, appAgent: "owner" });
          fail();
          break;
        case "attempt":
          retryFailedAppTask(config, {
            appId: "sample",
            taskId: "work",
            expectedGeneration: task.metadata.generation,
            expectedResourceVersion: task.metadata.resourceVersion,
          });
          fail();
          break;
        case "cancel":
          cancelAppTask(config, {
            appId: "sample",
            taskId: "work",
            expectedGeneration: task.metadata.generation,
            expectedResourceVersion: task.metadata.resourceVersion,
            reason: "No longer needed",
          });
          break;
        case "pause":
          store.setProjectLifecycle("paused");
          break;
        case "definition":
          current = false;
          break;
      }
      const before = store.readTaskContext({ taskIds: ["work"] });
      release.resolve(true);
      await pass;
      expect(recovered).toEqual([]);
      expect(store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
    },
  );

  it("does not release execution failures merely because a handler is installed", async () => {
    const { config, store, fail } = fixture();
    fail("HandlerExecutionFailed");
    const before = store.readTaskContext({ taskIds: ["work"] });
    await recoverUnavailableTaskHandlers({
      config,
      isCurrent: () => true,
      isAvailable: async () => {
        throw new Error("Must not inspect an execution failure");
      },
      onRecovered: () => {
        throw new Error("Must not release an execution failure");
      },
    });
    expect(store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
  });
});
