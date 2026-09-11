import { afterEach, expect, it, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskRequest } from "../state/inbox.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { AppTaskController } from "./controller.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import {
  appTaskContext, claimObservedAppTask, closeAppTask, completeAppTask, failAppTaskAttempt,
  observeAppTaskIntent, readAppTaskAdmissionOutcome, recordAppTaskTrigger, stopAppTask,
} from "./app-task-reconciler.js";

const cleanup: Array<() => void> = [];
afterEach(() => {
  setSystemTime();
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-durable-retry-"));
  const databasePath = join(root, "host.sqlite");
  let config = appTaskTestContext({ appDir: root, agent: "owner", databasePath,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } } } });
  cleanup.push(() => { config.resourceStore.close(); rmSync(root, { recursive: true, force: true }); });
  const intent = { id: "work", parentId: "root", outcome: "Read the measurement", acceptance: ["Return observed value"], mode: "achieve" as const };
  observeAppTaskIntent(config, { intent, appAgent: "owner" });
  admitTaskRequest(config, { appId: "sample", attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "ask:measure", request: { id: "measure", source: { kind: "app", id: "caller" },
      input: { kind: "measure", data: { sample: "one" } } } });
  return {
    get config() { return config; }, intent,
    claim() {
      const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${claim.kind}`);
      return claim;
    },
    reopen() {
      config.resourceStore.close();
      config = appTaskContext({ appDir: root, projectDir: root, agent: "owner",
        resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample") });
    },
  };
}

it("uses the real due timer after restart, preserves cooldown under early wakes, and releases capacity", async () => {
  const f = fixture();
  const capacity = new HostCapacity(1);
  let failure!: () => void;
  let success!: () => void;
  let reject!: (error: unknown) => void;
  const failed = new Promise<void>((resolve) => { failure = resolve; });
  const done = new Promise<void>((resolve, no) => { success = resolve; reject = no; });
  const timeout = setTimeout(() => reject(new Error("Persisted retry did not execute")), 5_000);
  let attempts = 0;
  let retryAt = 0;
  let retryStartedAt = 0;
  let earlyWakes = 0;
  let scheduler: AppTaskRecoveryScheduler;
  const createController = () => new AppTaskController({ maxConcurrent: 1, capacity,
    onError: (_id, error) => reject(error),
    async reconcile() {
      const claim = claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" });
      if (claim.kind === "waiting") { earlyWakes++; return; }
      if (claim.kind !== "claimed") throw new Error(`Unexpected ${claim.kind}`);
      attempts++;
      if (attempts === 1) {
        expect(failAppTaskAttempt(f.config, claim, "Provider unavailable").status).toBe("retrying");
        retryAt = f.config.resourceStore.readTask("work")!.status.executionRetryAt!;
        scheduler.stateChanged();
        failure();
        return;
      }
      retryStartedAt = Date.now();
      expect(claim.events.some(({ event }) => event.type === "app.task.requested")).toBe(true);
      completeAppTask(f.config, claim, { summary: "Measured", result: { value: 17 } });
      scheduler.stateChanged();
      success();
    },
  });
  let controller = createController();
  const createScheduler = () => new AppTaskRecoveryScheduler({ source: f.config.resourceStore,
    enqueue: (id, options) => { controller.enqueue(id, options); } });
  scheduler = createScheduler();
  try {
    scheduler.start();
    await Promise.race([failed, done]);
    // This cannot acquire until the controller releases its failed attempt.
    const release = await Promise.race([capacity.acquire(), done.then(() => { throw new Error("Retry held capacity through its delay"); })]);
    expect(Date.now()).toBeLessThan(retryAt);
    release();
    scheduler.close();
    controller.close();
    await controller.whenDrained();
    f.reopen();
    expect(f.config.resourceStore.nextDueAt()).toBe(retryAt);
    controller = createController();
    scheduler = createScheduler();
    recordAppTaskTrigger(f.config, "work", { type: "project.task.tick", eventId: 99 });
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    controller.enqueue("work");
    scheduler.start();
    await done;
    expect(earlyWakes).toBeGreaterThan(0);
    expect(attempts).toBe(2);
    expect(retryStartedAt).toBeGreaterThanOrEqual(retryAt);
    expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")?.result).toEqual({ value: 17 });
    expect(f.config.resourceStore.nextDueAt()).toBeNull();
    expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    expect(f.config.resourceStore.readCancellation("work")).toBeNull();
  } finally {
    clearTimeout(timeout);
    scheduler.close();
    controller.close();
    await controller.whenDrained();
  }
});

it("accepts failure evidence without resolving the ask, then succeeds on the same assignment", () => {
  const f = fixture();
  const first = f.claim();
  stopAppTask(f.config, first, { summary: "Could not read this measurement", result: { problem: "source offline" }, evidence: ["source:offline"] });
  f.reopen();
  expect(f.config.resourceStore.readAttempt(first.attemptId)).toMatchObject({ state: "completed",
    acceptedResult: { state: "stopped", evidence: ["source:offline"] } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toBeNull();
  const due = f.config.resourceStore.readTask("work")!.status.executionRetryAt!;
  expect(() => f.claim()).toThrow("waiting");
  setSystemTime(new Date(due));
  const next = f.claim();
  expect(next.taskId).toBe(first.taskId);
  expect(next.generation).toBe(first.generation);
  expect(next.events).toEqual(first.events);
  expect(f.config.resourceStore.readTask("work")?.status.evidence).toEqual(["source:offline"]);
  completeAppTask(f.config, next, { summary: "Source repaired; measurement read", result: { value: 17 } });
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "ask:measure")).toMatchObject({ attemptId: next.attemptId, result: { value: 17 } });
  expect(f.config.resourceStore.readAttempt(first.attemptId)?.acceptedResult?.state).toBe("stopped");
  expect(f.config.resourceStore.nextDueAt()).toBeNull();
});

it("rolls failure, input restoration and deadline back together, and guards indexed hint updates", () => {
  const f = fixture();
  const claim = f.claim();
  f.config.resourceStore.db.exec(`CREATE TRIGGER reject_retry BEFORE UPDATE ON app_tasks
    BEGIN SELECT RAISE(ABORT, 'retry write rejected'); END`);
  expect(() => failAppTaskAttempt(f.config, claim, "Provider unavailable")).toThrow("retry write rejected");
  expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("running");
  expect(f.config.resourceStore.readTask("work")?.status.executionRetryAt).toBeUndefined();
  f.config.resourceStore.db.exec("DROP TRIGGER reject_retry");
  failAppTaskAttempt(f.config, claim, "Provider unavailable");
  const due = f.config.resourceStore.nextDueAt();
  expect(due).toBeGreaterThan(Date.now());
  f.config.resourceStore.setRecoveryState("work", { ready: true, changed: true, nextCheckAt: null });
  expect(f.config.resourceStore.nextDueAt()).toBe(due);
  expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
  expect(f.config.resourceStore.readTask("work")?.status.executionFailures).toBe(1);
});

it("applies owner revision during cooldown and fences retry plus late failure on closure", () => {
  const f = fixture();
  const first = f.claim();
  failAppTaskAttempt(f.config, first, "Provider unavailable");
  const oldDue = f.config.resourceStore.nextDueAt()!;
  observeAppTaskIntent(f.config, { intent: { ...f.intent, outcome: "Read the cheaper replacement measurement" }, appAgent: "owner" });
  const revised = f.claim();
  expect(revised.generation).toBeGreaterThan(first.generation);
  const resource = f.config.resourceStore.readTask("work")!;
  closeAppTask(f.config, { appId: "sample", taskId: "work", reason: "Owner withdrew this assignment",
    expectedGeneration: resource.metadata.generation, expectedResourceVersion: resource.metadata.resourceVersion });
  expect(failAppTaskAttempt(f.config, revised, "Late provider failure").status).toBe("superseded");
  f.reopen();
  setSystemTime(new Date(oldDue + 1));
  expect(recordAppTaskTrigger(f.config, "work", { type: "project.task.tick" }).kind).not.toBe("recorded");
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "agent" }).kind).toBe("completed");
  expect(f.config.resourceStore.listRecoveryCandidates().items).toEqual([]);
});
