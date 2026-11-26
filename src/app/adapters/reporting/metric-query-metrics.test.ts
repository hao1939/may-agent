import { expect, test } from "bun:test";
import { cohortFingerprint, decodeQueryCohort, MetricQueryObservations, type QueryAttempt } from "./metric-query-metrics.js";
import { normalizedQueryFingerprint } from "../../../lib/db/query-performance.js";

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
  expect(note).toMatchObject({ failures: 1, queries: 21, totalMs: 1_520, preview: "top-3", examplesTruncated: false });
  expect(note.examples[0]).toMatchObject({ metricId: "slow", durationMs: 1_500, failed: true,
    query: { plan: { fingerprint: "get:source", capturedAt: 10, rowsTruncated: true } } });
  expect(note.examples[0].query.plan.rows.length).toBeGreaterThan(0);

  const longIdentity = new MetricQueryObservations();
  longIdentity.record("\"\n".repeat(2_000), 100, false);
  const bounded = longIdentity.sample()!;
  expect(bounded.note.length).toBeLessThanOrEqual(4_000);
  expect(JSON.parse(bounded.note).examples[0].metricIdTruncated).toBe(true);
});

test("44 attempts survive the note budget with fingerprints, multiplicity, failures and a three-query preview", () => {
  const epoch = 1_800_000_000_000;
  let now = epoch;
  const observations = new MetricQueryObservations(() => now);
  const expected: QueryAttempt[] = [];
  for (let n = 0; n < 44; n++) {
    const metricId = ["fixture", "system", "counter", "latency", "request", "worker", "signal", "uptime"][n % 8] + "." +
      ["work-in-progress-age", "oldest-read-seconds", "completed-attempts-6h", "finished-attempts-24h"][n % 4] + `-${n}`;
    const queryFingerprint = normalizedQueryFingerprint(`SELECT field_${n} FROM fixture WHERE key = 'private-${n}'`);
    const outcome = n === 5 ? "failed" : n === 7 ? "busy" : n === 8 ? "locked" : "ok";
    now = epoch + n * 25;
    observations.record(metricId, n + 0.25, outcome !== "ok", undefined, { start: now, queryFingerprint, outcome });
    expected.push({ metricId, queryFingerprint, startOffsetMs: n * 25, durationMs: n + 0.25, outcome });
  }
  now += 50;
  const sample = observations.sample(epoch + 1_125)!;
  const note = JSON.parse(sample.note);
  expect(sample.note.length).toBeLessThanOrEqual(4_000);
  expect(note.cohort).toMatchObject({ version: 1, attempted: 44, failed: 3, retained: 44, dropped: 0, status: "complete" });
  expect(decodeQueryCohort(note.cohort)).toEqual(expected);
  expect(note.cohort.cohortFingerprint).toBe(cohortFingerprint(expected));
  expect(cohortFingerprint(expected.slice(1))).not.toBe(cohortFingerprint(expected));
  expect(cohortFingerprint([...expected, expected[0]])).not.toBe(cohortFingerprint(expected));
  expect(note.examples).toHaveLength(3);
  expect(note.examplesTruncated).toBe(false);
  expect(note.preview).toBe("top-3");
  expect(note.examples.map((e: { metricId: string }) => e.metricId)).toEqual(expected.slice(-3).reverse().map(e => e.metricId));
  expect(JSON.stringify(note.cohort)).not.toContain("private-");
  expect(note.contention).toMatchObject({ status: "incomplete", coverage: "unknown", busyWaitMs: "unknown", busyWaitCount: "unknown",
    lockWaitMs: "unknown", lockWaitCount: "unknown", busyFailures: 1, lockedFailures: 1 });
  expect(normalizedQueryFingerprint("SELECT 1 /* private */")).toBe(normalizedQueryFingerprint("SELECT 42"));
});

test("pass and per-query intervals correlate only overlapping passive observations and keep missing signals unknown", () => {
  let now = 100;
  const observations = new MetricQueryObservations(() => now);
  for (let n = 0; n < 5; n++) {
    observations.record(`q${n}`, 5, false, undefined, { start: 100 + n * 10, queryFingerprint: "a" });
  }
  now = 150;
  const note = JSON.parse(observations.sample(1, { coverage: "unknown", dropped: 2, intervals: [
    { kind: "writer", start: 111, end: 124 },
    { kind: "writer", start: 90, end: 99 },
    { kind: "checkpoint", start: 133, end: 142, mode: "PASSIVE", busy: 1, log: 200, checkpointed: 100 },
    { kind: "checkpoint", start: 120, end: 121, mode: "PASSIVE" },
  ] })!.note);
  expect(note.contention).toMatchObject({ status: "incomplete", dropped: 2, writerCoverage: "unknown", checkpointCoverage: "unknown" });
  expect(note.contention.intervals).toEqual([
    { kind: "checkpoint", startOffsetMs: 33, durationMs: 9, queries: [3, 4], mode: "PASSIVE", busy: 1, walFrames: 200, checkpointedFrames: 100 },
    { kind: "checkpoint", startOffsetMs: 20, durationMs: 1, queries: [2], mode: "PASSIVE", busy: "unknown", walFrames: "unknown", checkpointedFrames: "unknown" },
    { kind: "writer", startOffsetMs: 11, durationMs: 13, queries: [1, 2] },
  ]);
});

test("44-query mixed pass summarizes sample writes and preserves its late query overlap within budget", () => {
  let now = 100;
  const observations = new MetricQueryObservations(() => now);
  for (let n = 0; n < 44; n++) observations.record(`fixture.query-source-${n}`, 5, false, undefined,
    { start: 100 + n * 10, queryFingerprint: normalizedQueryFingerprint(`SELECT field_${n} FROM fixture`) });
  now = 550;
  const intervals = Array.from({ length: 43 }, (_, n) => ({ kind: "writer" as const, start: 106 + n * 10, end: 108 + n * 10 }));
  intervals.push({ kind: "writer", start: 531, end: 534 });
  const sample = observations.sample(1, { intervals, coverage: "unknown", dropped: 2 })!;
  const note = JSON.parse(sample.note);
  expect(sample.note.length).toBeLessThanOrEqual(4_000);
  expect(note.cohort).toMatchObject({ attempted: 44, retained: 44, status: "complete" });
  expect(note.examplesTruncated).toBe(false);
  expect(note.contention.passOnlyWriters).toEqual({ count: 43, totalMs: 86 });
  expect(note.contention.intervals).toEqual([{ kind: "writer", startOffsetMs: 431, durationMs: 3, queries: [43] }]);
  expect(note.contention.dropped).toBe(2);
  // More actual query overlaps than the witness cap: no silent loss.
  const overflow = JSON.parse(observations.sample(1, { intervals: Array.from({ length: 20 }, () => intervals[43]),
    coverage: "unknown", dropped: 2 })!.note);
  expect(overflow.contention.dropped + overflow.contention.intervals.length).toBe(22);
  expect(overflow.contention.status).toBe("incomplete");
});

test("capture and serialization overflow are explicitly incomplete, not a complete top-three cohort", () => {
  const observations = new MetricQueryObservations(() => 100, 4);
  for (let n = 0; n < 6; n++) observations.record(`q${n}`, 1, false, undefined, { start: 100, queryFingerprint: "a" });
  const note = JSON.parse(observations.sample(1)!.note);
  expect(note.cohort).toMatchObject({ attempted: 6, retained: 4, dropped: 2, status: "incomplete" });
  expect(decodeQueryCohort(note.cohort)).toHaveLength(4);
  expect(cohortFingerprint(decodeQueryCohort(note.cohort))).not.toBe(note.cohort.cohortFingerprint);
  const huge = new MetricQueryObservations(() => 100);
  for (let n = 0; n < 150; n++) huge.record(`${n}-${"long".repeat(60)}`, n, false, undefined, { start: 100, queryFingerprint: String(n) });
  const sample = huge.sample(1)!;
  expect(sample.note.length).toBeLessThanOrEqual(4_000);
  const bounded = JSON.parse(sample.note);
  expect(bounded.cohort.status).toBe("incomplete");
  expect(bounded.cohort.retained + bounded.cohort.dropped).toBe(150);
  const escaped = new MetricQueryObservations(() => 100);
  for (let n = 0; n < 6; n++) escaped.record(`${n}${"\u0001".repeat(255)}`, n, false);
  expect(escaped.sample(1)!.note.length).toBeLessThanOrEqual(4_000);
});
