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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
//
// config: JSON with type-specific alert rules:
//   gauge:   { alert: { mode: "threshold" | "sustained", consecutive?: number } }
//   counter: { alert: { mode: "rate", min_rate?: number, per: "hour"|"day", stall_after_ms?: number } }
//   health:  { alert: { mode: "consecutive_failures", count: number } }

interface MetricDef {
  id: string; name: string; owner?: string; type: "gauge" | "counter" | "health" | "derived";
  target: number; threshold: number; unit: string; alert_op: "<" | ">";
  priority?: "P0" | "P1" | "P2" | "P3";
  config?: Record<string, unknown>;
}

const ALL_METRICS: MetricDef[] = [
  // Handler
  { id: "handler.completed-count", name: "Handler completions (6h)", owner: "may", type: "counter", target: 50, threshold: 10, unit: "count", alert_op: "<",
    priority: "P1",
    config: { alert: { mode: "rate", min_rate: 2, per: "hour", stall_after_ms: 3600000 } } },
  { id: "handler.failed-count", name: "Handler failures (6h)", owner: "may", type: "counter", target: 0, threshold: 3, unit: "count", alert_op: ">",
    priority: "P1",
    config: { alert: { mode: "rate", max_rate: 3, per: "hour" } } },
  { id: "handler.success-rate", name: "Handler success rate (6h)", owner: "optimizer", type: "gauge", target: 0.95, threshold: 0.80, unit: "ratio", alert_op: "<",
    priority: "P1",
    config: { alert: { mode: "sustained", consecutive: 3 } } },
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)", owner: "may", type: "gauge", target: 4, threshold: 3, unit: "count", alert_op: "<", priority: "P1" },
  // Sessions
  { id: "session.error-rate-6h", name: "Session error rate (6h)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P1" },
  // System output
  { id: "system.real-output-24h", name: "Real output (24h)", owner: "may", type: "counter", target: 100, threshold: 30, unit: "count", alert_op: "<",
    priority: "P1",
    config: { alert: { mode: "rate", min_rate: 5, per: "hour", stall_after_ms: 7200000 } } },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", type: "gauge", target: 120000, threshold: 600000, unit: "ms", alert_op: ">", priority: "P2" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", type: "gauge", target: 15, threshold: 8, unit: "count", alert_op: "<", priority: "P1" },
  // Project
  { id: "project.active-count", name: "Active projects", owner: "may", type: "gauge", target: 1, threshold: 1, unit: "count", alert_op: "<", priority: "P1" },
  { id: "project.blocked-count", name: "Blocked/waiting projects", owner: "may", type: "gauge", target: 2, threshold: 4, unit: "count", alert_op: ">", priority: "P2" },
  { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", type: "gauge", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P1" },
  { id: "project.iterations-24h", name: "Project iterations (24h)", owner: "may", type: "counter", target: 10, threshold: 0, unit: "count", alert_op: "<",
    priority: "P1",
    config: { alert: { mode: "rate", min_rate: 1, per: "hour", stall_after_ms: 7200000 } } },
  { id: "project.blocked-rate-7d", name: "Project blocked rate (7d)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
  { id: "project.blocked-over-6h", name: "Projects blocked/waiting >6h", owner: "may", type: "gauge", target: 2, threshold: 4, unit: "count", alert_op: ">", priority: "P2" },
  // v2 conformance / visibility
  { id: "v2.manager-loc", name: "Manager runtime LOC", owner: "arc", type: "gauge", target: 1000, threshold: 1500, unit: "loc", alert_op: ">", priority: "P2" },
  { id: "v2.runtime-glue-loc", name: "Runtime glue LOC", owner: "arc", type: "gauge", target: 1500, threshold: 2000, unit: "loc", alert_op: ">", priority: "P2" },
  { id: "v2.spec-coverage-rate", name: "v2 spec measurement coverage", owner: "arc", type: "gauge", target: 1.0, threshold: 0.8, unit: "ratio", alert_op: "<", priority: "P1" },
  { id: "capability.status-reality-mismatch-count", name: "Status/reality mismatches", owner: "may", type: "health", target: 0, threshold: 3, unit: "count", alert_op: ">", priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
];

/** Snapshot retention: keep 30 days of history */
const RETENTION_DAYS = 30;
const RUNTIME_GLUE_FILES = [
  "src/lib/manager.ts",
  "src/lib/manager-utils.ts",
  "src/lib/manager-receipts.ts",
  "src/lib/manager-agents-tool.ts",
];

function countFileLines(path: string): number {
  try {
    if (!existsSync(path)) return 0;
    const text = readFileSync(path, "utf8");
    if (text.length === 0) return 0;
    const newlineCount = text.match(/\n/g)?.length ?? 0;
    return text.endsWith("\n") ? newlineCount : newlineCount + 1;
  } catch {
    return 0;
  }
}

function listConfiguredAgents(agentsRoot: string): string[] {
  try {
    return readdirSync(agentsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "shared" && entry.name !== "gym")
      .map(entry => {
        const agentJson = join(agentsRoot, entry.name, "agent.json");
        if (!existsSync(agentJson)) return null;
        try {
          const config = JSON.parse(readFileSync(agentJson, "utf8")) as { name?: string; disabled?: boolean };
          if (config.disabled) return null;
          return config.name ?? entry.name;
        } catch {
          return entry.name;
        }
      })
      .filter((name): name is string => Boolean(name));
  } catch {
    return [];
  }
}

function resolveMetricOwner(
  metricId: string,
  configuredAgents: Set<string>,
  explicitOwner?: string | null,
  projectOwner?: string | null,
): string {
  if (explicitOwner?.trim()) return explicitOwner.trim();
  if (projectOwner?.trim()) return projectOwner.trim();
  const prefix = metricId.split(".")[0];
  return configuredAgents.has(prefix) ? prefix : "may";
}

function getProjectOwner(db: any, project: string | null | undefined): string | null {
  if (!project?.trim()) return null;
  const row = db.prepare(
    `SELECT owner FROM projects
     WHERE id = ? OR path = ? OR name = ?
     LIMIT 1`
  ).get(project, project, project) as { owner?: string | null } | null;
  return row?.owner?.trim() || null;
}

function countSpecClaimCoverage(projectRoot: string, metricIds: Set<string>): { covered: number; total: number; rate: number } {
  const specPath = join(projectRoot, "agents/shared/may-agent-docs/proposals/v2-spec.md");
  try {
    if (!existsSync(specPath)) return { covered: 0, total: 0, rate: 0 };
    const spec = readFileSync(specPath, "utf8");
    const headings = [...spec.matchAll(/^## ([CIS]\d+)\s+—/gm)].map(match => ({
      index: match.index ?? 0,
    }));
    let covered = 0;
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index;
      const end = i + 1 < headings.length ? headings[i + 1].index : spec.length;
      const section = spec.slice(start, end);
      const measurementMatch = section.match(/\*\*Measurement\.\*\*([\s\S]*?)(?=\*\*Status\.\*\*)/);
      const measurementText = measurementMatch?.[1] ?? section;
      const sectionMetricIds = [...measurementText.matchAll(/`((?:capability|infra|v2)\.[a-zA-Z0-9._-]+)`/g)].map(match => match[1]);
      if (sectionMetricIds.some(id => metricIds.has(id))) covered++;
    }
    const total = headings.length;
    return { covered, total, rate: total > 0 ? parseFloat((covered / total).toFixed(4)) : 0 };
  } catch {
    return { covered: 0, total: 0, rate: 0 };
  }
}

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

    const metricColumns = new Set((db.prepare("PRAGMA table_info(metrics)").all() as any[]).map(c => c.name));
    const hasMetricConfigColumn = metricColumns.has("config");
    const hasMetricPriorityColumn = metricColumns.has("priority");
    const configByMetricId = new Map(ALL_METRICS.map(m => [m.id, m.config ?? null]));
    const configuredAgents = new Set(listConfiguredAgents(ctx.agentsRoot));

    // ── Ensure metric rows exist ─────────────────────────────────────

    for (const m of ALL_METRICS) {
      const owner = resolveMetricOwner(m.id, configuredAgents, m.owner);
      const configJson = m.config ? JSON.stringify(m.config) : null;
      const priority = m.priority ?? "P2";
      if (hasMetricConfigColumn) {
        db.run(
          `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_op, config, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'active', 'fast', ?, ?, ?, ?)`,
          [m.id, m.name, owner, m.target, m.threshold, m.unit, m.type, m.alert_op, configJson, now, now]
        );
        db.run(
          `UPDATE metrics
           SET name = ?, owner = ?, target = ?, threshold = ?, unit = ?, type = ?, status = 'active', speed = 'fast', alert_op = ?, config = COALESCE(?, config)
           WHERE id = ?`,
          [m.name, owner, m.target, m.threshold, m.unit, m.type, m.alert_op, configJson, m.id]
        );
      } else {
        db.run(
          `INSERT OR IGNORE INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed, alert_op, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'active', 'fast', ?, ?, ?)`,
          [m.id, m.name, owner, m.target, m.threshold, m.unit, m.type, m.alert_op, now, now]
        );
        db.run(
          `UPDATE metrics
           SET name = ?, owner = ?, target = ?, threshold = ?, unit = ?, type = ?, status = 'active', speed = 'fast', alert_op = ?
           WHERE id = ?`,
          [m.name, owner, m.target, m.threshold, m.unit, m.type, m.alert_op, m.id]
        );
      }
      if (hasMetricPriorityColumn) {
        db.run("UPDATE metrics SET priority = ? WHERE id = ?", [priority, m.id]);
      }
    }
    for (const row of db.prepare("SELECT id, owner, project FROM metrics WHERE status = 'active' AND (owner IS NULL OR trim(owner) = '') AND project IS NOT NULL AND trim(project) != ''").all() as Array<{ id: string; owner?: string | null; project: string }>) {
      const projectOwner = getProjectOwner(db, row.project);
      if (projectOwner) db.run("UPDATE metrics SET owner = ? WHERE id = ?", [projectOwner, row.id]);
    }
    for (const row of db.prepare("SELECT id, owner FROM metrics WHERE status = 'active' AND (owner IS NULL OR trim(owner) = '')").all() as Array<{ id: string; owner?: string | null }>) {
      db.run("UPDATE metrics SET owner = ? WHERE id = ?", [resolveMetricOwner(row.id, configuredAgents, row.owner), row.id]);
    }
    if (hasMetricPriorityColumn) {
      db.run("UPDATE metrics SET priority = 'P2' WHERE priority IS NULL");
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

    // ── Measure: v2 conformance and status honesty ───────────────────

    try {
      const managerLoc = countFileLines(join(ctx.projectRoot, "src/lib/manager.ts"));
      record("v2.manager-loc", managerLoc, 1);

      const runtimeGlueLoc = RUNTIME_GLUE_FILES.reduce((sum, relPath) => sum + countFileLines(join(ctx.projectRoot, relPath)), 0);
      record("v2.runtime-glue-loc", runtimeGlueLoc, RUNTIME_GLUE_FILES.length);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring runtime LOC: ${e}`); }

    try {
      const activeMetricIds = new Set((db.prepare("SELECT id FROM metrics WHERE status = 'active'").all() as Array<{ id: string }>).map(row => row.id));
      const coverage = countSpecClaimCoverage(ctx.projectRoot, activeMetricIds);
      record("v2.spec-coverage-rate", coverage.rate, coverage.total);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring spec coverage: ${e}`); }

    try {
      const staleActiveProjects = count(
        `SELECT COUNT(*) as c FROM projects p
         WHERE p.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type = 'project.iteration'
               AND e.timestamp > ?
               AND e.data LIKE '%' || p.id || '%'
           )`, sevenD);

      const staleActiveMetrics = count(
        `SELECT COUNT(*) as c FROM metrics m
         WHERE m.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM metric_snapshots s
             WHERE s.metric_id = m.id
               AND s.measured_at > ?
           )`, now - 15 * 60000);

      const terminalSessionsWithoutEnd = count(
        `SELECT COUNT(*) as c FROM sessions s
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND NOT EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type = 'session.end'
               AND json_valid(e.data)
               AND json_extract(e.data, '$.sessionId') = s.sessionId
           )`);

      const configuredAgents = listConfiguredAgents(ctx.agentsRoot);
      let agentsWithoutHeartbeat = 0;
      for (const agent of configuredAgents) {
        const recentHeartbeat = count(
          `SELECT COUNT(*) as c FROM events
           WHERE event_type = 'handler.completed'
             AND json_valid(data)
             AND json_extract(data, '$.agent') = ?
             AND json_extract(data, '$.handler') LIKE 'heartbeat-%'
             AND timestamp > ?`,
          agent, now - 4 * 3600000);
        if (recentHeartbeat === 0) agentsWithoutHeartbeat++;
      }

      const mismatchCount = staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd + agentsWithoutHeartbeat;
      record("capability.status-reality-mismatch-count", mismatchCount,
        configuredAgents.length + staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd);
    } catch (e) { ctx.log(`[metrics-snapshot] Error measuring status-reality mismatch: ${e}`); }

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

    // ── Alert lifecycle (type-aware: open on breach, resolve on recovery) ───────

    try {
      const configSelect = hasMetricConfigColumn ? ", config" : "";
      const metrics = db.prepare(
        `SELECT m.id, m.name,
                COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
                m.current, m.target, m.threshold, m.alert_op, m.type${configSelect ? ", m.config" : ""}
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.status = 'active' AND m.current IS NOT NULL AND m.threshold IS NOT NULL`
      ).all() as any[];

      for (const m of metrics) {
        const registryConfig = configByMetricId.get(m.id) ?? null;
        const config = hasMetricConfigColumn && m.config ? JSON.parse(m.config) : registryConfig;
        const alertConfig = config?.alert;
        const metricType = m.type || "gauge";

        // ── Type-specific breach evaluation ──
        let breached = false;
        let stallDetected = false;

        if (metricType === "health" && alertConfig?.mode === "consecutive_failures") {
          // Health: breach only after N consecutive failures
          const requiredCount = alertConfig.count || 3;
          const recentSnapshots = db.prepare(
            "SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT ?"
          ).all(m.id, requiredCount) as any[];

          if (recentSnapshots.length >= requiredCount) {
            const allBreaching = recentSnapshots.every((s: any) =>
              m.alert_op === ">" ? s.value > m.threshold : s.value < m.threshold
            );
            breached = allBreaching;
          }
        } else if (metricType === "counter" && alertConfig?.mode === "rate") {
          // Counter: breach on rate, stall on no increment
          // Rate check: compare last 2 snapshots
          const lastTwo = db.prepare(
            "SELECT value, measured_at FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 2"
          ).all(m.id) as any[];

          if (lastTwo.length === 2) {
            const deltaMs = lastTwo[0].measured_at - lastTwo[1].measured_at;
            const deltaValue = lastTwo[0].value - lastTwo[1].value;
            if (deltaMs > 0) {
              const perHour = (deltaValue / deltaMs) * 3600000;
              const ratePer = alertConfig.per === "day" ? perHour * 24 : perHour;

              if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) breached = true;
              if (alertConfig.max_rate != null && ratePer > alertConfig.max_rate) breached = true;
            }
          }

          // Stall detection: no change in stall_after_ms
          if (alertConfig.stall_after_ms && lastTwo.length >= 2) {
            const latestSnapshot = lastTwo[0];
            // Find last snapshot where value was different
            const lastDifferent = db.prepare(
              "SELECT measured_at FROM metric_snapshots WHERE metric_id = ? AND value != ? ORDER BY measured_at DESC LIMIT 1"
            ).get(m.id, latestSnapshot.value) as any;
            const lastChangeAt = lastDifferent?.measured_at || 0;
            if (now - lastChangeAt > alertConfig.stall_after_ms) {
              stallDetected = true;
            }
          }

          // Also fall through to basic threshold check for counters without rate config
          if (!breached) {
            breached = m.alert_op === ">" || m.alert_op === "above"
              ? m.current > m.threshold
              : m.current < m.threshold;
          }
        } else if (metricType === "gauge" && alertConfig?.mode === "sustained") {
          // Gauge sustained: breach only after N consecutive breaching snapshots
          const requiredCount = alertConfig.consecutive || 3;
          const recentSnapshots = db.prepare(
            "SELECT value FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT ?"
          ).all(m.id, requiredCount) as any[];

          if (recentSnapshots.length >= requiredCount) {
            breached = recentSnapshots.every((s: any) =>
              m.alert_op === ">" ? s.value > m.threshold : s.value < m.threshold
            );
          }
        } else {
          // Default (gauge threshold): immediate breach
          breached = m.alert_op === ">" || m.alert_op === "above"
            ? m.current > m.threshold
            : m.current < m.threshold;
        }

        // ── Alert open/resolve ──
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
            const priority = hasMetricPriorityColumn
              ? ((db.prepare("SELECT COALESCE(priority, 'P2') as priority FROM metrics WHERE id = ?").get(m.id) as { priority?: string } | null)?.priority ?? "P2")
              : "P2";
            try {
              ctx.dispatchEvent("metric.breach", {
                owner: m.owner, metricId: m.id, metricName: m.name,
                current: m.current, threshold: m.threshold, target: m.target, message, priority,
              });
            } catch (e) { ctx.log(`[metrics-snapshot] Error emitting metric.breach for ${m.id}: ${e}`); }
          }
        } else if (openAlert) {
          db.run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [now, openAlert.id]);
          try {
            ctx.dispatchEvent("metric.recovered", {
              metricId: m.id,
              metricName: m.name,
            });
          } catch (e) { ctx.log(`[metrics-snapshot] Error emitting metric.recovered for ${m.id}: ${e}`); }
        }

        // ── Stall event (separate from breach) ──
        if (stallDetected) {
          const message = `${m.name ?? m.id} stalled: no change for ${Math.round((alertConfig?.stall_after_ms || 0) / 60000)}min`;
          try {
            ctx.dispatchEvent("metric.stalled", {
              owner: m.owner, metricId: m.id, metricName: m.name, message,
            });
          } catch (e) { ctx.log(`[metrics-snapshot] Error emitting metric.stalled for ${m.id}: ${e}`); }
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

    ctx.log(`[metrics-snapshot] ${ALL_METRICS.length} built-in metrics recorded, ${measured}/${measurable.length} source-defined`);
  };
};
