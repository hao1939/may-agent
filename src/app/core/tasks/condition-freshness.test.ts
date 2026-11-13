import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { observationCondition } from "@may-agent/sdk";
import { matchesAppTaskCondition } from "./app-task-condition-tracker.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { getDb, closeDb } from "../../../lib/db/connection.js";
import { EventBus, EVENT_ROW_ID } from "../events/bus.js";
import { loadPersistedEvent } from "../events/persisted.js";
import type { AppTaskCondition } from "./app-task-state.js";

const roots: string[] = [];
afterEach(() => {
  setSystemTime();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function condition(type: string, expected: unknown): AppTaskCondition {
  return {
    metadata: { id: type, generation: 2, resourceVersion: 3 },
    spec: { type, subject: "resource:sample", expected, owner: "app:sample" },
    status: { state: "unknown", observedGeneration: 0, observedAt: new Date(2000).toISOString() },
  };
}

test.each(["sample.state", "sample.check", "sample.pulse", "sample-pulse", "aks.repo-ref.observed", "sample.observed"])(
  "%s uses declared expectations, independently of event spelling",
  (type) => {
    const historical = condition(type, { field: "state", equals: "ready" });
    const fresh = condition(type, { field: "state", equals: "ready", timestamp: { gte: 2000 } });
    const event = { type, resource: "sample", state: "ready", timestamp: 1999 };
    expect(matchesAppTaskCondition(historical, event)).toBe(true);
    expect(matchesAppTaskCondition(fresh, event)).toBe(false);
    expect(matchesAppTaskCondition(fresh, { ...event, timestamp: 2000 })).toBe(true);
    expect(matchesAppTaskCondition(fresh, { ...event, timestamp: undefined, data: { timestamp: 3000 } })).toBe(false);
    expect(matchesAppTaskCondition(fresh, { ...event, timestamp: 2001, state: "unavailable" })).toBe(false);
  },
);

test("resource observations declare a construction-time boundary and preserve caller source-validity requirements", () => {
  setSystemTime(new Date(2000));
  const capability = {
    appId: "sample",
    id: "reader",
    type: "sample.observed",
    description: "Current state",
    intervalMs: 1000,
    timeoutMs: 100,
  };
  const interest = {
    observerId: "reader",
    id: "ready",
    resource: "sample",
    expected: { state: "ready", revision: "abc" },
  };
  const built = observationCondition(capability, interest);
  expect(built.expected).toEqual({
    ...interest.expected,
    timestamp: { gte: 2000 },
    source: "app:sample:observer:reader",
  });
  expect(interest.expected).toEqual({ state: "ready", revision: "abc" });
  const wait = { ...condition(built.type, built.expected), spec: built };
  const event = {
    type: built.type,
    resource: "sample",
    state: "ready",
    revision: "abc",
    source: "app:sample:observer:reader",
    timestamp: 2000,
  };
  expect(matchesAppTaskCondition(wait, event)).toBe(true);
  expect(matchesAppTaskCondition(wait, { ...event, timestamp: 1999 })).toBe(false);
  expect(matchesAppTaskCondition(wait, { ...event, revision: "obsolete" })).toBe(false);
  expect(matchesAppTaskCondition(wait, { ...event, source: "app:other:observer:reader" })).toBe(false);
  expect(
    observationCondition(capability, { ...interest, expected: { ...interest.expected, timestamp: { gte: 1000 } } })
      .expected,
  ).toMatchObject({ timestamp: { gte: 1000 } });
});

test("live routing, persisted reads and keyed retries share the saved envelope time", () => {
  const root = mkdtempSync(join(tmpdir(), "condition-publication-"));
  roots.push(root);
  setSystemTime(new Date(3000));
  const writer = new DbWriter(root);
  const bus = new EventBus();
  bus.setPersistenceSubscriber(writer.handler);
  try {
    const event = bus.emit({
      type: "sample.observed",
      source: "app:sample:observer:reader",
      owner: "app:sample",
      data: { resource: "sample", state: "ready", measuredAt: 500, timestamp: 9000 },
    });
    const recovered = loadPersistedEvent(getDb(root), event[EVENT_ROW_ID]!, root)!;
    const wait = condition("sample.observed", { state: "ready", timestamp: { gte: 2000 } });
    expect(event.timestamp).toBe(3000);
    expect(recovered.timestamp).toBe(event.timestamp);
    expect(matchesAppTaskCondition(wait, event)).toBe(true);
    expect(matchesAppTaskCondition(wait, recovered)).toBe(true);
    expect(event.data).toMatchObject({ measuredAt: 500, timestamp: 9000 });
    const explicit = bus.emit({
      type: "sample.observed",
      timestamp: 1000,
      source: "app:sample:observer:reader",
      owner: "app:sample",
      data: { ...event.data, idempotencyKey: "same-time" },
    });
    const recoveredExplicit = loadPersistedEvent(getDb(root), explicit[EVENT_ROW_ID]!, root)!;
    expect(explicit.timestamp).toBe(1000);
    expect(recoveredExplicit.timestamp).toBe(1000);
    expect(matchesAppTaskCondition(wait, explicit)).toBe(false);
    expect(matchesAppTaskCondition(wait, recoveredExplicit)).toBe(false);
    const retry = bus.emit({ ...explicit, timestamp: 9000 });
    expect(retry[EVENT_ROW_ID]).toBe(explicit[EVENT_ROW_ID]);
    expect(retry.timestamp).toBe(1000);
    expect(matchesAppTaskCondition(wait, retry)).toBe(false);
    getDb(root)
      .prepare("UPDATE events SET envelope_json = json_set(envelope_json, '$.timestamp', 'damaged') WHERE id = ?")
      .run(explicit[EVENT_ROW_ID]!);
    expect(() => bus.emit({ ...explicit, timestamp: 9000 })).toThrow("Stored event envelope timestamp must be finite");
  } finally {
    closeDb(root);
  }
});
