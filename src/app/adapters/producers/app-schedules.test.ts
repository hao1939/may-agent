import { afterEach, expect, it } from "bun:test";
import { defineApp, Type, type AppSchedule } from "@may-agent/sdk";
import { EVENT_RECORD_ONLY, EventBus, type AgentEvent } from "../../event-bus.js";
import { createAppScheduleProducer } from "./app-schedules.js";

const producers: ReturnType<typeof createAppScheduleProducer>[] = [];
afterEach(() => {
  for (const p of producers.splice(0)) p.close();
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

function fixture(enabled = true) {
  let now = 50;
  const bus = new EventBus();
  const events: AgentEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const producer = createAppScheduleProducer({ bus, now: () => now, enabled });
  producers.push(producer);
  return {
    producer,
    events,
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
