import { execFile, type ExecFileOptionsWithStringEncoding } from "node:child_process";
import { join } from "node:path";
import { openReadOnlyDatabase } from "../lib/db.js";
import { createMetricService } from "../lib/metrics.js";
import { log } from "../lib/log.js";
import { EVENT_ROW_ID, eventData, type AgentEvent, type EventBus } from "./core/events/bus.js";
import { getDb } from "../lib/db/connection.js";
import { withSqliteBusyRetry } from "../lib/db/busy-retry.js";
import { resolveRuntimeRoots } from "./path-roots.js";
import { WORKFLOW_OUTCOME_METRICS } from "./adapters/reporting/workflow-metrics.js";
import { redactTranscriptSecrets } from "../lib/persistence.js";

export const METRIC_SOURCE_MEASUREMENT_EVENT = "trigger.metrics-snapshot";
export const METRIC_EVALUATION_EVENT = "trigger.metrics-evaluate";
export const SUBSCRIBER_FAILED_COUNT_METRIC_ID = "infra.bus.subscriber-failed-count-1h";
export const SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY = `SELECT COUNT(*) AS value
FROM events
WHERE event_type = 'subscriber.failed'
  AND timestamp >= (strftime('%s','now') * 1000 - 3600000)`;
export const UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID = "event.unhandled-signal-count-1h";
export const INTENTIONAL_OBSERVATION_EVENT_TYPES = [
  "project.task.reconcile.profiled",
  "project.task.reconcile.started",
  "project.task.reconciled",
  "project.task.reconcile.skipped",
  "project.task.executor.progress",
  "handler.routed",
  "metric.breach",
  "metric.measurement.failed",
  "metric.evaluation.failed",
  "conversation.updated",
  "gym.review.filtered",
  "project.approval.resolved",
  "project.ops_digest.created",
  "project.ops_health.observed",
] as const;
const intentionalObservationSql = INTENTIONAL_OBSERVATION_EVENT_TYPES.map((type) => `'${type}'`).join(",");
export const UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY = `SELECT COUNT(*) AS value
FROM events
WHERE delivery_status = 'unhandled'
  AND timestamp >= (strftime('%s','now') * 1000 - 3600000)
  AND event_type NOT IN (${intentionalObservationSql})`;
export const STALE_ACTIVE_METRIC_ID = "metric.stale-active-count";
export const STALE_ACTIVE_SOURCE_QUERY = `WITH clock AS (SELECT strftime('%s','now') * 1000 AS cut),
  cadence AS (
    SELECT m.id, m.measure_interval,
      COALESCE(
        CASE WHEN m.created_at <= (SELECT cut FROM clock) THEN m.created_at END,
        CASE WHEN m.updated_at <= (SELECT cut FROM clock) THEN m.updated_at END,
        0
      ) AS created_at,
      (SELECT MAX(s.measured_at) FROM metric_snapshots s
        WHERE s.metric_id = m.id AND s.measured_at <= (SELECT cut FROM clock)) AS last_sample
    FROM metrics m
    WHERE m.status = 'active' AND m.id != '${STALE_ACTIVE_METRIC_ID}'
      AND m.measure_interval > 0
  ), stale AS (
    SELECT * FROM cadence
    WHERE COALESCE(last_sample, created_at) <= (SELECT cut FROM clock) - MAX(900000, measure_interval * 2)
  )
SELECT COUNT(*) AS value, (SELECT COUNT(*) FROM cadence) AS sampleSize,
  (SELECT cut FROM clock) AS measuredAt,
  json_object('scope', 'Active metrics with a declared cadence; missing first samples receive the same freshness grace.',
    'examples', json((SELECT json_group_array(json_object('metricId', id,
      'measureInterval', measure_interval, 'lastSampleAt', last_sample))
      FROM (SELECT * FROM stale ORDER BY COALESCE(last_sample, created_at), id LIMIT 5))),
    'examplesTruncated', COUNT(*) > 5) AS note
FROM stale`;

type SourceMetric = {
  id: string;
  source_query: string | null;
  source_command: string | null;
  measure_interval: number | null;
};

type CommandSample = {
  value: number;
  sampleSize?: number;
  measuredAt?: number;
  note?: string;
};

function sourceQuerySample(row: Record<string, unknown> | null): CommandSample | null {
  if (!row) return null;
  if (Object.prototype.hasOwnProperty.call(row, "value")) return commandSample(row);
  const candidate = Object.values(row)[0];
  return commandSample({ ...row, value: candidate });
}

function commandSample(value: unknown): CommandSample | null {
  if (typeof value === "number" && Number.isFinite(value)) return { value };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.value !== "number" || !Number.isFinite(row.value)) return null;
  const sample: CommandSample = { value: row.value };
  if (typeof row.sampleSize === "number" && Number.isFinite(row.sampleSize)) {
    sample.sampleSize = row.sampleSize;
  }
  if (typeof row.measuredAt === "number" && Number.isFinite(row.measuredAt)) {
    sample.measuredAt = row.measuredAt;
  }
  if (typeof row.note === "string") sample.note = row.note;
  else if (row.note != null) sample.note = JSON.stringify(row.note);
  return sample;
}

function parseCommandOutput(output: string, metricId: string): CommandSample | null {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    // Preserve the single-sample contract, including ignored extension fields.
    const single = commandSample(parsed);
    if (single) return single;
    // A producer may report several observations in one invocation. The Host
    // selects only this declared metric; missing entries are not zero samples.
    if (parsed && typeof parsed === "object" && Object.hasOwn(parsed, "samples")) {
      const samples = parsed.samples;
      return samples && typeof samples === "object" && !Array.isArray(samples) && Object.hasOwn(samples, metricId)
        ? commandSample(samples[metricId])
        : null;
    }
    return null;
  } catch {
    const value = Number(trimmed);
    return Number.isFinite(value) ? { value } : null;
  }
}

function execFileText(file: string, args: string[], options: ExecFileOptionsWithStringEncoding): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function executeCommand(command: string): Promise<string> {
  return execFileText("/bin/sh", ["-lc", command], {
    cwd: resolveRuntimeRoots(import.meta.url).projectRoot,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function measurementError(error: unknown): string {
  return redactTranscriptSecrets(error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

/**
 * Measure active metrics backed by a persisted source query or source command.
 *
 * The metric definition remains the domain authority. This Host consumer only
 * executes that accepted definition and records the correlated observation. Each source
 * query owns a read-only connection that closes before writer-side recording.
 */
export async function measureSourceMetrics(options: {
  bus: EventBus;
  persistDir: string;
  triggerEventId?: number;
  measuredAt?: number;
  isDue?: (metric: SourceMetric) => boolean;
  onAttempt?: (metric: SourceMetric) => void;
}): Promise<{ measured: string[]; skipped: string[]; failures: Array<{ id: string; reason: string }> }> {
  const db = getDb(options.persistDir);
  const metrics = createMetricService({
    getDb: () => db,
    measuredBy: "runtime:metric-source-measurement",
  });
  const rows = db
    .prepare(
      `SELECT id, source_query, source_command, measure_interval
       FROM metrics
       WHERE status = 'active'
         AND ((source_query IS NOT NULL AND trim(source_query) != '')
           OR (source_command IS NOT NULL AND trim(source_command) != ''))
       ORDER BY id`,
    )
    .all() as SourceMetric[];
  const dueRows = options.isDue ? rows.filter(options.isDue) : rows;
  const measured: string[] = [];
  const skipped: string[] = [];
  const failures: Array<{ id: string; reason: string }> = [];
  const failed = (id: string, reason: string) => {
    skipped.push(id);
    failures.push({ id, reason });
    // The scheduled caller does not consume this return value. Keep the
    // bounded explanation in the existing Event journal, not a fake sample
    // or an alert. Diagnostic storage failure must not stop other sources.
    try {
      options.bus.emit({
        type: "metric.measurement.failed",
        source: "runtime:metric-source-measurement",
        owner: "agent:may",
        data: { metricId: id, reason, triggerEventId: options.triggerEventId },
      });
    } catch (error) {
      log("warn", `[metrics:${id}] Could not retain failure diagnostic: ${measurementError(error)}`);
    }
    log("warn", `[metrics:${id}] ${reason}`);
  };
  const defaultMeasuredAt = options.measuredAt ?? Date.now();
  const queryNote = options.triggerEventId ? `source-query; trigger-event:${options.triggerEventId}` : "source-query";
  const commandNote = options.triggerEventId
    ? `source-command; trigger-event:${options.triggerEventId}`
    : "source-command";
  // Cache only this measurement pass, including failures. Execute the exact
  // declared command, once, when its first due command-backed metric is read.
  // Query-backed or not-due definitions must not trigger producer side effects.
  const commandOutputs = new Map<string, Promise<string>>();

  for (const row of dueRows) {
    options.onAttempt?.(row);
    try {
      let sample: CommandSample | null = null;
      let measuredBy = "runtime:metric-source-query";
      let note = queryNote;
      if (row.source_query) {
        // SQLite prepare executes the first statement and ignores SQL tail; it
        // is not a parser-based single-statement guarantee. Give every query its
        // own read-only connection and close it before the writer records or
        // evaluates the sample, so query transaction state cannot leak forward.
        const sourceDb = openReadOnlyDatabase(join(options.persistDir, "may.db"));
        try {
          sample = sourceQuerySample(sourceDb.prepare(row.source_query).get() as Record<string, unknown> | null);
        } finally {
          sourceDb.close();
        }
      } else if (row.source_command) {
        measuredBy = "runtime:metric-source-command";
        note = commandNote;
        let output = commandOutputs.get(row.source_command);
        if (!output) {
          output = executeCommand(row.source_command);
          commandOutputs.set(row.source_command, output);
        }
        sample = parseCommandOutput(await output, row.id);
      }
      if (!sample) {
        failed(row.id, "Source returned no finite numeric sample");
        continue;
      }
      metrics.record(row.id, sample.value, {
        measuredAt: sample.measuredAt ?? defaultMeasuredAt,
        measuredBy,
        sampleSize: sample.sampleSize,
        note: sample.note ?? note,
      });
      measured.push(row.id);
    } catch (error) {
      failed(row.id, measurementError(error));
    } finally {
      // Yield before the next metric so a large snapshot cannot keep
      // control traffic, including readiness, off the daemon event loop for the
      // duration of the complete metric collection.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return { measured, skipped, failures };
}

export type MetricPassRuntime = {
  idle(): Promise<void>;
};

export function attachMetricSourceMeasurement(options: {
  bus: EventBus;
  persistDir: string;
}): MetricPassRuntime {
  const db = getDb(options.persistDir);
  const metricService = createMetricService({ getDb: () => db });
  // Startup registrations are repeatable definition writes, not observations.
  // Reuse the bounded storage policy when another startup process owns SQLite's
  // writer lock; keep measurement and subscription effects outside this retry.
  withSqliteBusyRetry("register source metric definitions", () => {
    metricService.defineMany(WORKFLOW_OUTCOME_METRICS);
    const subscriberFailureSource = {
      source: "rolling one-hour subscriber.failed event count",
      sourceQuery: SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY,
      measureInterval: 300_000,
      description:
        "Counts every durable subscriber.failed event in the rolling hour, including malformed or unroutable exact-task failures.",
    };
    const existingSubscriberFailureMetric = db
      .prepare("SELECT id FROM metrics WHERE id = ?")
      .get(SUBSCRIBER_FAILED_COUNT_METRIC_ID);
    if (!existingSubscriberFailureMetric) {
      metricService.define({
        id: SUBSCRIBER_FAILED_COUNT_METRIC_ID,
        name: "Event bus subscriber failures (1h)",
        owner: "may",
        type: "health",
        target: 0,
        threshold: 3,
        unit: "count",
        priority: "P2",
        status: "active",
        ...subscriberFailureSource,
        alertOp: ">",
        speed: "fast",
        config: { alert: { mode: "consecutive_failures", count: 2 } },
      });
    } else {
      db.run(
        `UPDATE metrics
       SET source = ?, source_query = ?, measure_interval = ?, description = ?
       WHERE id = ?`,
        [
          subscriberFailureSource.source,
          subscriberFailureSource.sourceQuery,
          subscriberFailureSource.measureInterval,
          subscriberFailureSource.description,
          SUBSCRIBER_FAILED_COUNT_METRIC_ID,
        ],
      );
    }
    const unexpectedUnhandledSource = {
      source: "rolling one-hour unexpected unhandled event count",
      sourceQuery: UNEXPECTED_UNHANDLED_SIGNAL_SOURCE_QUERY,
      measureInterval: 300_000,
      description:
        "Counts unhandled events that are not declared observation-only task lifecycle, profiling, progress, metric, conversation, review, approval, or maintenance report facts.",
    };
    const existingUnexpectedUnhandledMetric = db
      .prepare("SELECT id FROM metrics WHERE id = ?")
      .get(UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID);
    if (!existingUnexpectedUnhandledMetric) {
      metricService.define({
        id: UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID,
        name: "Unexpected unhandled signal events (1h)",
        owner: "may",
        type: "health",
        target: 0,
        threshold: 5,
        unit: "count",
        priority: "P1",
        status: "active",
        ...unexpectedUnhandledSource,
        alertOp: ">",
        speed: "fast",
      });
    } else {
      // Source semantics are canonical Runtime code. Preserve live alert
      // calibration while repairing stale or historically hand-authored queries.
      db.run(
        `UPDATE metrics
       SET source = ?, source_query = ?, measure_interval = ?, description = ?
       WHERE id = ?`,
        [
          unexpectedUnhandledSource.source,
          unexpectedUnhandledSource.sourceQuery,
          unexpectedUnhandledSource.measureInterval,
          unexpectedUnhandledSource.description,
          UNEXPECTED_UNHANDLED_SIGNAL_METRIC_ID,
        ],
      );
    }
    metricService.define({
      id: STALE_ACTIVE_METRIC_ID,
      name: "Stale cadence-bound active metrics",
      owner: "may",
      type: "health",
      target: 0,
      threshold: 0,
      unit: "count",
      priority: "P1",
      status: "active",
      source: "cadence-aware metric snapshot history",
      sourceQuery: STALE_ACTIVE_SOURCE_QUERY,
      measureInterval: 300_000,
      alertOp: ">",
      speed: "fast",
      description:
        "Counts active metrics with an explicit positive measure interval that missed at least two expected samples, with a 15-minute minimum grace window.",
    });
  });

  const nextDueAt = new Map<string, number>();
  return attachMetricPass(options.bus, METRIC_SOURCE_MEASUREMENT_EVENT, "metric-source-measurement", async (current) => {
    await measureSourceMetrics({
      ...options,
      ...current,
      isDue: (metric) => current.forced || current.measuredAt >= (nextDueAt.get(metric.id) ?? 0),
      onAttempt: (metric) => {
        const interval = metric.measure_interval;
        nextDueAt.set(metric.id, current.measuredAt + (typeof interval === "number" && interval > 0 ? interval : 0));
      },
    });
  });
}

/** Recalculate retained evidence without running any collectors. */
export async function evaluateMetrics(options: { bus: EventBus; persistDir: string }) {
  const db = getDb(options.persistDir);
  const metrics = createMetricService({
    getDb: () => db,
    emit: (type, data, envelope) => options.bus.emit({ type, data: data ?? {}, ...envelope } as AgentEvent),
  });
  const ids = db.prepare("SELECT id FROM metrics WHERE status = 'active' AND threshold IS NOT NULL ORDER BY id").all();
  const results = [];
  for (const { id } of ids) {
    try {
      results.push(...metrics.evaluate(String(id)));
    } catch (error) {
      const reason = measurementError(error);
      log("warn", `[metrics:${id}] Evaluation failed: ${reason}`);
      try {
        options.bus.emit({ type: "metric.evaluation.failed", source: "runtime:metric-evaluation",
          owner: "agent:may", data: { metricId: String(id), reason } });
      } catch (error) {
        log("warn", `[metrics:${id}] Could not retain evaluation diagnostic: ${measurementError(error)}`);
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return results;
}

export function attachMetricEvaluation(options: { bus: EventBus; persistDir: string }): MetricPassRuntime {
  return attachMetricPass(options.bus, METRIC_EVALUATION_EVENT, "metric-evaluation", async () => {
    await evaluateMetrics(options);
  });
}

type MetricPass = { triggerEventId?: number; measuredAt: number; forced: boolean };

/** Each pass has independent progress; repeated wakes coalesce while it is busy. */
function attachMetricPass(bus: EventBus, type: string, label: string, run: (pass: MetricPass) => Promise<void>): MetricPassRuntime {
  let pending: MetricPass | undefined;
  let drain: Promise<void> | undefined;
  const schedule = (request: MetricPass) => {
    pending = request;
    if (drain) return;
    drain = new Promise<void>((resolve) => setTimeout(resolve, 0))
      .then(async () => {
        while (pending) {
          const current = pending;
          pending = undefined;
          await run(current);
        }
      })
      .catch((error) => log("warn", `[${label}] ${measurementError(error)}`))
      .finally(() => {
        drain = undefined;
        if (pending) schedule(pending);
      });
  };
  bus.listen((event): void => {
    schedule({
      triggerEventId: (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID],
      measuredAt: Date.now(),
      forced: (event as AgentEvent & { forced?: unknown }).forced === true || eventData(event).forced === true,
    });
  }, { label, types: [type] });
  return {
    async idle() {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      while (drain) await drain;
    },
  };
}
