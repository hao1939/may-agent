import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DbWriter } from "../../lib/db-writer.js";
import { closeDb, getDb } from "../../lib/db/connection.js";
import { AppRegistry } from "../core/apps/registry.js";
import { discoverAppDefinitions } from "../adapters/discovery/app-definitions.js";
import { EventBus, EVENT_ROW_ID } from "../core/events/bus.js";
import { createAppInboxItem, getAppInboxItem } from "../core/state/app-inbox-store.js";
import { rejectTaskInput } from "../core/state/inbox.js";
import { AppTaskAdmissionError } from "../core/state/task-admission-error.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "./app-inbox-runtime.js";

test("restart acknowledges an exact settled request without readmitting its former Conversation target", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-settled-input-recovery-"));
  let runtime: AppInboxRuntime | undefined;
  const createBus = () => {
    const bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
    return bus;
  };
  try {
    mkdirSync(join(root, "recipient.app"));
    writeFileSync(
      join(root, "recipient.app", "app.js"),
      `export default {
      id: "recipient", version: 1, owner: "worker", inputSchema: { type: "object" },
      task() { throw new Error("A settled request must not be remapped"); }, tasks: {}
    };`,
    );
    let db = getDb(root);
    const original = createAppInboxItem(db, {
      id: "conversation-input",
      appId: "recipient",
      conversationId: "primary",
      conversationSequence: 1,
      source: { kind: "human", id: "original" },
      input: { kind: "message", data: {} },
    }).item;
    db.prepare("UPDATE app_inbox_items SET execution_task_id = 'conversation-executor' WHERE id = ?").run(original.id);
    const request = {
      id: "settled-request",
      appId: "recipient",
      targetTaskId: "conversation-executor",
      source: { kind: "app" as const, id: "caller" },
      input: { kind: "message", data: { message: "obsolete request" } },
      idempotencyKey: "settled:1",
    };
    const retained = createAppInboxItem(db, request).item;
    rejectTaskInput(
      db,
      retained,
      new AppTaskAdmissionError("Conversation Task input must use conversationId without targetTaskId"),
      100,
    );
    const result = getAppInboxItem(db, retained.id)!.result;
    const publication = {
      type: "app.input.requested" as const,
      source: "app-task:caller",
      owner: "app:recipient",
      data: { ...request, requestId: request.id },
    };
    const eventId = createBus().emit(publication)[EVENT_ROW_ID]!;
    closeDb(root);

    // Both the terminal Inbox and the still-pending Event survive the process boundary.
    db = getDb(root);
    const registry = new AppRegistry(discoverAppDefinitions(root));
    await registry.reload();
    const bus = createBus();
    runtime = await startAppInboxRuntime({ registry, db, bus, schedulesEnabled: false });
    const deadline = Date.now() + 3_000;
    while (
      db.prepare("SELECT app_admission_pending FROM events WHERE id = ?").get(eventId)?.app_admission_pending !== 0
    ) {
      if (Date.now() >= deadline) throw new Error("Settled Event was not acknowledged after restart");
      await Bun.sleep(5);
    }
    expect(getAppInboxItem(db, retained.id)).toMatchObject({
      status: "done",
      result,
      completedAt: 100,
      originEventId: eventId,
    });
    expect(db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(eventId)).toEqual({
      delivery_status: "accepted",
    });
    bus.emit(publication);
    expect(getAppInboxItem(db, retained.id)?.result).toEqual(result);
    expect(db.prepare("SELECT count(*) count FROM app_tasks").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT count(*) count FROM app_inbox_items").get()).toEqual({ count: 2 });
    expect(db.prepare("SELECT count(*) count FROM events WHERE event_type = 'subscriber.failed'").get()).toEqual({
      count: 0,
    });
  } finally {
    runtime?.close();
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
