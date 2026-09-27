import { expect, test } from "bun:test";
import { matchesAppTaskCondition } from "./app-task-condition-tracker.js";
import type { AppTaskCondition } from "./app-task-state.js";
import { openDatabase } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskReconcileResult } from "@may-agent/sdk";

function condition(type: string, notBefore?: number): AppTaskCondition {
  return {
    metadata: { id: "ready", generation: 1, resourceVersion: 1 },
    spec: {
      type,
      subject: "credential:example",
      expected: "done",
      owner: "app:example",
      reviewAfterMs: 60_000,
      ...(notBefore === undefined ? {} : { notBefore }),
    },
    status: { observedGeneration: 0, state: "unknown", observedAt: new Date(2000).toISOString() },
  };
}

test("applies declared freshness independently of event names and preserves timeless results", () => {
  for (const type of [
    "probe.state",
    "probe.check",
    "probe.pulse",
    "probe-pulse",
    "aks.repo-ref.observed",
    "probe.observed",
  ]) {
    const event = { type, timestamp: 1000, data: { credential: "example", state: "completed" } };
    expect(matchesAppTaskCondition(condition(type), event)).toBe(true);
    expect(matchesAppTaskCondition(condition(type, 2000), event)).toBe(false);
    expect(matchesAppTaskCondition(condition(type, 2000), { ...event, timestamp: 2000 })).toBe(true);
    expect(matchesAppTaskCondition(condition(type, 2000), { ...event, timestamp: new Date(2000).toISOString() })).toBe(
      true,
    );
    expect(matchesAppTaskCondition(condition(type, 2000), { ...event, timestamp: undefined })).toBe(false);
    expect(
      matchesAppTaskCondition(condition(type, 2000), {
        ...event,
        timestamp: 3000,
        data: { credential: "other", state: "done" },
      }),
    ).toBe(false);
  }
  const explicit = condition("probe.observed");
  explicit.spec.expected = { state: "completed", observedAt: { gte: 2000 } };
  expect(
    matchesAppTaskCondition(explicit, {
      type: "probe.observed",
      data: { credential: "example", state: "completed", observedAt: 1000 },
    }),
  ).toBe(false);
  expect(
    matchesAppTaskCondition(explicit, {
      type: "probe.observed",
      data: { credential: "example", state: "completed", observedAt: 2000 },
    }),
  ).toBe(true);
});

test("upgrades old open Conditions once, preserving their original expected value and accepted history", () => {
  const db = openDatabase(":memory:");
  try {
    applyDbSchema(db);
    AppTaskResourceStore.fromDb(db, "example");
    db.prepare("UPDATE app_task_store_meta SET value = '3' WHERE app_id = 'example' AND key = 'schema_version'").run();
    for (const [id, value] of [
      ["open", condition("probe.state")],
      ["explicit", condition("probe.state", 1500)],
      ["timeless", condition("probe.observed")],
      [
        "accepted",
        { ...condition("probe.state"), status: { state: "true", observedAt: new Date(2000).toISOString() } },
      ],
    ] as const) {
      db.prepare("INSERT INTO app_task_conditions VALUES ('example', ?, ?, ?)").run(
        id,
        value.status.state,
        JSON.stringify(value),
      );
    }
    const read = (id: string) =>
      JSON.parse(
        String(
          db.prepare("SELECT condition_json FROM app_task_conditions WHERE condition_id = ?").get(id)?.condition_json,
        ),
      );
    applyDbSchema(db);
    expect(read("open")).toMatchObject({
      spec: { expected: "done", notBefore: 2000 },
      metadata: { resourceVersion: 2 },
    });
    expect(read("explicit").spec.notBefore).toBe(1500);
    expect(read("timeless").spec.notBefore).toBeUndefined();
    expect(read("accepted").spec.notBefore).toBeUndefined();
    const event = { type: "probe.state", timestamp: 1000, data: { credential: "example", state: "done" } };
    expect(matchesAppTaskCondition(read("open"), event)).toBe(false);
    // A new same-name Condition is not rewritten on later database opens.
    db.prepare("INSERT INTO app_task_conditions VALUES ('example', 'new', 'unknown', ?)").run(
      JSON.stringify(condition("probe.state")),
    );
    applyDbSchema(db);
    expect(read("new").spec.notBefore).toBeUndefined();
    expect(read("open").metadata.resourceVersion).toBe(2);
  } finally {
    db.close();
  }
});

test("keeps the explicit observation fence through result normalization and rejects invalid fences", () => {
  const value = condition("probe.observed", 2000);
  const result = {
    state: "waiting",
    summary: "Wait for current evidence",
    facts: [],
    actions: [],
    conditions: [{ id: value.metadata.id, ...value.spec }],
  };
  // Use the production SDK boundary used by agent and workflow results.
  const options = { allowNeedsAgent: false };
  const admitted = admitTaskReconcileResult(result, options);
  expect(admitted).toMatchObject({ ok: true });
  expect(JSON.stringify(admitted)).toContain('"notBefore":2000');
  for (const notBefore of [-1, NaN, Infinity, "2000"]) {
    expect(
      admitTaskReconcileResult({ ...result, conditions: [{ ...result.conditions[0], notBefore }] }, options),
    ).toMatchObject({ ok: false });
  }
});
