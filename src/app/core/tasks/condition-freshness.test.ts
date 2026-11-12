import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { observationCondition } from "@may-agent/sdk";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
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

function legacyStore() {
  const root = mkdtempSync(join(tmpdir(), "condition-freshness-"));
  roots.push(root);
  const path = join(root, "state.sqlite");
  const store = AppTaskResourceStore.openStandalone(path, "sample");
  store.db
    .prepare("INSERT INTO app_task_store_meta(app_id, key, value) VALUES ('sample', 'app_metadata', ?)")
    .run(JSON.stringify({ project: "sample", root_task_id: "root" }));
  store.db.prepare("UPDATE app_task_store_meta SET value = '3' WHERE key = 'schema_version'").run();
  const put = (value: AppTaskCondition) =>
    store.db
      .prepare(
        "INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES ('sample', ?, ?, ?)",
      )
      .run(value.metadata.id, value.status.state, JSON.stringify(value));
  return { path, store, put };
}

test("upgrade preserves old waits, observations and scalar matching, then survives reopen without reapplying name rules", () => {
  const { path, store, put } = legacyStore();
  const old = condition("sample.state", { state: "ready", source: "app:sample:observer:reader" });
  const scalar = condition("sample.check", " Completed ");
  const done = {
    ...condition("sample.pulse", true),
    status: {
      state: "true" as const,
      observedGeneration: 2,
      observedAt: new Date(2000).toISOString(),
      observed: { eventId: 7 },
      facts: ["saved fact"],
    },
  };
  const historical = condition("sample.finished", "done");
  for (const value of [old, scalar, done, historical]) put(value);
  store.close();
  const reopened = AppTaskResourceStore.openStandalone(path, "sample");
  let saved: Record<string, AppTaskCondition>;
  try {
    saved = reopened.readSnapshot().conditions!;
    expect(saved[old.metadata.id]).toEqual({
      ...old,
      metadata: { ...old.metadata, resourceVersion: 4 },
      spec: { ...old.spec, expected: { ...(old.spec.expected as object), timestamp: { gte: 2000 } } },
    });
    expect(saved[done.metadata.id].status).toEqual(done.status);
    expect(saved[historical.metadata.id]).toEqual(historical);
    expect(
      matchesAppTaskCondition(saved[old.metadata.id], {
        type: old.spec.type,
        resource: "sample",
        state: "ready",
        source: "app:sample:observer:reader",
        timestamp: 1999,
      }),
    ).toBe(false);
    expect(
      matchesAppTaskCondition(saved[scalar.metadata.id], {
        type: scalar.spec.type,
        resource: "sample",
        status: "succeeded",
        timestamp: 2000,
      }),
    ).toBe(true);
    expect(
      matchesAppTaskCondition(saved[scalar.metadata.id], {
        type: scalar.spec.type,
        resource: "sample",
        status: "failed",
        timestamp: 2000,
      }),
    ).toBe(false);
    expect(
      reopened.db.prepare("SELECT value FROM app_task_store_meta WHERE app_id='sample' AND key='schema_version'").get(),
    ).toEqual({ value: "4" });
    // A current declaration intentionally accepting history is not retrofitted
    // with an implicit policy merely because its name ends in .state.
    reopened.db
      .prepare("UPDATE app_task_conditions SET condition_json = ? WHERE condition_id = ?")
      .run(JSON.stringify(old), old.metadata.id);
  } finally {
    reopened.close();
  }
  const again = AppTaskResourceStore.openStandalone(path, "sample");
  try {
    const values = again.readSnapshot().conditions!;
    expect(values[old.metadata.id]).toEqual(old);
    expect(values[scalar.metadata.id]).toEqual(saved![scalar.metadata.id]);
    expect(
      matchesAppTaskCondition(values[old.metadata.id], {
        type: old.spec.type,
        resource: "sample",
        state: "ready",
        source: "app:sample:observer:reader",
        timestamp: 1999,
      }),
    ).toBe(true);
  } finally {
    again.close();
  }
});

test.each(["unrepresentable", {}, { gte: null }])(
  "upgrade intersects time constraints and rolls back an unrepresentable contract: %j",
  (invalidTimestamp) => {
    const { store, put } = legacyStore();
    const old = condition("sample.state", { state: "ready", timestamp: { gte: 1000, lt: 4000 } });
    put(old);
    const invalid = condition("sample.check", { state: "ready", timestamp: invalidTimestamp });
    put(invalid);
    try {
      expect(() => AppTaskResourceStore.fromDb(store.db, "sample")).toThrow("needs an explicit timestamp expectation");
      const read = () =>
        store.db
          .prepare("SELECT condition_json FROM app_task_conditions WHERE condition_id = ?")
          .get(old.metadata.id) as { condition_json: string };
      expect(JSON.parse(read().condition_json)).toEqual(old);
      expect(
        store.db.prepare("SELECT value FROM app_task_store_meta WHERE app_id='sample' AND key='schema_version'").get(),
      ).toEqual({ value: "3" });
      store.db.prepare("DELETE FROM app_task_conditions WHERE condition_id = ?").run(invalid.metadata.id);
      AppTaskResourceStore.fromDb(store.db, "sample");
      expect(JSON.parse(read().condition_json).spec.expected.timestamp).toEqual({ gte: 2000, lt: 4000 });
    } finally {
      store.close();
    }
  },
);

test("upgrade retains pending settlement effects and unchanged waits with their original boundary", () => {
  const { path, store, put } = legacyStore();
  const saved = condition("sample.state", { state: "ready" });
  put(saved);
  const changedAction = condition("sample.pulse", { state: "ready" });
  changedAction.spec.requestedAction = "Original action";
  put(changedAction);
  const fresh = {
    id: "later",
    type: "sample.check",
    subject: "resource:sample",
    expected: "done",
    owner: "app:sample",
  };
  const report = {
    handlerResult: {
      state: "waiting",
      summary: "Saved execution",
      facts: ["execution:one"],
      actions: [],
      conditions: [
        { id: saved.metadata.id, ...saved.spec },
        fresh,
        { requestId: "independent" },
        { id: changedAction.metadata.id, ...changedAction.spec, requestedAction: "Changed action" },
      ],
      requests: [{ id: "independent", appId: "peer", input: { kind: "review", data: {} } }],
    },
    runId: "saved-run",
  };
  const attempt = {
    metadata: { id: "one", resourceVersion: 3 },
    taskId: "work",
    taskGeneration: 2,
    state: "running",
    startedAt: new Date(1000).toISOString(),
    pendingSettlement: {
      claim: { taskId: "work", attemptId: "one", generation: 2 },
      report,
      acceptanceBasis: "executor",
    },
  };
  store.db
    .prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
    VALUES ('sample', 'one', 'work', 2, 'running', 1000, ?)`,
    )
    .run(JSON.stringify(attempt));
  // Retired report formats still reach their existing stopped-runtime conversion
  // fence; this schema upgrade must not consume or reinterpret their effects.
  const retired = {
    ...attempt,
    metadata: { id: "retired", resourceVersion: 1 },
    pendingSettlement: { report: { conversation: { response: "Retained report" } } },
  };
  store.db
    .prepare(
      `INSERT INTO app_task_attempts(app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
    VALUES ('sample', 'retired', 'work', 2, 'running', 1000, ?)`,
    )
    .run(JSON.stringify(retired));
  store.close();
  setSystemTime(new Date(3000));
  const reopened = AppTaskResourceStore.openStandalone(path, "sample");
  try {
    expect(reopened.readAttempt("retired")).toEqual(retired);
    const upgraded = reopened.readAttempt("one")!;
    expect(upgraded).toEqual({
      ...attempt,
      metadata: { ...attempt.metadata, resourceVersion: 4 },
      pendingSettlement: {
        ...attempt.pendingSettlement,
        report: {
          ...report,
          handlerResult: {
            ...report.handlerResult,
            conditions: [
              { id: saved.metadata.id, ...saved.spec, expected: { state: "ready", timestamp: { gte: 2000 } } },
              { ...fresh, expected: { equals: "done", timestamp: { gte: 3000 } } },
              { requestId: "independent" },
              {
                id: changedAction.metadata.id,
                ...changedAction.spec,
                requestedAction: "Changed action",
                expected: { state: "ready", timestamp: { gte: 3000 } },
              },
            ],
          },
        },
      },
    });
  } finally {
    reopened.close();
  }
});

test("live routing and recovered observations share the durable Host publication time", () => {
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
  } finally {
    closeDb(root);
  }
});
