import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DbWriter } from "./db-writer.js";
import { closeDb, getDb } from "./db/connection.js";
import { stateTransaction } from "./db/transaction.js";
import { openDatabase } from "./db.js";
import { EventBus, EVENT_ROW_ID } from "../app/core/events/bus.js";
const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);

test("contended Event persistence and receipt writes yield without losing their retry identity", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-contention-"));
  roots.push(root);
  const db = getDb(root);
  const competing = openDatabase(join(root, "may.db"));
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  const payload = { type: "fixture.requested", source: "fixture", owner: "app:sample",
    data: { idempotencyKey: "same-request", message: "Retain this work" } };
  const sleeps = spyOn(Atomics, "wait");
  try {
    competing.exec("BEGIN IMMEDIATE");
    const turn = new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(() => bus.emit(payload)).toThrow(/locked|SQLITE_BUSY/i);
    expect(db.prepare("SELECT COUNT(*) AS n FROM events").get()).toEqual({ n: 0 });
    expect(sleeps).not.toHaveBeenCalled();
    await turn;
    competing.exec("COMMIT");

    // The caller retries unsaved input with the same key on a later turn.
    const event = bus.emit(payload);
    const eventId = event[EVENT_ROW_ID]!;
    expect(eventId).toBeGreaterThan(0);
    competing.exec("BEGIN IMMEDIATE");
    writer.recordDelivery(event, { accepted: true, by: "fixture", appAdmission: true });
    expect(sleeps).not.toHaveBeenCalled();
    expect(db.prepare("SELECT delivery_status, app_admission_pending FROM events WHERE id = ?").get(eventId))
      .toEqual({ delivery_status: "pending", app_admission_pending: 1 });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    competing.exec("COMMIT");

    // Recover only the unfinished receipt, preserving the committed Event.
    writer.recordDelivery(event, { accepted: true, by: "fixture", appAdmission: true });
    expect(bus.emit(payload)[EVENT_ROW_ID]).toBe(eventId);
    expect(db.prepare("SELECT id, delivery_status, app_admission_pending FROM events").all())
      .toEqual([{ id: eventId, delivery_status: "accepted", app_admission_pending: 0 }]);
  } finally {
    sleeps.mockRestore();
    competing.close();
  }
});
test("event persistence joins the caller transaction and can retry after its rollback", () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-state-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.subscribeDurableRoute(() => ({ accepted: true, by: "fixture", route: "direct" }));
  const emit = () =>
    bus.emit({
      type: "conversation.message.created",
      source: "fixture",
      owner: "app:sample",
      data: {
        appId: "sample",
        conversationId: "chat",
        author: { kind: "agent", id: "sample" },
        text: "Answer",
        idempotencyKey: "answer",
      },
    });
  expect(() =>
    stateTransaction(db, () => {
      emit();
      throw new Error("fixture rollback");
    }),
  ).toThrow("fixture rollback");
  expect(
    db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'conversation.message.created'").get(),
  ).toEqual({ count: 0 });
  stateTransaction(db, emit);
  stateTransaction(db, emit);
  expect(
    db.prepare("SELECT delivery_status FROM events WHERE event_type = 'conversation.message.created'").all(),
  ).toEqual([{ delivery_status: "accepted" }]);
});

test("non-journaled conversation.updated wake is delivered only after stateTransaction commit and dropped on rollback with no events row", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-wake-tx-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const subscribed: string[] = [];
  const listened: string[] = [];
  bus.subscribe((event) => {
    if (event.type === "conversation.updated") subscribed.push(String((event as any).data?.conversationId));
  });
  bus.listen(
    (event) => {
      if (event.type === "conversation.updated") listened.push(String((event as any).data?.conversationId));
    },
    { label: "test-wake-listener", types: ["conversation.updated"] },
  );

  // 1. Rollback: neither subscriber nor listener receives the wake, and no events row is written.
  expect(() =>
    stateTransaction(db, () => {
      bus.emit({
        type: "conversation.updated",
        source: "fixture",
        owner: "app:sample",
        data: { appId: "sample", conversationId: "rolled-back" },
      });
      expect(subscribed).toEqual([]);
      expect(listened).toEqual([]);
      throw new Error("rollback wake");
    }),
  ).toThrow("rollback wake");
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(subscribed).toEqual([]);
  expect(listened).toEqual([]);
  expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'conversation.updated'").get()).toEqual({
    count: 0,
  });

  // 2. Commit: neither subscriber nor listener sees the wake before commit; delivered once after commit, with 0 events rows.
  stateTransaction(db, () => {
    bus.emit({
      type: "conversation.updated",
      source: "fixture",
      owner: "app:sample",
      data: { appId: "sample", conversationId: "committed" },
    });
    expect(subscribed).toEqual([]);
    expect(listened).toEqual([]);
  });
  expect(subscribed).toEqual(["committed"]);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(listened).toEqual(["committed"]);
  expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'conversation.updated'").get()).toEqual({
    count: 0,
  });
});

test("input preparation fails before taking the Event writer slot", () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-prepare-"));
  roots.push(root);
  const db = getDb(root);
  const writer = new DbWriter(root);
  const exec = spyOn(db, "exec");
  const payload: Record<string, unknown> = { idempotencyKey: "invalid" };
  payload.circular = payload;
  try {
    expect(() => writer.handler({ type: "fixture.saved", source: "fixture", owner: "app:sample", data: payload })).toThrow();
    expect(exec.mock.calls.some(([sql]) => sql === "BEGIN IMMEDIATE")).toBe(false);
    expect(db.prepare("SELECT COUNT(*) AS count FROM events").get()).toEqual({ count: 0 });
  } finally {
    exec.mockRestore();
  }
});
