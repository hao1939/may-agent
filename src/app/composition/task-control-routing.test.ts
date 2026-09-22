import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { discoverAppDefinitions } from "../adapters/discovery/app-definitions.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EVENT_DELIVERY_RESULT, EVENT_ROW_ID, EventBus, type AgentEvent } from "../core/events/bus.js";
import { loadPersistedEvent } from "../core/events/persisted.js";
import { getAppEventAdmissionPlan } from "../core/state/app-event-admission-store.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import {
  appTaskContext,
  cancelAppTask,
  claimObservedAppTask,
  closeAppTask,
  completeAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  retryFailedAppTask,
} from "../core/tasks/app-task-reconciler.js";
import { admitStandaloneCanonicalAppTaskEvent } from "../core/tasks/app-task-runtime.js";
import { appTaskTestContext } from "../core/tasks/app-task-test-support.js";
import {
  attachTaskControlEventRoute,
  taskCancelRequestedEvent,
  taskCloseRequestedEvent,
  taskRetryRequestedEvent,
} from "../task-control-events.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

async function fixture(controlFirst?: boolean) {
  const root = mkdtempSync(join(tmpdir(), "may-control-routing-"));
  const appDir = join(root, "sample.app");
  mkdirSync(appDir);
  let runtime: AppInboxRuntime | undefined;
  cleanup.push(() => {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  writeFileSync(
    join(appDir, "app.js"),
    `export default {
    id: "sample", version: 1, owner: "owner", tasks: {},
    inputSchema: { type: "object", required: ["kind", "data"], additionalProperties: false,
      properties: { kind: { const: "probe" }, data: { type: "object" } } },
    task() { return { kind: "existing", taskId: "work" }; }
  };`,
  );
  let config = appTaskTestContext({
    appDir,
    agent: "owner",
    maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.fromDb(getDb(root), "sample"),
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "owner" } } },
  });
  observeAppTaskIntent(config, {
    appAgent: "owner",
    intent: {
      id: "work",
      parentId: "root",
      outcome: "Read a measurement",
      acceptance: ["Return observed evidence"],
    },
  });
  const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
  if (claim.kind !== "claimed") throw new Error("Expected a Task claim");
  failAppTaskAttempt(config, claim, "Source temporarily unavailable");
  const registry = new AppRegistry(discoverAppDefinitions(root));
  const [entry] = await registry.reload();
  let bus: EventBus;
  let wakeAttempts = 0;
  const start = async () => {
    bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const controls = () =>
      attachTaskControlEventRoute(bus, {
        retryTask: ({ generation, resourceVersion, ...input }) =>
          retryFailedAppTask(config, {
            ...input,
            expectedGeneration: generation,
            expectedResourceVersion: resourceVersion,
          }),
        cancelTask: ({ generation, resourceVersion, ...input }) =>
          cancelAppTask(config, {
            ...input,
            expectedGeneration: generation,
            expectedResourceVersion: resourceVersion,
          }),
        closeTask: ({ generation, resourceVersion, ...input }) =>
          closeAppTask(config, {
            ...input,
            expectedGeneration: generation,
            expectedResourceVersion: resourceVersion,
          }),
      });
    if (controlFirst) controls();
    const descriptor = {
      id: "sample",
      appDir,
      projectDir: appDir,
      agent: "owner",
      app: entry!.definition,
      reconciliationPaused: false,
      resourceStore: config.resourceStore,
    };
    runtime = await startAppInboxRuntime({
      registry,
      db: getDb(root),
      bus,
      schedulesEnabled: false,
      admitTaskEvent: ({ event, intent, targetedTaskId, conditionTaskIds }) => {
        wakeAttempts++;
        return admitStandaloneCanonicalAppTaskEvent({ descriptor, event, intent, targetedTaskId, conditionTaskIds })
          .delivery;
      },
      previewTaskEvent: () => [],
    });
    if (controlFirst === false) controls();
  };
  await start();
  return {
    get bus() {
      return bus;
    },
    get db() {
      return getDb(root);
    },
    get store() {
      return config.resourceStore;
    },
    get wakeAttempts() {
      return wakeAttempts;
    },
    addInput(eventId = 2) {
      recordAppTaskTrigger(config, "work", {
        type: "conversation.message",
        eventId,
        data: { text: "New work" },
      });
    },
    claim() {
      const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error("Expected Task claim");
      return claim;
    },
    complete() {
      const resource = config.resourceStore.readTask("work")!;
      retryFailedAppTask(config, {
        appId: "sample",
        taskId: "work",
        expectedGeneration: resource.metadata.generation,
        expectedResourceVersion: resource.metadata.resourceVersion,
      });
      const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "agent" });
      if (claim.kind !== "claimed") throw new Error("Expected retried Task claim");
      completeAppTask(config, claim, { summary: "Answer accepted", facts: ["answer:verified"] });
      return claim.attemptId;
    },
    control(action: "cancel" | "retry" | "close", afterResult?: string) {
      const resource = config.resourceStore.readTask("work")!;
      const target = {
        appId: "sample",
        taskId: "work",
        generation: resource.metadata.generation,
        resourceVersion: resource.metadata.resourceVersion,
      };
      const input =
        action === "cancel"
          ? taskCancelRequestedEvent(target, "Owner ended the assignment")
          : action === "retry"
            ? taskRetryRequestedEvent(target)
            : taskCloseRequestedEvent(target, afterResult ?? "", "Accepted answer consumed");
      return {
        ...input,
        source: "test-control",
        owner: "app:sample",
        data: {
          ...input.data,
          appId: "sample",
          taskId: "work",
          idempotencyKey: input.idempotencyKey,
        },
      } as AgentEvent;
    },
    async reopen() {
      runtime!.close();
      closeDb(root);
      config = appTaskContext({
        appDir,
        projectDir: appDir,
        agent: "owner",
        resourceStore: AppTaskResourceStore.fromDb(getDb(root), "sample"),
      });
      await start();
    },
  };
}

for (const controlFirst of [true, false]) {
  for (const action of ["cancel", "retry"] as const) {
    it(`${action} has one route with control ${controlFirst ? "before" : "after"} inbox, including replay after reopen`, async () => {
      const f = await fixture(controlFirst);
      const before = f.store.readTask("work")!;
      const emitted = f.bus.emit(f.control(action));
      const id = emitted[EVENT_ROW_ID]!;
      expect(emitted[EVENT_DELIVERY_RESULT]).toMatchObject({ accepted: true, by: "task-control" });
      expect(f.wakeAttempts).toBe(0);
      expect(getAppEventAdmissionPlan(f.db, id)).toBeNull();
      expect(f.db.prepare("SELECT delivery_status, accepted_by FROM events WHERE id = ?").get(id)).toMatchObject({
        delivery_status: "accepted",
        accepted_by: "task-control",
      });
      expect(f.db.prepare("SELECT count(*) n FROM events WHERE event_type = 'subscriber.failed'").get()).toEqual({
        n: 0,
      });
      const after = f.store.readTask("work")!;
      expect(after.metadata.resourceVersion).toBe(before.metadata.resourceVersion + 1);
      expect(f.store.isCancelled("work")).toBe(action === "cancel");
      if (action === "cancel") {
        expect(f.store.readCancellation("work")?.decidedBy).toEqual({ kind: "app-policy" });
      } else expect(after.status.executionRetryAt).toBeUndefined();
      await f.reopen();
      const replay = loadPersistedEvent(f.db, id)!;
      expect(replay).not.toBeNull();
      expect(f.bus.redeliverPersisted(replay, id)[EVENT_DELIVERY_RESULT]).toMatchObject({
        accepted: true,
        by: "task-control",
      });
      expect(f.store.readTask("work")).toEqual(after);
      expect(f.wakeAttempts).toBe(0);
      expect(getAppEventAdmissionPlan(f.db, id)).toBeNull();
    });
  }
}

for (const controlFirst of [true, false]) {
  it(`completion close has one route with control ${controlFirst ? "before" : "after"} inbox, including replay after reopen`, async () => {
    const f = await fixture(controlFirst);
    const attemptId = f.complete();
    const before = f.store.readTask("work")!;
    const emitted = f.bus.emit(f.control("close", attemptId));
    const id = emitted[EVENT_ROW_ID]!;
    expect(emitted[EVENT_DELIVERY_RESULT]).toMatchObject({ accepted: true, by: "task-control" });
    expect(f.wakeAttempts).toBe(0);
    expect(getAppEventAdmissionPlan(f.db, id)).toBeNull();
    const after = f.store.readTask("work")!;
    expect(after.metadata.resourceVersion).toBe(before.metadata.resourceVersion + 1);
    expect(f.store.readCancellation("work")).toMatchObject({
      kind: "closed",
      acceptedResultAttemptId: attemptId,
    });
    await f.reopen();
    const replay = loadPersistedEvent(f.db, id)!;
    expect(f.bus.redeliverPersisted(replay, id)[EVENT_DELIVERY_RESULT]).toMatchObject({
      accepted: true,
      by: "task-control",
    });
    expect(f.store.readTask("work")).toEqual(after);
    expect(f.wakeAttempts).toBe(0);
  });
}

it.each(["pending input", "active attempt", "wrong result", "stale version", "unauthorized app"])(
  "keeps completion close with %s rejected without changing Task state",
  async (rejection) => {
    const f = await fixture(false);
    const acceptedAttemptId = f.complete();
    if (rejection === "pending input" || rejection === "active attempt") f.addInput();
    if (rejection === "active attempt") f.claim();
    const input = f.control("close", rejection === "wrong result" ? "r_1_wrong" : acceptedAttemptId);
    const data = input.data as Record<string, unknown>;
    if (rejection === "stale version") data.expectedResourceVersion = 999;
    if (rejection === "unauthorized app") {
      input.target = { appId: "other", taskId: "work" };
      data.appId = "other";
    }
    const before = f.store.readTaskContext({ taskIds: ["work"] });
    const failureObserved = new Promise<void>((resolve) => {
      const unsubscribe = f.bus.subscribe((event) => {
        if (event.type === "subscriber.failed") {
          unsubscribe();
          resolve();
        }
      });
    });
    const rejected = f.bus.emit(input);
    await failureObserved;
    expect(rejected[EVENT_DELIVERY_RESULT]).toBeUndefined();
    expect(f.store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
    expect(f.wakeAttempts).toBe(0);
    expect(getAppEventAdmissionPlan(f.db, rejected[EVENT_ROW_ID]!)).toBeNull();
  },
);

it.each(["missing", "stale generation", "stale version", "mismatched receipt"])(
  "keeps %s controls rejected without creating worker input",
  async (rejection) => {
    const f = await fixture(false);
    const input = f.control("retry");
    const data = input.data as Record<string, unknown>;
    let replayId: number | undefined;
    if (rejection === "missing") {
      Object.assign(input, { target: { appId: "sample", taskId: "missing" } });
      data.taskId = "missing";
    } else if (rejection === "stale generation") data.expectedGeneration = 99;
    else if (rejection === "stale version") data.expectedResourceVersion = 99;
    else {
      const accepted = f.bus.emit({ ...input, data: { ...data } } as AgentEvent);
      expect(accepted[EVENT_DELIVERY_RESULT]).toBeDefined();
      replayId = accepted[EVENT_ROW_ID]!;
      // The same control key cannot authorize a different fence on replay.
      data.expectedResourceVersion = 99;
    }
    const before = f.store.readTaskContext({ taskIds: ["work"] });
    const failureObserved = new Promise<void>((resolve) => {
      const unsubscribe = f.bus.subscribe((event) => {
        if (event.type === "subscriber.failed") {
          unsubscribe();
          resolve();
        }
      });
    });
    const rejected = replayId === undefined ? f.bus.emit(input) : f.bus.redeliverPersisted(input, replayId);
    await failureObserved;
    expect(rejected[EVENT_DELIVERY_RESULT]).toBeUndefined();
    expect(f.store.readTaskContext({ taskIds: ["work"] })).toEqual(before);
    expect(f.wakeAttempts).toBe(0);
    expect(getAppEventAdmissionPlan(f.db, rejected[EVENT_ROW_ID]!)).toBeNull();
  },
);

it("does not accept a control when its authoritative route is absent", async () => {
  const f = await fixture();
  const before = f.store.readTask("work");
  const emitted = f.bus.emit(f.control("cancel"));
  expect(emitted[EVENT_DELIVERY_RESULT]).toBeUndefined();
  expect(f.store.readTask("work")).toEqual(before);
  expect(f.wakeAttempts).toBe(0);
  expect(getAppEventAdmissionPlan(f.db, emitted[EVENT_ROW_ID]!)).toBeNull();
});

it("still admits ordinary exact Task facts through the inbox route", async () => {
  const f = await fixture(true);
  const emitted = f.bus.emit({
    type: "source.changed",
    source: "test-source",
    owner: "app:sample",
    target: { appId: "sample", taskId: "work" },
    data: { state: "ready" },
  });
  expect(emitted[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
  expect(f.wakeAttempts).toBe(1);
  expect(getAppEventAdmissionPlan(f.db, emitted[EVENT_ROW_ID]!)?.status).toBe("completed");
});
