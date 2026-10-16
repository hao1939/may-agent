import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/requests.js";
import { fakeTaskAttacher } from "../../../test/fixtures/task-attachment.js";
import { AppRegistry } from "../core/apps/registry.js";
import { EventBus, EVENT_ROW_ID, type Subscriber } from "../core/events/bus.js";
import { createEventInterface, getEventView } from "../core/events/interface.js";
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

async function settleFailureEvents(
  eventBus: EventBus,
  db: ReturnType<typeof getDb>,
  expectedCount: number,
): Promise<void> {
  // Failure notifications drain FIFO, one per timer turn. Observe a deliberate
  // trailing failure so even a no-new-failures assertion waits for the queue.
  // The marker uses a different original type and is excluded from our count.
  const marker = `failure-drain:${crypto.randomUUID()}`;
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type === "info" && event.message === marker) throw new Error(marker);
  });
  try {
    eventBus.emit({ type: "info", message: marker });
  } finally {
    unsubscribe();
  }
  const drained = db.prepare(
    "SELECT 1 FROM events WHERE event_type = 'subscriber.failed' AND json_extract(data, '$.error') = ?",
  );
  const deadline = Date.now() + 3_000;
  while (!drained.get(marker)) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for the failure queue's persisted drain marker");
    await Bun.sleep(5);
  }
  expect(
    db
      .prepare(
        `SELECT COUNT(*) count FROM events
    WHERE event_type = 'subscriber.failed' AND json_extract(data, '$.originalEventType') = 'message.created'`,
      )
      .get(),
  ).toEqual({ count: expectedCount });
}

test("address exhaustion preserves independent acceptance and retry scope across restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-address-independent-acceptance-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const eventBus = bus(root);
    let effects = 0;
    const accept: Subscriber = (event) => {
      if (event.type !== "message.created") return;
      effects += 1;
      return { accepted: true, by: "independent-route", route: "direct", note: "Independent effect accepted" };
    };
    eventBus.subscribeDurableRoute(accept, { label: "independent-route" });
    // As with worker acceptance before parent relay, App admission is still pending.
    const eventId = eventBus.emit(message())[EVENT_ROW_ID]!;
    let db = getDb(root);
    const readReceipt = () =>
      db
        .prepare(
          "SELECT delivery_status, accepted_by, accepted_at, delivery_route, delivery_note FROM events WHERE id = ?",
        )
        .get(eventId);
    const accepted = readReceipt();
    runtime = await startAppInboxRuntime({
      registry: await registry(root),
      db,
      bus: eventBus,
      deferStart: true,
      schedulesEnabled: false,
    });
    for (let i = 0; i < 3; i++) eventBus.emit(message());
    expect(readReceipt()).toEqual(accepted);
    const error = db.prepare("SELECT app_admission_error FROM events WHERE id = ?").get(eventId)?.app_admission_error;
    expect(error).toContain("terminal App admission after 3 unroutable address attempts");
    expect(getEventView(db, eventId)?.links).toContainEqual({
      kind: "delivery",
      id: `app-admission:${eventId}`,
      state: "failed",
      summary: error,
    });
    eventBus.emit(message());
    expect(effects).toBe(1);
    await settleFailureEvents(eventBus, db, 2);
    runtime.close();
    closeDb(root);

    // Restart and a newly installed recipient cannot renew the exhausted route.
    installRecipient(root);
    db = getDb(root);
    const restartedBus = bus(root);
    restartedBus.subscribeDurableRoute(accept, { label: "independent-route" });
    runtime = await startAppInboxRuntime({
      registry: await registry(root),
      db,
      bus: restartedBus,
      deferStart: true,
      schedulesEnabled: false,
    });
    expect(restartedBus.emit(message())[EVENT_ROW_ID]).toBe(eventId);
    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    expect(readReceipt()).toEqual(accepted);
    expect(effects).toBe(1);
    expect(
      db
        .prepare("SELECT app_admission_attempts, app_admission_pending, app_admission_error FROM events WHERE id = ?")
        .get(eventId),
    ).toEqual({ app_admission_attempts: 3, app_admission_pending: 0, app_admission_error: error });
    expect(getEventView(db, eventId)?.links).toContainEqual({
      kind: "delivery",
      id: `app-admission:${eventId}`,
      state: "failed",
      summary: error,
    });
    expect(db.prepare("SELECT COUNT(*) count FROM app_inbox_items WHERE origin_event_id = ?").get(eventId)).toEqual({
      count: 0,
    });
    await settleFailureEvents(restartedBus, db, 2);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("independent failure and later acceptance cannot erase exhausted App admission", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-address-later-acceptance-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const eventBus = bus(root);
    const db = getDb(root);
    runtime = await startAppInboxRuntime({
      registry: await registry(root),
      db,
      bus: eventBus,
      deferStart: true,
      schedulesEnabled: false,
    });
    const eventId = eventBus.emit(message())[EVENT_ROW_ID]!;
    eventBus.emit(message());
    eventBus.emit(message());
    await settleFailureEvents(eventBus, db, 2);
    const terminalLink = getEventView(db, eventId)?.links;
    expect(terminalLink).toEqual([
      {
        kind: "delivery",
        id: `app-admission:${eventId}`,
        state: "failed",
        summary: expect.stringContaining("terminal App admission after 3 unroutable address attempts"),
      },
    ]);

    let routeAttempts = 0;
    eventBus.subscribeDurableRoute(
      (event) => {
        if (event.type !== "message.created") return;
        routeAttempts += 1;
        if (routeAttempts === 1) throw new Error("independent route unavailable");
        return { accepted: true, by: "independent-route", route: "direct", note: "Independent effect accepted later" };
      },
      { label: "independent-route" },
    );
    eventBus.emit(message());
    await settleFailureEvents(eventBus, db, 3);
    expect(getEventView(db, eventId)?.links).toEqual(terminalLink);

    eventBus.emit(message());
    expect(
      db.prepare("SELECT delivery_status, accepted_by, delivery_note FROM events WHERE id = ?").get(eventId),
    ).toEqual({
      delivery_status: "accepted",
      accepted_by: "independent-route",
      delivery_note: "Independent effect accepted later",
    });
    expect(getEventView(db, eventId)?.links).toEqual(terminalLink);
    eventBus.emit(message());
    expect(routeAttempts).toBe(2);
    expect(
      db.prepare("SELECT app_admission_attempts, app_admission_pending FROM events WHERE id = ?").get(eventId),
    ).toEqual({ app_admission_attempts: 3, app_admission_pending: 0 });
    await settleFailureEvents(eventBus, db, 3);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

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
    await settleFailureEvents(firstBus, db, 1);
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
    await settleFailureEvents(restartedBus, db, 2);
    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents(restartedBus, db, 2);

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

    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents(restartedBus, db, 2);
    expect(db.prepare("SELECT app_admission_attempts FROM events WHERE id = ?").get(eventId)).toEqual({
      app_admission_attempts: 3,
    });

    installRecipient(root);
    await runtime.reload();
    const retried = restartedBus.emit(message());
    expect(retried[EVENT_ROW_ID]).toBe(eventId);
    restartedBus.redeliverPersisted(message(), eventId, "app-inbox-route");
    await settleFailureEvents(restartedBus, db, 2);
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
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("Event-interface keyed retries preserve terminal rejection evidence", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-unroutable-address-interface-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const eventBus = bus(root);
    const db = getDb(root);
    runtime = await startAppInboxRuntime({
      registry: await registry(root),
      db,
      bus: eventBus,
      deferStart: true,
      schedulesEnabled: false,
    });
    const events = createEventInterface({
      bus: eventBus,
      db,
      validateAppInput: () => {},
      hasApp: () => false,
      hasAgent: () => false,
      hasSession: () => false,
    });
    const publication = {
      type: "message.created" as const,
      idempotencyKey: "unroutable-address-interface-fixture",
      data: {
        from: "sender",
        to: "missing-owner",
        content: "fixture",
        intent: "status-update",
        priority: "P2",
      },
    };

    const first = events.publish(publication, { source: "fixture", allowUnregisteredFact: true });
    events.publish(publication, { source: "fixture", allowUnregisteredFact: true });
    const third = events.publish(publication, { source: "fixture", allowUnregisteredFact: true });
    await settleFailureEvents(eventBus, db, 2);

    expect(third.eventId).toBe(first.eventId);
    const terminal = db
      .prepare(
        "SELECT app_admission_attempts, app_admission_pending, delivery_status, delivery_note FROM events WHERE id = ?",
      )
      .get(first.eventId) as Record<string, unknown>;
    expect(terminal).toMatchObject({
      app_admission_attempts: 3,
      app_admission_pending: 0,
      delivery_status: "unhandled",
    });
    expect(terminal.delivery_note).toContain("terminal App admission after 3 unroutable address attempts");

    events.publish(publication, { source: "fixture", allowUnregisteredFact: true });
    expect(
      db
        .prepare(
          "SELECT app_admission_attempts, app_admission_pending, delivery_status, delivery_note FROM events WHERE id = ?",
        )
        .get(first.eventId),
    ).toEqual(terminal);
    await settleFailureEvents(eventBus, db, 2);
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
    await settleFailureEvents(eventBus, db, 1);
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
    await settleFailureEvents(eventBus, db, 1);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("record-only acceptance before App routing does not hide address exhaustion", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-address-record-only-"));
  let runtime: AppInboxRuntime | undefined;
  try {
    const eventBus = bus(root);
    const db = getDb(root);
    const events = createEventInterface({
      bus: eventBus,
      db,
      validateAppInput: () => {},
      hasApp: () => false,
      hasAgent: () => false,
      hasSession: () => false,
    });
    const publication = { type: "message.created" as const, data: message().data };
    const { eventId } = events.publish(publication, { source: "fixture", allowUnregisteredFact: true });
    expect(db.prepare("SELECT delivery_status, delivery_route FROM events WHERE id = ?").get(eventId)).toEqual({
      delivery_status: "accepted",
      delivery_route: "noop",
    });
    runtime = await startAppInboxRuntime({
      registry: await registry(root),
      db,
      bus: eventBus,
      deferStart: true,
      schedulesEnabled: false,
    });
    for (let i = 0; i < 4; i++) events.publish(publication, { source: "fixture", allowUnregisteredFact: true });
    await settleFailureEvents(eventBus, db, 2);
    const view = getEventView(db, eventId);
    expect(view?.delivery.state).toBe("unhandled");
    expect(view?.links).toEqual([
      {
        kind: "delivery",
        id: `app-admission:${eventId}`,
        state: "failed",
        summary: expect.stringContaining("terminal App admission after 3 unroutable address attempts"),
      },
    ]);
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
