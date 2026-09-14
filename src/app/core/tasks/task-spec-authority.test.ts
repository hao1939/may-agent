import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResourceCreator } from "@may-agent/sdk";
import { appTaskTestContext } from "./app-task-test-support.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  observeAppTaskIntent,
  readAppTaskIntent,
} from "./app-task-reconciler.js";

const cleanups: Array<() => void> = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup()),
);

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "task-spec-authority-"));
  const databasePath = join(root, "state.sqlite");
  const config = appTaskTestContext({
    appDir: root,
    databasePath,
    appId: "sample",
    agent: "worker",
    maxConcurrent: 4,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null } } },
  });
  cleanups.push(() => {
    config.resourceStore.close();
    rmSync(root, { recursive: true, force: true });
  });
  const create = (id: string, creator?: ResourceCreator) =>
    observeAppTaskIntent(config, {
      appAgent: "worker",
      creator,
      intent: { id, parentId: "root", outcome: `Deliver ${id}`, acceptance: ["Verified evidence"] },
    });
  const claim = (taskId: string) => {
    const claim = claimObservedAppTask(config, { taskId, appAgent: "worker", handler: "agent:worker" });
    if (claim.kind !== "claimed") throw new Error(`Expected claim: ${claim.kind}`);
    return claim;
  };
  return {
    config,
    create,
    claim,
    reopen() {
      config.resourceStore.close();
      config.resourceStore = AppTaskResourceStore.openStandalone(databasePath, "sample");
    },
  };
}

test("creator cancellation persists desired stop, rejects late results and does not stop independent work", () => {
  const f = fixture();
  f.create("parent");
  f.create("independent");
  const actor = { appId: "sample", taskId: "parent" };
  f.create("child", actor);
  const running = f.claim("child");
  const resource = f.config.resourceStore.readTask("child")!;
  const input = {
    appId: "sample",
    taskId: "child",
    expectedGeneration: resource.metadata.generation,
    expectedResourceVersion: resource.metadata.resourceVersion,
    reason: "Requirement withdrawn",
    controlKey: "stop-child",
  };
  expect(() => cancelAppTask(f.config, { ...input, actor: { appId: "sample", taskId: "independent" } })).toThrow(
    "recorded creator",
  );
  expect(cancelAppTask(f.config, { ...input, actor }).applied).toBe(true);
  f.reopen();
  expect(f.config.resourceStore.readCancellation("child")).toMatchObject({ reason: input.reason });
  expect(f.config.resourceStore.readCancellation("child")?.decidedBy).toEqual({ kind: "creator", creator: actor });
  expect(cancelAppTask(f.config, { ...input, actor }).applied).toBe(false);
  expect(completeAppTask(f.config, running, { summary: "Late answer" }).status).toBe("stale");
  expect(f.claim("independent").kind).toBe("claimed");
});

test("storage rejects creator replacement and executor identity cannot authorize spec writes", () => {
  const f = fixture();
  f.create("work", { appId: "sample", taskId: "parent" });
  const resource = f.config.resourceStore.readTask("work")!;
  expect(() =>
    observeAppTaskIntent(f.config, {
      appAgent: "worker",
      intent: { ...readAppTaskIntent(f.config, "work")!, acceptance: ["Changed by executor"] },
    }),
  ).toThrow("recorded creator");
  expect(() =>
    f.config.resourceStore.commit({
      fences: [{ taskId: "work", resourceVersion: resource.metadata.resourceVersion }],
      tasks: [
        { resource: { ...resource, metadata: { ...resource.metadata, creator: { appId: "sample" } } }, ready: true },
      ],
    }),
  ).toThrow("creator is immutable");
});
