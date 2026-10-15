import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/requests.js";
import { fakeTaskAttacher } from "../../../test/fixtures/task-attachment.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus, EVENT_ROW_ID } from "../core/events/bus.js";
import { discoverAppDefinitions } from "../adapters/discovery/app-definitions.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";

function bus(root: string): EventBus {
  const value = new EventBus();
  const writer = new DbWriter(root);
  value.setPersistenceSubscriber(writer.handler);
  value.setDeliveryRecorder(writer.recordDelivery);
  return value;
}

async function registry(root: string): Promise<AppRegistry> {
  const value = new AppRegistry(discoverAppDefinitions(root));
  await value.reload();
  return value;
}

function installRecipient(root: string): void {
  const dir = join(root, "recipient.app");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "app.js"),
    `export default {
    id: "recipient", version: 1, owner: "missing-owner",
    inputSchema: { type: "object", additionalProperties: false, required: ["kind", "data"], properties: {
      kind: { const: "message" }, data: { type: "object", required: ["message"], properties: {
        message: { type: "string" }, context: { type: "object" }
      } }
    } },
    task(input) { return { kind: "desired", intent: { id: "message/" + input.id, parentId: "recipient", outcome: "Handle message", acceptance: ["Handled"] } }; },
    tasks: {}
  };\n`,
  );
}

function message() {
  return {
    type: "message.created" as const,
    source: "agent:sender",
    owner: "agent:missing-owner",
    data: {
      from: "sender",
      to: "missing-owner",
      content: "fixture",
      intent: "status-update",
      priority: "P2",
      idempotencyKey: "unroutable-address-fixture",
    },
  };
}

async function settleFailureEvents(): Promise<void> {
  await Bun.sleep(15);
}

test("terminally settles a persistently unroutable durable address and does not retry after restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-unroutable-address-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const firstBus = bus(root);
    const persisted = firstBus.emit(message());
    const eventId = persisted[EVENT_ROW_ID]!;
    let db = getDb(root);
    const apps = await registry(root);
    runtime = await startAppInboxRuntime({
      registry: apps,
      db,
      bus: firstBus,
      deferStart: true,
      schedulesEnabled: false,
    });

    firstBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents();
    expect(
      db.prepare("SELECT app_admission_attempts, app_admission_pending FROM events WHERE id = ?").get(eventId),
    ).toEqual({ app_admission_attempts: 1, app_admission_pending: 1 });
    runtime.close();
    closeDb(root);

    db = getDb(root);
    const restartedBus = bus(root);
    runtime = await startAppInboxRuntime({
      registry: apps,
      db,
      bus: restartedBus,
      deferStart: true,
      schedulesEnabled: false,
    });
    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents();
    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents();

    const terminal = db
      .prepare(
        "SELECT app_admission_attempts, app_admission_pending, delivery_status, delivery_note FROM events WHERE id = ?",
      )
      .get(eventId) as Record<string, unknown>;
    expect(terminal).toMatchObject({
      app_admission_attempts: 3,
      app_admission_pending: 0,
      delivery_status: "unhandled",
    });
    expect(terminal.delivery_note).toContain("terminal App admission after 3 unroutable address attempts");
    expect(db.prepare("SELECT COUNT(*) count FROM events WHERE event_type = 'subscriber.failed'").get()).toEqual({
      count: 2,
    });

    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents();
    expect(db.prepare("SELECT app_admission_attempts FROM events WHERE id = ?").get(eventId)).toEqual({
      app_admission_attempts: 3,
    });
    expect(db.prepare("SELECT COUNT(*) count FROM events WHERE event_type = 'subscriber.failed'").get()).toEqual({
      count: 2,
    });

    installRecipient(root);
    await runtime.reload();
    const retried = restartedBus.emit(message());
    expect(retried[EVENT_ROW_ID]).toBe(eventId);
    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents();
    expect(
      db
        .prepare(
          "SELECT app_admission_attempts, app_admission_pending, delivery_status, delivery_note FROM events WHERE id = ?",
        )
        .get(eventId),
    ).toEqual(terminal);
    expect(db.prepare("SELECT COUNT(*) count FROM app_inbox_items WHERE origin_event_id = ?").get(eventId)).toEqual({
      count: 0,
    });
    expect(db.prepare("SELECT COUNT(*) count FROM events WHERE event_type = 'subscriber.failed'").get()).toEqual({
      count: 2,
    });
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("a route added before exhaustion delivers exactly once", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-transient-address-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const eventBus = bus(root);
    const persisted = eventBus.emit(message());
    const eventId = persisted[EVENT_ROW_ID]!;
    const db = getDb(root);
    const apps = await registry(root);
    runtime = await startAppInboxRuntime({
      registry: apps,
      db,
      bus: eventBus,
      deferStart: true,
      schedulesEnabled: false,
      attachTask: fakeTaskAttacher(db, (input) => ({ taskId: `message/${input.inboxInputId ?? input.inputId}` })),
    });
    eventBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents();
    installRecipient(root);
    await runtime.reload();
    eventBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    eventBus.redeliverPersisted(message(), eventId, "app-inbox-route");

    expect(
      db
        .prepare("SELECT app_admission_attempts, app_admission_pending, delivery_status FROM events WHERE id = ?")
        .get(eventId),
    ).toEqual({ app_admission_attempts: 1, app_admission_pending: 0, delivery_status: "accepted" });
    expect(db.prepare("SELECT COUNT(*) count FROM app_inbox_items WHERE origin_event_id = ?").get(eventId)).toEqual({
      count: 1,
    });
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
