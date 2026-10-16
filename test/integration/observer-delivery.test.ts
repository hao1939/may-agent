import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { createAppObserverRuntime } from "../../src/app/adapters/producers/app-observer-runtime.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY } from "../../src/app/metric-source-measurement.js";
import { fakeTaskAttacher } from "../fixtures/task-attachment.js";

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Observer delivery did not settle");
    await Bun.sleep(5);
  }
}

test.each(["live", "restart"] as const)("ordinary observer facts stay quiet through %s admission", async (mode) => {
  const root = mkdtempSync(join(tmpdir(), "may-observer-delivery-"));
  let runtime: AppInboxRuntime | undefined;
  let observers: ReturnType<typeof createAppObserverRuntime> | undefined;
  try {
    const entries = ["first", "second"].map((id) => {
      const appDir = join(root, `${id}.app`);
      mkdirSync(appDir);
      return { appDir, definition: defineApp({
        id, version: 1, agent: `${id}-owner`, inputSchema: Type.Object({}),
        observers: [{ id: "source", intervalMs: 60_000, async run() {
          return { events: [{ type: `${id}.observed`, data: { state: "ready" } }], nextObservation: { state: "ready" } };
        } }, ...(id === "second" ? [{ id: "broken", intervalMs: 60_000, async run(): Promise<[]> {
          throw new Error("Source unavailable");
        } }] : [])],
      }) };
    });
    const context = () => ({ read: {} as never, log: {} as never, workspace: { appRoot: root, projectRoot: root } });
    const producer = new EventBus();
    const writer = new DbWriter(root);
    producer.setPersistenceSubscriber(writer.handler);
    if (mode === "live") producer.setDeliveryRecorder(writer.recordDelivery);
    observers = createAppObserverRuntime({ bus: producer, context });
    observers.replace(entries);
    observers.scanNow();
    await until(() => entries.every(({ definition }) => observers!.health(definition.id).every((h) => h.lastCompletedAt)));
    expect(observers.health("second").find((h) => h.id === "broken")?.lastError).toBe("Source unavailable");
    observers.close();
    if (mode === "restart") closeDb(root);

    const db = getDb(root);
    const bus = new EventBus();
    const consumer = new DbWriter(root);
    bus.setPersistenceSubscriber(consumer.handler);
    bus.setDeliveryRecorder(consumer.recordDelivery);
    // The journal, not today's observer registration, retains publication intent.
    const registry = new AppRegistry(async () => entries.map(({ appDir, definition }) => ({
      appDir, definition: defineApp({ ...definition, observers: [] }),
    })));
    await registry.reload();
    runtime = await startAppInboxRuntime({ db, bus, registry, persistDir: root, schedulesEnabled: false,
      attachTask: () => { throw new Error("Unconsumed observations must not create work"); } });
    await until(() => db.prepare("SELECT COUNT(*) AS n FROM events WHERE app_admission_pending = 1").get()?.n === 0);
    consumer.runHousekeeping(Date.now() + 120_001);
    const rows = db.prepare("SELECT event_type, record_only, delivery_status, delivery_route FROM events ORDER BY id").all();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.event_type).sort()).toEqual(["app.observer.failed", "first.observed", "second.observed"]);
    for (const row of rows) expect(row).toMatchObject({ record_only: 1, delivery_status: "accepted", delivery_route: "noop" });
    expect(db.prepare(UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY).get()).toEqual({ value: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_inbox_items").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM app_tasks").get()).toEqual({ n: 0 });
  } finally {
    observers?.close();
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("an ordinary observer still delivers subscribed work through the saved admission plan", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-observer-work-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const appDir = join(root, "sample.app");
    mkdirSync(appDir);
    let reads = 0;
    const definition = defineApp({
      id: "sample", version: 1, agent: "worker",
      inputSchema: Type.Object({ kind: Type.Literal("review"), data: Type.Object({ state: Type.String() }) }),
      tasks: {},
      task: ({ id }) => ({ kind: "desired", intent: {
        id: `work/${id}`, parentId: "root", outcome: "Review the changed state", acceptance: ["Reviewed"],
      } }),
      observers: [{ id: "source", intervalMs: 60_000, async run() {
        reads++;
        return [{ type: "sample.observed", data: { state: "ready" } }];
      } }],
      subscriptions: [{ id: "review", event: "sample.observed", toInput: (event) => ({ kind: "review", data: event.data }) }],
    });
    const registry = new AppRegistry(async () => [{ appDir, definition }]);
    await registry.reload();
    const db = getDb(root);
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    const inputs: unknown[] = [];
    runtime = await startAppInboxRuntime({ db, bus, registry, persistDir: root, schedulesEnabled: false,
      observerContext: () => ({ read: {} as never, log: {} as never, workspace: { appRoot: root, projectRoot: root } }),
      attachTask: fakeTaskAttacher(db, (input) => { inputs.push(input); return { taskId: "work/review" }; }),
    });
    await until(() => inputs.length === 1);
    expect(reads).toBe(1);
    expect(db.prepare("SELECT record_only, delivery_status, delivery_route, app_admission_pending FROM events WHERE event_type = 'sample.observed'")
      .get()).toEqual({ record_only: 1, delivery_status: "accepted", delivery_route: "direct", app_admission_pending: 0 });
    expect(db.prepare("SELECT status FROM app_event_admission_plans").get()).toEqual({ status: "completed" });
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
