import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus, EVENT_ROW_ID } from "../app/core/events/bus.js";
import { DbWriter } from "./db-writer.js";
import { closeDb, getDb } from "./db/connection.js";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-receipt-expiry-"));
  roots.push(root);
  const bus = new EventBus();
  const writer = new DbWriter(root, { housekeepingIntervalMs: 0 });
  bus.setPersistenceSubscriber(writer.handler);
  return { root, bus, writer };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([undefined, 500])("receipt expiry has the same deadline before and after restart (TTL: %s)", (ttlMs) => {
  const publishedAt = 1_800_000_000_000;
  const clock = spyOn(Date, "now").mockReturnValue(publishedAt);
  try {
    const uninterrupted = fixture();
    const restarted = fixture();
    const event = {
      type: "fixture.requested",
      source: "fixture",
      owner: "app:sample",
      data: {},
      ...(ttlMs === undefined ? {} : { ttl_ms: ttlMs }),
    };
    const ids = [uninterrupted, restarted].map(({ bus }) => bus.emit({ ...event })[EVENT_ROW_ID]!);
    const deadline = publishedAt + (ttlMs ?? 120_000);
    const receipts = () =>
      [uninterrupted, restarted].map(({ root }, index) =>
        getDb(root)
          .prepare("SELECT delivery_status, delivery_note, app_admission_pending FROM events WHERE id = ?")
          .get(ids[index]!),
      );

    closeDb(restarted.root);
    clock.mockReturnValue(publishedAt + 100);
    const maintenance = new DbWriter(restarted.root, { housekeepingIntervalMs: 0 });
    uninterrupted.writer.runHousekeeping(deadline - 1);
    maintenance.runHousekeeping(deadline - 1);
    expect(receipts()).toEqual([
      { delivery_status: "pending", delivery_note: null, app_admission_pending: 1 },
      { delivery_status: "pending", delivery_note: null, app_admission_pending: 1 },
    ]);
    uninterrupted.writer.runHousekeeping(deadline + 1);
    maintenance.runHousekeeping(deadline + 1);
    const expired = {
      delivery_status: "unhandled",
      app_admission_pending: 1,
      delivery_note: "no responsible consumer accepted event before timeout",
    };
    expect(receipts()).toEqual([expired, expired]);
    // Reopening after expiry must not reset the receipt or its outstanding App interest.
    closeDb(restarted.root);
    clock.mockReturnValue(deadline + 2);
    new DbWriter(restarted.root, { housekeepingIntervalMs: 0 }).runHousekeeping(deadline + 3);
    expect(receipts()).toEqual([expired, expired]);
  } finally {
    clock.mockRestore();
  }
});

test("a later maintenance process expires failed required delivery without replaying subscribers", () => {
  const clock = spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  try {
    const { root, bus, writer } = fixture();
    bus.setDeliveryRecorder(writer.recordDelivery);
    let deliveries = 0;
    bus.subscribeDurableRoute(() => {
      deliveries++;
      throw new Error("Required consumer unavailable");
    });
    const event = bus.emit({ type: "fixture.requested", source: "fixture", owner: "app:sample", data: {}, ttl_ms: 1 });
    clock.mockReturnValue(Date.now() + 100);
    // Production maintenance has its own writer, which can start after publication.
    new DbWriter(root, { housekeepingIntervalMs: 0 }).runHousekeeping();
    expect(getDb(root).prepare("SELECT delivery_status FROM events WHERE id = ?").get(event[EVENT_ROW_ID]!)).toEqual({
      delivery_status: "unhandled",
    });
    expect(deliveries).toBe(1);
  } finally {
    clock.mockRestore();
  }
});

test("expiry preserves historical uncertainty, accepted receipts and independent App admission", () => {
  const { root, bus, writer } = fixture();
  const db = getDb(root);
  // Historical rows have no durable admission marker. Age alone does not invent an obligation.
  db.run(`INSERT INTO events (event_type, data, timestamp, delivery_status, delivery_note)
    VALUES ('legacy.observed', '{}', 1, 'pending', 'historical evidence')`);
  const accepted = bus.emit({ type: "fixture.requested", source: "fixture", owner: "app:sample", data: {} });
  writer.recordDelivery(accepted, { accepted: true, by: "independent-owner", route: "direct" });
  const before = db
    .prepare("SELECT id, delivery_status, delivery_note, accepted_by, app_admission_pending FROM events ORDER BY id")
    .all();
  closeDb(root);
  new DbWriter(root, { housekeepingIntervalMs: 0 }).runHousekeeping(Date.now() + 300_000);
  expect(
    getDb(root)
      .prepare("SELECT id, delivery_status, delivery_note, accepted_by, app_admission_pending FROM events ORDER BY id")
      .all(),
  ).toEqual(before);
  expect(before).toEqual([
    expect.objectContaining({ delivery_status: "pending", app_admission_pending: null }),
    expect.objectContaining({
      delivery_status: "accepted",
      accepted_by: "independent-owner",
      app_admission_pending: 1,
    }),
  ]);
});
