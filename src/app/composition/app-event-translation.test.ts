import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Type, defineApp } from "@may-agent/sdk";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/requests.js";
import { AppRegistry } from "../core/apps/registry.js";
import { getEventView } from "../core/events/interface.js";
import { EventBus, EVENT_DELIVERY_RESULT, EVENT_ROW_ID } from "../core/events/bus.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { getAppEventAdmissionPlan } from "../core/state/app-event-admission-store.js";
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

for (const failure of ["throw", "invalid-input", "resolver", "invalid-intent", "ambiguous"] as const) {
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
            tasks: {
              ...(id === "broken" && (failure === "resolver" || failure === "invalid-intent")
                ? {
                    subscriptions: ["probe.changed"],
                    resolve: () => {
                      calls.broken++;
                      if (broken && failure === "resolver") throw new Error("resolver unavailable");
                      if (broken) return { id: "invalid", parentId: "root", outcome: "Review", acceptance: [] };
                      return null;
                    },
                  }
                : {}),
            },
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
                  if ((failure !== "resolver" && failure !== "invalid-intent") || id !== "broken") calls[id]++;
                  if (id === "broken" && broken && failure === "throw") throw new Error("translation unavailable");
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
