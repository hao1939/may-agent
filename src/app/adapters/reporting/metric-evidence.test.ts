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
