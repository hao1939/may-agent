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
import { basename, join } from "node:path";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
import { listConfiguredAgents, listAutonomousAgents, resolveMetricOwner } from "../../shared/lib/metric-ownership.ts";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// v2 metric types:
//   gauge   — point-in-time value, can go up/down (rates, ratios, sizes)
//   counter — monotonically increasing total or explicit event-rate source
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
  project?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  config?: Record<string, unknown>;
}

const ALL_METRICS: MetricDef[] = [
  // Handler
  { id: "handler.completed-count", name: "Handler completions (6h)", owner: "may", type: "gauge", target: 50, threshold: 10, unit: "count", alert_op: "<",
    priority: "P1" },
  { id: "handler.failed-count", name: "Handler failures (6h)", owner: "may", type: "gauge", target: 0, threshold: 10, unit: "count", alert_op: ">",
    priority: "P1" },
  { id: "handler.success-rate", name: "Handler success rate (6h)", owner: "optimizer", type: "gauge", target: 0.95, threshold: 0.80, unit: "ratio", alert_op: "<",
    priority: "P1",
    config: { alert: { mode: "sustained", consecutive: 3 } } },
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)", owner: "may", type: "gauge", target: 4, threshold: 3, unit: "count", alert_op: "<", priority: "P1" },
  // Sessions
  { id: "session.error-rate-6h", name: "Session error rate (6h)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P1" },
  { id: "session.failed-triage-rate-3h", name: "Failed session triage rate (3h)", owner: "evaluator", type: "gauge", target: 1.0, threshold: 0.80, unit: "ratio", alert_op: "<", priority: "P1" },
  { id: "evaluator.aftermath-coverage-rate-3h", name: "Evaluator aftermath liveness (3h)", owner: "evaluator", type: "gauge", target: 0.80, threshold: 0.20, unit: "ratio", alert_op: "<", priority: "P3" },
  { id: "evaluator.low-quality-rate-24h", name: "Needs-improvement/low-score evaluated sessions (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
  { id: "evaluator.stale-running-session-count", name: "Stale running sessions", owner: "evaluator", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  // System output
  { id: "system.real-output-24h", name: "Real output (24h)", owner: "may", type: "gauge", target: 100, threshold: 30, unit: "count", alert_op: "<",
    priority: "P1" },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", type: "gauge", target: 120000, threshold: 600000, unit: "ms", alert_op: ">", priority: "P2" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", type: "gauge", target: 15, threshold: 8, unit: "count", alert_op: "<", priority: "P1" },
  // Project
  { id: "project.active-count", name: "Active projects", owner: "may", type: "gauge", target: 1, threshold: 1, unit: "count", alert_op: "<", priority: "P1" },
  { id: "project.blocked-count", name: "Blocked/waiting projects", owner: "may", type: "gauge", target: 2, threshold: 4, unit: "count", alert_op: ">", priority: "P2" },
  { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", type: "gauge", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P1" },
  { id: "project.iterations-24h", name: "Project iterations (24h)", owner: "may", type: "gauge", target: 10, threshold: 1, unit: "count", alert_op: "<",
    priority: "P1" },
  { id: "project.blocked-rate-7d", name: "Project blocked rate (7d)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
  { id: "project.blocked-over-6h", name: "Projects blocked/waiting >6h", owner: "may", type: "gauge", target: 2, threshold: 4, unit: "count", alert_op: ">", priority: "P2" },
  // v2 conformance / visibility
  { id: "v2.manager-loc", name: "Manager runtime LOC", owner: "arc", type: "gauge", target: 1000, threshold: 1500, unit: "loc", alert_op: ">", priority: "P2" },
  { id: "v2.runtime-glue-loc", name: "Runtime glue LOC", owner: "arc", type: "gauge", target: 1500, threshold: 2000, unit: "loc", alert_op: ">", priority: "P2" },
  { id: "v2.spec-coverage-rate", name: "v2 spec measurement coverage", owner: "may", project: "v2-conformance-and-visibility", type: "gauge", target: 1.0, threshold: 0.8, unit: "ratio", alert_op: "<", priority: "P2" },
  // KE-802: this currently measures trace-instrumentation liveness, not true
  // per-session reconstructability. Keep the aspirational target at 1.0, but
  // alert only if the sparse existing emitters disappear entirely until the
  // runtime emits context.read/agent.decision for every session.
  { id: "capability.session-trace-completeness", name: "Session trace completeness (24h)", owner: "may", project: "v2-conformance-and-visibility", type: "gauge", target: 1.0, threshold: 0.001, unit: "ratio", alert_op: "<", priority: "P3" },
  { id: "capability.tool-preset-drift-count", name: "Tool preset/config drift", owner: "may", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  { id: "capability.status-reality-mismatch-count", name: "Status/reality mismatches", owner: "may", type: "health", target: 0, threshold: 3, unit: "count", alert_op: ">", priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
  // v2-spec-coverage-buildout Phase 1 metrics
  { id: "capability.self-directed-iteration-rate-24h", name: "Self-directed iteration rate (24h)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 0.80, threshold: 0.50, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "capability.zombie-session-count", name: "Zombie sessions (running >30min)", owner: "may", project: "v2-spec-coverage-buildout", type: "health", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
  { id: "capability.process-uptime-h", name: "Process uptime (hours)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 168, threshold: 0.01, unit: "hours", alert_op: "<", priority: "P3",
    config: { alert: { mode: "consecutive_failures", count: 3 } } },
  { id: "capability.concurrent-session-max-1h", name: "Peak concurrent sessions (1h)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 8, threshold: 15, unit: "count", alert_op: ">", priority: "P1" },
];

/** Snapshot retention: keep 30 days of history */
const RETENTION_DAYS = 30;
const RUNTIME_GLUE_FILES = [
  "src/lib/manager.ts",
  "src/lib/manager-utils.ts",
  "src/lib/manager-receipts.ts",
  "src/lib/manager-agents-tool.ts",
];

const VALID_TOOL_PRESETS = new Set([
  "coding",
  "read-only",
  "agents",
  "workflow",
  "background-exec",
  "cron",
  "scrape",
  "finish",
  "checkpoint",
  "system-status",
  "system_status",
  "message",
  "query_db",
  "query-db",
  "cite-source",
]);

function countFleetToolPresetIssues(agentsRoot: string): { count: number; sample: string[] } {
  const issues: string[] = [];
  try {
    const entries = readdirSync(agentsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "shared" || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      const configPath = join(agentsRoot, entry.name, "agent.json");
      if (!existsSync(configPath)) continue;

      let config: any;
      try {
        config = JSON.parse(readFileSync(configPath, "utf8"));
      } catch (err) {
        issues.push(`${entry.name}: invalid agent.json (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }

      const agent = config.name || entry.name;
      if (config.extends && !Array.isArray(config.tools)) {
        // Agent inherits tools from archetype - resolve them
        const archetypePath = join(agentsRoot, config.extends, "agent.json");
        if (existsSync(archetypePath)) {
          try {
            const archetypeConfig = JSON.parse(readFileSync(archetypePath, "utf8"));
            config.tools = archetypeConfig.tools;
          } catch { /* fall through to tools check */ }
        }
      }
      if (!Array.isArray(config.tools)) {
        issues.push(`${agent}: tools must be an array`);
        continue;
      }
      for (const preset of config.tools) {
        if (typeof preset !== "string" || !VALID_TOOL_PRESETS.has(preset)) {
          issues.push(`${agent}: unknown tool preset ${String(preset)}`);
        }
      }
    }
  } catch (err) {
    issues.push(`fleet scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { count: issues.length, sample: issues.slice(0, 5) };
}

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

function projectSlugFromRef(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/\\/g, "/").replace(/\/+$/, "");
  return basename(normalized).trim() || null;
}

function projectSlugFromIterationData(data: string | null): string | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as { projectId?: unknown; project?: unknown };
    const raw = typeof parsed.projectId === "string"
      ? parsed.projectId
      : typeof parsed.project === "string"
        ? parsed.project
        : "";
    return projectSlugFromRef(raw);
  } catch {
    return null;
  }
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
    const db = ctx.sdk.getDb();
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
    const hasMetricProjectColumn = metricColumns.has("project");
    const configByMetricId = new Map(ALL_METRICS.map(m => [m.id, m.config ?? null]));
    const configuredAgents = listConfiguredAgents(ctx.sdk.paths.agents);

    // ── Ensure metric rows exist ─────────────────────────────────────

    for (const m of ALL_METRICS) {
      const owner = m.owner?.trim() || null;
      const project = m.project?.trim() || null;
      const configJson = m.config ? JSON.stringify(m.config) : null;
      const priority = m.priority ?? "P2";
      const insertColumns = ["id", "name", "owner", "current", "target", "threshold", "unit", "type", "status", "speed", "alert_op"];
      const insertValues: unknown[] = [m.id, m.name, owner, null, m.target, m.threshold, m.unit, m.type, "active", "fast", m.alert_op];
      if (hasMetricProjectColumn) {
        insertColumns.push("project");
        insertValues.push(project);
      }
      if (hasMetricConfigColumn) {
        insertColumns.push("config");
        insertValues.push(configJson);
      }
      insertColumns.push("created_at", "updated_at");
      insertValues.push(now, now);
      db.run(
        `INSERT OR IGNORE INTO metrics (${insertColumns.join(", ")})
         VALUES (${insertColumns.map(() => "?").join(", ")})`,
        insertValues,
      );

      const updateAssignments = ["name = ?", "owner = ?", "target = ?", "threshold = ?", "unit = ?", "type = ?", "status = 'active'", "speed = 'fast'", "alert_op = ?"];
      const updateValues: unknown[] = [m.name, owner, m.target, m.threshold, m.unit, m.type, m.alert_op];
      if (hasMetricProjectColumn) {
        updateAssignments.push("project = ?");
        updateValues.push(project);
      }
      if (hasMetricConfigColumn) {
        updateAssignments.push("config = ?");
        updateValues.push(configJson);
      }
      updateValues.push(m.id);
      db.run(
        `UPDATE metrics SET ${updateAssignments.join(", ")} WHERE id = ?`,
        updateValues,
      );
      if (hasMetricPriorityColumn) {
        db.run("UPDATE metrics SET priority = ? WHERE id = ?", [priority, m.id]);
      }
    }
    if (hasMetricPriorityColumn) {
      db.run("UPDATE metrics SET priority = 'P2' WHERE priority IS NULL");
    }

    // ── Measure: Handler (with error isolation) ──────────────────────

    const sixH = now - 6 * 3600000;
    const threeH = now - 3 * 3600000;
    const twoH = now - 2 * 3600000;
    const oneH = now - 3600000;
    const twentyFourH = now - 24 * 3600000;
    const sevenMinutesAgo = now - 7 * 60_000;
    const staleRunningCutoff = now - 30 * 60_000;

    let completed = 0, failed = 0;

    try {
      completed = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.completed' AND timestamp > ?", sixH);
      failed = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.failed' AND timestamp > ?", sixH);
      record("handler.completed-count", completed);
      record("handler.failed-count", failed);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring handler counts: ${e}`); }

    try {
      const total = completed + failed;
      record("handler.success-rate", total > 0 ? parseFloat((completed / total).toFixed(4)) : 1, total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring success-rate: ${e}`); }

    try {
      const coverage = count(
        `SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as c FROM events
         WHERE event_type = 'handler.completed' AND json_extract(data, '$.handler') LIKE 'heartbeat-%' AND timestamp > ?`, twoH);
      record("handler.heartbeat-coverage", coverage);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring heartbeat-coverage: ${e}`); }

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
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring p95-duration: ${e}`); }

    try {
      record("handler.fires-per-hour", count("SELECT COUNT(*) as c FROM events WHERE event_type = 'handler.started' AND timestamp > ?", oneH));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring fires-per-hour: ${e}`); }

    // ── Measure: Sessions/System output (with error isolation) ───────

    try {
      // Only terminal sessions belong in the denominator. Including in-flight
      // `running` sessions makes the rate look healthier while work is still
      // underway and can hide short auth/API failure bursts.
      const total = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done','error','interrupted')", sixH);
      const err = count(
        `SELECT COUNT(*) as c
         FROM sessions
         WHERE startedAt > ?
           AND (status = 'error' OR (status = 'interrupted' AND COALESCE(error, '') != 'Clean start (fresh)'))`,
        sixH,
      );
      record("session.error-rate-6h", total > 0 ? parseFloat((err / total).toFixed(4)) : 0, total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring session.error-rate-6h: ${e}`); }

    try {
      const failed = count(
        `SELECT COUNT(*) as c
         FROM sessions s
         WHERE s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?
           AND COALESCE(s.error, '') != 'Clean start (fresh)'
           AND (s.status IN ('error', 'interrupted') OR s.error IS NOT NULL)`,
        threeH, sevenMinutesAgo,
      );
      const triaged = count(
        `SELECT COUNT(DISTINCT s.sessionId) as c
         FROM sessions s
         JOIN evaluations e ON e.sessionId = s.sessionId
         WHERE s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?
           AND COALESCE(s.error, '') != 'Clean start (fresh)'
           AND (s.status IN ('error', 'interrupted') OR s.error IS NOT NULL)
           AND e.verdict = 'needs_improvement'`,
        threeH, sevenMinutesAgo,
      );
      record("session.failed-triage-rate-3h", failed > 0 ? parseFloat((triaged / failed).toFixed(4)) : 1, failed);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring session.failed-triage-rate-3h: ${e}`); }

    try {
      // This is a pipeline liveness/meta signal, not the north-star quality
      // metric. A small threshold catches "evaluator stopped entirely" without
      // making raw coverage the goal.
      const eligible = count(
        `SELECT COUNT(*) as c
         FROM sessions s
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?`,
        threeH, sevenMinutesAgo,
      );
      const evaluated = count(
        `SELECT COUNT(DISTINCT s.sessionId) as c
         FROM sessions s
         JOIN evaluations e ON e.sessionId = s.sessionId
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND s.agent NOT IN ('evaluator', 'judge')
           AND COALESCE(s.endedAt, s.startedAt) > ?
           AND COALESCE(s.endedAt, s.startedAt) <= ?`,
        threeH, sevenMinutesAgo,
      );
      record("evaluator.aftermath-coverage-rate-3h", eligible > 0 ? parseFloat((evaluated / eligible).toFixed(4)) : 1, eligible);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.aftermath-coverage-rate-3h: ${e}`); }

    try {
      const total = count(
        "SELECT COUNT(*) as c FROM evaluations WHERE createdAt > ? AND agent NOT IN ('evaluator', 'judge')",
        twentyFourH,
      );
      const needsImprovementOrLowScore = count(
        `SELECT COUNT(*) as c
         FROM evaluations
         WHERE createdAt > ?
           AND agent NOT IN ('evaluator', 'judge')
           AND (verdict IN ('needs_improvement', 'low_quality') OR quality < 0.4 OR efficiency < 0.4)`,
        twentyFourH,
      );
      record("evaluator.low-quality-rate-24h", total > 0 ? parseFloat((needsImprovementOrLowScore / total).toFixed(4)) : 0, total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.low-quality-rate-24h: ${e}`); }

    // ── Per-agent consecutive low-quality streak ─────────────────────
    // For each active agent, count consecutive recent low-quality evaluations.
    // When an agent hits 3+ consecutive low scores, the metric breaches and
    // metric-alert-reactor dispatches an investigation via the standard pattern.
    try {
      const excludeAgents = new Set(["evaluator", "judge", "may"]);
      const agentRows = db.prepare(
        `SELECT DISTINCT agent FROM evaluations WHERE createdAt > ? AND agent NOT IN ('evaluator', 'judge', 'may')`,
      ).all(twentyFourH) as Array<{ agent: string }>;

      for (const { agent } of agentRows) {
        if (excludeAgents.has(agent)) continue;
        const metricId = `agent.${agent}.low-quality-streak`;

        // Ensure metric row exists (dynamic per-agent metric)
        const existing = db.prepare("SELECT id FROM metrics WHERE id = ?").get(metricId) as { id: string } | null;
        if (!existing) {
          const insertCols = ["id", "name", "owner", "current", "target", "threshold", "unit", "type", "status", "speed", "alert_op"];
          const insertVals: unknown[] = [
            metricId, `${agent} consecutive low-quality sessions`, "may", 0,
            0, 3, "count", "health", "active", "fast", ">",
          ];
          if (hasMetricPriorityColumn) { insertCols.push("priority"); insertVals.push("P1"); }
          db.run(`INSERT OR IGNORE INTO metrics (${insertCols.join(", ")}) VALUES (${insertCols.map(() => "?").join(", ")})`, insertVals);
        }

        // Count consecutive low-quality sessions from most recent
        const recentEvals = db.prepare(
          `SELECT quality FROM evaluations WHERE agent = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 10`,
        ).all(agent, now - 48 * 60 * 60_000) as Array<{ quality: number }>;

        let streak = 0;
        for (const ev of recentEvals) {
          if (ev.quality < 0.4) streak++;
          else break;
        }
        record(metricId, streak, recentEvals.length);
      }
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring per-agent quality streaks: ${e}`); }

    try {
      record(
        "evaluator.stale-running-session-count",
        count(
          "SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle') AND agent NOT IN ('evaluator', 'judge') AND startedAt < ?",
          staleRunningCutoff,
        ),
      );
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.stale-running-session-count: ${e}`); }

    try {
      // Counts changed/created files in last 24h without blocking the runtime
      // event loop. Socket/Telegram must stay responsive while metrics run.
      let files: string[] = [];
      try {
        await execFileAsync("git", ["-C", ctx.sdk.paths.root, "rev-parse", "--git-dir"], { timeout: 3000, maxBuffer: 1024 * 1024 });
        const { stdout } = await execFileAsync(
          "git",
          ["-C", ctx.sdk.paths.root, "log", "--since=24.hours", "--name-only", "--pretty=format:"],
          { timeout: 5000, maxBuffer: 8 * 1024 * 1024 },
        );
        files = stdout.split("\n");
      } catch {
        const { stdout } = await execFileAsync(
          "find",
          [
            ctx.sdk.paths.root,
            "-path", join(ctx.sdk.paths.root, ".state"),
            "-prune",
            "-o",
            "-path", join(ctx.sdk.paths.root, "node_modules"),
            "-prune",
            "-o",
            "-path", join(ctx.sdk.paths.root, ".git"),
            "-prune",
            "-o",
            "-type", "f",
            "-mmin", "-1440",
            "(",
            "-name", "*.ts",
            "-o", "-name", "*.md",
            "-o", "-name", "*.json",
            ")",
            "-print",
          ],
          { timeout: 5000, maxBuffer: 8 * 1024 * 1024 },
        );
        files = stdout.split("\n");
      }
      const n = new Set(files
        .map((file) => file.trim())
        .filter(Boolean)
        .filter((file) => !/^(\.state\/sessions\/|node_modules\/|dist\/|build\/|coverage\/|\.git\/)/.test(file))).size;
      record("system.real-output-24h", n);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring system.real-output-24h: ${e}`); }

    // ── Measure: Project (with error isolation) ──────────────────────

    const fortyEightH = now - 48 * 3600000;
    const sevenD = now - 7 * 86400000;

    try {
      record("project.active-count", count("SELECT COUNT(*) as c FROM projects WHERE status = 'active'"));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring active-count: ${e}`); }

    try {
      record("project.blocked-count", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting')"));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring blocked-count: ${e}`); }

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
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring stale-active-count: ${e}`); }

    try {
      const activeProjectSlugs = new Set((db.prepare(
        "SELECT id, name, path FROM projects WHERE status = 'active'",
      ).all() as Array<{ id: string; name: string; path: string }>).flatMap((p) => [
        p.id,
        p.name,
        projectSlugFromRef(p.path),
      ]).filter((slug): slug is string => Boolean(slug)));
      const iterationRows = db.prepare(
        "SELECT data FROM events WHERE event_type = 'project.iteration' AND timestamp > ?",
      ).all(twentyFourH) as Array<{ data: string | null }>;
      const activeIterations = iterationRows.filter((row) => {
        const slug = projectSlugFromIterationData(row.data);
        return slug != null && activeProjectSlugs.has(slug);
      }).length;
      record("project.iterations-24h", activeIterations, iterationRows.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring iterations-24h: ${e}`); }

    try {
      const blocked7d = count("SELECT COUNT(*) as c FROM events WHERE event_type = 'project.blocked' AND timestamp > ?", sevenD);
      const productive7d = count("SELECT COUNT(*) as c FROM events WHERE event_type IN ('project.iteration', 'project.completed') AND timestamp > ?", sevenD);
      const total7d = blocked7d + productive7d;
      record("project.blocked-rate-7d", total7d > 0 ? parseFloat((blocked7d / total7d).toFixed(4)) : 0);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring blocked-rate-7d: ${e}`); }

    try {
      record("project.blocked-over-6h", count("SELECT COUNT(*) as c FROM projects WHERE status IN ('blocked', 'waiting') AND updated_at < ?", now - 6 * 3600000));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring blocked-over-6h: ${e}`); }

    // ── Measure: v2 conformance and status honesty ───────────────────

    try {
      const managerLoc = countFileLines(join(ctx.sdk.paths.root, "src/lib/manager.ts"));
      record("v2.manager-loc", managerLoc, 1);

      const runtimeGlueLoc = RUNTIME_GLUE_FILES.reduce((sum, relPath) => sum + countFileLines(join(ctx.sdk.paths.root, relPath)), 0);
      record("v2.runtime-glue-loc", runtimeGlueLoc, RUNTIME_GLUE_FILES.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring runtime LOC: ${e}`); }

    try {
      const activeMetricIds = new Set((db.prepare("SELECT id FROM metrics WHERE status = 'active'").all() as Array<{ id: string }>).map(row => row.id));
      const coverage = countSpecClaimCoverage(ctx.sdk.paths.root, activeMetricIds);
      record("v2.spec-coverage-rate", coverage.rate, coverage.total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring spec coverage: ${e}`); }

    try {
      const issues = countFleetToolPresetIssues(ctx.sdk.paths.agents);
      record("capability.tool-preset-drift-count", issues.count, Math.max(1, configuredAgents.length));
      if (issues.count > 0) {
        ctx.sdk.log("info", `[metrics-snapshot] Tool preset drift: ${issues.sample.join("; ")}`);
      }
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring tool preset drift: ${e}`); }

    try {
      const totalSessions = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ?", twentyFourH);
      const completeSessions = count(
        `SELECT COUNT(*) as c FROM sessions s
         WHERE s.startedAt > ?
           AND EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type = 'context.read'
               AND json_valid(e.data)
               AND json_extract(e.data, '$.agent') = s.agent
               AND e.timestamp BETWEEN s.startedAt AND COALESCE(s.endedAt, ?)
           )
           AND EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type = 'agent.decision'
               AND json_valid(e.data)
               AND json_extract(e.data, '$.agent') = s.agent
               AND e.timestamp BETWEEN s.startedAt AND COALESCE(s.endedAt, ?)
           )`,
        twentyFourH, now, now,
      );
      record("capability.session-trace-completeness", totalSessions > 0 ? parseFloat((completeSessions / totalSessions).toFixed(4)) : 0, totalSessions);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring session trace completeness: ${e}`); }

    // ── Measure: v2-spec-coverage-buildout Phase 1 metrics ─────────

    // C1: Self-directed iteration rate (24h)
    // Fraction of non-evaluator work sessions started by autonomous triggers.
    try {
      const totalSessions24h = count(
        `SELECT COUNT(*) as c FROM sessions
         WHERE startedAt > ?
           AND agent NOT IN ('evaluator', 'judge')
           AND COALESCE(source, '') NOT LIKE 'workflow:evaluator-%'`,
        twentyFourH,
      );
      const autonomousSessions24h = count(
        `SELECT COUNT(*) as c FROM sessions
         WHERE startedAt > ?
           AND agent NOT IN ('evaluator', 'judge')
           AND (
             source = 'workflow:heartbeat'
             OR source LIKE 'workflow:heartbeat-%'
             OR source LIKE 'workflow:%-heartbeat'
             OR source = 'closed-loop-steward'
             OR source = 'project'
             OR source = 'metric-alert-reactor'
             OR source = 'session-recovery'
           )`,
        twentyFourH,
      );
      record("capability.self-directed-iteration-rate-24h",
        totalSessions24h > 0 ? parseFloat((autonomousSessions24h / totalSessions24h).toFixed(4)) : 0,
        totalSessions24h);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring self-directed-iteration-rate: ${e}`); }

    // C7: Zombie session count (running >30min)
    try {
      const zombies = count(
        "SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle') AND startedAt < ?",
        staleRunningCutoff,
      );
      record("capability.zombie-session-count", zombies);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring zombie-session-count: ${e}`); }

    // C7: Peak concurrent sessions in last hour
    try {
      // Approximate: count sessions that overlapped with each 5-min bucket in the last hour
      let maxConcurrent = 0;
      for (let t = oneH; t <= now; t += 5 * 60_000) {
        const concurrent = count(
          "SELECT COUNT(*) as c FROM sessions WHERE startedAt <= ? AND (endedAt IS NULL OR endedAt >= ?)",
          t, t,
        );
        if (concurrent > maxConcurrent) maxConcurrent = concurrent;
      }
      record("capability.concurrent-session-max-1h", maxConcurrent);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring concurrent-session-max: ${e}`); }

    // C9: Process uptime for this may-agent runtime process.
    try {
      const uptimeH = parseFloat((process.uptime() / 3600).toFixed(2));
      record("capability.process-uptime-h", uptimeH);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring process-uptime: ${e}`); }

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
           )`, now - 2 * 3600000);  // 2h window: heartbeat-measured metrics run on ~30min cycles

      const terminalSessionsWithoutEnd = count(
        `SELECT COUNT(*) as c FROM sessions s
         WHERE s.status IN ('done', 'error', 'interrupted')
           AND s.startedAt > ?
           AND NOT EXISTS (
             SELECT 1 FROM events e
             WHERE e.event_type = 'session.end'
               AND json_valid(e.data)
               AND json_extract(e.data, '$.sessionId') = s.sessionId
           )`, now - 24 * 3600000);

      // Only check agents that have an enabled heartbeat cron job
      const cronPath = join(ctx.sdk.paths.agents, "may", "cron.json");
      let heartbeatAgents: string[] = [];
      try {
        const cron = JSON.parse(readFileSync(cronPath, "utf8")) as Array<{ name?: string; enabled?: boolean; agent?: string; handlerConfig?: { agent?: string } }>;
        heartbeatAgents = cron
          .filter(j => j.name?.includes("heartbeat") && j.enabled !== false)
          .map(j => j.agent || j.handlerConfig?.agent || "")
          .filter(Boolean);
      } catch { /* fallback to empty */ }

      let agentsWithoutHeartbeat = 0;
      for (const agent of heartbeatAgents) {
        const recentHeartbeat = count(
          `SELECT COUNT(*) as c FROM events
           WHERE event_type = 'handler.completed'
             AND json_valid(data)
             AND json_extract(data, '$.agent') = ?
             AND json_extract(data, '$.handler') LIKE 'heartbeat%'
             AND timestamp > ?`,
          agent, now - 4 * 3600000);
        if (recentHeartbeat === 0) agentsWithoutHeartbeat++;
      }

      const mismatchCount = staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd + agentsWithoutHeartbeat;
      record("capability.status-reality-mismatch-count", mismatchCount,
        heartbeatAgents.length + staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd);

      // ── Reconciliation: emit session.end for orphaned terminal sessions ──
      if (terminalSessionsWithoutEnd > 0) {
        try {
          const orphaned = db.prepare(
            `SELECT s.sessionId, s.agent, s.status, s.endedAt
             FROM sessions s
             WHERE s.status IN ('done', 'error', 'interrupted')
               AND s.startedAt > ?
               AND NOT EXISTS (
                 SELECT 1 FROM events e
                 WHERE e.event_type = 'session.end'
                   AND json_valid(e.data)
                   AND json_extract(e.data, '$.sessionId') = s.sessionId
               )
             LIMIT 50`
          ).all(now - 24 * 3600000) as Array<{ sessionId: string; agent: string; status: string; endedAt: number | null }>;
          const insert = db.prepare("INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)");
          for (const s of orphaned) {
            insert.run("session.end", JSON.stringify({ sessionId: s.sessionId, agent: s.agent, status: s.status, reconciled: true }), s.endedAt || now);
          }
          if (orphaned.length > 0) ctx.sdk.log("info", `[metrics-snapshot] Reconciled ${orphaned.length} orphaned session.end events`);
        } catch (reconErr) { /* best-effort reconciliation */ }
      }
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring status-reality mismatch: ${e}`); }

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
          const { stdout } = await execAsync(m.source_command, {
            cwd: ctx.sdk.paths.root,
            timeout: 5000,
            maxBuffer: 1024 * 1024,
          });
          const output = stdout.trim();
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
                m.owner as explicitOwner, p.owner as projectOwner,
                m.current, m.target, m.threshold, m.alert_op, m.type${configSelect ? ", m.config" : ""}
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         WHERE m.status = 'active' AND m.current IS NOT NULL AND m.threshold IS NOT NULL`
      ).all() as any[];

      const evaluateThresholdBreach = (metric: { current: number; threshold: number; alert_op: string | null }) =>
        metric.alert_op === ">" || metric.alert_op === "above"
          ? metric.current > metric.threshold
          : metric.current < metric.threshold;

      for (const m of metrics) {
        const owner = resolveMetricOwner(m.id, configuredAgents, m.explicitOwner, m.projectOwner);
        const registryConfig = configByMetricId.get(m.id) ?? null;
        const config = hasMetricConfigColumn && m.config ? JSON.parse(m.config) : registryConfig;
        const alertConfig = config?.alert;
        const metricType = m.type || "gauge";

        // ── Type-specific breach evaluation ──
        let breached = false;
        let thresholdBreached = false;
        let rateBreached = false;
        let ratePer: number | null = null;
        let rateLimit: number | null = null;
        let rateDirection: "below" | "above" | null = null;
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
              ratePer = alertConfig.per === "day" ? perHour * 24 : perHour;

              if (alertConfig.min_rate != null && ratePer < alertConfig.min_rate) {
                rateBreached = true;
                rateLimit = alertConfig.min_rate;
                rateDirection = "below";
              }
              if (alertConfig.max_rate != null && ratePer > alertConfig.max_rate) {
                rateBreached = true;
                rateLimit = alertConfig.max_rate;
                rateDirection = "above";
              }
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

          // Also fall through to basic threshold check for counters without rate config.
          // Rate-mode counters use this only as a backstop: a low event rate should
          // not open a misleading "current is below threshold" alert when the
          // windowed count is already healthy; stallDetected emits metric.stalled.
          thresholdBreached = evaluateThresholdBreach(m);
          breached = thresholdBreached || rateBreached;
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
          "SELECT id, alert_type, message FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL LIMIT 1"
        ).get(m.id) as { id: number; alert_type?: string; message?: string } | null;

        if (breached) {
          const thresholdDirection = m.alert_op === ">" || m.alert_op === "above" ? "above" : "below";
          const rateUnit = alertConfig?.per === "day" ? "day" : "hour";
          const alertType = rateBreached && !thresholdBreached ? "rate" : "threshold";
          const message = alertType === "rate"
            ? `${m.name ?? m.id} rate is ${rateDirection ?? "outside"} limit: rate=${ratePer?.toFixed(2) ?? "?"}/${rateUnit}, limit=${rateLimit ?? "?"}/${rateUnit}, current=${m.current}, target=${m.target ?? "?"}`
            : `${m.name ?? m.id} is ${thresholdDirection} threshold: current=${m.current}, threshold=${m.threshold}, target=${m.target ?? "?"}`;
          if (openAlert && (openAlert.alert_type !== alertType || openAlert.message !== message)) {
            db.run("UPDATE metric_alerts SET alert_type = ?, message = ? WHERE id = ?", [alertType, message, openAlert.id]);
          }
          if (!openAlert) {
            db.run(
              "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
              [m.id, alertType, message, now]
            );
            const priority = hasMetricPriorityColumn
              ? ((db.prepare("SELECT COALESCE(priority, 'P2') as priority FROM metrics WHERE id = ?").get(m.id) as { priority?: string } | null)?.priority ?? "P2")
              : "P2";
            try {
              ctx.sdk.emit("metric.breach", {
                owner, metricId: m.id, metricName: m.name,
                current: m.current, threshold: m.threshold, target: m.target, message, priority,
              });
            } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error emitting metric.breach for ${m.id}: ${e}`); }
          }
        } else if (openAlert) {
          db.run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [now, openAlert.id]);
          try {
            ctx.sdk.emit("metric.recovered", {
              metricId: m.id,
              metricName: m.name,
            });
          } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error emitting metric.recovered for ${m.id}: ${e}`); }
        }

        // ── Stall event (separate from breach) ──
        if (stallDetected) {
          const message = `${m.name ?? m.id} stalled: no change for ${Math.round((alertConfig?.stall_after_ms || 0) / 60000)}min`;
          try {
            ctx.sdk.emit("metric.stalled", {
              owner, metricId: m.id, metricName: m.name, message,
            });
          } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error emitting metric.stalled for ${m.id}: ${e}`); }
        }
      }
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error during alert lifecycle: ${e}`); }

    // ── Snapshot retention cleanup (keep last 30 days) ───────────────

    try {
      const cutoff = now - RETENTION_DAYS * 86400000;
      const result = db.run("DELETE FROM metric_snapshots WHERE measured_at < ?", [cutoff]);
      const deleted = (result as any)?.changes ?? 0;
      if (deleted > 0) ctx.sdk.log("info", `[metrics-snapshot] Cleaned ${deleted} old snapshots (>${RETENTION_DAYS}d)`);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error during snapshot cleanup: ${e}`); }

    ctx.sdk.log("info", `[metrics-snapshot] ${ALL_METRICS.length} built-in metrics recorded, ${measured}/${measurable.length} source-defined`);

    // ── Fire-and-forget: regenerate conformance report ──
    try {
      Bun.spawn(["bun", "run", "agents/shared/scripts/conformance-report.ts"], {
        cwd: import.meta.dir + "/../../..",
        stdout: "ignore",
        stderr: "ignore",
      });
      ctx.sdk.log("info", `[metrics-snapshot] Conformance report regeneration triggered`);
    } catch (e) {
      ctx.sdk.log("info", `[metrics-snapshot] Failed to trigger conformance report: ${e}`);
    }
  };
};
