import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
  cancelAppTask,
  claimObservedAppTask,
  markAppTaskAttention,
  observeAppTaskIntent,
  retryFailedAppTask,
} from "../../app-task-reconciler.js";
import { appTaskTestContext } from "../../app-task-test-support.js";
import { AppTaskResourceStore } from "../../app-task-resource-store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  it("preserves unavailable work when another connection pauses immediately before commit", async () => {
    const { config: seed, fail } = fixture();
    fail();
    const root = mkdtempSync(join(tmpdir(), "may-handler-pause-"));
    const path = join(root, "tasks.sqlite");
    const store = AppTaskResourceStore.openStandalone(path, "sample");
    store.bootstrapSnapshot(seed.resourceStore.readSnapshot(), "fixture");
    const other = AppTaskResourceStore.openStandalone(path, "sample");
    const recovered: string[] = [];
    const commit = store.commit.bind(store);
    const interleave = spyOn(store, "commit").mockImplementationOnce((mutation) => {
      other.setProjectLifecycle("paused");
      return commit(mutation);
    });
    try {
      const before = store.readTaskContext({ taskIds: ["work"] });
      const recover = () =>
        recoverUnavailableTaskHandlers({
          config: { ...seed, resourceStore: store },
          isCurrent: () => true,
          isAvailable: async () => true,
          onRecovered: (candidate) => recovered.push(candidate.taskId),
        });
      await recover();
      expect(interleave).toHaveBeenCalledTimes(1);
      expect(other.projectLifecycle()).toBe("paused");
      expect(store.readTaskContext({ taskIds: ["work"] }).resources).toEqual(before.resources);
      expect(store.readTaskContext({ taskIds: ["work"] }).attempts).toEqual(before.attempts);
      expect(recovered).toEqual([]);
      interleave.mockRestore();
      other.setProjectLifecycle("active");
      await recover();
      expect(store.readTask("work")?.status.phase).toBe("pending");
      expect(recovered).toEqual(["work"]);
    } finally {
      interleave.mockRestore();
      other.close();
      store.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reaches restored handlers beyond the first page across recovery restarts", async () => {
    const { config: seed, fail } = fixture();
    const claim = fail();
    const tree = seed.resourceStore.readTaskContext({ taskIds: ["work"] });
    const original = tree.resources!.work!;
    const failed = tree.attempts![claim.attemptId]!;
    for (let index = 0; index < 512; index++) {
      const taskId = `blocked/${String(index).padStart(4, "0")}`;
      const attemptId = `attempt-${index}`;
      tree.resources![taskId] = {
        ...structuredClone(original),
        metadata: { ...original.metadata, id: taskId },
        status: { ...original.status, updatedAt: "2026-01-01T00:00:00.000Z" },
      };
      tree.attempts![attemptId] = {
        ...structuredClone(failed),
        metadata: { ...failed.metadata, id: attemptId },
        taskId,
        handler: "executor:missing",
      };
    }
    const root = mkdtempSync(join(tmpdir(), "may-handler-pages-"));
    const path = join(root, "tasks.sqlite");
    let store = AppTaskResourceStore.openStandalone(path, "sample");
    try {
      store.bootstrapSnapshot(tree, "fixture");
      const recover = (inspected: string[]) =>
        recoverUnavailableTaskHandlers({
          config: { ...seed, resourceStore: store },
          isCurrent: () => true,
          isAvailable: async (candidate) => {
            inspected.push(candidate.taskId);
            return candidate.handler === "executor:fixture";
          },
          onRecovered: () => {},
        });
      const first: string[] = [];
      await recover(first);
      expect(first).toHaveLength(512);
      expect(store.readTask("work")?.status.phase).toBe("attention");
      store.close();
      store = AppTaskResourceStore.openStandalone(path, "sample");
      const second: string[] = [];
      await recover(second);
      expect(second).toEqual(["work"]);
      expect(store.readTask("work")?.status.phase).toBe("pending");
      expect(store.readAttempt(claim.attemptId)).toEqual(failed);
      const wrapped: string[] = [];
      await recover(wrapped);
      expect(wrapped).toEqual(first);
    } finally {
      store.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

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
