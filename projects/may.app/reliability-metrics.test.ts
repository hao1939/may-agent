import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type SqliteDb } from "../may-agent/src/lib/db.js";
import { applyDbSchema } from "../may-agent/src/lib/db/schema.js";
import { closeDb, getDb } from "../may-agent/src/lib/db/connection.js";
import { EventBus } from "../may-agent/src/app/core/events/bus.js";
import { createAppReporting } from "../may-agent/src/app/composition/reporting.js";
import { measureSourceMetrics } from "../may-agent/src/app/metric-source-measurement.js";
import { createAppScheduleProducer } from "../may-agent/src/app/adapters/producers/app-schedules.js";
import {
  createAppInboxItem,
  recordAppInboxRecoveryFailure,
  resolveAppInboxRecovery,
} from "../may-agent/src/app/core/state/app-inbox-store.js";
import {
  reliabilityMetrics,
  REVIEW_LAG_METRIC,
  SQL_TIME_METRIC,
} from "./reliability-metrics.js";
import app from "./app.js";

let db: SqliteDb;
beforeEach(() => {
  db = openDatabase(":memory:");
  applyDbSchema(db);
});
afterEach(() => db.close());
function sample(id: string) {
  return db
    .prepare(
      reliabilityMetrics.find((metric) => metric.id === id)!.sourceQuery!,
    )
    .get() as any;
}

function sqlHeartbeat(
  store: SqliteDb,
  at: number,
  pid: number,
  since: number,
  totalMs: number,
) {
  store
    .prepare(
      "INSERT INTO events(event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      "runtime.daemon.heartbeat",
      "daemon",
      "agent:may",
      JSON.stringify({
        pid,
        sql: { since, totalMs, calls: totalMs, errors: 0, untrackedCalls: 0 },
      }),
      at,
    );
}

test("SQL cost uses recent counter deltas, separates restarts and keeps absent or stale coverage unknown", () => {
  const now = Date.now();
  expect(sample(SQL_TIME_METRIC)).toBeNull();
  sqlHeartbeat(db, now - 400_000, 10, 1, 200_000);
  sqlHeartbeat(db, now - 300_000, 10, 1, 250_000);
  expect(sample(SQL_TIME_METRIC)).toBeNull(); // old samples cannot report current health
  sqlHeartbeat(db, now - 200_000, 11, 2, 1_000);
  sqlHeartbeat(db, now - 100_000, 11, 2, 26_000);
  // 75 seconds of SQL in 200 seconds of observed time, without bridging a restart.
  expect(sample(SQL_TIME_METRIC)).toMatchObject({ value: 37.5, sampleSize: 4 });
  const note = JSON.parse(sample(SQL_TIME_METRIC).note);
  expect(note).toMatchObject({ elapsedMs: 200_000, sqlMs: 75_000 });
  expect(note.nextRead).toContain("diagnostics.sql");
  const plan = db
    .prepare(
      `EXPLAIN QUERY PLAN ${reliabilityMetrics.find((metric) => metric.id === SQL_TIME_METRIC)!.sourceQuery}`,
    )
    .all();
  expect(
    plan.some((step) =>
      String(step.detail).includes(
        "idx_events_type (event_type=? AND timestamp>? AND timestamp<?)",
      ),
    ),
  ).toBe(true);
});

test("May schedules one normal collection opportunity every five minutes without a Task input", () => {
  let now = 0;
  const bus = new EventBus();
  const observed: unknown[] = [];
  bus.subscribe((event) => {
    if (event.type === "trigger.metrics-snapshot") observed.push(event);
  });
  const producer = createAppScheduleProducer({ bus, now: () => now });
  try {
    producer.replace([{ appDir: "/fixture/may.app", definition: app }]);
    producer.scanNow();
    expect(observed).toEqual([]);
    now = 300_000;
    producer.scanNow();
    producer.scanNow();
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      type: "trigger.metrics-snapshot",
      source: "app:may:schedule:metric-source-collection",
      data: { idempotencyKey: "schedule:may:metric-source-collection:1" },
    });
    now = 600_000;
    producer.scanNow();
    expect(observed).toHaveLength(2);
  } finally {
    producer.close();
  }
});

test("declared reliability metrics collect through the Host and retain a real breach and recovery", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-reliability-collection-"));
  try {
    const store = getDb(root);
    const reporting = createAppReporting(() => store);
    reporting.syncDefinitions([{ definition: app }]);
    const now = Date.now();
    sqlHeartbeat(store, now - 120_000, 1, now - 200_000, 10);
    sqlHeartbeat(store, now - 60_000, 1, now - 200_000, 20);
    const old = Date.now() - 2 * 86400000;
    createAppInboxItem(store, {
      id: "unadmitted",
      appId: "sample",
      source: { kind: "system", id: "fixture" },
      input: { kind: "request", data: {} },
      now: old,
    });
    recordAppInboxRecoveryFailure(store, "unadmitted", "input-admission", "mapping unavailable", old);
    const bus = new EventBus();
    const collected = await measureSourceMetrics({ bus, persistDir: root });
    expect(collected.failures).toEqual([]);
    expect(collected.skipped).toEqual([]);
    expect(collected.measured.sort()).toEqual(reliabilityMetrics.map((metric) => metric.id).sort());
    expect(await reporting.readMetric("may.unresolved-input-recovery-count")).toMatchObject({ value: 1, sampleSize: 1 });
    const alert = store.prepare("SELECT id, resolved_at FROM metric_alerts WHERE metric_id = ?")
      .get("may.oldest-input-recovery-age-seconds") as { id: number; resolved_at: number | null };
    const alertId = alert.id;
    expect(alertId).toBeGreaterThan(0);
    expect(alert.resolved_at).toBeNull();
    resolveAppInboxRecovery(store, "unadmitted", "input-admission", Date.now());
    expect((await measureSourceMetrics({ bus, persistDir: root })).failures).toEqual([]);
    expect(await reporting.readMetric("may.unresolved-input-recovery-count")).toMatchObject({ value: 0, sampleSize: 0 });
    expect(store.prepare("SELECT resolved_at FROM metric_alerts WHERE id = ?").get(alertId))
      .toMatchObject({ resolved_at: expect.any(Number) });
  } finally {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("input metrics include old unadmitted work after feedback and exclude recovered operations", () => {
  const old = Date.now() - 5 * 86400000;
  createAppInboxItem(db, {
    id: "input",
    appId: "sample",
    source: { kind: "system", id: "fixture" },
    input: { kind: "request", data: {} },
    now: old,
  });
  recordAppInboxRecoveryFailure(
    db,
    "input",
    "input-admission",
    "mapping unavailable",
    old,
  );
  expect(sample("may.unresolved-input-recovery-count").value).toBe(1);
  expect(sample("may.oldest-input-recovery-age-seconds").value).toBeGreaterThan(
    4 * 86400,
  );
  const note = JSON.parse(sample("may.unresolved-input-recovery-count").note);
  expect(note.examples[0]).toMatchObject({
    appId: "sample",
    inputId: "input",
    stage: "input-admission",
    failures: 1,
  });
  resolveAppInboxRecovery(db, "input", "input-admission", Date.now());
  expect(sample("may.unresolved-input-recovery-count").value).toBe(0);
});

test("retains failed attempts after later success and calculates the rate from the same terminal cohort", () => {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT INTO app_task_attempts(app_id, task_id, attempt_id, task_generation, state, started_at, attempt_json) VALUES (?, ?, ?, 1, ?, ?, ?)`,
  );
  for (const [id, state] of [
    ["failed", "failed"],
    ["recovered", "completed"],
    ["interrupted", "interrupted"],
    ["running", "running"],
  ]) {
    insert.run(
      "sample",
      "same-task",
      id,
      state,
      now - 10000,
      JSON.stringify({
        startedAt: new Date(now - 10000).toISOString(),
        finishedAt:
          state === "running" ? null : new Date(now - 5000).toISOString(),
      }),
    );
  }
  const observed = sample("may.failed-task-attempts-24h");
  expect(observed.value).toBe(1);
  expect(observed.sampleSize).toBe(3);
  expect(JSON.parse(observed.note)).toMatchObject({
    failurePercent: 33.333,
    examples: [{ appId: "sample", taskId: "same-task", attemptId: "failed" }],
  });
});

test("overdue reviews route to May once per alert, while an empty population remains explicitly limited", () => {
  const empty = sample("may.failed-task-attempts-24h");
  expect(empty.value).toBe(0);
  expect(empty.sampleSize).toBe(0);
  expect(JSON.parse(empty.note).failurePercent).toBeNull();
  createAppInboxItem(db, {
    id: "review",
    appId: "evaluation",
    source: { kind: "system", id: "fixture" },
    input: { kind: "review-metric", data: {} },
    now: Date.now() - 3 * 86400000,
  });
  expect(sample(REVIEW_LAG_METRIC).value).toBeGreaterThan(2 * 86400);
  const route = app.subscriptions!.find(
    (subscription) => subscription.id === "evaluation-review-lag",
  )!;
  expect(
    route.toInput({
      type: "metric.breach",
      data: { metricId: REVIEW_LAG_METRIC },
    } as any),
  ).toMatchObject({ kind: "message" });
  expect(
    route.toInput({
      type: "metric.breach",
      data: { metricId: REVIEW_LAG_METRIC, repeat: true },
    } as any),
  ).toBeNull();
});
