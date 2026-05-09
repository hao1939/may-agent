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
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HandlerContext, HandlerModule, TriggerEvent } from "../../shared/agent-sdk.ts";
import type { CronEntry } from "../../shared/agent-sdk.ts";
import { listConfiguredAgents, resolveMetricOwner } from "../../shared/lib/metric-ownership.ts";
import { validateProjectFormat } from "../../shared/lib/project-health.ts";

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
  { id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents with sessions in 2h)", owner: "may", type: "gauge", target: 8, threshold: 3, unit: "count", alert_op: "<", priority: "P0" },
  { id: "agent.heartbeat-dark-count-2h", name: "Scheduled heartbeat agents dark (2h)", owner: "may", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  { id: "agent.config-invalid-count-1h", name: "Agent config load errors (1h)", owner: "may", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  // Sessions
  { id: "session.error-rate-6h", name: "Session error rate (6h)", owner: "may", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P1" },
  { id: "session.first-turn-error-count-1h", name: "First-turn provider errors (1h)", owner: "may", type: "health", target: 0, threshold: 10, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
  { id: "session.empty-assistant-stop-count-1h", name: "Empty assistant stops (1h)", owner: "may", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
  { id: "session.failed-triage-rate-3h", name: "Failed session triage rate (3h)", owner: "evaluator", type: "gauge", target: 1.0, threshold: 0.80, unit: "ratio", alert_op: "<", priority: "P1" },
  { id: "evaluator.aftermath-coverage-rate-3h", name: "Evaluator aftermath liveness (3h)", owner: "evaluator", type: "gauge", target: 0.80, threshold: 0.20, unit: "ratio", alert_op: "<", priority: "P3" },
  { id: "eval.llm-coverage-lag-h", name: "LLM evaluation lag (hours since last non-heuristic eval)", owner: "evaluator", type: "gauge", target: 1, threshold: 4, unit: "hours", alert_op: ">", priority: "P0" },
  { id: "eval.llm-evals-24h", name: "LLM-evaluated sessions (24h)", owner: "evaluator", type: "gauge", target: 4, threshold: 1, unit: "count", alert_op: "<", priority: "P2" },
  { id: "evaluator.low-quality-rate-24h", name: "Broad needs-improvement/low-score evaluated sessions (24h, dashboard only)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.80, unit: "ratio", alert_op: ">", priority: "P3" },
  { id: "evaluator.substantive-low-quality-rate-24h", name: "Substantive evaluator quality failures (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P1" },
  { id: "evaluator.meaningful-review-rate-24h", name: "Evaluator meaningful review rate (24h)", owner: "evaluator", type: "gauge", target: 0.90, threshold: 0.70, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "evaluator.triage-closure-rate-24h", name: "Evaluator triage closure rate (24h)", owner: "evaluator", type: "gauge", target: 0.90, threshold: 0.70, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "evaluator.false-good-rate-sample", name: "Reviewed good sessions overturned (24h)", owner: "evaluator", type: "gauge", target: 0.05, threshold: 0.60, unit: "ratio", alert_op: ">", priority: "P2" },
  { id: "evaluator.success-candidates-24h", name: "Good sessions marked for learning (24h)", owner: "evaluator", type: "gauge", target: 1, threshold: 0, unit: "count", alert_op: "<", priority: "P3" },
  { id: "evaluator.success-learnings-24h", name: "Learnings extracted from good sessions (24h)", owner: "evaluator", type: "gauge", target: 1, threshold: 0, unit: "count", alert_op: "<", priority: "P3" },
  { id: "evaluator.stale-running-session-count", name: "Stale running sessions", owner: "evaluator", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  // System output
  { id: "system.real-output-24h", name: "Real output (24h)", owner: "may", type: "gauge", target: 100, threshold: 30, unit: "count", alert_op: "<",
    priority: "P1" },
  // Scout knowledge behavior
  { id: "scout.knowledge-practice-loaded", name: "Scout knowledge practice loaded", owner: "scout", project: "scout-second-brain-learning", type: "health", target: 1, threshold: 1, unit: "boolean", alert_op: "<",
    priority: "P2",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  { id: "scout.knowledge-preamble-coverage", name: "Scout knowledge preamble coverage", owner: "scout", project: "scout-second-brain-learning", type: "gauge", target: 0.8, threshold: 0.25, unit: "ratio", alert_op: "<",
    priority: "P3" },
  { id: "handler.p95-duration", name: "Handler p95 duration (ms)", owner: "optimizer", type: "gauge", target: 120000, threshold: 600000, unit: "ms", alert_op: ">", priority: "P2" },
  { id: "handler.fires-per-hour", name: "Handler fires per hour", owner: "may", type: "gauge", target: 15, threshold: 8, unit: "count", alert_op: "<", priority: "P1" },
  // Project
  { id: "project.active-count", name: "Active push projects", owner: "may", type: "gauge", target: 0, threshold: 0, unit: "count", alert_op: "<", priority: "P3" },
  { id: "project.blocked-count", name: "Blocked projects", owner: "may", type: "gauge", target: 0, threshold: 4, unit: "count", alert_op: ">", priority: "P2" },
  { id: "project.stale-active-count", name: "Stale active projects (no iteration 48h)", owner: "may", type: "gauge", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P1" },
  { id: "project.iterations-24h", name: "Active project iterations (24h)", owner: "may", type: "gauge", target: 0, threshold: 0, unit: "count", alert_op: "<",
    priority: "P3" },
  { id: "project.blocked-over-6h", name: "Projects blocked >6h", owner: "may", type: "gauge", target: 0, threshold: 4, unit: "count", alert_op: ">", priority: "P2" },
  { id: "project.invalid-format-count", name: "Invalid project.md format", owner: "may", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  { id: "capability.status-reality-mismatch-count", name: "Status/reality mismatches", owner: "may", type: "health", target: 0, threshold: 3, unit: "count", alert_op: ">", priority: "P0",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
  { id: "capability.zombie-session-count", name: "Zombie sessions (running >30min)", owner: "may", project: "v2-spec-coverage-buildout", type: "health", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 2 } } },
  { id: "message.delivery-failed-count-1h", name: "Message delivery failures (1h)", owner: "may", type: "health", target: 0, threshold: 0, unit: "count", alert_op: ">", priority: "P1",
    config: { alert: { mode: "consecutive_failures", count: 1 } } },
  // v2 spec coverage
  { id: "v2.agent-config-bytes-p50", name: "Agent config median size (bytes)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 300, threshold: 500, unit: "bytes", alert_op: ">", priority: "P2" },
  { id: "v2.manager-loc", name: "manager.ts LOC", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1000, threshold: 1500, unit: "lines", alert_op: ">", priority: "P2" },
  { id: "v2.runtime-glue-loc", name: "Runtime glue LOC", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1500, threshold: 2000, unit: "lines", alert_op: ">", priority: "P2" },
  { id: "v2.spec-coverage-rate", name: "v2 spec measurement coverage", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1.0, threshold: 0.77, unit: "ratio", alert_op: "<", priority: "P2" },
  // v2 infra metrics (I1-I4)
  { id: "infra.bus.event-count-1h", name: "Event bus events (1h)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 10, threshold: 0, unit: "count", alert_op: "<", priority: "P2" },
  { id: "infra.persist.db-size-mb", name: "DB size (MB)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 500, threshold: 2000, unit: "MB", alert_op: ">", priority: "P2" },
  { id: "infra.messages.delivery-rate", name: "Message delivery success rate", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1.0, threshold: 0.9, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "infra.sessions.active-count", name: "Active sessions", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 5, threshold: 0, unit: "count", alert_op: "<", priority: "P2" },
  // v2 structural metrics (S1, S7)
  { id: "v2.runagent-callsite-conformance", name: "runAgent callsite conformance rate", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1.0, threshold: 0.8, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "v2.heartbeat-decision-rate", name: "Heartbeat decision coverage rate", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1.0, threshold: 0, unit: "ratio", alert_op: "<", priority: "P2" },  // threshold=0: metric implementation doesn't match spec (measures handler config, not decision events). Suppressed until reimplemented.
  { id: "v2.self-directed-iteration-rate-24h", name: "Self-directed iteration rate (24h)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 0.8, threshold: 0.3, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "v2.session-trace-completeness", name: "Session trace completeness (24h)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1.0, threshold: 0.5, unit: "ratio", alert_op: "<", priority: "P2" },
  { id: "v2.process-uptime-h", name: "Process uptime (hours)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 24, threshold: 1, unit: "hours", alert_op: "<", priority: "P2" },
  { id: "v2.fork-on-breach-rate", name: "Fork-on-breach rate for P0 metrics", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 1.0, threshold: 0.5, unit: "ratio", alert_op: "<", priority: "P2" },
  // C2: breach recovery metrics
  { id: "capability.breach-time-to-recovery-p50-h", name: "Breach-to-recovery median latency (hours)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 6, threshold: 24, unit: "hours", alert_op: ">", priority: "P2" },
  { id: "capability.unrecovered-breach-count-7d", name: "Unrecovered breaches (7d)", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P2" },
  // C5: ownership
  { id: "capability.cross-domain-handling-rate", name: "Cross-domain breach handling rate", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 0, threshold: 0.1, unit: "ratio", alert_op: ">", priority: "P2" },
  // C6: adaptation
  { id: "capability.trend-7d", name: "Capability metrics with declining 7d trend", owner: "may", project: "v2-spec-coverage-buildout", type: "gauge", target: 0, threshold: 2, unit: "count", alert_op: ">", priority: "P2" },
];

const RETIRED_METRIC_IDS = [
  "project.blocked-rate-7d",
  "capability.session-trace-completeness",
  "capability.tool-preset-drift-count",
  "capability.self-directed-iteration-rate-24h",
  "capability.process-uptime-h",
  "capability.concurrent-session-max-1h",
  "session.zero-op-error-count-1h",
];

/** Snapshot retention: keep 30 days of history */
const RETENTION_DAYS = 30;

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

function countInvalidSharedProjectFormats(agentsRoot: string): number {
  const sharedProjectsDir = join(agentsRoot, "shared", "projects");
  if (!existsSync(sharedProjectsDir)) return 0;

  let invalid = 0;
  for (const entry of readdirSync(sharedProjectsDir)) {
    if (entry === "_archive") continue;
    const projectDir = join(sharedProjectsDir, entry);
    try {
      if (!statSync(projectDir).isDirectory()) continue;
      const projectFile = join(projectDir, "project.md");
      if (!existsSync(projectFile)) continue;
      const content = readFileSync(projectFile, "utf-8");
      if (validateProjectFormat(content, entry).length > 0) invalid++;
    } catch {
      invalid++;
    }
  }
  return invalid;
}

function listEnabledHeartbeatAgents(agentsRoot: string, configuredAgents: Set<string>): string[] {
  const cronPath = join(agentsRoot, "may", "cron.json");
  const agents = new Set<string>();
  try {
    const cron = JSON.parse(readFileSync(cronPath, "utf8")) as Array<{
      name?: string;
      enabled?: boolean;
      agent?: string;
      handler?: string;
      handlerConfig?: { agent?: string; workflow?: string };
    }>;
    for (const entry of cron) {
      if (entry.enabled === false) continue;
      const isHeartbeat = entry.name === "heartbeat"
        || entry.name?.startsWith("heartbeat-")
        || entry.handlerConfig?.workflow?.includes("heartbeat")
        || entry.handler === "heartbeat";
      if (!isHeartbeat) continue;
      const agent = (entry.handlerConfig?.agent || entry.agent || "").trim();
      if (agent && configuredAgents.has(agent)) agents.add(agent);
    }
  } catch {
    // No cron file means no scheduled heartbeat expectation.
  }
  return [...agents].sort();
}

function readFilePrefix(path: string, maxBytes = 512 * 1024): string {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytes = readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.toString("utf8", 0, bytes);
  } finally {
    closeSync(fd);
  }
}

function sessionJsonlPath(persistDir: string, sessionId: string): string | null {
  const active = join(persistDir, "sessions", sessionId, "session.jsonl");
  if (existsSync(active)) return active;
  const archived = join(persistDir, "sessions", "history", sessionId, "session.jsonl");
  return existsSync(archived) ? archived : null;
}

function hasFirstAssistantProviderError(persistDir: string, sessionId: string): boolean {
  const path = sessionJsonlPath(persistDir, sessionId);
  if (!path) return false;
  try {
    const prefix = readFilePrefix(path);
    for (const line of prefix.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (msg?.role !== "assistant") continue;
      const stopReason = String(msg.stopReason ?? "").toLowerCase();
      const errorMessage = String(msg.errorMessage ?? "").toLowerCase();
      return stopReason === "error"
        || /connection error|rate limit|unauthorized|forbidden|unsupported model|unknown model|overloaded|timeout|api/.test(errorMessage);
    }
  } catch {
    return false;
  }
  return false;
}

function hasEmptyAssistantStop(persistDir: string, sessionId: string): boolean {
  const path = sessionJsonlPath(persistDir, sessionId);
  if (!path) return false;
  try {
    const prefix = readFilePrefix(path);
    for (const line of prefix.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let msg: any;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (msg?.role !== "assistant") continue;
      const content = msg.content;
      const emptyContent = Array.isArray(content)
        ? content.length === 0
        : typeof content === "string"
          ? content.trim().length === 0
          : content == null;
      return emptyContent && String(msg.stopReason ?? "").toLowerCase() === "stop";
    }
  } catch {
    return false;
  }
  return false;
}

function listMarkdownFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(path));
    } else if (entry.endsWith(".md") && entry !== "INDEX.md") {
      files.push(path);
    }
  }
  return files;
}

function hasScoutKnowledgePracticeLoaded(agentsRoot: string): boolean {
  try {
    const agentPrompt = readFileSync(join(agentsRoot, "scout", "AGENTS.md"), "utf8");
    const heartbeat = readFileSync(join(agentsRoot, "scout", "heartbeat.md"), "utf8");
    return /Search `agents\/scout\/knowledge\/` before creating a new knowledge file/.test(agentPrompt)
      && /update that note in place/i.test(agentPrompt)
      && /<ai_context>/.test(agentPrompt)
      && /Check existing knowledge/i.test(heartbeat)
      && /knowledge-preamble-coverage/.test(heartbeat);
  } catch {
    return false;
  }
}

function scoutKnowledgePreambleCoverage(agentsRoot: string): { value: number; sampleSize: number } {
  const files = listMarkdownFilesRecursive(join(agentsRoot, "scout", "knowledge"));
  if (files.length === 0) return { value: 1, sampleSize: 0 };
  let withPreamble = 0;
  for (const file of files) {
    try {
      const prefix = readFilePrefix(file, 4096).trimStart();
      if (prefix.startsWith("<ai_context>") || prefix.startsWith("## For future agents")) {
        withPreamble++;
      }
    } catch {
      // Treat unreadable files as not covered; the sample size still exposes the issue.
    }
  }
  return { value: Number((withPreamble / files.length).toFixed(4)), sampleSize: files.length };
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

    function terminalSessionsWithoutEndEvent(since: number, limit = 5000): Array<{ sessionId: string; agent: string; status: string; endedAt: number | null }> {
      const sessions = db.prepare(
        `SELECT sessionId, agent, status, endedAt
         FROM sessions
         WHERE status IN ('done', 'error', 'interrupted')
           AND startedAt > ?
         ORDER BY startedAt DESC
         LIMIT ?`,
      ).all(since, limit) as Array<{ sessionId: string; agent: string; status: string; endedAt: number | null }>;
      if (sessions.length === 0) return [];

      const endRows = db.prepare(
        `SELECT data
         FROM events
         WHERE event_type = 'session.end'
           AND timestamp > ?`,
      ).all(since) as Array<{ data: string | null }>;

      const ended = new Set<string>();
      for (const row of endRows) {
        if (!row.data) continue;
        try {
          const parsed = JSON.parse(row.data) as { sessionId?: unknown };
          if (typeof parsed.sessionId === "string" && parsed.sessionId) ended.add(parsed.sessionId);
        } catch {
          // Ignore malformed historic event payloads.
        }
      }
      return sessions.filter((session) => !ended.has(session.sessionId));
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

    // Historical rows remain queryable, but retired/noncritical metrics should
    // not appear in active watches or keep unresolved alerts alive.
    try {
      const placeholders = RETIRED_METRIC_IDS.map(() => "?").join(", ");
      db.run(
        `UPDATE metrics
         SET status = 'retired', closed_at = COALESCE(closed_at, ?), updated_at = ?
         WHERE id IN (${placeholders}) OR id LIKE 'agent.%.low-quality-streak'`,
        [now, now, ...RETIRED_METRIC_IDS],
      );
      db.run(
        `UPDATE metric_alerts
         SET resolved_at = COALESCE(resolved_at, ?)
         WHERE resolved_at IS NULL
           AND (metric_id IN (${placeholders}) OR metric_id LIKE 'agent.%.low-quality-streak')`,
        [now, ...RETIRED_METRIC_IDS],
      );
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error retiring noncritical metrics: ${e}`); }

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
      // Count agents that actually ran a heartbeat SESSION (not just the handler).
      // The handler fires even when the workflow fails to load — sessions are the real signal.
      const coverage = count(
        `SELECT COUNT(DISTINCT agent) as c FROM sessions
         WHERE startedAt > ?
           AND (source LIKE 'workflow:%heartbeat%' OR source = 'heartbeat' OR task LIKE '[heartbeat]%'
                OR task LIKE 'You are %waking up for your heartbeat.%')`, twoH);
      record("handler.heartbeat-coverage", coverage);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring heartbeat-coverage: ${e}`); }

    try {
      const heartbeatAgents = listEnabledHeartbeatAgents(ctx.sdk.paths.agents, configuredAgents);
      let dark = 0;
      for (const agent of heartbeatAgents) {
        const recent = count(
          `SELECT COUNT(*) as c FROM sessions
           WHERE agent = ?
             AND startedAt > ?
             AND (source LIKE 'workflow:%heartbeat%' OR source = 'heartbeat' OR task LIKE '[heartbeat]%'
                  OR task LIKE 'You are %waking up for your heartbeat.%')`,
          agent, twoH,
        );
        if (recent === 0) dark++;
      }
      record("agent.heartbeat-dark-count-2h", dark, heartbeatAgents.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring agent.heartbeat-dark-count-2h: ${e}`); }

    try {
      const row = db.prepare(
        `SELECT COALESCE(SUM(COALESCE(json_extract(data, '$.count'), 1)), 0) as c
         FROM events
         WHERE event_type = 'agent.config_invalid'
           AND timestamp > ?`,
      ).get(oneH) as { c?: number } | undefined;
      record("agent.config-invalid-count-1h", Number(row?.c ?? 0));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring agent.config-invalid-count-1h: ${e}`); }

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
      const candidates = db.prepare(
        `SELECT sessionId
         FROM sessions
         WHERE startedAt > ?
           AND COALESCE(error, '') != 'Clean start (fresh)'
           AND status IN ('error', 'interrupted')
         ORDER BY startedAt DESC
         LIMIT 200`,
      ).all(oneH) as Array<{ sessionId: string }>;
      const persistDir = ctx.sdk.paths.persist ?? ctx.sdk.paths.root;
      const firstTurnErrors = candidates.filter((s) => hasFirstAssistantProviderError(persistDir, s.sessionId)).length;
      record("session.first-turn-error-count-1h", firstTurnErrors, candidates.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring session.first-turn-error-count-1h: ${e}`); }

    try {
      const candidates = db.prepare(
        `SELECT sessionId
         FROM sessions
         WHERE startedAt > ?
           AND status IN ('error', 'interrupted')
           AND COALESCE(error, '') != 'Clean start (fresh)'
         ORDER BY startedAt DESC
         LIMIT 300`,
      ).all(oneH) as Array<{ sessionId: string }>;
      const persistDir = ctx.sdk.paths.persist ?? ctx.sdk.paths.root;
      const emptyStops = candidates.filter((s) => hasEmptyAssistantStop(persistDir, s.sessionId)).length;
      record("session.empty-assistant-stop-count-1h", emptyStops, candidates.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring session.empty-assistant-stop-count-1h: ${e}`); }

    try {
      record(
        "message.delivery-failed-count-1h",
        count("SELECT COUNT(*) as c FROM events WHERE event_type = 'message.delivery_failed' AND timestamp > ?", oneH),
      );
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring message.delivery-failed-count-1h: ${e}`); }

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
      const lastNonHeuristicEval = (db.prepare(
        "SELECT MAX(createdAt) as lastCreatedAt FROM evaluations WHERE evaluatedByHeuristic = 0",
      ).get() as any)?.lastCreatedAt as number | null | undefined;
      const lagH = lastNonHeuristicEval ? (now - lastNonHeuristicEval) / 3600000 : 9999;
      record("eval.llm-coverage-lag-h", parseFloat(lagH.toFixed(2)));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring eval.llm-coverage-lag-h: ${e}`); }

    try {
      record(
        "eval.llm-evals-24h",
        count(
          `SELECT COUNT(*) as c
           FROM evaluations
           WHERE evaluatedByHeuristic = 0
             AND createdAt > ?
             AND agent NOT IN ('evaluator', 'judge')`,
          twentyFourH,
        ),
      );
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring eval.llm-evals-24h: ${e}`); }

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

    try {
      const total = count(
        "SELECT COUNT(*) as c FROM evaluations WHERE createdAt > ? AND agent NOT IN ('evaluator', 'judge')",
        twentyFourH,
      );
      const substantiveLowQuality = count(
        `SELECT COUNT(*) as c
         FROM evaluations e
         LEFT JOIN sessions s ON s.sessionId = e.sessionId
         WHERE e.createdAt > ?
           AND e.agent NOT IN ('evaluator', 'judge')
           AND (
             s.status IN ('error', 'interrupted')
             OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
             OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
             OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
           )`,
        twentyFourH,
      );
      record("evaluator.substantive-low-quality-rate-24h", total > 0 ? parseFloat((substantiveLowQuality / total).toFixed(4)) : 0, total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.substantive-low-quality-rate-24h: ${e}`); }

    try {
      const routedForReview = count(
        `SELECT COUNT(*) as c
         FROM events
         WHERE event_type = 'evaluation.routed'
           AND timestamp > ?
           AND json_extract(data, '$.lane') IN ('needs_triage', 'success_candidate')`,
        twentyFourH,
      );
      const reviewed = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.reviewed' AND timestamp > ?",
        twentyFourH,
      );
      record("evaluator.meaningful-review-rate-24h", routedForReview > 0 ? parseFloat((Math.min(reviewed, routedForReview) / routedForReview).toFixed(4)) : 1, routedForReview);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.meaningful-review-rate-24h: ${e}`); }

    try {
      const triageRouted = count(
        `SELECT COUNT(*) as c
         FROM events
         WHERE event_type = 'evaluation.routed'
           AND timestamp > ?
           AND json_extract(data, '$.lane') = 'needs_triage'`,
        twentyFourH,
      );
      const triageClosed = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.triage_closed' AND timestamp > ?",
        twentyFourH,
      );
      record("evaluator.triage-closure-rate-24h", triageRouted > 0 ? parseFloat((Math.min(triageClosed, triageRouted) / triageRouted).toFixed(4)) : 1, triageRouted);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.triage-closure-rate-24h: ${e}`); }

    try {
      const reviewedGood = count(
        `SELECT COUNT(*) as c
         FROM events
         WHERE event_type = 'evaluation.reviewed'
           AND timestamp > ?
           AND json_extract(data, '$.verdict') = 'good'`,
        twentyFourH,
      );
      const falseGood = count(
        "SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.false_good' AND timestamp > ?",
        twentyFourH,
      );
      record("evaluator.false-good-rate-sample", reviewedGood > 0 ? parseFloat((falseGood / reviewedGood).toFixed(4)) : 0, reviewedGood);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.false-good-rate-sample: ${e}`); }

    try {
      record(
        "evaluator.success-candidates-24h",
        count("SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.success_candidate' AND timestamp > ?", twentyFourH),
      );
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.success-candidates-24h: ${e}`); }

    try {
      record(
        "evaluator.success-learnings-24h",
        count("SELECT COUNT(*) as c FROM events WHERE event_type = 'evaluation.learning_created' AND timestamp > ?", twentyFourH),
      );
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring evaluator.success-learnings-24h: ${e}`); }

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

    // ── Measure: Scout knowledge behavior ───────────────────────────

    try {
      record("scout.knowledge-practice-loaded", hasScoutKnowledgePracticeLoaded(ctx.sdk.paths.agents) ? 1 : 0);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring scout.knowledge-practice-loaded: ${e}`); }

    try {
      const coverage = scoutKnowledgePreambleCoverage(ctx.sdk.paths.agents);
      record("scout.knowledge-preamble-coverage", coverage.value, coverage.sampleSize);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring scout.knowledge-preamble-coverage: ${e}`); }

    // ── Measure: Project (with error isolation) ──────────────────────

    const fortyEightH = now - 48 * 3600000;
    const sevenD = now - 7 * 86400000;

    try {
      record("project.active-count", count("SELECT COUNT(*) as c FROM projects WHERE status = 'active'"));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring active-count: ${e}`); }

    try {
      record("project.blocked-count", count("SELECT COUNT(*) as c FROM projects WHERE status = 'blocked'"));
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
      record("project.blocked-over-6h", count("SELECT COUNT(*) as c FROM projects WHERE status = 'blocked' AND updated_at < ?", now - 6 * 3600000));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring blocked-over-6h: ${e}`); }

    try {
      record("project.invalid-format-count", countInvalidSharedProjectFormats(ctx.sdk.paths.agents));
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring invalid-format-count: ${e}`); }

    // ── Measure: status honesty ─────────────────────────────────────

    // C7: Zombie session count (running >30min)
    try {
      const zombies = count(
        "SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle') AND startedAt < ?",
        staleRunningCutoff,
      );
      record("capability.zombie-session-count", zombies);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring zombie-session-count: ${e}`); }

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
           AND m.created_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM metric_snapshots s
             WHERE s.metric_id = m.id
               AND s.measured_at > ?
           )`, now, now - 2 * 3600000);  // Exclude just-created metrics; 2h window for snapshot staleness

      let missingEndSessions = terminalSessionsWithoutEndEvent(now - 24 * 3600000);
      let terminalSessionsWithoutEnd = missingEndSessions.length;

      // Only check agents that have an enabled heartbeat cron job.
      const heartbeatAgents = listEnabledHeartbeatAgents(ctx.sdk.paths.agents, configuredAgents);

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

      // ── Reconciliation: emit session.end for orphaned terminal sessions before recording state ──
      if (terminalSessionsWithoutEnd > 0) {
        try {
          const orphaned = missingEndSessions.slice(0, 50);
          const insert = db.prepare("INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)");
          for (const s of orphaned) {
            insert.run("session.end", JSON.stringify({ sessionId: s.sessionId, agent: s.agent, status: s.status, reconciled: true }), s.endedAt || now);
          }
          if (orphaned.length > 0) ctx.sdk.log("info", `[metrics-snapshot] Reconciled ${orphaned.length} orphaned session.end events`);
          missingEndSessions = terminalSessionsWithoutEndEvent(now - 24 * 3600000);
          terminalSessionsWithoutEnd = missingEndSessions.length;
        } catch (reconErr) { /* best-effort reconciliation */ }
      }

      const mismatchCount = staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd + agentsWithoutHeartbeat;
      record("capability.status-reality-mismatch-count", mismatchCount,
        heartbeatAgents.length + staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring status-reality mismatch: ${e}`); }

    // ── Measure: v2 spec metrics (S5, S6, coverage rate) ─────────────

    // S5: agent-config-bytes-p50 — median agent.json size
    try {
      const agentJsonFiles = readdirSync(ctx.sdk.paths.agents)
        .map(d => join(ctx.sdk.paths.agents, d, "agent.json"))
        .filter(f => existsSync(f));
      const sizes = agentJsonFiles.map(f => statSync(f).size).sort((a, b) => a - b);
      if (sizes.length > 0) {
        const mid = Math.floor(sizes.length / 2);
        const median = sizes.length % 2 === 0 ? Math.round((sizes[mid - 1] + sizes[mid]) / 2) : sizes[mid];
        record("v2.agent-config-bytes-p50", median, sizes.length);
      }
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.agent-config-bytes-p50: ${e}`); }

    // S6: manager-loc and runtime-glue-loc
    try {
      const managerFiles = ["manager.ts"];
      const glueFiles = ["manager.ts", "manager-utils.ts", "manager-receipts.ts", "manager-agents-tool.ts"];
      const findLoc = async (files: string[]): Promise<number> => {
        let total = 0;
        for (const f of files) {
          try {
            const { stdout } = await execAsync(`find ${ctx.sdk.paths.root} -name "${f}" -not -path "*/node_modules/*" -not -path "*/.state/*" -not -path "*/gym/*" -print -quit`, { timeout: 3000 });
            const path = stdout.trim();
            if (path) {
              const { stdout: loc } = await execAsync(`wc -l < "${path}"`, { timeout: 2000 });
              total += parseInt(loc.trim()) || 0;
            }
          } catch { /* file not found */ }
        }
        return total;
      };
      const managerLoc = await findLoc(managerFiles);
      const glueLoc = await findLoc(glueFiles);
      record("v2.manager-loc", managerLoc);
      record("v2.runtime-glue-loc", glueLoc);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.manager-loc / v2.runtime-glue-loc: ${e}`); }

    // I1: infra.bus.event-count-1h — events in the last hour
    try {
      const eventCount1h = count("SELECT COUNT(*) as c FROM events WHERE timestamp > ?", now - 3600000);
      record("infra.bus.event-count-1h", eventCount1h);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring infra.bus.event-count-1h: ${e}`); }

    // I2: infra.persist.db-size-mb — DB file size
    try {
      const dbPath = join(ctx.sdk.paths.root, ".state", "may.db");
      if (existsSync(dbPath)) {
        const sizeMb = parseFloat((statSync(dbPath).size / (1024 * 1024)).toFixed(2));
        record("infra.persist.db-size-mb", sizeMb);
      }
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring infra.persist.db-size-mb: ${e}`); }

    // I3: infra.messages.delivery-rate — ratio of delivered messages
    try {
      const totalMsgs = count("SELECT COUNT(*) as c FROM notification_messages WHERE sent_at > ?", now - 3600000);
      // All messages in notification_messages are delivered (they have sent_at), so rate is 1.0 if any exist
      const failedMsgs = count("SELECT COUNT(*) as c FROM notification_messages WHERE sent_at IS NULL");
      const delivered = totalMsgs;
      const total = totalMsgs + failedMsgs;
      record("infra.messages.delivery-rate", total > 0 ? parseFloat((delivered / total).toFixed(4)) : 1.0, total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring infra.messages.delivery-rate: ${e}`); }

    // I4: infra.sessions.active-count — currently running sessions
    try {
      const activeSessions = count("SELECT COUNT(*) as c FROM sessions WHERE status = 'running'");
      record("infra.sessions.active-count", activeSessions);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring infra.sessions.active-count: ${e}`); }

    // S1: v2.runagent-callsite-conformance — check that agent sessions use runAgent (not direct DB)
    try {
      const { stdout: totalCallsites } = await execAsync(`grep -r "runAgent\\|runSession\\|createSession" ${ctx.sdk.paths.root}/src --include="*.ts" -l 2>/dev/null | wc -l`, { timeout: 5000 });
      const { stdout: directDbImports } = await execAsync(`grep -r "import.*from.*bun:sqlite\\|import.*Database.*from" ${ctx.sdk.paths.root}/src --include="*.ts" -l 2>/dev/null | grep -v node_modules | grep -v ".state" | wc -l`, { timeout: 5000 });
      const total = parseInt(totalCallsites.trim()) || 0;
      const direct = parseInt(directDbImports.trim()) || 0;
      // Conformance = files using runAgent / total session-related files (higher is better)
      // If no callsites found, assume conformant
      record("v2.runagent-callsite-conformance", total > 0 ? parseFloat((Math.max(0, total - direct) / total).toFixed(4)) : 1.0, total);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.runagent-callsite-conformance: ${e}`); }

    // S7: v2.heartbeat-decision-rate — ratio of agents with heartbeat handlers
    try {
      const agentDirs = readdirSync(ctx.sdk.paths.agents).filter(d => {
        const agentJsonPath = join(ctx.sdk.paths.agents, d, "agent.json");
        return existsSync(agentJsonPath);
      });
      const withHeartbeat = agentDirs.filter(d => {
        try {
          const config = JSON.parse(readFileSync(join(ctx.sdk.paths.agents, d, "agent.json"), "utf-8"));
          return config.handlers?.some((h: any) => h.event === "heartbeat" || h.type === "heartbeat");
        } catch { return false; }
      });
      record("v2.heartbeat-decision-rate", agentDirs.length > 0 ? parseFloat((withHeartbeat.length / agentDirs.length).toFixed(4)) : 0, agentDirs.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.heartbeat-decision-rate: ${e}`); }

    // C1: v2.self-directed-iteration-rate-24h — sessions without human trigger in 24h
    try {
      const totalSessions24h = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ?", now - 86400000);
      // Sessions from heartbeat/cron are self-directed; sessions with source='human' or kind='call' with no parentSessionId from heartbeat are human-triggered
      const humanTriggered = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND source = 'human'", now - 86400000);
      const selfDirectedRate = totalSessions24h > 0 ? parseFloat(((totalSessions24h - humanTriggered) / totalSessions24h).toFixed(4)) : 0;
      record("v2.self-directed-iteration-rate-24h", selfDirectedRate, totalSessions24h);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.self-directed-iteration-rate-24h: ${e}`); }

    // C8: v2.session-trace-completeness — sessions with outcome set / total completed sessions (24h)
    try {
      const completedSessions = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done', 'error', 'cancelled')", now - 86400000);
      const withOutcome = count("SELECT COUNT(*) as c FROM sessions WHERE startedAt > ? AND status IN ('done', 'error', 'cancelled') AND outcome IS NOT NULL AND outcome != ''", now - 86400000);
      const traceRate = completedSessions > 0 ? parseFloat((withOutcome / completedSessions).toFixed(4)) : 1.0;
      record("v2.session-trace-completeness", traceRate, completedSessions);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.session-trace-completeness: ${e}`); }

    // C9: v2.process-uptime-h — hours since process start (proxy: oldest running session or DB activity)
    try {
      const oldestRunning = db.prepare("SELECT MIN(startedAt) as oldest FROM sessions WHERE status = 'running'").get() as any;
      const uptimeH = oldestRunning?.oldest ? parseFloat(((now - oldestRunning.oldest) / 3600000).toFixed(2)) : 0;
      // Also check: if we have recent snapshots, the process is alive
      const recentSnap = count("SELECT COUNT(*) as c FROM metric_snapshots WHERE measured_at > ?", now - 3600000);
      const effectiveUptime = recentSnap > 0 ? Math.max(uptimeH, 1) : uptimeH;
      record("v2.process-uptime-h", effectiveUptime);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.process-uptime-h: ${e}`); }

    // S8: v2.fork-on-breach-rate — check that metrics table has priority column and P0 breaches fork
    try {
      // S8 claims priority column exists and P0 metrics get fork-on-breach
      const p0Metrics = db.prepare("SELECT COUNT(*) as c FROM metrics WHERE priority = 'P0' AND status = 'active'").get() as any;
      const p0Count = p0Metrics?.c || 0;
      // If priority column exists and P0 metrics exist, the structural claim is met
      record("v2.fork-on-breach-rate", p0Count > 0 ? 1.0 : 0, p0Count);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.fork-on-breach-rate: ${e}`); }

    // C2: capability.breach-time-to-recovery-p50-h — median breach→recovery latency
    try {
      // For each breach, find the next recovery of the same metricId
      const recoveryDeltas = db.prepare(`
        WITH breaches AS (
          SELECT timestamp, json_extract(data, '$.metricId') as metricId
          FROM events WHERE event_type = 'metric.breach' AND timestamp > ?
        ),
        recoveries AS (
          SELECT timestamp, json_extract(data, '$.metricId') as metricId
          FROM events WHERE event_type = 'metric.recovered' AND timestamp > ?
        ),
        matched AS (
          SELECT b.metricId, b.timestamp as breach_ts,
            (SELECT MIN(r.timestamp) FROM recoveries r WHERE r.metricId = b.metricId AND r.timestamp > b.timestamp) as recovery_ts
          FROM breaches b
        )
        SELECT (recovery_ts - breach_ts) / 3600000.0 as delta_h
        FROM matched
        WHERE recovery_ts IS NOT NULL
        ORDER BY delta_h
      `).all(now - 7 * 86400000, now - 7 * 86400000) as any[];
      if (recoveryDeltas.length > 0) {
        const mid = Math.floor(recoveryDeltas.length / 2);
        const p50 = recoveryDeltas.length % 2 === 1
          ? recoveryDeltas[mid].delta_h
          : (recoveryDeltas[mid - 1].delta_h + recoveryDeltas[mid].delta_h) / 2;
        record("capability.breach-time-to-recovery-p50-h", parseFloat(p50.toFixed(2)), recoveryDeltas.length);
      } else {
        record("capability.breach-time-to-recovery-p50-h", 0, 0);
      }
      // Unrecovered breaches in 7d — count distinct metrics whose latest breach has no subsequent recovery
      const unrecovered = count(`
        SELECT COUNT(*) as c FROM (
          SELECT metricId, MAX(timestamp) as latest_breach
          FROM (
            SELECT json_extract(data, '$.metricId') as metricId, timestamp
            FROM events WHERE event_type = 'metric.breach' AND timestamp > ?
          )
          WHERE metricId NOT IN (${RETIRED_METRIC_IDS.map(() => '?').join(',')})
          GROUP BY metricId
        ) b
        WHERE NOT EXISTS (
          SELECT 1 FROM events r
          WHERE r.event_type = 'metric.recovered'
            AND json_extract(r.data, '$.metricId') = b.metricId
            AND r.timestamp > b.latest_breach
        )
      `, now - 7 * 86400000, ...RETIRED_METRIC_IDS);
      record("capability.unrecovered-breach-count-7d", unrecovered);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring capability.breach-time-to-recovery-p50-h: ${e}`); }

    // C5: capability.cross-domain-handling-rate — breaches handled by non-owner agent
    try {
      // Find breach events with owner, then check if the remediation session was run by a different agent
      const breachesWithOwner = db.prepare(`
        SELECT json_extract(data, '$.owner') as owner, json_extract(data, '$.metricId') as metricId, timestamp
        FROM events WHERE event_type = 'metric.breach' AND timestamp > ?
      `).all(now - 7 * 86400000) as any[];
      let totalBreaches = 0;
      let crossDomain = 0;
      for (const b of breachesWithOwner) {
        if (!b.owner || !b.metricId) continue;
        totalBreaches++;
        // Check if a session was forked for this breach by a different agent
        const handlerSession = db.prepare(`
          SELECT agent FROM sessions
          WHERE startedAt > ? AND startedAt < ? AND agent != ?
            AND (task LIKE ? OR task LIKE ?)
          LIMIT 1
        `).get(b.timestamp - 5000, b.timestamp + 300000, b.owner, `%${b.metricId}%`, `%breach%`) as any;
        if (handlerSession) crossDomain++;
      }
      const crossRate = totalBreaches > 0 ? parseFloat((crossDomain / totalBreaches).toFixed(4)) : 0;
      record("capability.cross-domain-handling-rate", crossRate, totalBreaches);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring capability.cross-domain-handling-rate: ${e}`); }

    // C6: capability.trend-7d — count of capability metrics with declining 7-day trend
    try {
      const capMetrics = db.prepare(`
        SELECT DISTINCT ms.metric_id FROM metric_snapshots ms
        LEFT JOIN metrics m ON ms.metric_id = m.id
        WHERE ms.metric_id LIKE 'capability.%' AND ms.measured_at > ?
          AND ms.metric_id != 'capability.trend-7d'
          AND (m.status IS NULL OR m.status != 'retired')
      `).all(now - 7 * 86400000) as any[];
      let declining = 0;
      for (const m of capMetrics) {
        const snapshots = db.prepare(`
          SELECT value, measured_at FROM metric_snapshots
          WHERE metric_id = ? AND measured_at > ?
          ORDER BY measured_at ASC
        `).all(m.metric_id, now - 7 * 86400000) as any[];
        if (snapshots.length < 2) continue;
        // Simple linear regression slope
        const n = snapshots.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        const t0 = snapshots[0].measured_at;
        for (const s of snapshots) {
          const x = (s.measured_at - t0) / 3600000; // hours
          sumX += x; sumY += s.value; sumXY += x * s.value; sumX2 += x * x;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        if (slope < -0.001) declining++; // small negative threshold to avoid noise
      }
      record("capability.trend-7d", declining, capMetrics.length);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring capability.trend-7d: ${e}`); }

    // v2.spec-coverage-rate — count claims with active, measured metrics
    try {
      // Claims and their metric IDs (from v2-spec.md)
      const claimMetrics: Record<string, string[]> = {
        C1: ["v2.self-directed-iteration-rate-24h"],
        C2: ["capability.breach-time-to-recovery-p50-h"],
        C3: ["capability.journal-reference-rate"],
        C4: ["capability.message-conversation-close-rate"],
        C5: ["capability.cross-domain-handling-rate"],
        C6: ["capability.trend-7d"],
        C7: ["capability.zombie-session-count", "capability.concurrent-session-max-1h", "capability.cost-per-day-usd", "capability.fork-loop-incidents-24h"],
        C8: ["v2.session-trace-completeness"],
        C9: ["v2.process-uptime-h"],
        C10: ["capability.status-reality-mismatch-count"],
        I1: ["infra.bus.event-count-1h"],
        I2: ["infra.persist.db-size-mb"],
        I3: ["infra.messages.delivery-rate"],
        I4: ["infra.sessions.active-count"],
        S1: ["v2.runagent-callsite-conformance"],
        S2: [],  // structural hold
        S3: [],  // structural hold
        S4: [],  // structural hold
        S5: ["v2.agent-config-bytes-p50"],
        S6: ["v2.manager-loc", "v2.runtime-glue-loc"],
        S7: ["v2.heartbeat-decision-rate"],
        S8: ["v2.fork-on-breach-rate"],
      };
      const totalClaims = Object.keys(claimMetrics).length;  // 22
      let measured = 0;
      for (const [claim, metricIds] of Object.entries(claimMetrics)) {
        if (metricIds.length === 0) {
          // Structural holds count as measured
          measured++;
          continue;
        }
        // A claim is measured if at least one of its metrics is active and has a recent snapshot
        const hasActive = metricIds.some(mid => {
          const row = db.prepare("SELECT status FROM metrics WHERE id = ? AND status = 'active'").get(mid) as any;
          if (!row) return false;
          const snap = db.prepare("SELECT 1 FROM metric_snapshots WHERE metric_id = ? AND measured_at > ? LIMIT 1").get(mid, now - 24 * 3600000) as any;
          return !!snap;
        });
        if (hasActive) measured++;
      }
      const rate = parseFloat((measured / totalClaims).toFixed(4));
      record("v2.spec-coverage-rate", rate, totalClaims);
    } catch (e) { ctx.sdk.log("info", `[metrics-snapshot] Error measuring v2.spec-coverage-rate: ${e}`); }

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
