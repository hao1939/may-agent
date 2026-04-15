/**
 * proof-of-life.ts — Periodic system summary sent to Telegram every 2h.
 *
 * Gives the human operator visibility into system activity without
 * needing to check the web UI. Compact ~10-15 line message with:
 *   1. Per-agent session counts and error counts
 *   2. High-op sessions (>30 ops)
 *   3. Active persistent tasks
 *   4. Total sessions / total errors footer
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ── Constants ─────────────────────────────────────────────────────────

const MS_2H = 2 * 60 * 60 * 1000;

// ── Types ─────────────────────────────────────────────────────────────

interface AgentRow {
  agent: string;
  n: number;
  errs: number;
}

interface HighOpRow {
  agent: string;
  opCount: number;
  task: string;
}

interface PersistentTaskRow {
  agent: string;
  task: string;
  sessionId: string;
}

<<<<<<< HEAD
// ── Metrics Summary ───────────────────────────────────────────────────

interface MetricWithSnapshotRow {
  id: string;
=======
interface HealthMetricRow {
>>>>>>> review/metrics-phase2-integration
  name: string;
  current: number | null;
  target: number | null;
  threshold: number | null;
  unit: string | null;
  type: string;
<<<<<<< HEAD
  last_value: number | null;
  measured_at: number | null;
}

interface MetricAlertRow {
  metric_id: string;
  severity: string;
  message: string;
  value: number | null;
  threshold: number | null;
  created_at: number;
}

function getMetricsSummary(baseDir: string): string {
  const dbPath = join(baseDir, ".state", "may.db");
  if (!existsSync(dbPath)) return "";
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    // Check if metrics table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'"
    ).get();
    if (!tableCheck) return "";

    // All active metrics with latest snapshot
    const metrics = db.prepare(
      `SELECT m.id, m.name, m.current, m.target, m.threshold, m.unit, m.type,
              s.value as last_value, s.measured_at
       FROM metrics m
       LEFT JOIN metric_snapshots s ON m.id = s.metric_id
         AND s.measured_at = (SELECT MAX(measured_at) FROM metric_snapshots WHERE metric_id = m.id)
       WHERE m.status = 'active'
       ORDER BY m.type, m.id`
    ).all() as MetricWithSnapshotRow[];

    if (metrics.length === 0) return "";

    // Recent alerts (last 2h)
    const alertCutoff = Date.now() - MS_2H;
    let recentAlerts: MetricAlertRow[] = [];
    try {
      const alertTableCheck = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='metric_alerts'"
      ).get();
      if (alertTableCheck) {
        recentAlerts = db.prepare(
          `SELECT metric_id, severity, message, value, threshold, created_at
           FROM metric_alerts
           WHERE created_at > ? AND resolved_at IS NULL
           ORDER BY created_at DESC`
        ).all(alertCutoff) as MetricAlertRow[];
      }
    } catch {
      // metric_alerts table may not exist
    }

    // Compute summary counts
    const totalMetrics = metrics.length;
    const measured = metrics.filter(m => m.current != null || m.last_value != null).length;

    // Health metrics breaching thresholds
    const breaching = metrics.filter(m =>
      m.type === "health" &&
      m.threshold != null &&
      m.current != null &&
      m.current < m.threshold
    );

    // Build output lines
    const lines: string[] = [];
    lines.push("");
    lines.push(`📊 Metrics: ${measured}/${totalMetrics} measured, ${recentAlerts.length} alerts active`);

    // Show breaching health metrics
    for (const m of breaching) {
      const unit = m.unit ?? "";
      lines.push(`  ⚠️ ${m.name}: ${m.current}${unit} (threshold: ${m.threshold}${unit})`);
    }

    // Show recent alerts
    for (const a of recentAlerts) {
      const sev = a.severity === "red" ? "🔴" : "🟡";
      const msg = a.message.length > 80 ? a.message.slice(0, 77) + "..." : a.message;
      lines.push(`  ${sev} ${msg}`);
    }

    return lines.join("\n");
  } catch {
    return "";
=======
}

function getHealthMetrics(baseDir: string): HealthMetricRow[] {
  const dbPath = join(baseDir, ".state", "may.db");
  if (!existsSync(dbPath)) return [];
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'"
    ).get();
    if (!tableCheck) return [];
    return db.prepare(
      `SELECT name, current, target, threshold, unit, type
       FROM metrics
       WHERE status = 'active' AND type = 'health' AND current IS NOT NULL
       ORDER BY id`
    ).all() as HealthMetricRow[];
  } catch {
    return [];
>>>>>>> review/metrics-phase2-integration
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    const cutoff = Date.now() - MS_2H;

    // 1. Per-agent session counts and error counts
    let agentRows: AgentRow[] = [];
    try {
      agentRows = db.prepare(
        `SELECT agent, COUNT(*) as n,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errs
         FROM sessions
         WHERE startedAt > ?
         GROUP BY agent
         ORDER BY n DESC`,
      ).all(cutoff) as AgentRow[];
    } catch {
      // Table may not exist yet
    }

    // 2. High-op sessions (>30 ops)
    let highOpRows: HighOpRow[] = [];
    try {
      highOpRows = db.prepare(
        `SELECT agent, opCount, task
         FROM sessions
         WHERE startedAt > ? AND opCount > 30
         ORDER BY opCount DESC
         LIMIT 5`,
      ).all(cutoff) as HighOpRow[];
    } catch {
      // Table may not exist
    }

    // 3. Active persistent tasks (sessions from persistent-task workflow still running)
    let persistentRows: PersistentTaskRow[] = [];
    try {
      persistentRows = db.prepare(
        `SELECT agent, task, sessionId
         FROM sessions
         WHERE status = 'running'
           AND workflowRunId IS NOT NULL
           AND task LIKE '%persistent%'
         LIMIT 5`,
      ).all() as PersistentTaskRow[];
    } catch {
      // Column may not exist
    }

    // Compute totals
    let totalSessions = 0;
    let totalErrors = 0;
    for (const row of agentRows) {
      totalSessions += row.n;
      totalErrors += row.errs;
    }

    // If no activity at all, send a minimal message
    if (totalSessions === 0) {
      ctx.notify("🫀 *Proof of Life* — Last 2h: no sessions recorded.");
      ctx.log("[proof-of-life] No sessions in last 2h — sent minimal digest.");
      return;
    }

    // Format the message
    const lines: string[] = [];
    lines.push("🫀 *Proof of Life* — Last 2h activity:");
    lines.push("");

    // Per-agent lines
    for (const row of agentRows) {
      const errStr = row.errs > 0 ? ` ⚠️${row.errs}err` : "";
      lines.push(`  ${row.agent}: ${row.n} sessions${errStr}`);
    }

    // High-op sessions
    if (highOpRows.length > 0) {
      lines.push("");
      lines.push("📊 High-op sessions:");
      for (const row of highOpRows) {
        const taskSnip = (row.task || "").replace(/\n/g, " ").slice(0, 60);
        lines.push(`  ${row.agent} (${row.opCount} ops) — ${taskSnip}`);
      }
    }

    // Persistent tasks
    if (persistentRows.length > 0) {
      lines.push("");
      lines.push("🔄 Active persistent tasks:");
      for (const row of persistentRows) {
        const taskSnip = (row.task || "").replace(/\n/g, " ").slice(0, 60);
        lines.push(`  ${row.agent}: ${taskSnip}`);
      }
    }

<<<<<<< HEAD
    // Metrics summary from may.db
    const baseDir = process.cwd();
    const metricsSummary = getMetricsSummary(baseDir);
    if (metricsSummary) {
      lines.push(metricsSummary);
=======
    // Health metrics summary from may.db
    const baseDir = process.cwd();
    const healthMetrics = getHealthMetrics(baseDir);
    if (healthMetrics.length > 0) {
      lines.push("");
      lines.push("📊 Health metrics:");
      for (const m of healthMetrics) {
        const unit = m.unit ? m.unit : "";
        const warn = m.threshold != null && m.current != null && m.current < m.threshold ? " ⚠️" : "";
        const targetStr = m.target != null ? `/${m.target}` : "";
        lines.push(`  ${m.name}: ${m.current}${targetStr} ${unit}${warn}`);
      }
>>>>>>> review/metrics-phase2-integration
    }

    // Footer
    lines.push("");
    lines.push(`Total: ${totalSessions} sessions, ${totalErrors} errors.`);

    const message = lines.join("\n");
    ctx.notify(message);
    ctx.log(`[proof-of-life] Sent digest: ${totalSessions} sessions, ${totalErrors} errors.`);
  };
};
