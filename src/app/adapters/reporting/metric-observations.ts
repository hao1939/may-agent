import type { SqliteDb } from "../../../lib/db.js";
import { metricThresholdBreached } from "../../../lib/metrics.js";
import { classifyMetricScope, resolveObservabilityCatalog, type AppCatalog } from "./observability-summary.js";
import { WORKFLOW_OUTCOME_METRICS, WORKFLOW_OUTCOMES, WORKFLOW_OUTCOME_WINDOW_MS } from "./workflow-metrics.js";

export const METRIC_LIST_LIMIT = 500;
export const METRIC_HISTORY_LIMIT = 2_000;
// Display tolerance only: allow one missed scheduled observation before stale.
// A cadence-free or future-dated observation has unknown freshness, never healthy.
const STALE_INTERVALS = 2;

export function readMetricObservations(
  db: SqliteDb,
  now = Date.now(),
  ids?: string[],
  appCatalog?: AppCatalog,
  options?: { scopeAppId?: string | null; limit?: number; projectsRoot?: string },
) {
  const scopeAppId = options?.scopeAppId?.trim() || null;
  const catalog =
    appCatalog ?? resolveObservabilityCatalog(db, { projectsRoot: options?.projectsRoot, filterAppId: scopeAppId });
  const rowLimit = options?.limit ?? METRIC_LIST_LIMIT;

  let effectiveIds = ids;
  let prefilteredTruncated = false;
  if (scopeAppId && !ids) {
    const candidates = db
      .prepare("SELECT id, owner, project, config FROM metrics WHERE status = 'active' ORDER BY owner, priority, id")
      .all() as Array<{ id: string; owner: string | null; project: string | null; config: string | null }>;
    const matching: string[] = [];
    for (const c of candidates) {
      const sc = classifyMetricScope(c, catalog);
      if (sc.kind === "app" && sc.appId === scopeAppId) {
        matching.push(c.id);
      }
    }
    prefilteredTruncated = matching.length > rowLimit;
    effectiveIds = matching.slice(0, rowLimit);
    if (effectiveIds.length === 0) {
      return { metrics: [], truncated: false, generatedAt: now };
    }
  }

  const rows = db
    .prepare(
      `SELECT m.id, m.name, m.type, m.owner, m.project, m.target, m.threshold,
    m.unit, m.priority, m.status, m.alert_op, m.source, m.source_query, m.description, m.config, m.measure_interval,
    s.id AS sampleId, s.value, s.sample_size, s.measured_at, s.measured_by, s.note,
    e.id AS failureId, e.timestamp AS failedAt, e.data AS failureData
    FROM metrics m
    LEFT JOIN metric_snapshots s ON s.id = (
      SELECT id FROM metric_snapshots WHERE metric_id = m.id ORDER BY measured_at DESC, id DESC LIMIT 1)
    LEFT JOIN events e ON e.id = (
      SELECT id FROM events WHERE metric_id = m.id AND event_type = 'metric.measurement.failed'
      ORDER BY timestamp DESC, id DESC LIMIT 1)
    WHERE m.status = 'active' ${effectiveIds ? `AND m.id IN (${effectiveIds.map(() => "?").join(",") || "NULL"})` : ""}
    ORDER BY m.owner, m.priority, m.id LIMIT ?`,
    )
    .all(...(effectiveIds ?? []), rowLimit + 1) as Array<{
    id: string;
    name: string | null;
    owner: string | null;
    project: string | null;
    type: string | null;
    target: number | null;
    threshold: number | null;
    unit: string | null;
    priority: string | null;
    status: string;
    alert_op: string | null;
    source: string | null;
    source_query: string | null;
    description: string | null;
    config: string | null;
    measure_interval: number | null;
    sampleId: number | null;
    value: number | null;
    sample_size: number | null;
    measured_at: number | null;
    measured_by: string | null;
    note: string | null;
    failureId: number | null;
    failedAt: number | null;
    failureData: string | null;
  }>;
  const metrics = rows.slice(0, rowLimit).map(({ failureData, config, source_query, ...row }) => {
    let reason = "Source measurement failed; explanation unavailable";
    try {
      const data = JSON.parse(failureData ?? "null");
      if (typeof data?.reason === "string") reason = data.reason.slice(0, 2_000);
    } catch {
      /* Retain the failure identity even with unreadable detail. */
    }
    let alertsDisabled = false;
    let parsedConfig: Record<string, unknown> | null = null;
    try {
      const cfg = JSON.parse(config ?? "null");
      if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
        parsedConfig = cfg as Record<string, unknown>;
        const alert = parsedConfig.alert as Record<string, unknown> | undefined;
        alertsDisabled = alert?.disabled === true || alert?.mode === "disabled";
      }
    } catch {
      /* No invented policy. */
    }
    const lastNoExposureAt =
      typeof parsedConfig?.lastNoExposureAt === "number" &&
      Number.isSafeInteger(parsedConfig.lastNoExposureAt) &&
      parsedConfig.lastNoExposureAt > 0
        ? parsedConfig.lastNoExposureAt
        : null;
    const hasSnapshot =
      row.sampleId !== null && row.value !== null && Number.isFinite(row.value) && row.measured_at !== null;
    const supersededByNoExposure =
      lastNoExposureAt !== null && (!hasSnapshot || lastNoExposureAt > row.measured_at!);
    const observed = hasSnapshot && !supersededByNoExposure;
    const staleAfterMs =
      row.measure_interval && row.measure_interval > 0 ? row.measure_interval * STALE_INTERVALS : null;
    const lastCheckedAt =
      hasSnapshot && lastNoExposureAt !== null
        ? Math.max(row.measured_at!, lastNoExposureAt)
        : hasSnapshot
          ? row.measured_at!
          : lastNoExposureAt;
    const freshness =
      lastCheckedAt === null
        ? "missing"
        : lastCheckedAt > now || staleAfterMs === null
          ? "unknown"
          : now - lastCheckedAt > staleAfterMs
            ? "stale"
            : "fresh";
    const thresholdBreached =
      observed && row.threshold !== null
        ? metricThresholdBreached({ current: row.value!, threshold: row.threshold, alert_op: row.alert_op })
        : null;
    // Only the supplied, unchanged workflow query has a known cohort contract.
    // Arbitrary metric names/SQL do not imply a run selection or a root cause.
    const workflowIndex = WORKFLOW_OUTCOME_METRICS.findIndex(
      (def) => def.id === row.id && def.sourceQuery === source_query,
    );
    const workflowSelection =
      observed &&
      Number.isSafeInteger(row.measured_at) &&
      row.measured_at! >= WORKFLOW_OUTCOME_WINDOW_MS &&
      row.measured_at! <= now &&
      workflowIndex >= 0
        ? {
            start: row.measured_at! - WORKFLOW_OUTCOME_WINDOW_MS,
            end: row.measured_at!,
            scope: "top-level",
            outcome: WORKFLOW_OUTCOMES[workflowIndex]!,
          }
        : null;
    return {
      ...row,
      scope: classifyMetricScope({ ...row, config: parsedConfig }, catalog),
      noExposure: supersededByNoExposure,
      current: observed ? row.value : null,
      updated_at: observed ? row.measured_at : null,
      observation: observed
        ? {
            value: row.value!,
            measuredAt: row.measured_at!,
            sampleSize: row.sample_size,
            note: row.note,
            measuredBy: row.measured_by,
          }
        : null,
      freshness,
      staleAfterMs,
      thresholdBreached,
      alertsDisabled,
      workflowSelection,
      collectionFailure:
        row.failureId !== null
          ? {
              eventId: row.failureId,
              at: row.failedAt!,
              reason,
              afterLastSample: lastCheckedAt === null || row.failedAt! >= lastCheckedAt,
            }
          : null,
    };
  });
  return { metrics, truncated: prefilteredTruncated || rows.length > rowLimit, generatedAt: now };
}

export function readMetricHistory(db: SqliteDb, metricId: string, window: { start: number; end: number }) {
  const samples = db
    .prepare(
      `SELECT id, value, sample_size, measured_at, measured_by, note FROM metric_snapshots
    WHERE metric_id = ? AND measured_at >= ? AND measured_at < ? ORDER BY measured_at DESC, id DESC LIMIT ?`,
    )
    .all(metricId, window.start, window.end, METRIC_HISTORY_LIMIT + 1);
  const failures = db
    .prepare(
      `SELECT id AS eventId, timestamp, substr(data, 1, 4000) AS data FROM events
    WHERE metric_id = ? AND event_type = 'metric.measurement.failed' AND timestamp >= ? AND timestamp < ?
    ORDER BY timestamp DESC, id DESC LIMIT ?`,
    )
    .all(metricId, window.start, window.end, METRIC_HISTORY_LIMIT + 1);
  return {
    metricId,
    window,
    snapshots: samples.slice(0, METRIC_HISTORY_LIMIT).reverse(),
    failures: failures.slice(0, METRIC_HISTORY_LIMIT).reverse(),
    truncated: samples.length > METRIC_HISTORY_LIMIT || failures.length > METRIC_HISTORY_LIMIT,
  };
}
