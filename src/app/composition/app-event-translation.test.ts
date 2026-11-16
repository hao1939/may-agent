import { Type, defineApp } from "@may-agent/sdk";
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EVENT_DELIVERY_RESULT, EVENT_ROW_ID, EventBus } from "../core/events/bus.js";
import { getEventView } from "../core/events/interface.js";
import { getAppEventAdmissionPlan } from "../core/state/app-event-admission-store.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { admitTaskInput } from "../core/state/inbox.js";
import { appTaskContext } from "../core/tasks/app-task-reconciler.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Event admission did not recover");
    await Bun.sleep(5);
  }
}

for (const failure of ["throw", "invalid-input", "ambiguous", "action"] as const) {
  test(`recovers ${failure} translation after database reopen without blocking another App or duplicating work`, async () => {
    const root = mkdtempSync(join(tmpdir(), "may-event-translation-"));
    let db = getDb(root);
    let runtime: AppInboxRuntime | undefined;
    let broken = true;
    let version = "original";
    let now = Date.now();
    const calls = { broken: 0, healthy: 0 };
    const entries = () =>
      (["broken", "healthy"] as const).map((id) => {
        const appDir = join(root, id);
        mkdirSync(appDir, { recursive: true });
        const frozenVersion = version;
        return {
          appDir,
          definition: defineApp({
            id,
            version: 1,
            agent: id,
            inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ value: Type.String() }) }),
            tasks: {},
            task: ({ id: inputId }) => ({
              kind: "desired",
              intent: { id: inputId, parentId: "root", outcome: "Review fact", acceptance: ["Reviewed"] },
            }),
            subscriptions: [
              {
                id: "change",
                event: "probe.changed",
                toInput(event) {
                  // The responsibility must exist before even the first App callback.
                  expect(db.prepare("SELECT COUNT(*) AS n FROM app_event_admission_commands").get()?.n).toBe(2);
                  calls[id]++;
                  if (id === "broken" && broken && failure === "throw") throw new Error("translation unavailable");
                  if (id === "broken" && failure === "action") {
                    if (broken) throw new Error("translation unavailable");
                    if (event.action !== "review") return null;
                  }
                  return {
                    kind: "message",
                    data: {
                      value:
                        id === "broken" && broken && failure === "invalid-input"
                          ? (42 as unknown as string)
                          : `${frozenVersion}:${event.data.value}`,
                    },
                  };
                },
              },
              ...(id === "broken" && broken && failure === "ambiguous"
                ? [
                    {
                      id: "duplicate",
                      event: "probe.changed",
                      toInput: () => ({ kind: "message", data: { value: "conflicting route" } }),
                    },
                  ]
                : []),
            ],
          }),
        };
      });
    const start = async () => {
      const source = entries();
      const contexts = new Map(
        source.map(({ appDir, definition }) => {
          const store = AppTaskResourceStore.fromDb(db, definition.id);
          if (version === "original")
            store.bootstrapSnapshot(
              {
                project: definition.id,
                root_task_id: "root",
                project_lifecycle: "active",
                groups: { root: { id: "root", parent_id: null } },
              },
              "fixture",
            );
          return [
            definition.id,
            appTaskContext({ appDir, projectDir: appDir, agent: definition.agent!, resourceStore: store }),
          ];
        }),
      );
      const registry = new AppRegistry(async () => entries());
      await registry.reload();
      const bus = new EventBus();
      const writer = new DbWriter(root);
      bus.setPersistenceSubscriber(writer.handler);
      bus.setDeliveryRecorder(writer.recordDelivery);
      runtime = await startAppInboxRuntime({
        db,
        bus,
        registry,
        persistDir: root,
        schedulesEnabled: false,
        now: () => now,
        attachTask: (input) => admitTaskInput(contexts.get(input.appId)!, input),
      });
      return { bus, writer };
    };
    try {
      const first = await start();
      // Simulate a lost global delivery receipt after durable routing.
      if (failure === "throw") first.bus.setDeliveryRecorder(() => {});
      const emitted = first.bus.emit({
        type: "probe.changed",
        source: "fixture",
        owner: "fixture",
        ...(failure === "action" ? { action: "review" } : {}),
        data: { value: "evidence" },
      });
      const eventId = emitted[EVENT_ROW_ID]!;
      expect(emitted[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
      // Replay and reload before dispatch must reuse preparation from this turn.
      expect(calls).toEqual({ broken: 1, healthy: 1 });
      first.bus.redeliverPersisted(emitted, eventId);
      version = "replacement";
      await runtime!.reload();
      await until(
        () =>
          getAppEventAdmissionPlan(db, eventId)?.commands.find((command) => command.appId === "healthy")?.status ===
          "admitted",
      );
      const original = getAppEventAdmissionPlan(db, eventId)!;
      expect(original.commands[0]).toMatchObject({
        kind: "unresolved",
        status: "pending",
        lastError: expect.any(String),
      });
      expect(calls).toEqual({ broken: 1, healthy: 1 });
      expect(getEventView(db, eventId)?.links).toContainEqual({
        kind: "delivery",
        id: `app-event:${eventId}:broken`,
        state: "pending",
        summary: original.commands[0]!.lastError,
      });
      expect(db.prepare("SELECT app_id FROM app_inbox_items").all()).toEqual([{ app_id: "healthy" }]);
      // This is an accepted admission obligation, so ordinary unaccepted-event expiry cannot discard it.
      first.writer.runHousekeeping(Date.now() + 300_000);
      expect(getAppEventAdmissionPlan(db, eventId)?.status).toBe("pending");

      runtime!.close();
      closeDb(root);
      db = getDb(root);
      broken = false;
      version = "repaired";
      now += 180_000;
      const second = await start();
      // A removed selected subscription is not silently remapped. Repair that exact route explicitly.
      if (failure === "ambiguous") {
        await until(() =>
          Boolean(getAppEventAdmissionPlan(db, eventId)?.commands[0]?.lastError?.includes("duplicate")),
        );
        await runtime!.reload(undefined, async () =>
          entries().map((entry) =>
            entry.definition.id !== "broken"
              ? entry
              : {
                  ...entry,
                  definition: {
                    ...entry.definition,
                    subscriptions: [
                      ...entry.definition.subscriptions!,
                      { id: "duplicate", event: "probe.changed", toInput: () => null },
                    ],
                  },
                },
          ),
        );
      }
      await until(() => getAppEventAdmissionPlan(db, eventId)?.status === "completed");
      const repaired = getAppEventAdmissionPlan(db, eventId)!;
      expect(repaired.registrySnapshotId).toBe(original.registrySnapshotId);
      expect(repaired.commands[0]?.resolvedSnapshotId).not.toBe(original.registrySnapshotId);
      expect(calls.healthy).toBe(1);
      expect(db.prepare("SELECT app_id, input_data FROM app_inbox_items ORDER BY app_id").all()).toEqual([
        { app_id: "broken", input_data: JSON.stringify({ value: "repaired:evidence" }) },
        { app_id: "healthy", input_data: JSON.stringify({ value: "original:evidence" }) },
      ]);
      expect(db.prepare("SELECT COUNT(*) AS n FROM app_tasks WHERE task_id != 'root'").get()?.n).toBe(2);
      second.bus.redeliverPersisted(emitted, eventId);
      runtime!.scanNow();
      expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()?.n).toBe(2);
      expect(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type = 'probe.changed'").get()?.n).toBe(1);
    } finally {
      runtime?.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("freezes an intentional no-work decision across reload", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-noop-"));
  const db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  let calls = 0;
  try {
    const registry = new AppRegistry(async () => [
      {
        appDir: root,
        definition: defineApp({
          id: "observer",
          version: 1,
          agent: "observer",
          inputSchema: Type.Object({}),
          tasks: {},
          subscriptions: [
            {
              id: "change",
              event: "probe.changed",
              toInput: () => {
                calls++;
                return null;
              },
            },
          ],
        }),
      },
    ]);
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    runtime = await startAppInboxRuntime({ db, bus, registry, persistDir: root });
    const event = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: {} });
    await until(() => getAppEventAdmissionPlan(db, event[EVENT_ROW_ID]!)?.status === "completed");
    expect(getAppEventAdmissionPlan(db, event[EVENT_ROW_ID]!)?.commands[0]?.kind).toBe("noop");
    // Simulate a stop after command admission but before plan completion.
    db.prepare("UPDATE app_event_admission_plans SET status = 'pending', completed_at = NULL WHERE event_id = ?").run(
      event[EVENT_ROW_ID]!,
    );
    await runtime.reload();
    await until(() => getAppEventAdmissionPlan(db, event[EVENT_ROW_ID]!)?.status === "completed");
    bus.redeliverPersisted(event, event[EVENT_ROW_ID]!);
    expect(calls).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()?.n).toBe(0);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("delivers exact Condition wakes even when the same App cannot translate new work", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-condition-translation-"));
  const db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  try {
    let calls = 0;
    const registry = new AppRegistry(async () => [
      {
        appDir: root,
        definition: defineApp({
          id: "example",
          version: 1,
          agent: "example",
          inputSchema: Type.Object({}),
          tasks: {},
          subscriptions: [
            {
              id: "change",
              event: "probe.changed",
              toInput: () => {
                calls++;
                throw new Error("broken translation");
              },
            },
          ],
        }),
      },
    ]);
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const wakes: string[][] = [];
    runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      previewTaskEventRoutes: ({ event }) =>
        event.type === "probe.changed" ? [{ appId: "example", taskIds: ["existing"] }] : [],
      admitTaskEvent: ({ intent, conditionTaskIds }) => {
        expect(intent).toBeNull();
        wakes.push(conditionTaskIds ?? []);
        return { accepted: true, by: "fixture", route: "direct" };
      },
    });
    const event = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: {} });
    await until(() => wakes.length === 1);
    expect(wakes).toEqual([["existing"]]);
    expect(calls).toBe(1);
    expect(getAppEventAdmissionPlan(db, event[EVENT_ROW_ID]!)?.commands[0]).toMatchObject({
      kind: "unresolved",
      status: "pending",
      lastError: "broken translation",
    });
    await expect(
      runtime.reload(undefined, async () => [
        {
          appDir: root,
          definition: defineApp({ id: "example", version: 1, agent: "example", inputSchema: Type.Object({}) }),
        },
      ]),
    ).rejects.toThrow("Condition wakes");
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("preserves forced reload recovery when reload runs during an active startup recovery slice or pending dispatch", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-forced-recovery-reload-"));
  const db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  let broken = true;
  let clock = Date.now();
  let holdHealthyWorker = false;
  const healthyWorkerEntered = Promise.withResolvers<void>();
  const releaseHealthyWorker = Promise.withResolvers<void>();
  const makeEntries = () =>
    (["broken", "healthy"] as const).map((id) => {
      const appDir = join(root, id);
      mkdirSync(appDir, { recursive: true });
      return {
        appDir,
        definition: defineApp({
          id,
          version: 1,
          agent: id,
          inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ value: Type.String() }) }),
          tasks: {},
          task: ({ id: inputId }) => ({
            kind: "desired",
            intent: { id: inputId, parentId: "root", outcome: "Review fact", acceptance: ["Reviewed"] },
          }),
          subscriptions:
            id === "broken"
              ? [
                  {
                    id: "change",
                    event: "probe.changed",
                    toInput: (event) => {
                      if (broken) throw new Error("broken before reload");
                      return { kind: "message", data: { value: `${id}:${String(event.data.value)}` } };
                    },
                  },
                ]
              : [],
        }),
      };
    });
  try {
    for (const { appDir, definition } of makeEntries()) {
      const store = AppTaskResourceStore.fromDb(db, definition.id);
      store.bootstrapSnapshot(
        {
          project: definition.id,
          root_task_id: "root",
          project_lifecycle: "active",
          groups: { root: { id: "root", parent_id: null } },
        },
        "fixture",
      );
      void appTaskContext({ appDir, projectDir: appDir, agent: definition.agent!, resourceStore: store });
    }
    const registry = new AppRegistry(async () => makeEntries());
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const startRuntime = () =>
      startAppInboxRuntime({
        db,
        bus,
        registry,
        persistDir: root,
        schedulesEnabled: false,
        now: () => clock,
        attachTask: (input) => {
          const store = AppTaskResourceStore.fromDb(db, input.appId);
          return admitTaskInput(
            appTaskContext({ appDir: join(root, input.appId), projectDir: join(root, input.appId), agent: input.appId, resourceStore: store }),
            input,
          );
        },
        createTaskAdmissionWorker: () => ({
          dispatch: async (command) => {
            if (command.appId === "healthy" && holdHealthyWorker) {
              healthyWorkerEntered.resolve();
              await releaseHealthyWorker.promise;
            }
            return { taskIds: [] };
          },
          close: () => {},
        }),
        previewTaskEventRoutes: ({ event }) =>
          event.type === "probe.changed" ? [{ appId: "healthy", taskIds: ["root"] }] : [],
        admitTaskEvent: () => ({ accepted: true, by: "fixture", route: "direct" }),
      });

    runtime = await startRuntime();
    // Emit two events while broken=true so startup recovery has multiple pending plans.
    // healthy has no subscription, so its conditionTaskIds route resolves to kind: "task"
    // and dispatches asynchronously through createTaskAdmissionWorker().dispatch().
    const first = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "one" } });
    const second = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "two" } });
    const firstId = first[EVENT_ROW_ID]!;
    const secondId = second[EVENT_ROW_ID]!;
    await until(() => getAppEventAdmissionPlan(db, firstId)?.commands.find((c) => c.appId === "healthy")?.status === "admitted");
    await until(() => getAppEventAdmissionPlan(db, secondId)?.commands.find((c) => c.appId === "healthy")?.status === "admitted");

    // Reopen runtime with healthy's task command on firstId reset to pending so its async
    // worker dispatch is held in flight across reload(), a due periodic scanNow(), and the
    // end of the startup recovery slice.
    runtime.close();
    db.prepare(
      "UPDATE app_event_admission_commands SET status = 'pending', admitted_at = NULL WHERE event_id = ? AND app_id = 'healthy'",
    ).run(firstId);
    holdHealthyWorker = true;
    runtime = await startRuntime();
    await healthyWorkerEntered.promise;

    // Repair broken subscription and reload while healthy's async worker dispatch is held in flight.
    broken = false;
    await runtime.reload(undefined, async () => makeEntries());
    // Advance clock past ADMISSION_RECOVERY_INTERVAL_MS so a periodic scanNow() is due while
    // the reload retry is queued behind the held dispatch.
    clock += 120_000;
    runtime.scanNow();
    holdHealthyWorker = false;
    releaseHealthyWorker.resolve();

    await until(
      () =>
        getAppEventAdmissionPlan(db, firstId)?.status === "completed" &&
        getAppEventAdmissionPlan(db, secondId)?.status === "completed",
    );
    expect(getAppEventAdmissionPlan(db, firstId)?.commands.every((c) => c.status === "admitted")).toBe(true);
    expect(getAppEventAdmissionPlan(db, secondId)?.commands.every((c) => c.status === "admitted")).toBe(true);
  } finally {
    releaseHealthyWorker.resolve();
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("isolated forced reload regressions: reload before startup timer fires, and reload during held dispatch under post-reload ingress without clock advancement", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-forced-recovery-isolated-"));
  const db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  let brokenPreReload = true;
  let postReloadThrows = 0;
  let holdHealthyWorker = false;
  let heldEventId: number | null = null;
  let healthyWorkerEntered = Promise.withResolvers<void>();
  let releaseHealthyWorker = Promise.withResolvers<void>();
  const makeEntries = () =>
    (["broken", "healthy"] as const).map((id) => {
      const appDir = join(root, id);
      mkdirSync(appDir, { recursive: true });
      return {
        appDir,
        definition: defineApp({
          id,
          version: 1,
          agent: id,
          inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ value: Type.String() }) }),
          tasks: {},
          task: ({ id: inputId }) => ({
            kind: "desired",
            intent: { id: inputId, parentId: "root", outcome: "Review fact", acceptance: ["Reviewed"] },
          }),
          subscriptions:
            id === "broken"
              ? [
                  {
                    id: "change",
                    event: "probe.changed",
                    toInput: (event) => {
                      if (event.data.value === "post-reload-broken") {
                        postReloadThrows++;
                        throw new Error("post-reload translation failure");
                      }
                      if (brokenPreReload) throw new Error("broken before reload");
                      return { kind: "message", data: { value: `${id}:${String(event.data.value)}` } };
                    },
                  },
                ]
              : [],
        }),
      };
    });
  try {
    for (const { appDir, definition } of makeEntries()) {
      const store = AppTaskResourceStore.fromDb(db, definition.id);
      store.bootstrapSnapshot(
        {
          project: definition.id,
          root_task_id: "root",
          project_lifecycle: "active",
          groups: { root: { id: "root", parent_id: null } },
        },
        "fixture",
      );
      void appTaskContext({ appDir, projectDir: appDir, agent: definition.agent!, resourceStore: store });
    }
    const registry = new AppRegistry(async () => makeEntries());
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const startRuntime = () =>
      startAppInboxRuntime({
        db,
        bus,
        registry,
        persistDir: root,
        schedulesEnabled: false,
        attachTask: (input) => {
          const store = AppTaskResourceStore.fromDb(db, input.appId);
          return admitTaskInput(
            appTaskContext({ appDir: join(root, input.appId), projectDir: join(root, input.appId), agent: input.appId, resourceStore: store }),
            input,
          );
        },
        createTaskAdmissionWorker: () => ({
          dispatch: async (command, event) => {
            const eid = Number((event as unknown as Record<PropertyKey, unknown>)[EVENT_ROW_ID]);
            if (command.appId === "healthy" && holdHealthyWorker && (heldEventId === null || eid === heldEventId)) {
              healthyWorkerEntered.resolve();
              await releaseHealthyWorker.promise;
            }
            return { taskIds: [] };
          },
          close: () => {},
        }),
        previewTaskEventRoutes: ({ event }) =>
          event.type === "probe.changed" ? [{ appId: "healthy", taskIds: ["root"] }] : [],
        admitTaskEvent: () => ({ accepted: true, by: "fixture", route: "direct" }),
      });

    // Case 1: reload immediately after startAppInboxRuntime(), BEFORE the startup 0ms recovery timer fires,
    // with NO clock advancement and NO scanNow().
    runtime = await startRuntime();
    const startupEvent = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "startup" } });
    const startupEventId = startupEvent[EVENT_ROW_ID]!;
    await until(() => getAppEventAdmissionPlan(db, startupEventId)?.commands.find((c) => c.appId === "healthy")?.status === "admitted");
    runtime.close();

    runtime = await startRuntime();
    brokenPreReload = false;
    await runtime.reload(undefined, async () => makeEntries());
    await until(() => getAppEventAdmissionPlan(db, startupEventId)?.status === "completed");
    expect(getAppEventAdmissionPlan(db, startupEventId)?.commands.every((c) => c.status === "admitted")).toBe(true);

    // Case 2: reload with dispatch held across a timer turn, plus post-reload ingress (including a post-reload
    // failing event that must NOT bypass the 60s cooldown when the pre-reload dispatch drains).
    runtime.close();
    brokenPreReload = true;
    runtime = await startRuntime();
    const heldEvent = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "held" } });
    const heldId = heldEvent[EVENT_ROW_ID]!;
    await until(() => getAppEventAdmissionPlan(db, heldId)?.commands.find((c) => c.appId === "healthy")?.status === "admitted");
    runtime.close();

    db.prepare(
      "UPDATE app_event_admission_commands SET status = 'pending', admitted_at = NULL WHERE event_id = ? AND app_id = 'healthy'",
    ).run(heldId);
    holdHealthyWorker = true;
    heldEventId = heldId;
    healthyWorkerEntered = Promise.withResolvers<void>();
    releaseHealthyWorker = Promise.withResolvers<void>();
    runtime = await startRuntime();
    await healthyWorkerEntered.promise;

    brokenPreReload = false;
    await runtime.reload(undefined, async () => makeEntries());
    // Wait a timer turn while dispatch is still held, and emit both a post-reload failing event and
    // another post-reload event whose healthy dispatch is also held so the global queue is non-empty
    // when heldId finishes.
    await Bun.sleep(15);
    const postBroken = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "post-reload-broken" } });
    const postBrokenId = postBroken[EVENT_ROW_ID]!;
    expect(postReloadThrows).toBe(1);

    // Hold postBroken's healthy worker dispatch only after heldId is re-queued by the forced recovery slice,
    // or release postBroken once postHealthyEntered fires so dispatchNextAdmissionCommand can proceed to heldId!
    heldEventId = postBrokenId;
    const postHealthyEntered = Promise.withResolvers<void>();
    const releasePostHealthy = Promise.withResolvers<void>();
    const origRelease = releaseHealthyWorker;
    releaseHealthyWorker = releasePostHealthy;
    healthyWorkerEntered = postHealthyEntered;
    origRelease.resolve();
    await postHealthyEntered.promise;
    // Emit another event while postBroken is held so pendingAdmissionEvents remains non-empty
    const trailing = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "trailing" } });
    const trailingId = trailing[EVENT_ROW_ID]!;
    heldEventId = trailingId;
    const releaseTrailing = Promise.withResolvers<void>();
    releaseHealthyWorker = releaseTrailing;
    releasePostHealthy.resolve();

    // Even while trailingId is held in dispatch, heldId (captured at reload time)
    // is retried and completes without waiting for trailingId or bypassing postBroken's 60s cooldown!
    await until(() => getAppEventAdmissionPlan(db, heldId)?.status === "completed");
    expect(getAppEventAdmissionPlan(db, heldId)?.commands.every((c) => c.status === "admitted")).toBe(true);
    expect(postReloadThrows).toBe(1);
    holdHealthyWorker = false;
    releaseTrailing.resolve();
  } finally {
    holdHealthyWorker = false;
    releaseHealthyWorker.resolve();
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("regular recovery skips an event with an active dispatch and retries it on a later pass after the dispatch fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-recovery-overlap-dispatch-"));
  const db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  let clock = Date.now();
  let holdHealthyWorker = true;
  let failHeldDispatch = true;
  let workerDispatches = 0;
  let redeliveries = 0;
  const healthyWorkerEntered = Promise.withResolvers<void>();
  const releaseHealthyWorker = Promise.withResolvers<void>();
  try {
    const appDir = join(root, "healthy");
    mkdirSync(appDir, { recursive: true });
    const definition = defineApp({
      id: "healthy",
      version: 1,
      agent: "healthy",
      inputSchema: Type.Object({ kind: Type.Literal("message"), data: Type.Object({ value: Type.String() }) }),
      tasks: {},
    });
    const store = AppTaskResourceStore.fromDb(db, "healthy");
    store.bootstrapSnapshot(
      {
        project: "healthy",
        root_task_id: "root",
        project_lifecycle: "active",
        groups: { root: { id: "root", parent_id: null } },
      },
      "fixture",
    );
    const registry = new AppRegistry(async () => [{ appDir, definition }]);
    await registry.reload();
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const origRedeliver = bus.redeliverPersisted.bind(bus);
    bus.redeliverPersisted = ((event, eventId, routeId) => {
      redeliveries++;
      return origRedeliver(event, eventId, routeId);
    }) as typeof bus.redeliverPersisted;

    runtime = await startAppInboxRuntime({
      db,
      bus,
      registry,
      persistDir: root,
      schedulesEnabled: false,
      now: () => clock,
      attachTask: (input) =>
        admitTaskInput(
          appTaskContext({ appDir, projectDir: appDir, agent: "healthy", resourceStore: store }),
          input,
        ),
      createTaskAdmissionWorker: () => ({
        dispatch: async (command) => {
          if (command.appId === "healthy") {
            workerDispatches++;
            if (holdHealthyWorker) {
              healthyWorkerEntered.resolve();
              await releaseHealthyWorker.promise;
            }
            if (failHeldDispatch) throw new Error("transient worker dispatch failure");
          }
          return { taskIds: [] };
        },
        close: () => {},
      }),
      previewTaskEventRoutes: ({ event }) =>
        event.type === "probe.changed" ? [{ appId: "healthy", taskIds: ["root"] }] : [],
      admitTaskEvent: () => ({ accepted: true, by: "fixture", route: "direct" }),
    });

    const overlapEvent = bus.emit({ type: "probe.changed", source: "fixture", owner: "fixture", data: { value: "overlap" } });
    const overlapId = overlapEvent[EVENT_ROW_ID]!;
    await healthyWorkerEntered.promise;
    expect(workerDispatches).toBe(1);
    expect(redeliveries).toBe(0);

    // Advance the recovery clock and run regular recovery while dispatch is held open.
    clock += 120_000;
    runtime.scanNow();
    await Bun.sleep(20);
    expect(redeliveries).toBe(0);
    expect(workerDispatches).toBe(1);

    // Fail the held dispatch and verify that a later recovery pass retries its pending command.
    holdHealthyWorker = false;
    releaseHealthyWorker.resolve();
    await until(
      () =>
        getAppEventAdmissionPlan(db, overlapId)?.commands
          .find((c) => c.appId === "healthy")
          ?.lastError?.includes("transient worker dispatch failure") === true,
    );
    failHeldDispatch = false;
    clock += 120_000;
    runtime.scanNow();
    await until(() => getAppEventAdmissionPlan(db, overlapId)?.status === "completed");
    expect(redeliveries).toBe(1);
    expect(workerDispatches).toBe(2);
  } finally {
    holdHealthyWorker = false;
    releaseHealthyWorker.resolve();
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
