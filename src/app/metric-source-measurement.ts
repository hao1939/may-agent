import { execFile, type ExecFileOptionsWithStringEncoding } from "node:child_process";
import { createMetricService } from "../lib/metrics.js";
import { log } from "../lib/log.js";
import { EVENT_ROW_ID, type AgentEvent, type DeliveryResult, type EventBus } from "./event-bus.js";
import { getDb } from "../lib/db/connection.js";
import { projectSemanticObservations } from "../lib/semantic-observation-projection.js";
import type { AppObservationProjection } from "@may-agent/sdk";

export const METRIC_SOURCE_MEASUREMENT_EVENT = "trigger.metrics-snapshot";
export const SUBSCRIBER_FAILED_COUNT_METRIC_ID = "infra.bus.subscriber-failed-count-1h";
export const SUBSCRIBER_FAILED_COUNT_SOURCE_QUERY = `SELECT COUNT(*) AS value
FROM events
WHERE event_type = 'subscriber.failed'
  AND timestamp >= (strftime('%s','now') * 1000 - 3600000)`;
export const STALE_ACTIVE_METRIC_ID = "metric.stale-active-count";
export const UNHANDLED_SIGNAL_METRIC_ID = "event.unhandled-signal-count-1h";
export const STALE_ACTIVE_SOURCE_QUERY = `SELECT COUNT(*) AS value
FROM metrics m
WHERE m.status = 'active'
  AND m.id != '${STALE_ACTIVE_METRIC_ID}'
  AND m.measure_interval IS NOT NULL
  AND m.measure_interval > 0
  AND NOT EXISTS (
    SELECT 1
    FROM metric_snapshots s
    WHERE s.metric_id = m.id
      AND s.measured_at > (
        strftime('%s','now') * 1000
        - MAX(900000, m.measure_interval * 2)
      )
  )`;

type SourceMetric = {
  id: string;
  source_query: string | null;
  source_command: string | null;
};

type CommandSample = {
  value: number;
  sampleSize?: number;
  measuredAt?: number;
  note?: string;
};

function sourceQueryValue(row: Record<string, unknown> | null): number | null {
  if (!row) return null;
  const candidate = Object.prototype.hasOwnProperty.call(row, "value")
    ? row.value
    : Object.values(row)[0];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function isReadOnlySourceQuery(query: string): boolean {
  const normalized = query.trim();
  if (!/^(SELECT|WITH)\b/i.test(normalized)) return false;
  return !normalized.replace(/;\s*$/, "").includes(";");
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

function parseCommandOutput(output: string): CommandSample | null {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return commandSample(JSON.parse(trimmed));
  } catch {
    const value = Number(trimmed);
    return Number.isFinite(value) ? { value } : null;
  }
}

export function batchableProjectMetricCommand(
  command: string,
): { scriptPath: string; metricId: string } | null {
  const match = command
    .trim()
    .match(/^bun\s+(\S+\/project-metrics\.ts)\s+(\S+)\s+--json$/);
  return match ? { scriptPath: match[1]!, metricId: match[2]! } : null;
}

function execFileText(file: string, args: string[], options: ExecFileOptionsWithStringEncoding): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function executeCommand(command: string): Promise<CommandSample | null> {
  const stdout = await execFileText("/bin/sh", ["-lc", command], {
    cwd: "/app",
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return parseCommandOutput(stdout);
}

async function executeBatches(rows: SourceMetric[]): Promise<{
  samples: Map<string, CommandSample>;
  handled: Set<string>;
}> {
  const groups = new Map<string, Array<{ rowId: string; metricId: string }>>();
  for (const row of rows) {
    if (!row.source_command) continue;
    const parsed = batchableProjectMetricCommand(row.source_command);
    if (!parsed) continue;
    const group = groups.get(parsed.scriptPath) ?? [];
    group.push({ rowId: row.id, metricId: parsed.metricId });
    groups.set(parsed.scriptPath, group);
  }

  const samples = new Map<string, CommandSample>();
  const handled = new Set<string>();
  for (const [scriptPath, group] of groups) {
    if (group.length < 2) continue;
    for (const item of group) handled.add(item.rowId);
    try {
      const stdout = await execFileText(
        "bun",
        [scriptPath, "--batch-json", ...group.map((item) => item.metricId)],
        {
          cwd: "/app",
          encoding: "utf8",
          timeout: 120_000,
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      for (const item of group) {
        const sample = commandSample(parsed[item.metricId]);
        if (sample) samples.set(item.rowId, sample);
      }
    } catch {
      // Keep every omitted/failed batch member stale; never fabricate a sample.
    }
  }
  return { samples, handled };
}

/**
 * Measure active metrics backed by a persisted source query or source command.
 *
 * The metric definition remains the domain authority. This Host consumer only
 * executes that accepted definition, records the correlated real observation,
 * and asks MetricService to apply the existing alert lifecycle.
 */
export async function measureSourceMetrics(options: {
  bus: EventBus;
  persistDir: string;
  triggerEventId?: number;
  measuredAt?: number;
  observationProjections?: readonly AppObservationProjection[];
}): Promise<{ measured: string[]; skipped: string[] }> {
  const db = getDb(options.persistDir);
  const metrics = createMetricService({
    getDb: () => db,
    measuredBy: "runtime:metric-source-measurement",
    emit: (type, data, envelope) => {
      options.bus.emit({ type, data: data ?? {}, ...envelope } as AgentEvent);
    },
  });
  const rows = db
    .prepare(
      `SELECT id, source_query, source_command
       FROM metrics
       WHERE status = 'active'
         AND ((source_query IS NOT NULL AND trim(source_query) != '')
           OR (source_command IS NOT NULL AND trim(source_command) != ''))
       ORDER BY id`,
    )
    .all() as SourceMetric[];
  const measured: string[] = [];
  const skipped: string[] = [];
  const defaultMeasuredAt = options.measuredAt ?? Date.now();
  const queryNote = options.triggerEventId
    ? `source-query; trigger-event:${options.triggerEventId}`
    : "source-query";
  const commandNote = options.triggerEventId
    ? `source-command; trigger-event:${options.triggerEventId}`
    : "source-command";
  const batches = await executeBatches(rows);

  for (const row of rows) {
    try {
      let sample: CommandSample | null = null;
      let measuredBy = "runtime:metric-source-query";
      let note = queryNote;
      if (row.source_query) {
        if (!isReadOnlySourceQuery(row.source_query)) {
          skipped.push(row.id);
          continue;
        }
        if (row.id === UNHANDLED_SIGNAL_METRIC_ID && options.observationProjections?.length) {
          const since = defaultMeasuredAt - 3_600_000;
          const projected = projectSemanticObservations({
            db,
            projections: options.observationProjections,
            since,
            now: defaultMeasuredAt,
          });
          const unhandled = db
            .prepare(
              `SELECT id FROM events
               WHERE delivery_status = 'unhandled'
                 AND event_type != 'channel.delivery.completed'
                 AND timestamp >= ? AND timestamp <= ?`,
            )
            .all(since, defaultMeasuredAt) as Array<{ id: number }>;
          sample = { value: unhandled.filter((event) => !projected.has(event.id)).length };
        } else {
          const value = sourceQueryValue(
            db.prepare(row.source_query).get() as Record<string, unknown> | null,
          );
          if (value != null) sample = { value };
        }
      } else if (row.source_command) {
        measuredBy = "runtime:metric-source-command";
        note = commandNote;
        sample = batches.samples.get(row.id) ?? null;
        if (!sample && !batches.handled.has(row.id)) {
          sample = await executeCommand(row.source_command);
        }
      }
      if (!sample) {
        skipped.push(row.id);
        continue;
      }
      metrics.record(row.id, sample.value, {
        measuredAt: sample.measuredAt ?? defaultMeasuredAt,
        measuredBy,
        sampleSize: sample.sampleSize,
        note: sample.note ?? note,
      });
      metrics.evaluate(row.id);
      measured.push(row.id);
    } catch {
      skipped.push(row.id);
    } finally {
      // Recording and evaluating one observation remains a synchronous durable
      // boundary. Yield before the next metric so a large snapshot cannot keep
      // control traffic, including readiness, off the daemon event loop for the
      // duration of the complete metric collection.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  return { measured, skipped };
}

export const measureSourceQueryMetrics = measureSourceMetrics;

export type MetricSourceMeasurementRuntime = {
  idle(): Promise<void>;
};

export function attachMetricSourceMeasurement(options: {
  bus: EventBus;
  persistDir: string;
  observationProjections?: readonly AppObservationProjection[];
}): MetricSourceMeasurementRuntime {
  const db = getDb(options.persistDir);
  const metricService = createMetricService({ getDb: () => db });
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
  metricService.define({
    id: STALE_ACTIVE_METRIC_ID,
    name: "Stale cadence-bound active metrics",
    owner: "may",
    type: "health",
    target: 0,
    threshold: 45,
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

  let pending: { triggerEventId?: number; measuredAt: number } | undefined;
  let drain: Promise<void> | undefined;

  const schedule = (request: { triggerEventId?: number; measuredAt: number }) => {
    // Metrics are observations. If snapshots arrive faster than their source
    // commands finish, one latest observation is sufficient.
    pending = request;
    if (drain) return;
    drain = (async () => {
      while (pending) {
        const current = pending;
        pending = undefined;
        await measureSourceMetrics({ ...options, ...current });
      }
    })()
      .catch((error) => {
        log("warn", `[metrics] source measurement failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        drain = undefined;
        if (pending) schedule(pending);
      });
  };

  options.bus.subscribe((event): DeliveryResult | void => {
    if ((event as { type: string }).type !== METRIC_SOURCE_MEASUREMENT_EVENT) return;
    const triggerEventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[
      EVENT_ROW_ID
    ];
    schedule({
      triggerEventId,
      measuredAt: Date.now(),
    });
    return {
      accepted: true,
      by: "runtime:metric-source-measurement",
      route: "direct",
      note: "source-defined metric observation scheduled",
    };
  });

  return {
    async idle() {
      while (drain) await drain;
    },
  };
}
