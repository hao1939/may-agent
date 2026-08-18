import { createMetricService } from "../lib/metrics.js";
import { EVENT_ROW_ID, type AgentEvent, type DeliveryResult, type EventBus } from "./event-bus.js";
import { getDb } from "../lib/db/connection.js";

export const METRIC_SOURCE_MEASUREMENT_EVENT = "trigger.metrics-snapshot";

type SourceMetric = {
  id: string;
  source_query: string;
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

/**
 * Measure active metrics backed by a persisted read-only source query.
 *
 * The metric definition remains the domain authority. This Host consumer only
 * executes that accepted definition, records the correlated observation, and
 * asks MetricService to apply the existing alert lifecycle.
 */
export function measureSourceQueryMetrics(options: {
  bus: EventBus;
  persistDir: string;
  triggerEventId?: number;
  measuredAt?: number;
}): { measured: string[]; skipped: string[] } {
  const db = getDb(options.persistDir);
  const metrics = createMetricService({
    getDb: () => db,
    measuredBy: "runtime:metric-source-query",
    emit: (type, data, envelope) => {
      options.bus.emit({ type, data: data ?? {}, ...envelope } as AgentEvent);
    },
  });
  const rows = db
    .prepare(
      `SELECT id, source_query
       FROM metrics
       WHERE status = 'active'
         AND source_query IS NOT NULL
         AND trim(source_query) != ''
       ORDER BY id`,
    )
    .all() as SourceMetric[];
  const measured: string[] = [];
  const skipped: string[] = [];
  const measuredAt = options.measuredAt ?? Date.now();
  const note = options.triggerEventId
    ? `source-query; trigger-event:${options.triggerEventId}`
    : "source-query";

  for (const row of rows) {
    if (!isReadOnlySourceQuery(row.source_query)) {
      skipped.push(row.id);
      continue;
    }
    const value = sourceQueryValue(
      db.prepare(row.source_query).get() as Record<string, unknown> | null,
    );
    if (value == null) {
      skipped.push(row.id);
      continue;
    }
    metrics.record(row.id, value, {
      measuredAt,
      measuredBy: "runtime:metric-source-query",
      note,
    });
    metrics.evaluate(row.id);
    measured.push(row.id);
  }

  return { measured, skipped };
}

export function attachMetricSourceMeasurement(options: {
  bus: EventBus;
  persistDir: string;
}): void {
  options.bus.subscribe((event): DeliveryResult | void => {
    if ((event as { type: string }).type !== METRIC_SOURCE_MEASUREMENT_EVENT) return;
    const triggerEventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[
      EVENT_ROW_ID
    ];
    const result = measureSourceQueryMetrics({
      ...options,
      triggerEventId,
      measuredAt: Date.now(),
    });
    return {
      accepted: true,
      by: "runtime:metric-source-query",
      route: "direct",
      note: `measured ${result.measured.length} source-query metric(s); skipped ${result.skipped.length}`,
    };
  });
}
