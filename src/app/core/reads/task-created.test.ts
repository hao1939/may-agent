import { afterEach, expect, test } from "bun:test";
import type { ResourceCreator } from "@may-agent/sdk";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  appTaskContext,
  observeAppTaskIntent,
  claimObservedAppTask,
  completeAppTask,
  recordAppTaskTrigger,
  cancelAppTask,
} from "../tasks/app-task-reconciler.js";
import { readCreatedTasks } from "./task-created.js";

const stores: AppTaskResourceStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

function fixture() {
  const ownerStore = AppTaskResourceStore.openStandalone(":memory:", "owner");
  stores.push(ownerStore);
  const config = (appId: string) => {
    const store = appId === "owner" ? ownerStore : AppTaskResourceStore.fromDb(ownerStore.db, appId);
    store.bootstrapSnapshot(
      {
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null },
          research: { id: "research", parent_id: "root" },
        },
      },
      "seed",
    );
    return appTaskContext({
      appDir: `/fixture/${appId}.app`,
      projectDir: "/fixture",
      agent: "worker",
      maxConcurrent: 4,
      resourceStore: store,
    });
  };
  const owner = config("owner"),
    worker = config("worker");
  const creator = { appId: "owner", taskId: "research" };
  const add = (ctx: typeof owner, id: string, by: ResourceCreator = creator, parentId = "root") =>
    observeAppTaskIntent(ctx, {
      appAgent: "worker",
      creator: by,
      intent: { id, parentId, outcome: "Read the exact source. ".repeat(100), acceptance: ["Evidence retained"] },
    });
  const accept = (ctx: typeof owner, taskId: string) => {
    const claim = claimObservedAppTask(ctx, { taskId, appAgent: "worker", handler: "auto" });
    if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${JSON.stringify(claim)}`);
    completeAppTask(ctx, claim, { summary: "Verified publication", facts: ["publication:verified"] });
    return claim;
  };
  return {
    owner,
    worker,
    creator,
    add,
    accept,
    read: (options?: Parameters<typeof readCreatedTasks>[2]) => readCreatedTasks(ownerStore.db, creator, options),
  };
}

test("creator discovery includes returned idle work outside the grouping parent and App, without changing state", () => {
  const f = fixture();
  f.add(f.owner, "research"); // Self cannot be a closure candidate, even in damaged/legacy attribution.
  f.add(f.owner, "result");
  f.add(f.worker, "result"); // Same Task id in another App must remain distinct.
  const accepted = f.accept(f.worker, "result");
  f.add(f.worker, "structural-only", { appId: "other", taskId: "research" }, "research");
  f.add(f.worker, "other-task", { appId: "owner", taskId: "other" });
  f.add(f.worker, "app-created", { appId: "owner" });
  f.add(f.worker, "ended");
  const ended = f.worker.resourceStore.readTask("ended")!;
  cancelAppTask(f.worker, {
    appId: "worker",
    taskId: "ended",
    expectedGeneration: 1,
    expectedResourceVersion: ended.metadata.resourceVersion,
    reason: "Assignment withdrawn",
  });
  const before = f.worker.resourceStore.readTask("result");
  const changes = f.owner.resourceStore.db.prepare("SELECT total_changes() AS n").get();
  const page = f.read();
  expect(page.creator).toEqual(f.creator);
  expect(page.items).toMatchObject([
    { appId: "owner", taskId: "result", status: "pending" },
    { appId: "worker", taskId: "result", status: "idle", acceptedAttempt: { id: accepted.attemptId, generation: 1 } },
  ]);
  expect(page.nextCursor).toBeUndefined();
  expect(page.items[1]?.outcomePreview.length).toBeLessThanOrEqual(240);
  expect(page.items[1]).not.toHaveProperty("facts");
  expect(f.owner.resourceStore.db.prepare("SELECT total_changes() AS n").get()).toEqual(changes);
  expect(f.worker.resourceStore.readTask("result")).toEqual(before);
  recordAppTaskTrigger(f.worker, "result", { type: "source.corrected", data: {} });
  expect(f.read().items[1]).toMatchObject({ status: "pending", acceptedAttempt: { id: accepted.attemptId } });
});

test("creator pages retain cross-App identity and reject a cursor from another creator", () => {
  const f = fixture();
  for (const ctx of [f.owner, f.worker]) for (const id of ["a", "b"]) f.add(ctx, id);
  let cursor: string | undefined;
  const ids: string[] = [];
  do {
    const page = f.read({ limit: 1, cursor });
    ids.push(...page.items.map((task) => `${task.appId}/${task.taskId}`));
    cursor = page.nextCursor;
  } while (cursor);
  expect(ids).toEqual(["owner/a", "owner/b", "worker/a", "worker/b"]);
  const first = f.read({ limit: 1 });
  expect(() =>
    readCreatedTasks(f.owner.resourceStore.db, { appId: "other", taskId: "research" }, { cursor: first.nextCursor }),
  ).toThrow("cursor");
  for (const cursor of [
    "",
    "not-a-cursor",
    Buffer.from(JSON.stringify(["created-v1", "owner", "research", 1, "a"])).toString("base64url"),
  ])
    expect(() => f.read({ cursor })).toThrow("cursor");
  for (const limit of [0, 101, 1.5]) expect(() => f.read({ limit })).toThrow("limit");
});
