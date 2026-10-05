import { afterEach, beforeEach, expect, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { createMetricService } from "../../../lib/metrics.js";
import { metricEvidenceQuery, readMetricEvidence } from "./metric-evidence.js";

let db: SqliteDb;
const end = Date.UTC(2026, 8, 30);
const windowMs = 3_600_000;
beforeEach(() => {
  db = openDatabase(":memory:");
  applyDbSchema(db);
});
afterEach(() => db.close());

test("compares retained samples at a fixed cut without leaking later observations or summing rolling counts", () => {
  const metrics = createMetricService({ getDb: () => db });
  metrics.define({ id: "sample.failures", project: "sample", type: "gauge", measureInterval: 300_000 });
  metrics.record("sample.failures", 4, { measuredAt: end - 2 * windowMs + 1, sampleSize: 20 });
  metrics.record("sample.failures", 6, { measuredAt: end - windowMs - 1, sampleSize: 30 });
  metrics.record("sample.failures", 8, { measuredAt: end - windowMs + 1, sampleSize: 40 });
  metrics.record("sample.failures", 10, { measuredAt: end - 1, sampleSize: 50, note: "same 20 percent failure rate" });
  metrics.record("sample.failures", 0, { measuredAt: end });
  const evidence = readMetricEvidence(db, "sample.failures", { end, windowMs });
  expect(evidence).toMatchObject({
    available: true,
    freshness: "fresh",
    latest: { value: 10, sampleSize: 50 },
    previous: { samples: 2, change: 2 },
    current: { samples: 2, change: 2 },
    comparison: { previousLast: 6, currentLast: 10, change: 4 },
  });
  expect(evidence.examples?.map((sample) => sample.value)).toEqual([4, 6, 8, 10]);
  expect(evidence.unknowns).toContain(
    "Metric recovery does not establish that any particular input or requested outcome was fulfilled.",
  );
});

test("old and missing evidence remain visible even outside the comparison window", () => {
  const metrics = createMetricService({ getDb: () => db });
  metrics.define({ id: "sample.recovery-age", project: "sample", measureInterval: 300_000 });
  expect(readMetricEvidence(db, "sample.recovery-age", { end, windowMs })).toMatchObject({
    freshness: "missing",
    latest: null,
    comparison: { change: null },
  });
  metrics.record("sample.recovery-age", 99, { measuredAt: end - 3 * windowMs });
  db.prepare("INSERT INTO events(event_type, metric_id, timestamp, data) VALUES (?, ?, ?, ?)").run(
    "metric.measurement.failed",
    "sample.recovery-age",
    end - 1,
    JSON.stringify({ reason: "source unavailable" }),
  );
  expect(readMetricEvidence(db, "sample.recovery-age", { end, windowMs })).toMatchObject({
    freshness: "stale",
    latest: { value: 99 },
    current: { samples: 0 },
    previous: { samples: 0 },
    collectionFailures: [{ at: end - 1 }],
  });
  expect(readMetricEvidence(db, "unknown", { end, windowMs }).available).toBe(false);
});

test("exposes the alert's calculation basis at the evidence cut while preserving raw samples", () => {
  const metrics = createMetricService({ getDb: () => db });
  const rule = { method: "mean" as const, windowMs: 1_800_000, minSamples: 3 };
  metrics.define({ id: "sample.check-rate", measureInterval: 300_000, config: { calculation: rule } });
  for (const [offset, value] of [[900_000, 0], [600_000, 0], [300_000, 60], [0, 999]]) {
    metrics.record("sample.check-rate", value, { measuredAt: end - offset });
  }
  expect(readMetricEvidence(db, "sample.check-rate", { end, windowMs })).toMatchObject({
    latest: { value: 60 },
    calculationRule: rule,
    calculation: { method: "mean", value: 20, calculatedAt: end - 1, sampleCount: 3 },
  });
  db.run("UPDATE metrics SET config = ? WHERE id = 'sample.check-rate'", ['{"calculation":{"method":"unknown"}}']);
  expect(readMetricEvidence(db, "sample.check-rate", { end, windowMs })).toMatchObject({
    available: true, latest: { value: 60 }, calculation: { value: null, reason: expect.any(String) },
  });
});

test("limits examples while preserving whole-window statistics and rejects invalid windows", () => {
  const metrics = createMetricService({ getDb: () => db });
  metrics.define({ id: "sample", measureInterval: 100 });
  for (let n = 0; n < 30; n++) metrics.record("sample", n, { measuredAt: end - 100 + n, note: "x".repeat(5_000) });
  const evidence = readMetricEvidence(db, "sample", { end, windowMs });
  expect(evidence).toMatchObject({
    current: { samples: 30, minimum: 0, maximum: 29, change: 29 },
    examplesTruncated: true,
  });
  expect(evidence.examples).toHaveLength(12);
  expect(evidence.latest?.note).toHaveLength(4_000);
  expect(evidence.latest?.noteTruncated).toBe(1);
  for (const query of ["end=NaN", `end=${end + 1}`, "windowMs=0", "windowMs=604800001"]) {
    expect(() => metricEvidenceQuery(new URLSearchParams(query), end)).toThrow();
  }
});

test("breach updates retain one alert identity and historical cuts do not leak later resolution", () => {
  let now = end - 100;
  const metrics = createMetricService({ getDb: () => db, now: () => now });
  metrics.define({ id: "admission.failures", owner: "operator", threshold: 0, alertOp: ">" });
  metrics.record("admission.failures", 1);
  const first = metrics.evaluate("admission.failures")[0]!;
  now += 10;
  metrics.record("admission.failures", 3);
  expect(metrics.evaluate("admission.failures")[0]!.alertId).toBe(first.alertId);
  const breachedCut = now + 1;
  now += 10;
  metrics.record("admission.failures", 0);
  expect(metrics.evaluate("admission.failures")[0]).toMatchObject({ status: "recovered", alertId: first.alertId });
  expect(readMetricEvidence(db, "admission.failures", { end: breachedCut, windowMs }).alerts).toEqual([
    { alertId: first.alertId, alertType: "threshold", createdAt: end - 100, resolvedAt: null },
  ]);
  now += 10;
  metrics.record("admission.failures", 1);
  expect(metrics.evaluate("admission.failures")[0]!.alertId).not.toBe(first.alertId);
  const current = readMetricEvidence(db, "admission.failures", { end, windowMs });
  expect(current.alerts).toHaveLength(2);
  expect(current.alerts?.[1]).toMatchObject({ alertId: first.alertId, resolvedAt: end - 80 });
  // An exact old breach remains readable independently of the recent list.
  for (let n = 0; n < 15; n++)
    db.prepare(
      "INSERT INTO metric_alerts(metric_id, alert_type, message, created_at, resolved_at) VALUES ('admission.failures', 'threshold', 'later', ?, ?)",
    ).run(end - 15 + n, end - 15 + n);
  expect(readMetricEvidence(db, "admission.failures", { end, windowMs, alertId: first.alertId }).alerts).toHaveLength(
    1,
  );
  expect(() => metricEvidenceQuery(new URLSearchParams("alertId=-1"), end)).toThrow();
});

test("only accepted Task decisions appear, with exact breach and Task provenance after later work", () => {
  createMetricService({ getDb: () => db }).define({ id: "admission.failures" });
  const decision = {
    version: 1,
    metricId: "admission.failures",
    alertId: 42,
    disposition: "investigate",
    reason: "Repeated admission failure",
    evidence: ["input:example"],
    linkedTask: { appId: "platform", taskId: "repair/admission" },
  };
  const insert = (id: string, at: number, result: object) =>
    db
      .prepare(
        `INSERT INTO app_task_attempts
    (app_id, attempt_id, task_id, task_generation, state, started_at, attempt_json) VALUES ('platform', ?, 'owner-review', 1, 'completed', ?, ?)`,
      )
      .run(id, at - 1, JSON.stringify({ finishedAt: new Date(at).toISOString(), ...result }));
  insert("accepted", end - 100, {
    acceptedResult: { state: "waiting", facts: [`metric-disposition:${JSON.stringify(decision)}`] },
  });
  insert("unaccepted", end - 50, {
    unacceptedResult: { facts: [`metric-disposition:${JSON.stringify({ ...decision, disposition: "recovered" })}`] },
  });
  insert("later-unrelated", end - 20, {
    acceptedResult: { state: "converged", facts: ["Reviewed unrelated work", "metric-disposition:broken"] },
  });
  insert("future", end + 1, {
    acceptedResult: { facts: [`metric-disposition:${JSON.stringify({ ...decision, disposition: "recovered" })}`] },
  });
  // One attempt can address several independent metrics; the index is only a
  // candidate filter and must preserve every valid accepted fact.
  insert("several", end - 80, {
    acceptedResult: { facts: [
      "Checked both metrics",
      `metric-disposition:${JSON.stringify({ ...decision, metricId: "other.metric" })}`,
      `metric-disposition:${JSON.stringify({ ...decision, alertId: null })}`,
    ] },
  });
  const evidence = readMetricEvidence(db, "admission.failures", { end, windowMs, alertId: 42 });
  expect(evidence.dispositions).toHaveLength(1);
  expect(evidence.dispositions?.[0]).toMatchObject({
    appId: "platform",
    taskId: "owner-review",
    attemptId: "accepted",
    decision,
  });
  const next = readMetricEvidence(db, "admission.failures", { end, windowMs, alertId: 43 });
  expect(next.dispositions).toEqual([]);
  expect(next.relatedDispositions).toMatchObject([
    { decision: { alertId: null, linkedTask: decision.linkedTask } },
    { decision: { alertId: 42, linkedTask: decision.linkedTask } },
  ]);
  expect(db.prepare("SELECT metric_id FROM metric_dispositions WHERE attempt_id = 'several' ORDER BY metric_id").all())
    .toEqual([{ metric_id: "admission.failures" }, { metric_id: "other.metric" }]);
  const before = db.prepare("SELECT * FROM metric_dispositions ORDER BY attempt_id, metric_id").all();
  // Existing installations replace the old view during the normal atomic schema
  // upgrade. No attempt bytes or accepted decisions need rewriting.
  db.exec("DROP VIEW metric_dispositions; CREATE VIEW metric_dispositions AS SELECT 'legacy' AS legacy");
  applyDbSchema(db);
  expect(db.prepare("SELECT * FROM metric_dispositions ORDER BY attempt_id, metric_id").all()).toEqual(before);
  const plan = db.prepare(`EXPLAIN QUERY PLAN
    SELECT data FROM metric_dispositions WHERE metric_id = ? AND timestamp < ?
    ORDER BY timestamp DESC, attempt_id DESC LIMIT 13`).all("admission.failures", end);
  expect(plan.some((row) => String(row.detail).includes("idx_metric_disposition_attempts"))).toBe(true);
  expect(plan.some((row) => String(row.detail) === "SCAN a")).toBe(false);
});
