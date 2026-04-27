/**
 * metrics-snapshot — Measures handler health metrics every 5 minutes.
 *
 * Queries the events table for handler.started/completed/failed events
 * and writes metric snapshots for:
 *   - handler.success-rate
 *   - handler.heartbeat-coverage
 *   - handler.p95-duration
 *   - handler.fires-per-hour
 */
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";

const METRICS = [
  { id: "handler.success-rate", name: "Handler success rate", owner: "optimizer", target: 0.95, threshold: 0.80, unit: "ratio" },
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)", owner: "may", target: 8, threshold: 6, unit: "count" },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", target: 120000, threshold: 240000, unit: "ms" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", target: 30, threshold: 15, unit: "count" },
];

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const db = ctx.getDb();
    const now = Date.now();
    const sixHoursAgo = now - 6 * 3600000;
    const twoHoursAgo = now - 2 * 3600000;
    const oneHourAgo = now - 3600000;

    // Ensure metrics exist
    for (const m of METRICS) {
      try {
        db.run(
          `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, created_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, 'health', 'active', 'fast', ?)`,
          [m.id, m.name, m.owner, m.target, m.threshold, m.unit, now]
        );
      } catch { /* already exists */ }
    }

    // 1. handler.success-rate (6h)
    try {
      const completed = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?"
      ).get(sixHoursAgo) as any)?.c || 0;
      const failed = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?"
      ).get(sixHoursAgo) as any)?.c || 0;
      const total = completed + failed;
      const rate = total > 0 ? completed / total : 1;
      db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?", [parseFloat(rate.toFixed(4)), now, "handler.success-rate"]);
      db.run("INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by) VALUES (?, ?, ?, ?, ?)",
        ["handler.success-rate", parseFloat(rate.toFixed(4)), total, now, "metrics-snapshot"]);
    } catch (e) { ctx.log(`[metrics-snapshot] success-rate error: ${e}`); }

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

    ctx.log(`[metrics-snapshot] 4 metrics updated`);
  };
};
