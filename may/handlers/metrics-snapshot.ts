/**
 * metrics-snapshot.ts — Unified Metric System snapshot handler.
 *
 * Runs every hour. For each active metric:
 *   1. Auto-measures SQL-based metrics (source='auto') by running source_query
 *   2. Command-measures shell-based metrics (source='command') by running source_command
 *   3. Records snapshots in metric_snapshots table
 *   4. Updates current value in metrics table
 *   5. Checks health thresholds and fires alerts (with dedup)
 *   6. Checks for regressions using sensitivity against 7d average
 *   7. Detects stalled metrics (no update within measure_interval)
 *   8. Auto-resolves alerts when metrics recover
 *   9. Auto-closes one-off metrics when current >= target
 *
 * Exports create() conforming to HandlerModule.
 */

import { execSync } from "node:child_process";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import type { SqliteDb } from "../../../src/lib/db.js";

// ── Constants ─────────────────────────────────────────────────────────

const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;
const CMD_TIMEOUT_MS = 10_000;
const DEFAULT_SENSITIVITY = 0.15; // 15%

// ── Types ─────────────────────────────────────────────────────────────

interface MetricRow {
  id: string;
  name: string;
  type: string;
  owner: string;
  current: number | null;
  target: number;
  threshold: number | null;
  alert_direction: string | null; // 'below' (default) or 'above' — controls threshold breach direction
  source: string | null;
  source_query: string | null;
  source_command: string | null;
  sensitivity: number | null;
  measure_interval: number | null;
  updated_at: number;
}

// ── Schema ────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS metrics (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  owner           TEXT NOT NULL,
  current         REAL,
  target          REAL NOT NULL,
  threshold       REAL,
  unit            TEXT,
  priority        TEXT NOT NULL DEFAULT 'P1',
  status          TEXT NOT NULL DEFAULT 'active',
  blocker         TEXT,
  project         TEXT,
  source          TEXT,
  source_query    TEXT,
  source_command  TEXT,
  sensitivity     REAL,
  measure_interval INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  closed_at       INTEGER
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  value       REAL NOT NULL,
  sample_size INTEGER,
  measured_at INTEGER NOT NULL,
  measured_by TEXT,
  note        TEXT
);

CREATE TABLE IF NOT EXISTS metric_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  severity    TEXT NOT NULL,
  message     TEXT NOT NULL,
  value       REAL,
  threshold   REAL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS research_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  ref         TEXT,
  agent       TEXT NOT NULL,
  rating      INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner, status);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON metric_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_research_log_agent ON research_log(agent, type, created_at);
`;

// ── Helpers ───────────────────────────────────────────────────────────

function ensureTables(db: SqliteDb): void {
  db.exec(SCHEMA_SQL);
  // Migration: add alert_direction column if not present
  try {
    db.exec("ALTER TABLE metrics ADD COLUMN alert_direction TEXT DEFAULT 'below'");
  } catch {
    // Column already exists — ignore
  }
}

/**
 * Insert an alert, but only if there isn't already an unresolved alert for
 * the same metric. Prevents alert fatigue from repeated fires.
 */
function recordAlertWithDedup(
  db: SqliteDb,
  metricId: string,
  severity: string,
  message: string,
  value: number | null,
  threshold: number | null,
  now: number,
): void {
  const existing = db.prepare(
    "SELECT id FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL",
  ).get(metricId);
  if (existing) return; // Already alerting on this metric
  db.prepare(
    "INSERT INTO metric_alerts (metric_id, severity, message, value, threshold, created_at) VALUES (?,?,?,?,?,?)",
  ).run(metricId, severity, message, value, threshold, now);
}

/**
 * Check if a metric value has regressed beyond its sensitivity threshold
 * compared to the 7-day moving average.
 */
function checkRegression(
  db: SqliteDb,
  metric: MetricRow,
  currentValue: number,
  now: number,
): void {
  const sensitivity = metric.sensitivity ?? DEFAULT_SENSITIVITY;
  const avg7d = db.prepare(
    "SELECT avg(value) as avg_val FROM metric_snapshots WHERE metric_id = ? AND measured_at > ?",
  ).get(metric.id, now - MS_7D) as { avg_val: number | null } | null;

  if (avg7d?.avg_val != null && avg7d.avg_val > 0) {
    const alertAbove = metric.alert_direction === 'above';
    // For "below" metrics (e.g., quality): regression = value drops below avg
    // For "above" metrics (e.g., error rate): regression = value rises above avg
    const changeRatio = alertAbove
      ? (currentValue - avg7d.avg_val) / avg7d.avg_val  // positive when value rises
      : (avg7d.avg_val - currentValue) / avg7d.avg_val; // positive when value drops
    if (changeRatio > sensitivity) {
      recordAlertWithDedup(
        db,
        metric.id,
        "yellow",
        `${metric.id} regressed ${(changeRatio * 100).toFixed(1)}% vs 7d avg (${avg7d.avg_val.toFixed(2)} → ${currentValue.toFixed(2)})`,
        currentValue,
        avg7d.avg_val,
        now,
      );
    }
  }
}

/**
 * Check if a health metric's value breaches its threshold and record an alert.
 * Returns true if an alert was fired.
 */
function checkThresholdAlert(db: SqliteDb, metric: MetricRow, value: number, now: number): boolean {
  if (metric.type !== "health" || metric.threshold == null) return false;
  const alertAbove = metric.alert_direction === 'above';
  const breaching = alertAbove ? value > metric.threshold : value < metric.threshold;
  if (breaching) {
    const direction = alertAbove ? 'above' : 'below';
    recordAlertWithDedup(db, metric.id, "yellow",
      `${metric.id} ${direction} threshold: ${value} ${alertAbove ? '>' : '<'} ${metric.threshold}`,
      value, metric.threshold, now);
    return true;
  }
  return false;
}

/**
 * Resolve alerts for metrics that have recovered above their thresholds.
 */
function resolveRecoveredAlerts(db: SqliteDb, now: number): void {
  // Find all unresolved alerts where the metric is now above threshold
  const unresolvedAlerts = db.prepare(`
    SELECT ma.id as alert_id, ma.metric_id, m.current, m.threshold, m.type, m.alert_direction
    FROM metric_alerts ma
    JOIN metrics m ON m.id = ma.metric_id
    WHERE ma.resolved_at IS NULL
  `).all() as Array<{
    alert_id: number;
    metric_id: string;
    current: number | null;
    threshold: number | null;
    type: string;
    alert_direction: string | null;
  }>;

  for (const alert of unresolvedAlerts) {
    let resolved = false;

    if (alert.type === "health" && alert.threshold != null && alert.current != null) {
      // Health metric: resolve based on alert direction
      const alertAbove = alert.alert_direction === 'above';
      resolved = alertAbove
        ? alert.current <= alert.threshold  // Was above, now at or below
        : alert.current >= alert.threshold; // Was below, now at or above
    } else if (alert.current != null) {
      // Regression alert: resolve if current is back within 7d average range
      // (simplified: just check if current is no longer below threshold)
      const avg7d = db.prepare(
        "SELECT avg(value) as avg_val FROM metric_snapshots WHERE metric_id = ? AND measured_at > ?",
      ).get(alert.metric_id, now - MS_7D) as { avg_val: number | null } | null;
      if (avg7d?.avg_val != null && avg7d.avg_val > 0) {
        const changeRatio = (avg7d.avg_val - alert.current) / avg7d.avg_val;
        resolved = changeRatio <= DEFAULT_SENSITIVITY;
      }
    }

    if (resolved) {
      db.prepare("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?").run(now, alert.alert_id);
    }
  }
}

/**
 * Try to get sample size for an auto-measured metric by running a COUNT
 * alongside the source query. Best-effort — returns null on failure.
 */
function getSampleSize(db: SqliteDb, sourceQuery: string): number | null {
  try {
    // Wrap source_query in a COUNT — works for simple queries
    // Pattern: if the query has a FROM clause, try to count
    const fromMatch = sourceQuery.match(/FROM\s+(\w+)/i);
    if (!fromMatch) return null;

    const whereMatch = sourceQuery.match(/(WHERE\s+.+?)(?:GROUP|ORDER|LIMIT|$)/is);
    const countSql = `SELECT COUNT(*) as n FROM ${fromMatch[1]}${whereMatch ? " " + whereMatch[1] : ""}`;
    const row = db.prepare(countSql).get() as { n: number } | null;
    return row?.n ?? null;
  } catch {
    return null; // Best-effort
  }
}

/**
 * After recording a snapshot, check if the metric regressed and notify the owner.
 * Regression = value moved in the wrong direction compared to previous snapshot.
 * For "below" alert_direction: regression means value dropped below threshold.
 * For "above" alert_direction: regression means value rose above threshold.
 * For metrics without thresholds: regression means value moved away from target.
 */
function notifyOwnerOnRegression(
  ctx: HandlerContext,
  db: SqliteDb,
  metric: MetricRow,
  newValue: number,
): void {
  try {
    // Get previous snapshot (the one before the one we just inserted)
    const prev = db.prepare(
      `SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 1 OFFSET 1`,
    ).get(metric.id) as { value: number } | null;
    if (!prev) return; // First snapshot, nothing to compare

    const oldValue = prev.value;
    if (oldValue === newValue) return; // No change

    // Determine if this is a regression
    let regressed = false;
    let explanation = "";

    if (metric.threshold != null) {
      // Health metric with threshold
      const alertAbove = metric.alert_direction === "above";
      if (alertAbove) {
        // Bad when value goes above threshold — regressed if new > old AND new > threshold
        regressed = newValue > metric.threshold && newValue > oldValue;
        explanation = `threshold: ${metric.threshold}`;
      } else {
        // Bad when value drops below threshold — regressed if new < old AND new < threshold
        regressed = newValue < metric.threshold && newValue < oldValue;
        explanation = `threshold: ${metric.threshold}`;
      }
    } else {
      // No threshold — regress if moving away from target
      const oldDist = Math.abs(oldValue - metric.target);
      const newDist = Math.abs(newValue - metric.target);
      regressed = newDist > oldDist && newDist > oldDist * 1.05; // 5% tolerance
      explanation = `target: ${metric.target}`;
    }

    if (!regressed) return;

    const task = `⚠️ Metric '${metric.name}' regressed: ${oldValue} → ${newValue} (${explanation}). Investigate and fix.`;

    ctx.trackRequest({
      fromEntity: "metrics-snapshot",
      toAgent: metric.owner,
      method: "notify",
      task,
      source: "metrics-snapshot",
    });
  } catch {
    // Best-effort — don't break snapshot recording
  }
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    ensureTables(db);

    const now = Date.now();
    let autoMeasured = 0;
    let cmdMeasured = 0;
    let alertsFired = 0;
    let alertsResolved = 0;
    let oneOffsClosed = 0;
    let errors = 0;

    // ── 1. Auto-measure SQL-based metrics ───────────────────────────

    const autoMetrics = db.prepare(
      "SELECT * FROM metrics WHERE source = 'auto' AND status = 'active'",
    ).all() as MetricRow[];

    for (const m of autoMetrics) {
      if (!m.source_query) continue;
      try {
        const row = db.prepare(m.source_query).get() as Record<string, unknown> | null;
        if (!row) continue;

        const value = Number(Object.values(row)[0]);
        if (isNaN(value)) continue;

        const sampleSize = getSampleSize(db, m.source_query);

        // Record snapshot
        db.prepare(
          "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by) VALUES (?,?,?,?,?)",
        ).run(m.id, value, sampleSize, now, "auto:metrics-snapshot");

        // Update current value
        db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?").run(value, now, m.id);

        autoMeasured++;

        // Check for regression and notify owner
        notifyOwnerOnRegression(ctx, db, m, value);

        // Check one-off completion
        if (m.type === "one-off" && value >= 1) {
          db.prepare("UPDATE metrics SET status = 'done', closed_at = ? WHERE id = ?").run(now, m.id);
          oneOffsClosed++;
        }

        // Check health threshold
        if (checkThresholdAlert(db, m, value, now)) alertsFired++;

        // Check regression
        checkRegression(db, m, value, now);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.log(`[metrics-snapshot] Failed to measure ${m.id}: ${msg}`);
        errors++;
      }
    }

    // ── 2. Command-measure shell-based metrics ──────────────────────

    const cmdMetrics = db.prepare(
      "SELECT * FROM metrics WHERE source = 'command' AND status = 'active'",
    ).all() as MetricRow[];

    for (const m of cmdMetrics) {
      if (!m.source_command) continue;
      try {
        const result = execSync(m.source_command, {
          cwd: ctx.projectRoot,
          timeout: CMD_TIMEOUT_MS,
          stdio: "pipe",
        }).toString().trim();

        const value = parseFloat(result);
        if (isNaN(value)) {
          ctx.log(`[metrics-snapshot] ${m.id} command returned non-numeric: "${result.slice(0, 100)}"`);
          continue;
        }

        // Record snapshot
        db.prepare(
          "INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?,?,?,?)",
        ).run(m.id, value, now, "auto:metrics-snapshot");

        // Update current value
        db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?").run(value, now, m.id);

        cmdMeasured++;

        // Check for regression and notify owner
        notifyOwnerOnRegression(ctx, db, m, value);

        // Check health threshold
        if (checkThresholdAlert(db, m, value, now)) alertsFired++;

        // Check regression
        checkRegression(db, m, value, now);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.log(`[metrics-snapshot] Failed to measure ${m.id} via command: ${msg.slice(0, 200)}`);
        errors++;
      }
    }

    // ── 3. Check for stalled metrics ────────────────────────────────

    const allActive = db.prepare(
      "SELECT * FROM metrics WHERE status = 'active'",
    ).all() as MetricRow[];

    for (const m of allActive) {
      const interval = m.measure_interval
        ? m.measure_interval * 60 * 60 * 1000  // stored in hours, convert to ms
        : (m.source === "manual" ? MS_48H : null);

      if (interval != null && m.updated_at < now - interval) {
        recordAlertWithDedup(
          db,
          m.id,
          "yellow",
          `${m.name} stalled — no update in expected interval (owner: ${m.owner})`,
          null,
          null,
          now,
        );
        alertsFired++;
      }
    }

    // ── 4. Resolve recovered alerts ─────────────────────────────────

    const unresolvedBefore = (db.prepare(
      "SELECT COUNT(*) as n FROM metric_alerts WHERE resolved_at IS NULL",
    ).get() as { n: number })?.n ?? 0;

    resolveRecoveredAlerts(db, now);

    const unresolvedAfter = (db.prepare(
      "SELECT COUNT(*) as n FROM metric_alerts WHERE resolved_at IS NULL",
    ).get() as { n: number })?.n ?? 0;

    alertsResolved = unresolvedBefore - unresolvedAfter;

    // ── Summary ─────────────────────────────────────────────────────

    const parts: string[] = [];
    if (autoMeasured > 0) parts.push(`${autoMeasured} auto`);
    if (cmdMeasured > 0) parts.push(`${cmdMeasured} cmd`);
    if (oneOffsClosed > 0) parts.push(`${oneOffsClosed} closed`);
    if (alertsFired > 0) parts.push(`${alertsFired} alerts`);
    if (alertsResolved > 0) parts.push(`${alertsResolved} resolved`);
    if (errors > 0) parts.push(`${errors} errors`);

    const summary = parts.length > 0 ? parts.join(", ") : "no active metrics";
    ctx.log(`[metrics-snapshot] Done: ${summary}`);
  };
};
