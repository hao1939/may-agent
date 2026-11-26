import { createHash } from "node:crypto";
import type { MetricDefinition } from "../../../lib/metrics.js";
import type { SqlQueryEvidence } from "../../../lib/db/query-performance.js";
import { contentionNow, type ContentionSnapshot } from "../../../lib/db/contention-observations.js";

export const METRIC_QUERY_DURATION_METRIC: MetricDefinition = {
  id: "metric.source-query-worst-ms",
  name: "Slowest metric source query in a collection pass",
  owner: "system:host",
  type: "gauge",
  unit: "milliseconds",
  measureInterval: 300_000,
  source: "Host metric source query execution",
  description:
    "Maximum elapsed query-source duration in a collection pass, including connection, preparation, read and close. Includes failed queries; excludes command sources, sample persistence and yields. sampleSize counts attempted SQL sources. Bounded notes retain slowest source references and available diagnostic plans. No queries means no sample, not zero. No default alert; Apps own review policy.",
};

type QueryObservation = {
  metricId: string;
  metricIdTruncated?: boolean;
  durationMs: number;
  failed: boolean;
  query?: SqlQueryEvidence;
};
export type QueryAttempt = {
  metricId: string;
  queryFingerprint: string;
  startOffsetMs: number;
  durationMs: number;
  outcome: "ok" | "failed" | "busy" | "locked";
};
// v1: one prefix-compressed metric ID per invocation; fingerprint dictionary; invocation tuples.
// Millisecond offsets/durations use 0.01ms precision; the scalar retains full precision.
export type QueryCohort = {
  version: 1;
  passId: string;
  measuredAt: number;
  start: number;
  end: number;
  attempted: number;
  failed: number;
  retained: number;
  dropped: number;
  status: "complete" | "incomplete";
  cohortFingerprint: string;
  ids: Array<[number, string]>;
  fingerprints: string[];
  // fingerprint index, startOffsetMs, durationMs, outcome (omitted/0 ok, 1 failed, 2 busy, 3 locked)
  entries: Array<[number, number, number, number?]>;
};
const outcomes = ["ok", "failed", "busy", "locked"] as const;
const rounded = (n: number) => Math.round(n * 100) / 100;

/** Stable identity of the ordered, multiplicity-preserving invocation cohort, excluding timing/outcome. */
export function cohortFingerprint(attempts: ReadonlyArray<Pick<QueryAttempt, "metricId" | "queryFingerprint">>): string {
  const hash = createHash("sha256");
  for (const a of attempts) hash.update(JSON.stringify([a.metricId, a.queryFingerprint]) + "\n");
  return hash.digest("hex").slice(0, 16);
}

export function decodeQueryCohort(cohort: QueryCohort): QueryAttempt[] {
  const ids: string[] = [];
  for (const [prefix, suffix] of cohort.ids) ids.push((ids.at(-1) ?? "").slice(0, prefix) + suffix);
  return cohort.entries.map(([fingerprint, startOffsetMs, durationMs, outcome = 0], id) => ({
    metricId: ids[id], queryFingerprint: cohort.fingerprints[fingerprint], startOffsetMs, durationMs,
    outcome: outcomes[outcome],
  }));
}

/** One pass, bounded capture; no per-source series or additional query execution. */
export class MetricQueryObservations {
  private count = 0;
  private failures = 0;
  private totalMs = 0;
  private examples: QueryObservation[] = [];
  private attempts: QueryAttempt[] = [];
  private windows: Array<[number, number]> = [];
  private identity = createHash("sha256");
  private busyFailures = 0;
  private lockedFailures = 0;
  private start: number;
  constructor(private readonly now = contentionNow, private readonly retentionLimit = 256) {
    this.start = now();
  }

  record(metricId: string, durationMs: number, failed: boolean, evidence?: SqlQueryEvidence,
    invocation?: { start: number; queryFingerprint: string; outcome?: QueryAttempt["outcome"] }): void {
    this.count++;
    this.failures += Number(failed);
    this.totalMs += durationMs;
    const start = invocation?.start ?? this.now();
    const attempt: QueryAttempt = {
      metricId, queryFingerprint: invocation?.queryFingerprint ?? evidence?.id ?? "unknown",
      startOffsetMs: rounded(start - this.start), durationMs: rounded(durationMs),
      outcome: invocation?.outcome ?? (failed ? "failed" : "ok"),
    };
    this.identity.update(JSON.stringify([metricId, attempt.queryFingerprint]) + "\n");
    this.busyFailures += Number(attempt.outcome === "busy");
    this.lockedFailures += Number(attempt.outcome === "locked");
    if (this.attempts.length === this.count - 1 && this.attempts.length < this.retentionLimit && metricId.length <= 256) {
      this.attempts.push(attempt);
      this.windows.push([start, start + durationMs]);
    }
    this.examples.push({
      metricId: metricId.slice(0, 256), ...(metricId.length > 256 ? { metricIdTruncated: true } : {}),
      durationMs, failed, ...(evidence ? { query: evidence } : {}),
    });
    this.examples.sort((a, b) => b.durationMs - a.durationMs);
    this.examples.length = Math.min(this.examples.length, 3);
  }

  sample(measuredAt = Date.now(), contention?: ContentionSnapshot) {
    if (!this.count) return undefined;
    const end = this.now();
    const attempts = [...this.attempts];
    const cohort: QueryCohort = {
      version: 1, passId: `${process.pid}:${this.start}`, measuredAt, start: this.start, end,
      attempted: this.count, failed: this.failures, retained: 0, dropped: 0, status: "incomplete",
      cohortFingerprint: this.identity.copy().digest("hex").slice(0, 16), ids: [], fingerprints: [], entries: [],
    };
    const encode = () => {
      let previous = "";
      cohort.ids = []; cohort.fingerprints = []; cohort.entries = [];
      for (const a of attempts) {
        let prefix = 0;
        while (prefix < previous.length && previous[prefix] === a.metricId[prefix]) prefix++;
        cohort.ids.push([prefix, a.metricId.slice(prefix)]);
        previous = a.metricId;
        let fingerprint = cohort.fingerprints.indexOf(a.queryFingerprint);
        if (fingerprint < 0) { fingerprint = cohort.fingerprints.length; cohort.fingerprints.push(a.queryFingerprint); }
        const outcome = outcomes.indexOf(a.outcome);
        cohort.entries.push(outcome ? [fingerprint, a.startOffsetMs, a.durationMs, outcome] :
          [fingerprint, a.startOffsetMs, a.durationMs]);
      }
      cohort.retained = attempts.length;
      cohort.dropped = this.count - attempts.length;
      cohort.status = !cohort.dropped && attempts.filter(a => a.outcome !== "ok").length === this.failures &&
        attempts.every(a => a.queryFingerprint !== "unknown") ? "complete" : "incomplete";
    };
    encode();
    const intervals = (contention?.intervals.filter(i => i.start < end && i.end > this.start) ?? []);
    // Correlate before bounding: ordinary sample writes between queries must not evict
    // a late query-overlapping writer. Summarize pass-only writes without losing counts.
    const passOnlyWriters = intervals.filter(i => i.kind === "writer" &&
      !this.windows.some(([start, end]) => start < i.end && end > i.start));
    const witnesses = intervals.filter(i => !passOnlyWriters.includes(i))
      .sort((a, b) => Number(this.windows.some(([s, e]) => s < b.end && e > b.start)) -
        Number(this.windows.some(([s, e]) => s < a.end && e > a.start)) ||
        Number(a.kind === "writer") - Number(b.kind === "writer"));
    const correlated = witnesses.slice(0, 16).map(i => ({
      kind: i.kind, startOffsetMs: rounded(i.start - this.start), durationMs: rounded(i.end - i.start),
      // Query indices are invocation ordinals; they remain valid even if trailing entries are dropped below.
      queries: this.windows.flatMap(([start, end], index) => start < i.end && end > i.start ? [index] : []),
      ...(i.kind === "checkpoint" ? { mode: i.mode ?? "unknown", busy: i.busy ?? "unknown",
        walFrames: i.log ?? "unknown", checkpointedFrames: i.checkpointed ?? "unknown" } : {}),
    }));
    const signals = {
      // Neither Bun nor Node SQLite exposes native busy-handler waits. Errors are not waits.
      status: "incomplete", coverage: "unknown", scope: "stateTransaction + maintenance; delayed/in-flight/colliding workers unknown",
      clock: "monotonic-epoch-ms",
      busyWaitCount: "unknown", busyWaitMs: "unknown", lockWaitCount: "unknown", lockWaitMs: "unknown",
      busyFailures: this.busyFailures, lockedFailures: this.lockedFailures,
      writerCoverage: "unknown", checkpointCoverage: "unknown",
      passOnlyWriters: { count: passOnlyWriters.length,
        totalMs: rounded(passOnlyWriters.reduce((sum, i) => sum + i.end - i.start, 0)) },
      dropped: (contention?.dropped ?? 0) + Math.max(0, witnesses.length - correlated.length), intervals: correlated,
    };
    const examples = structuredClone(this.examples);
    let evidenceTruncated = false;
    for (const example of examples) {
      const query = example.query;
      if (!query) continue;
      evidenceTruncated ||= query.sql.length > 200;
      query.sql = query.sql.slice(0, 200);
      if (query.plan) {
        evidenceTruncated ||= query.plan.shape.length > 200 || query.plan.rows.length > 6 ||
          query.plan.rows.some(row => row.detail.length > 200);
        query.plan.rowsTruncated ||= query.plan.rows.length > 6;
        query.plan.rows = query.plan.rows.slice(0, 6).map(row => ({ ...row, detail: row.detail.slice(0, 200) }));
        query.plan.shape = query.plan.shape.slice(0, 200);
      }
    }
    const observation = {
      queries: this.count, failures: this.failures, totalMs: this.totalMs,
      cohort, contention: signals, examples, preview: "top-3", examplesTruncated: false, evidenceTruncated,
    };
    const stringify = () => JSON.stringify(observation);
    let note = stringify();
    // Optional plans first, then SQL, before any required cohort record is dropped.
    while (note.length > 4_000 && examples.some(e => e.query?.plan?.rows.length)) {
      const e = [...examples].reverse().find(e => e.query?.plan?.rows.length)!;
      e.query!.plan!.rows.pop(); e.query!.plan!.rowsTruncated = true;
      observation.evidenceTruncated = true; note = stringify();
    }
    for (const e of [...examples].reverse()) {
      if (note.length <= 4_000) break;
      delete e.query; observation.evidenceTruncated = true; note = stringify();
    }
    // Bound interval metadata too, with explicit loss; cohort has priority.
    while (note.length > 4_000 && signals.intervals.length) {
      signals.intervals.pop(); signals.dropped++; note = stringify();
    }
    while (note.length > 4_000 && attempts.length) {
      attempts.pop(); encode(); note = stringify();
    }
    // Pathological escaped identifiers can exceed the budget even without a cohort.
    while (note.length > 4_000 && examples.length > 1) {
      examples.pop(); observation.examplesTruncated = true; note = stringify();
    }
    while (note.length > 4_000 && examples[0].metricId.length) {
      examples[0].metricId = examples[0].metricId.slice(0, -16);
      examples[0].metricIdTruncated = true; note = stringify();
    }
    return { value: this.examples[0].durationMs, sampleSize: this.count, measuredAt, note };
  }
}
