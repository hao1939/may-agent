import type { MetricDefinition } from "../../../lib/metrics.js";
import type { SqlQueryEvidence } from "../../../lib/db/query-performance.js";

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
  metricIdTruncated: boolean;
  durationMs: number;
  failed: boolean;
  query?: SqlQueryEvidence;
};

/** One pass, no per-source series or additional query execution. */
export class MetricQueryObservations {
  private count = 0;
  private failures = 0;
  private totalMs = 0;
  private examples: QueryObservation[] = [];
  private startedAt = Date.now();

  record(metricId: string, durationMs: number, failed: boolean, evidence?: SqlQueryEvidence): void {
    this.count++;
    this.failures += Number(failed);
    this.totalMs += durationMs;
    this.examples.push({
      metricId: metricId.slice(0, 256), metricIdTruncated: metricId.length > 256,
      durationMs, failed,
      ...(evidence ? { query: evidence } : {}),
    });
    this.examples.sort((a, b) => b.durationMs - a.durationMs);
    this.examples.length = Math.min(this.examples.length, 3);
  }

  sample(measuredAt = Date.now()) {
    if (!this.count) return undefined;
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
      scope: "Attempted direct SQL sources in this collection pass; command sources and sample writes excluded",
      startedAt: this.startedAt, completedAt: measuredAt, queries: this.count,
      failures: this.failures, totalMs: this.totalMs,
      examples, examplesTruncated: this.count > examples.length,
      // Plans are existing, timestamped evidence for the query shape, not a new EXPLAIN.
      evidenceTruncated,
    };
    let note = JSON.stringify(observation);
    while (note.length > 4_000 && examples.length > 1) {
      examples.pop();
      observation.examplesTruncated = true;
      note = JSON.stringify(observation);
    }
    const worst = examples[0];
    while (note.length > 4_000 && worst.query?.plan?.rows.length) {
      worst.query.plan.rows.pop();
      worst.query.plan.rowsTruncated = true;
      observation.evidenceTruncated = true;
      note = JSON.stringify(observation);
    }
    if (note.length > 4_000) {
      // Even unusually escaped identifiers must not hide the scalar's source witness.
      delete worst.query;
      observation.evidenceTruncated = true;
      note = JSON.stringify(observation);
    }
    return { value: worst.durationMs, sampleSize: this.count, measuredAt, note };
  }
}
