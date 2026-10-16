import { afterEach, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineApp, Type, type AppSchedule } from "@may-agent/sdk";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { EVENT_RECORD_ONLY, EventBus, type AgentEvent } from "../../core/events/bus.js";
import { createAppScheduleProducer } from "./app-schedules.js";
import { startAppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { AppRegistry } from "../../core/apps/registry.js";
import { fakeTaskAttacher } from "../../../../test/fixtures/task-attachment.js";

const producers: ReturnType<typeof createAppScheduleProducer>[] = [];
const roots = new Set<string>();
afterEach(() => {
  for (const p of producers.splice(0)) p.close();
  for (const root of roots) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
  roots.clear();
});
const entries = (schedules: AppSchedule[]) => [
  {
    appDir: "/fixture/sample.app",
    definition: defineApp({
      id: "sample",
      agent: "sample-owner",
      version: 1,
      inputSchema: Type.Object({}),
      schedules,
    }),
  },
];

function fixture(enabled = true, root = mkdtempSync(join(tmpdir(), "may-schedule-"))) {
  roots.add(root);
  const db = getDb(root);
  let now = 50;
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const events: AgentEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const producer = createAppScheduleProducer({ db, bus, now: () => now, enabled });
  producers.push(producer);
  return {
    producer,
    events,
    db,
    bus,
    root,
    at(value: number) {
      now = value;
    },
  };
}

it("publishes only the latest due input/fact with its declared catch-up semantics", () => {
  const f = fixture();
  f.producer.replace(
    entries([
      { id: "latest", intervalMs: 100, input: { kind: "review", data: {} } },
      { id: "none", intervalMs: 100, input: { kind: "review", data: {} }, catchUp: "none" },
      { id: "fact", intervalMs: 100, event: { type: "sample.changed", data: {} } },
    ]),
  );
  f.producer.scanNow();
  expect(f.events).toHaveLength(1);
  f.at(350);
  f.producer.scanNow();
  f.producer.scanNow();
  expect(f.events).toHaveLength(4);
  expect(f.events.map((e) => e.data.idempotencyKey)).toEqual([
    "schedule:sample:latest:0",
    "schedule:sample:latest:3",
    "schedule:sample:none:3",
    "schedule:sample:fact:3",
  ]);
  expect(f.events[3]![EVENT_RECORD_ONLY]).toBeTrue();
});

it.each(["reload", "restart", "re-enable"])("keeps the published input unchanged after %s and uses revised instructions next slot", (change) => {
  let f = fixture();
  const original = entries([{ id: "review", intervalMs: 100, input: { kind: "review", data: { requirement: "original" } } }]);
  const revised = entries([{ id: "review", intervalMs: 100, input: { kind: "review", data: { requirement: "revised" } } }]);
  f.producer.replace(original);
  f.producer.scanNow();
  const before = f.db.prepare("SELECT * FROM events").all();
  expect(before).toHaveLength(1);
  if (change === "restart") {
    f.producer.close();
    closeDb(f.root);
    f = fixture(true, f.root);
  } else if (change === "re-enable") {
    f.producer.replace(entries([{ ...original[0]!.definition.schedules![0]!, enabled: false }]));
    f.producer.scanNow();
    f.producer.replace([]);
  }
  f.producer.replace(revised);
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    f.producer.scanNow();
    f.producer.scanNow();
    expect(errors).not.toHaveBeenCalled();
    expect(f.db.prepare("SELECT * FROM events").all()).toEqual(before);
    f.at(150);
    f.producer.scanNow();
    f.producer.scanNow();
    expect(f.db.prepare("SELECT json_extract(data, '$.input.data.requirement') AS requirement FROM events ORDER BY id").all())
      .toEqual([{ requirement: "original" }, { requirement: "revised" }]);
  } finally {
    errors.mockRestore();
  }
});

it("retries a transient publication failure without consuming the slot", () => {
  const f = fixture();
  const writer = new DbWriter(f.root);
  let unavailable = true;
  f.bus.setPersistenceSubscriber((event) => {
    if (unavailable) throw new Error("fixture publication unavailable");
    return writer.handler(event);
  });
  f.producer.replace(entries([{ id: "review", intervalMs: 100, input: { kind: "review", data: {} } }]));
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    f.producer.scanNow();
    expect(f.events).toHaveLength(0);
    unavailable = false;
    f.producer.scanNow();
    f.producer.scanNow();
    expect(f.events).toHaveLength(1);
    expect(f.db.prepare("SELECT count(*) AS count FROM events").get()).toEqual({ count: 1 });
  } finally {
    errors.mockRestore();
  }
});

it("recovers delivery of the original published input when the restarted schedule has changed", async () => {
  const f = fixture();
  f.producer.replace(entries([{ id: "review", intervalMs: 100, input: { kind: "review", data: { requirement: "original" } } }]));
  f.producer.scanNow();
  f.producer.close();
  const saved = f.db.prepare("SELECT id, data, app_admission_pending FROM events").get()!;
  expect(saved.app_admission_pending).toBe(1);
  const registry = new AppRegistry(async () => [{
    appDir: f.root,
    definition: defineApp({
      id: "sample", agent: "sample-owner", version: 1,
      tasks: {},
      inputSchema: Type.Object({ kind: Type.Literal("review"), data: Type.Object({ requirement: Type.String() }) }),
      task: (input) => ({ kind: "desired", intent: {
        id: `review/${input.id}`, parentId: "sample", outcome: String(input.input.data.requirement), acceptance: ["Reviewed"],
      } }),
      schedules: [{ id: "review", intervalMs: 100, input: { kind: "review", data: { requirement: "revised" } } }],
    }),
  }]);
  await registry.reload();
  const admitted = Promise.withResolvers<string>();
  const runtime = await startAppInboxRuntime({
    db: f.db, bus: f.bus, registry, persistDir: f.root, now: () => 50,
    scanIntervalMs: 60_000,
    attachTask: fakeTaskAttacher(f.db, ({ attachment }) => {
      if (attachment.kind !== "desired") throw new Error("Expected desired Task");
      admitted.resolve(attachment.intent.outcome);
      return { taskId: attachment.intent.id };
    }),
  });
  try {
    expect(await admitted.promise).toBe("original");
    runtime.scanNow();
    expect(f.db.prepare("SELECT id, data, app_admission_pending FROM events WHERE event_type = 'app.input.requested'").all())
      .toEqual([{ ...saved, app_admission_pending: 0 }]);
    expect(f.db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
  } finally {
    runtime.close();
  }
});

it("restores exact activation slots when a replacement publication is rejected", () => {
  const f = fixture();
  const original = entries([{ id: "review", intervalMs: 100, input: { kind: "review", data: {} } }]);
  f.producer.replace(original);
  f.producer.scanNow();
  f.at(150);
  const undo = f.producer.replace(entries([{ id: "review", intervalMs: 1_000, input: { kind: "changed", data: {} } }]));
  undo();
  f.producer.scanNow();
  f.producer.scanNow();
  expect(f.events.map((e) => e.data.idempotencyKey)).toEqual(["schedule:sample:review:0", "schedule:sample:review:1"]);
  f.producer.replace(original);
  f.producer.scanNow();
  expect(f.events).toHaveLength(2);
});

it("does not publish disabled producers or closed registrations", () => {
  const f = fixture(false);
  f.producer.replace(entries([{ id: "review", intervalMs: 100, input: { kind: "review", data: {} } }]));
  f.producer.start(5);
  f.at(150);
  f.producer.scanNow();
  expect(f.events).toEqual([]);
  f.producer.close();
  f.producer.scanNow();
  expect(f.events).toEqual([]);
});
