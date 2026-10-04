import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { createMetricService } from "../../../lib/metrics.js";
import { EventBus } from "../../core/events/bus.js";
import { attachMetricSourceMeasurement, evaluateMetrics, measureSourceMetrics } from "../../metric-source-measurement.js";
import { readTaskAttempts } from "./task-attempts.js";
import { TASK_FAILOVER_METRIC } from "./task-failover-metrics.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture() {
  const persistDir = mkdtempSync(join(tmpdir(), "task-failover-metrics-"));
  roots.push(persistDir);
  const db = getDb(persistDir);
  const bus = new EventBus();
  const service = createMetricService({ getDb: () => db });
  return { persistDir, db, bus, service };
}

it("counts retained failover claims quietly, links exact evidence and keeps recovered failures visible", async () => {
  const { persistDir, db, bus, service } = fixture();
  // An App can calibrate a review threshold; sampling itself never requests work.
  service.define({ ...TASK_FAILOVER_METRIC, threshold: 2, alertOp: ">" });
  const events: string[] = [];
  bus.subscribe((event) => { events.push(event.type); });
  const cut = Math.floor(Date.now() / 1_000) * 1_000;
  const insert = (id: string, start: number, state: string, from?: string, appId = "sample") => {
    const attempt = { handler: from ? "agent:owner" : "executor:measure", state,
      startedAt: new Date(start).toISOString(),
      ...(state !== "running" ? { finishedAt: new Date(start + 100).toISOString() } : {}),
      ...(from ? { failoverFromAttemptId: from } : {}) };
    db.prepare(`INSERT INTO app_task_attempts
      (app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json)
      VALUES (?, ?, 'work', 1, ?, ?, ?)`)
      .run(appId, id, state, start, JSON.stringify(attempt));
  };
  for (const [i, state] of ["running", "failed", "interrupted", "completed", "completed", "completed"].entries()) {
    const appId = i === 5 ? "other" : "sample";
    insert(`source-${i}`, cut - 20_000 - i, "failed", undefined, appId);
    insert(`agent-${i}`, cut - 10_000 - i, state, `source-${i}`, appId);
  }
  insert("old", cut - 86_400_001, "completed", "old-source");
  insert("future", cut + 60_000, "running", "future-source");
  insert("unmarked", cut - 2_000, "failed");
  insert("continuation", cut - 1_000, "completed");

  const options = { bus, persistDir };
  expect(await measureSourceMetrics(options)).toMatchObject({ skipped: [], failures: [] });
  const sample = service.get(TASK_FAILOVER_METRIC.id)!.observation!;
  expect(sample).toMatchObject({ value: 6, sampleSize: 6 });
  expect(sample.measuredAt).toBeGreaterThanOrEqual(cut);
  const note = JSON.parse(sample.note!);
  expect(note.examplesTruncated).toBe(1);
  expect(note.examples).toHaveLength(5);
  for (const example of note.examples) {
    expect(readTaskAttempts(db, { appId: example.appId, taskId: example.taskId, attemptId: example.attemptId }))
      .toMatchObject({ available: true, failoverFromAttemptId: example.fromAttemptId });
    expect(readTaskAttempts(db, { appId: example.appId, taskId: example.taskId, attemptId: example.fromAttemptId }))
      .toMatchObject({ available: true, state: "failed" });
  }
  expect(readTaskAttempts(db, { appId: "sample", end: sample.measuredAt, windowMs: 86_400_000 }))
    .toMatchObject({ current: { totals: { failovers: 5 } } });
  expect(events).toEqual([]);
  await evaluateMetrics(options);
  expect(events).toEqual(["metric.breach"]);

  // Successful settlement updates the attempt without erasing its switch or source failure.
  db.run(`UPDATE app_task_attempts SET state = 'completed', attempt_json = json_set(attempt_json,
    '$.state', 'completed', '$.acceptedResult', json('{"state":"converged","summary":"Recovered"}'))
    WHERE attempt_id = 'agent-0'`);
  closeDb(persistDir);
  await measureSourceMetrics(options);
  await evaluateMetrics(options);
  const reopened = getDb(persistDir);
  expect(createMetricService({ getDb: () => reopened }).get(TASK_FAILOVER_METRIC.id)!.observation)
    .toMatchObject({ value: 6, sampleSize: 6 });
  expect(events).toEqual(["metric.breach"]);
  const plan = reopened.prepare("EXPLAIN QUERY PLAN " + TASK_FAILOVER_METRIC.sourceQuery).all();
  expect(plan.some((row) => JSON.stringify(row).includes("idx_app_task_attempts_failover"))).toBe(true);
});

it("installs the default observation without alerts and preserves App calibration on startup", async () => {
  const { persistDir, db, bus, service } = fixture();
  const runtime = attachMetricSourceMeasurement({ bus, persistDir });
  await runtime.idle();
  expect(service.get(TASK_FAILOVER_METRIC.id)).toMatchObject({ threshold: null, observation: null });
  await measureSourceMetrics({ bus, persistDir });
  expect(service.get(TASK_FAILOVER_METRIC.id)!.observation).toMatchObject({ value: 0, sampleSize: 0 });
  service.define({ ...TASK_FAILOVER_METRIC, owner: "reviewer", threshold: 3, alertOp: ">", status: "retired" });
  const restarted = attachMetricSourceMeasurement({ bus: new EventBus(), persistDir });
  await restarted.idle();
  expect(service.get(TASK_FAILOVER_METRIC.id)).toMatchObject({ owner: "reviewer", threshold: 3, status: "retired" });
  expect(db.prepare("SELECT COUNT(*) AS n FROM metric_alerts WHERE metric_id = ?").get(TASK_FAILOVER_METRIC.id))
    .toEqual({ n: 0 });
});
