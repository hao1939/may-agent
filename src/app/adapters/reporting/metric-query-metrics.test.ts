import { expect, test } from "bun:test";
import { MetricQueryObservations } from "./metric-query-metrics.js";

test("pass cost preserves its worst source, failures and bounded plan evidence without treating no work as zero", () => {
  const observations = new MetricQueryObservations();
  expect(observations.sample()).toBeUndefined();
  const details = "\"\n".repeat(250);
  observations.record("slow", 1_500, true, {
    id: "get:source", sql: "SELECT ? AS value",
    plan: { fingerprint: "get:source", shape: "SELECT ? AS value", capturedAt: 10,
      rows: Array.from({ length: 20 }, (_, id) => ({ id, parent: 0, detail: details })), rowsTruncated: false },
  });
  for (let n = 0; n < 20; n++) observations.record(`fast-${n}`, 1, false);
  const sample = observations.sample(20)!;
  expect(sample).toMatchObject({ value: 1_500, sampleSize: 21, measuredAt: 20 });
  expect(sample.note.length).toBeLessThanOrEqual(4_000);
  const note = JSON.parse(sample.note);
  expect(note).toMatchObject({ failures: 1, queries: 21, totalMs: 1_520, examplesTruncated: true });
  expect(note.examples[0]).toMatchObject({ metricId: "slow", durationMs: 1_500, failed: true,
    query: { plan: { fingerprint: "get:source", capturedAt: 10, rowsTruncated: true } } });
  expect(note.examples[0].query.plan.rows.length).toBeGreaterThan(0);

  const longIdentity = new MetricQueryObservations();
  longIdentity.record("\"\n".repeat(2_000), 100, false);
  const bounded = longIdentity.sample()!;
  expect(bounded.note.length).toBeLessThanOrEqual(4_000);
  expect(JSON.parse(bounded.note).examples[0].metricIdTruncated).toBe(true);
});
