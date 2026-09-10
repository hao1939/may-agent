import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DbWriter } from "./db-writer.js";
import { closeDb, getDb } from "./requests.js";
import { stateTransaction } from "./db/transaction.js";
import { EventBus } from "../app/core/events/bus.js";
const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);
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
