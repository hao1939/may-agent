/**
 * metrics-snapshot — Measures system health metrics every 5 minutes.
 * See: agents/shared/may-agent-docs/design/agent-metrics.md
 *
 * ── Built-in Metric Registry ────────────────────────────────────────────────
 * This handler owns the built-in system health metrics below. On every run it
 * upserts metric rows and refreshes mutable metadata (name/owner/target/etc.)
 * so DB rows cannot silently drift away from the registry constants.
 *
 * Custom metrics can still be measured via metrics.source_query/source_command
 * in the generic section near the end of the handler.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";

// v2 metric types:
//   gauge   — point-in-time value, can go up/down (rates, ratios, sizes)
//   counter — monotonically increasing or rate-of-events (output, iterations)
//   health  — boolean pass/fail or count-of-failures (build_passing, errors)
//   derived — computed from other metrics (not yet used in built-ins)
//
// alert_op: "<" = alert when current < threshold (too low)
//           ">" = alert when current > threshold (too high)
const ALL_METRICS = [
  // Handler
  { id: "handler.completed-count", name: "Handler completions (6h)", owner: "may", type: "counter", target: 50, threshold: 10, unit: "count", alert_op: "<" },
  { id: "handler.failed-count", name: "Handler failures (6h)", owner: "may", type: "counter", target: 0, threshold: 3, unit: "count", alert_op: ">" },
  { id: "handler.success-rate", name: "Handler success rate (6h)", owner: "optimizer", type: "gauge", target: 0.95, threshold: 0.80, unit: "ratio", alert_op: "<" },
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)", owner: "may", type: "gauge", target: 4, threshold: 3, unit: "count", alert_op: "<" },
  // Sessions
  { id: "session.error-rate-6h", name: "Session error rate (6h)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">" },
  // System output
  { id: "system.real-output-24h", name: "Real output (24h)", owner: "may", type: "counter", target: 100, threshold: 30, unit: "count", alert_op: "<" },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", type: "gauge", target: 120000, threshold: 600000, unit: "ms", alert_op: ">" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", type: "gauge", target: 15, threshold: 8, unit: "count", alert_op: "<" },
  // Project
  { id: "project.active-count", name: "Active projects", owner: "may", type: "gauge", target: 1, threshold: 0, unit: "count", alert_op: "<" },
  { id: "project.blocked-count", name: "Blocked/waiting projects", owner: "may", type: "gauge", target: 2, threshold: 4, unit: "count", alert_op: ">" },
  { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", type: "gauge", target: 0, threshold: 2, unit: "count", alert_op: ">" },
  { id: "project.iterations-24h", name: "Project iterations (24h)", owner: "may", type: "counter", target: 10, threshold: 0, unit: "count", alert_op: "<" },
  { id: "project.blocked-rate-7d", name: "Project blocked rate (7d)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">" },
  { id: "project.blocked-over-6h", name: "Projects blocked/waiting >6h", owner: "may", type: "gauge", target: 0, threshold: 3, unit: "count", alert_op: ">" },
];

/** Snapshot retention: keep 30 days of history */
const RETENTION_DAYS = 30;

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const db = ctx.getDb();
    const now = Date.now();

    // ── Ensure indexes exist (idempotent) ────────────────────────────

    db.run("CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp)");
    db.run("CREATE INDEX IF NOT EXISTS idx_metric_snapshots_measured_at ON metric_snapshots(measured_at)");

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
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'active', 'fast', ?, ?, ?)`,
        [m.id, m.name, m.owner, m.target, m.threshold, m.unit, m.type, m.alert_op, now, now]
      );
      db.run(
        `UPDATE metrics
         SET name = ?, owner = ?, target = ?, threshold = ?, unit = ?, type = ?, status = 'active', speed = 'fast', alert_op = ?
         WHERE id = ?`,
        [m.name, m.owner, m.target, m.threshold, m.unit, m.type, m.alert_op, m.id]
      );
    }

    // ── Measure: Handler (with error isolation) ──────────────────────

    const sixH = now - 6 * 3600000;
    const twoH = now - 2 * 3600000;
    const oneH = now - 3600000;
    const twentyFourH = now - 24 * 3600000;

    let completed = 0, failed = 0;

    try {
      completed = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?", sixH);
      failed = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?", sixH);
      record("handler.completed-count", completed);
      record("handler.failed-count", failed);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring handler counts: ${e}`); }

    try {
      const total = completed + failed;
      record("handler.success-rate", total > 0 ? parseFloat((completed / total).toFixed(4)) : 1, total);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring success-rate: ${e}`); }

    try {
      const coverage = count(
        `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
         WHERE event_type = 'handler.completed' AND json_extract(data, '$.handler') LIKE 'heartbeat-%' AND timestamp > ?`, twoH);
      record("handler.heartbeat-coverage", coverage);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring heartbeat-coverage: ${e}`); }

    try {
      // Exclude AI/eval handlers from p95 — they are long-running agent sessions
      // or pollers, not infrastructure reactor latency. Including them makes this
      // metric unactionable for handler health; measure only infra handlers here.
      const durations = (db.prepare(
        `SELECT json_extract(data, '$.durationMs') as dur FROM events
         WHERE event_type = 'handler.completed' AND timestamp > ?
           AND COALESCE(json_extract(data, '$.handler'), '') != 'heartbeat'
           AND COALESCE(json_extract(data, '$.handler'), '') NOT LIKE 'heartbeat-%'
           AND COALESCE(json_extract(data, '$.handler'), '') != 'eval-poller'
         ORDER BY dur ASC`
      ).all(sixH) as any[]).map(r => r.dur).filter(d => d != null);
      if (durations.length > 0) {
        const p95 = durations[Math.min(Math.floor(durations.length * 0.95), durations.length - 1)];
        record("handler.p95-duration", p95, durations.length);
      }
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring p95-duration: ${e}`); }

    try {
      record("handler.fires-per-hour", count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.started' AND timestamp > ?", oneH));
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring fires-per-hour: ${e}`); }

    // ── Measure: Sessions/System output (with error isolation) ───────

    try {
      const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ?", sixH);
      const err = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('error','interrupted')", sixH);
      record("session.error-rate-6h", total > 0 ? parseFloat((err / total).toFixed(4)) : 0, total);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring session.error-rate-6h: ${e}`); }

    try {
      // Counts "substantive" changed/created files in last 24h, excluding noise dirs.
      // Uses find -mmin (works without git) with fallback to git log if available.
      const { execSync } = require("node:child_process");
      let cmd: string;
      try {
        execSync("git -C \"" + ctx.projectRoot + "\" rev-parse --git-dir", { timeout: 5000, stdio: "pipe" });
        // Git available — use git log for accuracy
        cmd = "git -C \"" + ctx.projectRoot + "\" log --since=24.hours --name-only --pretty=format: | " +
          "grep -v '^$' | " +
          "grep -Ev '^(\\.state/sessions/|node_modules/|dist/|build/|coverage/|\\.git/)' | " +
          "sort -u | wc -l";
      } catch {
        // No git — use find for files modified in last 24h
        cmd = "find \"" + ctx.projectRoot + "\" -type f -mmin -1440 " +
          "\\( -name '*.ts' -o -name '*.md' -o -name '*.json' \\) " +
          "-not -path '*/.state/sessions/*' " +
          "-not -path '*/node_modules/*' " +
          "-not -path '*/.git/*' " +
          "| wc -l";
      }
      const out = execSync(cmd, { timeout: 15000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      const n = parseFloat(out);
      if (!isNaN(n)) record("system.real-output-24h", n);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring system.real-output-24h: ${e}`); }

    // ── Measure: Project (with error isolation) ──────────────────────

    const fortyEightH = now - 48 * 3600000;
    const sevenD = now - 7 * 86400000;

    try {
      record("project.active-count", count("SELECT COUNT(*) as c FROM projects WHERE status = 'active'"));
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring active-count: ${e}`); }

    try {
      record("project.blocked-count", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting')"));
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring blocked-count: ${e}`); }

    // Stale: active projects with no iteration event in 48h (single query, no N+1)
    try {
      const stale = count(
        `SELECT COUNT(*) as c FROM projects p
         WHERE p.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type = 'project.iteration'
               AND e.timestamp > ?
               AND e.data LIKE '%' || p.id || '%'
           )`, fortyEightH);
      record("project.stale-active-count", stale);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring stale-active-count: ${e}`); }

    try {
      record("project.iterations-24h", count("SELECT COUNT(*) as c FROM events WHERE event_type = 'project.iteration' AND timestamp > ?", twentyFourH));
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring iterations-24h: ${e}`); }

    try {
      const blocked7d = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'project.blocked' AND timestamp > ?", sevenD);
      const productive7d = count("SELECT COUNT(*) as c FROM events WHERE event_type IN ('project.iteration', 'project.completed') AND timestamp > ?", sevenD);
      const total7d = blocked7d + productive7d;
      record("project.blocked-rate-7d", total7d > 0 ? parseFloat((blocked7d / total7d).toFixed(4)) : 0);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring blocked-rate-7d: ${e}`); }

    try {
      record("project.blocked-over-6h", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting') AND updated_at < ?", now - 6 * 3600000));
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring blocked-over-6h: ${e}`); }

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

    // ── Alert lifecycle (open on breach, resolve on recovery) ───────

    try {
      const metrics = db.prepare(
        `SELECT id, name, owner, current, target, threshold, alert_op
         FROM metrics
         WHERE status = 'active' AND current IS NOT NULL AND threshold IS NOT NULL`
      ).all() as any[];

      for (const m of metrics) {
        const breached = m.alert_op === ">" || m.alert_op === "above"
          ? m.current > m.threshold
          : m.current < m.threshold;

        const openAlert = db.prepare(
          "SELECT id FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1"
        ).get(m.id) as { id: number } | null;

        if (breached) {
          const direction = m.alert_op === ">" || m.alert_op === "above" ? "above" : "below";
          const message = `${m.name ?? m.id} is ${direction} threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target ?? "?"}`;
          if (!openAlert) {
            db.run(
              "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
              [m.id, "threshold", message, now]
            );
            try {
              ctx.dispatchEvent("metric.breach", {
                owner: m.owner,
                metricId: m.id,
                metricName: m.name,
                current: m.current,
                threshold: m.threshold,
                target: m.target,
                message,
              });
            } catch (e) { ctx.log(`[metrics-snapshot] Error emitting metric.breach for ${m.id}: ${e}`); }
          }
        } else if (openAlert) {
          db.run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [now, openAlert.id]);
        }
      }
    } catch (e) { ctx.log(`[metrics-snapshot] Error during alert lifecycle: ${e}`); }

    // ── Snapshot retention cleanup (keep last 30 days) ───────────────

    try {
      const cutoff = now - RETENTION_DAYS * 86400000;
      const result = db.run("DELETE FROM metric_snapshots WHERE measured_at < ?", [cutoff]);
      const deleted = (result as any)?.changes ?? 0;
      if (deleted > 0) ctx.log(`[metrics-snapshot] Cleaned ${deleted} old snapshots (>${RETENTION_DAYS}d)`);
    } catch (e) { ctx.log(`[metrics-snapshot] Error during snapshot cleanup: ${e}`); }

    ctx.log(`[metrics-snapshot] 12 metrics recorded (6 handler + 6 project), ${measured}/${measurable.length} source-defined`);
  };
};

