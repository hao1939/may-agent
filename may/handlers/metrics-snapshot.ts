/**
 * metrics-snapshot — Measures system health metrics every 5 minutes.
 * See: agents/shared/may-agent-docs/design/health-metrics.md
 */
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";

// alert_op: "<" = alert when current < threshold (too low)
//           ">" = alert when current > threshold (too high)
const ALL_METRICS = [
  // Handler
  { id: "handler.completed-count", name: "Handler completions (6h)", owner: "may", target: 50, threshold: 10, unit: "count", alert_op: "<" },
  { id: "handler.failed-count", name: "Handler failures (6h)", owner: "may", target: 0, threshold: 3, unit: "count", alert_op: ">" },
  { id: "handler.success-rate", name: "Handler success rate (6h)", owner: "optimizer", target: 0.95, threshold: 0.80, unit: "ratio", alert_op: "<" },
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)", owner: "may", target: 8, threshold: 6, unit: "count", alert_op: "<" },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", target: 120000, threshold: 600000, unit: "ms", alert_op: ">" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", target: 30, threshold: 15, unit: "count", alert_op: "<" },
  // Project
  { id: "project.active-count", name: "Active projects", owner: "may", target: 3, threshold: 1, unit: "count", alert_op: "<" },
  { id: "project.blocked-count", name: "Blocked/waiting projects", owner: "may", target: 0, threshold: 2, unit: "count", alert_op: ">" },
  { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", target: 0, threshold: 2, unit: "count", alert_op: ">" },
  { id: "project.iterations-24h", name: "Project iterations (24h)", owner: "may", target: 10, threshold: 0, unit: "count", alert_op: "<" },
  { id: "project.blocked-rate-7d", name: "Project blocked rate (7d)", owner: "may", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">" },
  { id: "project.blocked-over-6h", name: "Projects blocked/waiting >6h", owner: "may", target: 0, threshold: 1, unit: "count", alert_op: ">" },
];

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const db = ctx.getDb();
    const now = Date.now();

    // ── Helpers ──────────────────────────────────────────────────────

    function record(id: string, value: number, sampleSize?: number) {
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [value, now, id]);
      if (sampleSize != null) {
        db.run("INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by) VALUES (?, ?, ?, ?, ?)",
          [id, value, sampleSize, now, "metrics-snapshot"]);
      } else {
        db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
          [id, value, now, "metrics-snapshot"]);
      }
    }

    function count(query: string, ...args: any[]): number {
      return (db.prepare(query).get(...args) as any)?.c || 0;
    }

    // ── Ensure metric rows exist ─────────────────────────────────────

    for (const m of ALL_METRICS) {
      db.run(
        `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_op, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 'health', 'active', 'fast', ?, ?, ?)`,
        [m.id, m.name, m.owner, m.target, m.threshold, m.unit, m.alert_op, now, now]
      );
      db.run("UPDATE metrics SET alert_op = ?, threshold = ? WHERE id = ?", [m.alert_op, m.threshold, m.id]);
    }

    // ── Measure: Handler ─────────────────────────────────────────────

    const sixH = now - 6 * 3600000;
    const twoH = now - 2 * 3600000;
    const oneH = now - 3600000;

    const completed = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?", sixH);
    const failed = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?", sixH);
    record("handler.completed-count", completed);
    record("handler.failed-count", failed);

    const total = completed + failed;
    record("handler.success-rate", total > 0 ? parseFloat((completed / total).toFixed(4)) : 1, total);

    const coverage = count(
      `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
       WHERE event_type = 'handler.completed' AND json_extract(data, '$.handler') LIKE 'heartbeat-%' AND timestamp > ?`, twoH);
    record("handler.heartbeat-coverage", coverage);

    const durations = (db.prepare(
      `SELECT json_extract(data, '$.durationMs') as dur FROM events
       WHERE event_type = 'handler.completed' AND timestamp > ? ORDER BY dur ASC`
    ).all(sixH) as any[]).map(r => r.dur).filter(d => d != null);
    if (durations.length > 0) {
      const p95 = durations[Math.min(Math.floor(durations.length * 0.95), durations.length - 1)];
      record("handler.p95-duration", p95, durations.length);
    }

    record("handler.fires-per-hour", count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.started' AND timestamp > ?", oneH));

    // ── Measure: Project ─────────────────────────────────────────────

    const fortyEightH = now - 48 * 3600000;
    const twentyFourH = now - 24 * 3600000;
    const sevenD = now - 7 * 86400000;

    record("project.active-count", count("SELECT COUNT(*) as c FROM projects WHERE status = 'active'"));
    record("project.blocked-count", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting')"));

    // Stale: active projects with no iteration event in 48h
    const activeProjects = db.prepare("SELECT id FROM projects WHERE status = 'active'").all() as any[];
    let stale = 0;
    for (const p of activeProjects) {
      const last = (db.prepare("SELECT MAX(timestamp) as t FROM events WHERE event_type = 'project.iteration' AND data LIKE ?").get(`%${p.id}%`) as any)?.t;
      if (!last || last < fortyEightH) stale++;
    }
    record("project.stale-active-count", stale);

    record("project.iterations-24h", count("SELECT COUNT(*) as c FROM events WHERE event_type = 'project.iteration' AND timestamp > ?", twentyFourH));

    const blocked7d = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'project.blocked' AND timestamp > ?", sevenD);
    const productive7d = count("SELECT COUNT(*) as c FROM events WHERE event_type IN ('project.iteration', 'project.completed') AND timestamp > ?", sevenD);
    const total7d = blocked7d + productive7d;
    record("project.blocked-rate-7d", total7d > 0 ? parseFloat((blocked7d / total7d).toFixed(4)) : 0);

    record("project.blocked-over-6h", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting') AND updated_at < ?", now - 6 * 3600000));

    // ── Generic metrics (source_query / source_command) ──────────────

    const measurable = db.prepare(
      "SELECT id, source_query, source_command FROM metrics WHERE status = 'active' AND (source_query IS NOT NULL OR source_command IS NOT NULL)"
    ).all() as any[];

    let measured = 0;
    for (const m of measurable) {
      try {
        let value: number | null = null;
        if (m.source_query) {
          const row = db.prepare(m.source_query).get() as any;
          if (row) {
            const vals = Object.values(row).filter(v => typeof v === "number");
            if (vals.length > 0) value = vals[0] as number;
          }
        } else if (m.source_command) {
          const { execSync } = require("node:child_process");
          const output = execSync(m.source_command, { cwd: ctx.projectRoot, timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
          const parsed = parseFloat(output);
          if (!isNaN(parsed)) value = parsed;
        }
        if (value !== null) { record(m.id, value); measured++; }
      } catch { /* skip individual metric errors */ }
    }

    ctx.log(`[metrics-snapshot] 12 metrics recorded (6 handler + 6 project), ${measured}/${measurable.length} source-defined`);
  };
};
