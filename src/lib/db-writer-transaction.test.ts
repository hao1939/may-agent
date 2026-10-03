import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DbWriter } from "./db-writer.js";
import { closeDb, getDb } from "./requests.js";
import { stateTransaction } from "./db/transaction.js";
import { EVENT_DELIVERY_RESULT, EVENT_ROW_ID, EventBus } from "../app/core/events/bus.js";
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
  bus.setDurableRouteRecorder(writer.recordDurableRoute);
  bus.subscribeDurableRoute(() => ({ accepted: true, by: "fixture", route: "direct" }), { label: "test-durable-route-1" });
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

test("durable-route completion and its acceptance receipt roll back together", () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-route-receipt-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.setDurableRouteRecorder(writer.recordDurableRoute);
  bus.subscribeDurableRoute(() => ({ accepted: true, by: "route-owner", route: "direct" }), {
    label: "route-owner",
  });
  const emit = () =>
    bus.emit({
      type: "fixture.changed",
      source: "fixture",
      owner: "app:sample",
      data: { idempotencyKey: "atomic-route-receipt", value: "accepted" },
    });

  db.exec(`CREATE TEMP TRIGGER abort_event_acceptance
    BEFORE UPDATE OF delivery_status ON events
    WHEN NEW.delivery_status = 'accepted'
    BEGIN SELECT RAISE(ABORT, 'fixture acceptance failure'); END`);
  const failed = emit();
  expect(failed[EVENT_DELIVERY_RESULT]).toBeUndefined();
  const eventId = Number(db.prepare("SELECT id FROM events WHERE event_type = 'fixture.changed'").get()?.id);
  expect(db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(eventId)).toEqual({
    delivery_status: "pending",
  });
  expect(db.prepare("SELECT status FROM event_durable_routes WHERE event_id = ? AND route_id = 'route-owner'").get(eventId)).toEqual({
    status: "pending",
  });

  db.exec("DROP TRIGGER abort_event_acceptance");
  const recovered = emit();
  expect(recovered[EVENT_DELIVERY_RESULT]).toEqual({ accepted: true, by: "route-owner", route: "direct" });
  expect(db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(eventId)).toEqual({
    delivery_status: "accepted",
  });
  expect(db.prepare("SELECT status FROM event_durable_routes WHERE event_id = ? AND route_id = 'route-owner'").get(eventId)).toEqual({
    status: "completed",
  });
  expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'fixture.changed'").get()).toEqual({ count: 1 });
});

test("the final durable-route settlement returns the authoritative two-route receipt", () => {
  const root = mkdtempSync(join(tmpdir(), "may-event-two-route-"));
  roots.push(root);
  const db = getDb(root);
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  bus.setDurableRouteRecorder(writer.recordDurableRoute);
  bus.subscribeDurableRoute(() => ({ accepted: true, by: "route-a", route: "direct" }), { label: "route-a" });
  bus.subscribeDurableRoute(() => ({ accepted: true, by: "route-b", route: "direct" }), { label: "route-b" });

  const event = bus.emit({
    type: "fixture.changed",
    source: "fixture",
    owner: "app:sample",
    data: { value: "ordinary-success" },
  });
  const eventId = Number(event[EVENT_ROW_ID]);

  expect(event[EVENT_DELIVERY_RESULT]).toEqual({ accepted: true, by: "route-a", route: "direct" });
  expect(db.prepare("SELECT delivery_status, accepted_by FROM events WHERE id = ?").get(eventId)).toEqual({
    delivery_status: "accepted",
    accepted_by: "route-a",
  });
  expect(
    db.prepare("SELECT route_id, status FROM event_durable_routes WHERE event_id = ? ORDER BY route_id").all(eventId),
  ).toEqual([
    { route_id: "route-a", status: "completed" },
    { route_id: "route-b", status: "completed" },
  ]);
});

for (const scenario of ["same-route", "mixed-routes", "default-direct"] as const) {
  test(`direct acceptance supersedes noop evidence: ${scenario}`, () => {
    const root = mkdtempSync(join(tmpdir(), "may-event-noop-upgrade-"));
    roots.push(root);
    const db = getDb(root);
    const writer = new DbWriter(root);
    const bus = new EventBus();
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDurableRouteRecorder(writer.recordDurableRoute);
    bus.setDeliveryRecorder(writer.recordDelivery);
    let claimed = false;
    bus.subscribeDurableRoute(() => claimed
      ? { accepted: true, by: "owner", ...(scenario === "default-direct" ? {} : {route: "direct"}) }
      : { accepted: true, by: "observer", route: "noop" }, {label: "a-route"});
    if (scenario === "mixed-routes") {
      bus.subscribeDurableRoute(() => ({accepted: true, by: "owner", route: "direct"}), {label: "b-route"});
    }
    const emit = () => bus.emit({type: "fixture.changed", source: "fixture", owner: "app:sample", data: {idempotencyKey: scenario}});
    let event = emit();
    if (scenario !== "mixed-routes") { claimed = true; event = emit(); }
    expect(event[EVENT_DELIVERY_RESULT]).toEqual({accepted: true, by: "owner", route: "direct"});
    expect(db.prepare("SELECT delivery_status, accepted_by, delivery_route FROM events WHERE id = ?").get(event[EVENT_ROW_ID])).toEqual({delivery_status: "accepted", accepted_by: "owner", delivery_route: "direct"});
  });
}
