/**
 * metrics-snapshot — Measures system health metrics every 5 minutes.
 *
 * Queries the events table for handler.started/completed/failed events
 * and the projects table, writing metric snapshots for:
 *
 * Handler metrics:
 *   - handler.completed-count (6h)
 *   - handler.failed-count (6h)
 *   - handler.success-rate (6h, derived)
 *   - handler.heartbeat-coverage (2h)
 *   - handler.p95-duration (6h)
 *   - handler.fires-per-hour (1h)
 *
 * Project metrics:
 *   - project.active-count
 *   - project.blocked-count
 *   - project.stale-active-count (48h)
 *   - project.iterations-24h
 *   - project.blocked-rate-7d (derived)
 */
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";

// alert_op: "<" means alert when current < threshold (too low)
//           ">" means alert when current > threshold (too high)
const METRICS = [
  { id: "handler.completed-count", name: "Handler completions (6h)", owner: "may", target: 50, threshold: 10, unit: "count", alert_op: "<" },
  { id: "handler.failed-count", name: "Handler failures (6h)", owner: "may", target: 0, threshold: 3, unit: "count", alert_op: ">" },
  { id: "handler.success-rate", name: "Handler success rate (6h)", owner: "optimizer", target: 0.95, threshold: 0.80, unit: "ratio", alert_op: "<" },
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)", owner: "may", target: 8, threshold: 6, unit: "count", alert_op: "<" },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", target: 120000, threshold: 600000, unit: "ms", alert_op: ">" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", target: 30, threshold: 15, unit: "count", alert_op: "<" },
];

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const db = ctx.getDb();
    const now = Date.now();
    const sixHoursAgo = now - 6 * 3600000;
    const twoHoursAgo = now - 2 * 3600000;
    const oneHourAgo = now - 3600000;

    // Rename column on first run (alert_direction → alert_op)
    try { db.run("ALTER TABLE metrics RENAME COLUMN alert_direction TO alert_op"); } catch {}

    // Ensure metrics exist
    for (const m of METRICS) {
      try {
        db.run(
          `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_op, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, 'health', 'active', 'fast', ?, ?, ?)`,
          [m.id, m.name, m.owner, m.target, m.threshold, m.unit, m.alert_op, now, now]
        );
        db.run("UPDATE metrics SET alert_op = ?, threshold = ? WHERE id = ?", [m.alert_op, m.threshold, m.id]);
      } catch { /* already exists */ }
    }

    // 1. handler counts (6h) — primitives
    let completed = 0, failed = 0;
    try {
      completed = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?"
      ).get(sixHoursAgo) as any)?.c || 0;
      failed = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?"
      ).get(sixHoursAgo) as any)?.c || 0;

      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [completed, now, "handler.completed-count"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["handler.completed-count", completed, now, "metrics-snapshot"]);

      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [failed, now, "handler.failed-count"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["handler.failed-count", failed, now, "metrics-snapshot"]);

      // Derived: success-rate
      const total = completed + failed;
      const rate = total > 0 ? completed / total : 1;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [parseFloat(rate.toFixed(4)), now, "handler.success-rate"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by) VALUES (?, ?, ?, ?, ?)",
        ["handler.success-rate", parseFloat(rate.toFixed(4)), total, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] handler counts error: ${e}`); }

    // 2. handler.heartbeat-coverage (2h)
    try {
      const agents = (db.prepare(
        `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
         WHERE event_type = 'handler.completed'
           AND json_extract(data, '$.handler') LIKE 'heartbeat-%'
           AND timestamp > ?`
      ).get(twoHoursAgo) as any)?.c || 0;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [agents, now, "handler.heartbeat-coverage"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["handler.heartbeat-coverage", agents, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] heartbeat-coverage error: ${e}`); }

    // 3. handler.p95-duration (6h)
    try {
      const durations = (db.prepare(
        `SELECT json_extract(data, '$.durationMs') as dur FROM events
         WHERE event_type = 'handler.completed' AND timestamp > ?
         ORDER BY dur ASC`
      ).all(sixHoursAgo) as any[]).map(r => r.dur).filter(d => d != null);
      if (durations.length > 0) {
        const p95idx = Math.floor(durations.length * 0.95);
        const p95 = durations[Math.min(p95idx, durations.length - 1)];
        db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [p95, now, "handler.p95-duration"]);
        db.run("INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by) VALUES (?, ?, ?, ?, ?)",
          ["handler.p95-duration", p95, durations.length, now, "metrics-snapshot"]);
      }
    } catch (e) { ctx.log(`[metrics-snapshot] p95-duration error: ${e}`); }

    // 4. handler.fires-per-hour (1h)
    try {
      const fires = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.started' AND timestamp > ?"
      ).get(oneHourAgo) as any)?.c || 0;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [fires, now, "handler.fires-per-hour"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["handler.fires-per-hour", fires, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] fires-per-hour error: ${e}`); }

    // ── Project metrics ──────────────────────────────────────────────

    const PROJECT_METRICS = [
      { id: "project.active-count", name: "Active projects", owner: "may", target: 3, threshold: 1, unit: "count", direction: "<" },
      { id: "project.blocked-count", name: "Blocked/waiting projects", owner: "may", target: 0, threshold: 3, unit: "count", direction: ">" },
      { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", target: 0, threshold: 2, unit: "count", direction: ">" },
      { id: "project.iterations-24h", name: "Project iterations (24h)", owner: "may", target: 10, threshold: 0, unit: "count", direction: "<" },
      { id: "project.blocked-rate-7d", name: "Project blocked rate (7d)", owner: "may", target: 0.10, threshold: 0.30, unit: "ratio", direction: ">" },
    ];

    for (const m of PROJECT_METRICS) {
      try {
        db.run(
          `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_direction, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, 'health', 'active', 'fast', ?, ?, ?)`,
          [m.id, m.name, m.owner, m.target, m.threshold, m.unit, m.direction, now, now]
        );
        db.run("UPDATE metrics SET alert_direction = ? WHERE id = ?", [m.direction, m.id]);
      } catch {}
    }

    const fortyEightHoursAgo = now - 48 * 3600000;
    const twentyFourHoursAgo = now - 24 * 3600000;
    const sevenDaysAgo = now - 7 * 86400000;

    // project.active-count
    try {
      const active = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'active'").get() as any)?.c || 0;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [active, now, "project.active-count"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["project.active-count", active, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] active-count error: ${e}`); }

    // project.blocked-count
    try {
      const blocked = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting')").get() as any)?.c || 0;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [blocked, now, "project.blocked-count"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["project.blocked-count", blocked, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] blocked-count error: ${e}`); }

    // project.stale-active-count
    try {
      const activeProjects = db.prepare("SELECT id FROM projects WHERE status = 'active'").all() as any[];
      let stale = 0;
      for (const p of activeProjects) {
        const lastIter = db.prepare(
          "SELECT MAX(timestamp) as t FROM events WHERE event_type = 'project.iteration' AND data LIKE ?"
        ).get(`%${p.id}%`) as any;
        if (!lastIter?.t || lastIter.t < fortyEightHoursAgo) stale++;
      }
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [stale, now, "project.stale-active-count"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["project.stale-active-count", stale, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] stale-active error: ${e}`); }

    // project.iterations-24h
    try {
      const iters = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'project.iteration' AND timestamp > ?"
      ).get(twentyFourHoursAgo) as any)?.c || 0;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [iters, now, "project.iterations-24h"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["project.iterations-24h", iters, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] iterations-24h error: ${e}`); }

    // project.blocked-rate-7d
    try {
      const blocked7d = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'project.blocked' AND timestamp > ?"
      ).get(sevenDaysAgo) as any)?.c || 0;
      const productive7d = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type IN ('project.iteration', 'project.completed') AND timestamp > ?"
      ).get(sevenDaysAgo) as any)?.c || 0;
      const total7d = blocked7d + productive7d;
      const rate = total7d > 0 ? blocked7d / total7d : 0;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [parseFloat(rate.toFixed(4)), now, "project.blocked-rate-7d"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["project.blocked-rate-7d", parseFloat(rate.toFixed(4)), now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] blocked-rate error: ${e}`); }

    // project.blocked-over-6h
    try {
      const sixHoursMs = 6 * 3600000;
      const count = (db.prepare(
        "SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting') AND updated_at < ?"
      ).get(now - sixHoursMs) as any)?.c || 0;
      db.run(
        `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_direction, created_at, updated_at)
         VALUES ('project.blocked-over-6h', 'Projects blocked/waiting >6h', 'may', NULL, 0, 1, 'count', 'health', 'active', 'fast', 'above', ?, ?)`,
        [now, now]
      );
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [count, now, "project.blocked-over-6h"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
        ["project.blocked-over-6h", count, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] blocked-over-6h error: ${e}`); }

    // ── Generic metric measurement (source_query / source_command) ──────
    try {
      const measurable = db.prepare(
        "SELECT id, source_query, source_command FROM metrics WHERE status = 'active' AND (source_query IS NOT NULL OR source_command IS NOT NULL)"
      ).all() as any[];

      let measured = 0;
      for (const m of measurable) {
        try {
          let value: number | null = null;

          if (m.source_query) {
            const row = db.prepare(m.source_query).get() as any;
            // Extract first numeric column
            if (row) {
              const vals = Object.values(row).filter(v => typeof v === "number");
              if (vals.length > 0) value = vals[0] as number;
            }
          } else if (m.source_command) {
            const { execSync } = require("node:child_process");
            const output = execSync(m.source_command, {
              cwd: ctx.projectRoot,
              timeout: 15000,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }).trim();
            const parsed = parseFloat(output);
            if (!isNaN(parsed)) value = parsed;
          }

          if (value !== null) {
            db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [value, now, m.id]);
            db.run("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?, ?, ?, ?)",
              [m.id, value, now, "metrics-snapshot"]);
            measured++;
          }
        } catch { /* skip individual metric errors */ }
      }
      ctx.log(`[metrics-snapshot] ${measured}/${measurable.length} source-defined metrics measured`);
    } catch (e) { ctx.log(`[metrics-snapshot] generic measurement error: ${e}`); }

    ctx.log(`[metrics-snapshot] 10 handler+project metrics + source-defined metrics updated`);
  };
};
