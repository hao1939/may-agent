/**
 * System Status tool — read-only dashboard showing active sessions,
 * recent history, delegations, job health, and strategic context.
 *
 * Designed for supervisors (May, Bob) to get a "single pane of glass"
 * view of system activity without grepping log files.
 *
 * Performance constraints:
 * - History dir has 3,500+ entries: use readdir → sort → slice (never walk all)
 * - JSONL files can be large: use tail-read (last N KB) not full read
 * - All operations are read-only; no state mutation
 */

import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import type { PersistedSession } from "../persistence.js";
import { getDb } from "../requests.js";

// ── Tail utility ────────────────────────────────────────────────────────

/**
 * Read the last `bytes` of a file and return the last `maxLines` complete lines.
 * Uses positioned read — never loads the whole file into memory.
 */
function tailFile(filePath: string, maxLines: number, bytes: number = 32_768): string[] {
  if (!existsSync(filePath)) return [];
  try {
    const stat = statSync(filePath);
    if (stat.size === 0) return [];

    const readSize = Math.min(bytes, stat.size);
    const buffer = Buffer.alloc(readSize);
    const fd = openSync(filePath, "r");
    try {
      readSync(fd, buffer, 0, readSize, stat.size - readSize);
    } finally {
      closeSync(fd);
    }

    const text = buffer.toString("utf-8");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

/**
 * Parse JSONL lines, skipping corrupted entries.
 */
function parseJsonlLines<T>(lines: string[]): T[] {
  const results: T[] = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      // skip corrupted lines
    }
  }
  return results;
}

// ── Data types ──────────────────────────────────────────────────────────

interface DelegationEntry {
  timestamp: string;
  parent: string;
  child: string;
  method: string;
  status: string;
  durationMs: number | null;
  error: string | null;
}

interface JobHistoryEntry {
  jobName: string;
  type: string;
  status: string;
  summary: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

// ── Metrics data types ──────────────────────────────────────────────────

interface MetricRow {
  id: string;
  name: string;
  current: number | null;
  target: number;
  unit: string | null;
  type: string;
  status: string;
  threshold: number | null;
  alert_op: string | null;
  config: string | null;
  last_value: number | null;
  measured_at: number | null;
}

// ── Metrics fetcher ─────────────────────────────────────────────────────

function getAgentMetrics(stateDir: string, agent: string): MetricRow[] {
  try {
    const db = getDb(stateDir);
    // Check if metrics table exists
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'")
      .get();
    if (!tableCheck) return [];

    const rows = db
      .prepare(
        `SELECT m.id, m.name, m.current, m.target, m.unit, m.type, m.status, m.threshold, m.alert_op, m.config,
                s.value as last_value, s.measured_at
         FROM metrics m
         LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
           AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
         LEFT JOIN metric_snapshots s ON m.id = s.metric_id
           AND s.measured_at = (SELECT MAX(measured_at) FROM metric_snapshots WHERE metric_id = m.id)
         WHERE m.status = 'active'
           AND COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), '') = ?
         ORDER BY m.type, m.id`,
      )
      .all(agent) as unknown as MetricRow[];
    return rows;
  } catch {
    return [];
  }
}

function getAllActiveMetrics(stateDir: string): MetricRow[] {
  try {
    const db = getDb(stateDir);
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'")
      .get();
    if (!tableCheck) return [];

    const rows = db
      .prepare(
        `SELECT m.id, m.name, m.current, m.target, m.unit, m.type, m.status, m.threshold, m.alert_op,
                s.value as last_value, s.measured_at
         FROM metrics m
         LEFT JOIN metric_snapshots s ON m.id = s.metric_id
           AND s.measured_at = (SELECT MAX(measured_at) FROM metric_snapshots WHERE metric_id = m.id)
         WHERE m.status = 'active'
         ORDER BY m.type, m.id`,
      )
      .all() as unknown as MetricRow[];
    return rows;
  } catch {
    return [];
  }
}

function formatMetricsSection(metrics: MetricRow[], agent?: string): string {
  const lines: string[] = [];
  const label = agent ? `My Metrics` : `All Active Metrics`;
  lines.push(`## 📊 ${label} (${metrics.length})`);

  if (metrics.length === 0) {
    lines.push("- (no owned metrics)");
  } else {
    for (const m of metrics) {
      const unitDisplay = m.unit ? ` ${m.unit}` : "";
      const typeTag = m.type ? ` [${m.type}]` : "";
      const targetPart = `target: ${m.target}`;
      const thresholdPart = m.threshold != null ? `, threshold: ${m.threshold}` : "";

      // Type-aware value display
      let currentDisplay = m.current != null ? `${m.current}` : "unmeasured";
      if (m.type === "health" && m.current != null && m.threshold != null) {
        const passing = m.alert_op === ">" ? m.current <= m.threshold : m.current >= m.threshold;
        currentDisplay = passing ? "PASS" : `FAILING (${m.current})`;
      } else if (m.type === "counter" && m.unit === "count" && m.current != null) {
        currentDisplay = `${m.current}`;
      }

      // Per-type alert evaluation
      let warn = "";
      if (m.current != null && m.threshold != null) {
        const op = m.alert_op;
        const breached =
          op === ">" || op === "above"
            ? m.current > m.threshold
            : op === "<" || op === "below" || m.type === "health"
              ? m.current < m.threshold
              : false;
        if (breached) warn = " ⚠️";
      }
      lines.push(`- **${m.name}**${typeTag}: ${currentDisplay}${unitDisplay} (${targetPart}${thresholdPart})${warn}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// ── Core data fetchers ──────────────────────────────────────────────────

function getRecentJobs(stateDir: string, count: number): JobHistoryEntry[] {
  try {
    const db = getDb(stateDir);
    const rows = db
      .prepare(
        `SELECT json_extract(data, '$.handler') as jobName,
                'handler' as type,
                CASE event_type
                  WHEN 'handler.completed' THEN 'success'
                  WHEN 'handler.failed' THEN 'failure'
                  ELSE 'unknown'
                END as status,
                '' as summary,
                datetime(timestamp / 1000, 'unixepoch') as startedAt,
                datetime(timestamp / 1000, 'unixepoch') as endedAt,
                COALESCE(json_extract(data, '$.durationMs'), 0) as durationMs
         FROM events
         WHERE event_type IN ('handler.completed', 'handler.failed')
         ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(count) as unknown as JobHistoryEntry[];
    return rows;
  } catch {
    return [];
  }
}

function getActiveSessions(stateDir: string): Array<{ id: string; meta: PersistedSession }> {
  const sessionsRoot = join(stateDir, "sessions");
  if (!existsSync(sessionsRoot)) return [];

  const results: Array<{ id: string; meta: PersistedSession }> = [];
  try {
    const dirs = readdirSync(sessionsRoot, { withFileTypes: true }).filter(
      (d) => d.isDirectory() && d.name !== "history",
    );

    for (const d of dirs) {
      const metaPath = join(sessionsRoot, d.name, "meta.json");
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as PersistedSession;
        results.push({ id: d.name, meta });
      } catch {
        // corrupted meta.json — skip
      }
    }
  } catch {
    // readdir failed — return empty
  }
  return results;
}

function getRecentHistory(
  stateDir: string,
  windowMs: number,
  maxEntries: number = 100,
): Array<{ id: string; meta: PersistedSession }> {
  const histDir = join(stateDir, "sessions", "history");
  if (!existsSync(histDir)) return [];

  try {
    // readdir returns filenames — session IDs contain timestamps: s_{TIMESTAMP}_...
    const dirs = readdirSync(histDir);
    // Sort descending by name (timestamps in names give chronological order)
    dirs.sort((a, b) => b.localeCompare(a));

    // Only read the most recent entries
    const candidates = dirs.slice(0, maxEntries);
    const cutoff = Date.now() - windowMs;
    const results: Array<{ id: string; meta: PersistedSession }> = [];

    for (const name of candidates) {
      const metaPath = join(histDir, name, "meta.json");
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as PersistedSession;
        // Filter by time window — use endedAt if available, otherwise startedAt
        const ts = meta.endedAt ?? meta.startedAt;
        if (ts >= cutoff) {
          results.push({ id: name, meta });
        }
      } catch {
        // corrupted — skip
      }
    }
    return results;
  } catch {
    return [];
  }
}

function getRecentDelegations(stateDir: string, count: number): DelegationEntry[] {
  const lines = tailFile(join(stateDir, "delegations.jsonl"), count);
  return parseJsonlLines<DelegationEntry>(lines);
}

function readFocusTasks(sharedRoot: string): string {
  const focusPath = join(sharedRoot, "focus-tasks.md");
  if (!existsSync(focusPath)) return "(no focus-tasks.md found)";
  try {
    const content = readFileSync(focusPath, "utf-8");
    // Extract active focus items (lines between "## Active Focus" and next "## ")
    const activeMatch = content.match(/## Active Focus\s*\n([\s\S]*?)(?=\n## |$)/);
    if (activeMatch) {
      const items = activeMatch[1].trim();
      if (items.length === 0) return "(no active focus items)";
      // Get just the task titles (### lines)
      const titles = items
        .split("\n")
        .filter((l) => l.startsWith("### "))
        .map((l) => l.replace(/^###\s*/, "").trim());
      return titles.length > 0 ? titles.join("; ") : items.slice(0, 300);
    }
    return "(could not parse focus-tasks.md)";
  } catch {
    return "(error reading focus-tasks.md)";
  }
}

function readTodoSummary(stateDir: string): string {
  try {
    const db = getDb(stateDir);
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM events
         WHERE owner = 'may' AND timestamp > ?`,
      )
      .get(twoHoursAgo) as { count: number } | null;
    return `${row?.count ?? 0} recent event(s)`;
  } catch {
    return "(DB unavailable)";
  }
}

// ── Formatting ──────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remainder = s % 60;
  if (m < 60) return `${m}m ${remainder}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function truncateId(id: string): string {
  // s_1773410609353_696 → s_...609353_696
  if (id.length <= 20) return id;
  return id.slice(0, 2) + "..." + id.slice(-10);
}

function truncateTask(task: string, maxLen: number = 60): string {
  // Strip [heartbeat] prefix for brevity
  let t = task.replace(/^\[heartbeat\]\s*/i, "HB: ");
  if (t.length > maxLen) t = t.slice(0, maxLen - 1) + "…";
  return t;
}

function formatMarkdown(
  active: Array<{ id: string; meta: PersistedSession }>,
  history: Array<{ id: string; meta: PersistedSession }>,
  delegations: DelegationEntry[],
  jobs: JobHistoryEntry[],
  focus: string,
  todoSummary: string,
  windowMinutes: number,
  metricsSection?: string,
): string {
  const now = new Date();
  const lines: string[] = [];

  lines.push(`# System Status: ${now.toISOString().replace("T", " ").slice(0, 19)} UTC`);
  lines.push("");

  // ── Active Sessions ──────────────────────────────────────────────
  const running = active.filter((s) => s.meta.status === "running");
  const idle = active.filter((s) => s.meta.status === "idle");
  const statusIcon = running.length > 0 ? "🟢" : "⚪";
  lines.push(`## ${statusIcon} Active Sessions (${active.length})`);
  if (active.length === 0) {
    lines.push("- (none)");
  } else {
    // Sort: running first, then by startedAt
    const sorted = [...active].sort((a, b) => {
      if (a.meta.status === "running" && b.meta.status !== "running") return -1;
      if (a.meta.status !== "running" && b.meta.status === "running") return 1;
      return (a.meta.startedAt ?? 0) - (b.meta.startedAt ?? 0);
    });
    for (const s of sorted) {
      const dur = formatDuration(Date.now() - (s.meta.startedAt ?? Date.now()));
      const statusLabel = s.meta.status === "running" ? "Running" : s.meta.status;
      const warn = Date.now() - (s.meta.startedAt ?? Date.now()) > 15 * 60 * 1000 ? " ⚠️ long" : "";
      lines.push(
        `- **${s.meta.agent}** (${truncateId(s.id)}): "${truncateTask(s.meta.task)}" (${statusLabel} ${dur}${warn})`,
      );
    }
  }
  if (running.length > 0 || idle.length > 0) {
    lines.push(`- _Running: ${running.length}, Idle: ${idle.length}_`);
  }
  lines.push("");

  // ── Recent History ───────────────────────────────────────────────
  lines.push(`## 📈 Last ${windowMinutes}m`);
  if (history.length === 0) {
    lines.push("- (no completed sessions in window)");
  } else {
    const done = history.filter((s) => s.meta.status === "done");
    const errors = history.filter((s) => s.meta.status === "error");
    const interrupted = history.filter((s) => s.meta.status === "interrupted");
    const successRate = history.length > 0 ? Math.round((done.length / history.length) * 100) : 0;

    // Compute avg duration
    const durations = history
      .filter((s) => s.meta.endedAt && s.meta.startedAt)
      .map((s) => s.meta.endedAt! - s.meta.startedAt);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    lines.push(`- **Throughput**: ${history.length} sessions completed`);
    lines.push(`- **Success Rate**: ${successRate}% (${done.length}/${history.length})`);
    if (avgDuration > 0) {
      lines.push(`- **Avg Duration**: ${formatDuration(avgDuration)}`);
    }

    // Agent breakdown
    const agentCounts: Record<string, number> = {};
    for (const s of history) {
      agentCounts[s.meta.agent] = (agentCounts[s.meta.agent] ?? 0) + 1;
    }
    const topAgents = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => `${name}(${count})`)
      .join(", ");
    lines.push(`- **Top Agents**: ${topAgents}`);

    // Show errors
    if (errors.length > 0) {
      lines.push(`- **Errors** (${errors.length}):`);
      for (const e of errors.slice(0, 5)) {
        const errMsg = e.meta.error ? e.meta.error.slice(0, 80) : "unknown";
        lines.push(`  - \`${e.meta.agent}\` (${truncateId(e.id)}): ${errMsg}`);
      }
      if (errors.length > 5) lines.push(`  - ... and ${errors.length - 5} more`);
    }
    if (interrupted.length > 0) {
      lines.push(`- **Interrupted**: ${interrupted.length}`);
    }
  }
  lines.push("");

  // ── Recent Delegations ──────────────────────────────────────────
  lines.push(`## 🔄 Recent Delegations (Last ${delegations.length})`);
  if (delegations.length === 0) {
    lines.push("- (no delegation data)");
  } else {
    // Show most recent 10
    const recent = delegations.slice(-10);
    for (const d of recent.reverse()) {
      const statusIcon = d.status === "error" ? "❌" : d.status === "sent" ? "📤" : "✅";
      const errSuffix = d.error ? ` — ${d.error.slice(0, 60)}` : "";
      const durSuffix = d.durationMs != null ? ` (${formatDuration(d.durationMs)})` : "";
      lines.push(`- ${statusIcon} ${d.parent} → ${d.child} [${d.method}] ${d.status}${durSuffix}${errSuffix}`);
    }
  }
  lines.push("");

  // ── Job Health ──────────────────────────────────────────────────
  lines.push(`## ⏱️ Cron/Jobs (Last ${jobs.length})`);
  if (jobs.length === 0) {
    lines.push("- (no job history data)");
  } else {
    // Summarize: group by jobName, show last status
    const jobMap: Record<string, { last: JobHistoryEntry; total: number; errors: number }> = {};
    for (const j of jobs) {
      if (!jobMap[j.jobName]) {
        jobMap[j.jobName] = { last: j, total: 0, errors: 0 };
      }
      jobMap[j.jobName].last = j;
      jobMap[j.jobName].total++;
      if (j.status !== "success") jobMap[j.jobName].errors++;
    }
    for (const [name, info] of Object.entries(jobMap).sort((a, b) => a[0].localeCompare(b[0]))) {
      const icon = info.errors === 0 ? "✅" : "⚠️";
      lines.push(`- ${icon} **${name}**: ${info.total} runs, ${info.errors} errors (last: ${info.last.status})`);
    }
  }
  lines.push("");

  // ── Metrics ─────────────────────────────────────────────────────
  if (metricsSection) {
    lines.push(metricsSection);
  }

  // ── Strategic Context ──────────────────────────────────────────
  lines.push(`## 🎯 Strategic Context`);
  lines.push(`- **Focus**: ${focus}`);
  lines.push(`- **Ops Queue**: ${todoSummary}`);
  lines.push("");

  return lines.join("\n");
}

// ── Tool factory ────────────────────────────────────────────────────────

/**
 * Create the system-status tool. Read-only dashboard of system activity.
 *
 * @param stateDir - Path to .state/ directory
 * @param agentsRoot - Path to agents/ directory
 * @param sharedRoot - Path to shared/ directory
 */
export function createSystemStatusTool(stateDir: string, agentsRoot: string, sharedRoot = join(agentsRoot, "shared")): AgentTool {
  return {
    name: "system_status",
    label: "System Status Dashboard",
    description:
      "Get a high-level dashboard of system activity: active sessions, recent completions, delegation history, job health, and strategic context. Read-only. Use this during heartbeats to understand what's happening before deciding on actions.",
    parameters: Type.Object({
      windowMinutes: Type.Optional(
        Type.Number({
          description:
            "Lookback window in minutes for history stats. Default: 60. Increase to 180 or 360 for a broader view of recent activity.",
          default: 60,
        }),
      ),
      agent: Type.Optional(
        Type.String({
          description:
            "Agent name to show metrics for. If omitted, shows all active metrics.",
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const { windowMinutes: wm, agent } = params as { windowMinutes?: number; agent?: string };
      const windowMinutes = wm ?? 60;
      const windowMs = windowMinutes * 60 * 1000;

      const active = getActiveSessions(stateDir);
      const history = getRecentHistory(stateDir, windowMs);
      const delegations = getRecentDelegations(stateDir, 50);
      const jobs = getRecentJobs(stateDir, 50);
      const focus = readFocusTasks(sharedRoot);
      const todoSummary = readTodoSummary(stateDir);

      // Fetch metrics — filtered by agent if provided, otherwise all active
      const metrics = agent
        ? getAgentMetrics(stateDir, agent)
        : getAllActiveMetrics(stateDir);
      const metricsSection = formatMetricsSection(metrics, agent);

      const markdown = formatMarkdown(active, history, delegations, jobs, focus, todoSummary, windowMinutes, metricsSection);

      return {
        content: [{ type: "text", text: markdown }],
        details: {
          activeSessions: active.length,
          historyInWindow: history.length,
          delegationCount: delegations.length,
          jobCount: jobs.length,
        },
      };
    },
  };
}
