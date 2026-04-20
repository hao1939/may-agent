/**
 * heartbeat-context — JS cron handler (pre-compute agent context).
 *
 * Runs before each heartbeat, gathers common situational data that agents
 * currently waste 10-40 bash calls discovering:
 *   - Recent session counts by agent
 *   - Session sizes (cost proxy)
 *   - Error counts from ERROR_LOGs
 *
 * Writes a compact summary to agents/<agent>/workspace/heartbeat-context.md
 * that gets injected into the cron message. Agents skip the "situational
 * awareness" bash calls and start working immediately.
 *
 * Estimated savings: 10-20 bash calls per heartbeat × 4-6 agents × 2/hour
 *   = 80-240 fewer tool calls/hour ≈ 15-30% token reduction per heartbeat.
 *
 * Original: agents/optimizer/workspace/patches/heartbeat-context-handler.ts
 * Adapted to HandlerModule["create"] signature by tech-lead (2026-03-21).
 *
 * Exports create() conforming to HandlerModule.
 */

import {
  readdirSync,
  readFileSync,
  existsSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Configuration ─────────────────────────────────────────────────────

/** How far back to look for recent sessions (6 hours). */
const SESSION_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Maximum recent sessions to analyze per run. */
const MAX_SESSIONS_TO_SCAN = 100;

/** Agents to generate context for. */
const CONTEXT_AGENTS = [
  "optimizer",
  "coach",
  "tech-lead",
  "bob",
  "scout",
  "amy-kimi",
  "qa",
  "evaluator",
];

// ── Types ─────────────────────────────────────────────────────────────

interface SessionInfo {
  id: string;
  agent: string;
  status: string;
  sizeKB: number;
  startedAt: number;
  task: string;
}

interface AgentSummary {
  sessions: number;
  totalKB: number;
  avgKB: number;
  errors: number;
  largestSession: { id: string; sizeKB: number; task: string } | null;
}

interface SystemSnapshot {
  windowHours: number;
  totalSessions: number;
  totalKB: number;
  errorRate: number;
  byAgent: Record<string, AgentSummary>;
  recentErrors: { agent: string; code: string; count: number }[];
  generatedAt: string;
}

// ── Core Logic ────────────────────────────────────────────────────────

function scanRecentSessions(baseDir: string, windowMs: number): SessionInfo[] {
  const sessionsDir = join(baseDir, ".state", "sessions");
  if (!existsSync(sessionsDir)) return [];

  const cutoff = Date.now() - windowMs;
  const entries = readdirSync(sessionsDir).filter((d) => d.startsWith("s_"));

  // Sort by timestamp descending, take only MAX_SESSIONS_TO_SCAN
  const sorted = entries
    .map((d) => {
      const match = d.match(/^s_(\d+)_/);
      return { dir: d, ts: match ? parseInt(match[1]) : 0 };
    })
    .filter((e) => e.ts >= cutoff)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_SESSIONS_TO_SCAN);

  const sessions: SessionInfo[] = [];

  for (const entry of sorted) {
    const metaPath = join(sessionsDir, entry.dir, "meta.json");
    if (!existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      const sessionPath = join(sessionsDir, entry.dir);

      // Get total directory size
      let sizeKB = 0;
      try {
        const files = readdirSync(sessionPath);
        for (const f of files) {
          const fPath = join(sessionPath, f);
          try {
            const st = statSync(fPath);
            if (st.isFile()) sizeKB += Math.ceil(st.size / 1024);
          } catch {
            /* skip */
          }
        }
      } catch {
        /* skip */
      }

      sessions.push({
        id: entry.dir,
        agent: meta.agent || "unknown",
        status: meta.status || "unknown",
        sizeKB,
        startedAt: meta.startedAt || entry.ts,
        task: (meta.task || "").slice(0, 100),
      });
    } catch {
      /* skip malformed meta */
    }
  }

  return sessions;
}

function scanErrorLogs(
  baseDir: string,
  windowMs: number,
): { agent: string; code: string; count: number }[] {
  const agentsDir = join(baseDir, "agents");
  if (!existsSync(agentsDir)) return [];

  const cutoff = Date.now() - windowMs;
  const errorCounts: Record<string, number> = {};

  let agentDirs: string[];
  try {
    agentDirs = readdirSync(agentsDir).filter((d) => {
      const p = join(agentsDir, d);
      return existsSync(join(p, "ERROR_LOG.jsonl"));
    });
  } catch {
    return [];
  }

  for (const agentName of agentDirs) {
    const logPath = join(agentsDir, agentName, "ERROR_LOG.jsonl");
    try {
      const lines = readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
          if (ts < cutoff) continue;

          const code = (entry.error || "").split(":")[0].trim();
          if (code) {
            const key = `${agentName}:${code}`;
            errorCounts[key] = (errorCounts[key] || 0) + 1;
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip */
    }
  }

  return Object.entries(errorCounts)
    .map(([key, count]) => {
      const [agent, code] = key.split(":");
      return { agent, code, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15); // Top 15 errors
}

function buildSnapshot(baseDir: string): SystemSnapshot {
  const sessions = scanRecentSessions(baseDir, SESSION_WINDOW_MS);
  const errors = scanErrorLogs(baseDir, SESSION_WINDOW_MS);

  const windowHours = SESSION_WINDOW_MS / (60 * 60 * 1000);
  const byAgent: Record<string, AgentSummary> = {};
  let totalErrors = 0;

  for (const s of sessions) {
    if (!byAgent[s.agent]) {
      byAgent[s.agent] = {
        sessions: 0,
        totalKB: 0,
        avgKB: 0,
        errors: 0,
        largestSession: null,
      };
    }
    const a = byAgent[s.agent];
    a.sessions++;
    a.totalKB += s.sizeKB;
    if (s.status === "error") {
      a.errors++;
      totalErrors++;
    }
    if (!a.largestSession || s.sizeKB > a.largestSession.sizeKB) {
      a.largestSession = { id: s.id, sizeKB: s.sizeKB, task: s.task };
    }
  }

  for (const a of Object.values(byAgent)) {
    a.avgKB = a.sessions > 0 ? Math.round(a.totalKB / a.sessions) : 0;
  }

  return {
    windowHours,
    totalSessions: sessions.length,
    totalKB: sessions.reduce((sum, s) => sum + s.sizeKB, 0),
    errorRate:
      sessions.length > 0
        ? Math.round((totalErrors / sessions.length) * 1000) / 10
        : 0,
    byAgent,
    recentErrors: errors,
    generatedAt: new Date().toISOString(),
  };
}

// ── Formatters ────────────────────────────────────────────────────────

function formatSnapshot(snap: SystemSnapshot): string {
  const lines: string[] = [];
  lines.push(
    `# System Context (auto-generated ${snap.generatedAt.slice(0, 16)})`,
  );
  lines.push("");
  lines.push(
    `**${snap.windowHours}h window:** ${snap.totalSessions} sessions, ${snap.totalKB}KB total, ${snap.errorRate}% error rate`,
  );
  lines.push("");

  // Agent table
  lines.push("| Agent | Sessions | Total KB | Avg KB | Errors |");
  lines.push("|-------|----------|----------|--------|--------|");

  const sorted = Object.entries(snap.byAgent).sort(
    ([, a], [, b]) => b.totalKB - a.totalKB,
  );
  for (const [name, data] of sorted) {
    lines.push(
      `| ${name} | ${data.sessions} | ${data.totalKB} | ${data.avgKB} | ${data.errors} |`,
    );
  }

  // Top cost sessions
  lines.push("");
  lines.push("**Largest sessions:**");
  const largestSessions = sorted
    .filter(([, d]) => d.largestSession)
    .map(([name, d]) => ({ name, ...d.largestSession! }))
    .sort((a, b) => b.sizeKB - a.sizeKB)
    .slice(0, 5);

  for (const s of largestSessions) {
    lines.push(`- ${s.sizeKB}KB ${s.name}: ${s.task.slice(0, 80)}`);
  }

  // Error patterns
  if (snap.recentErrors.length > 0) {
    lines.push("");
    lines.push("**Active error patterns (6h):**");
    for (const e of snap.recentErrors.slice(0, 8)) {
      lines.push(`- ${e.agent} ${e.code}: ${e.count}x`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatAgentContext(snap: SystemSnapshot, agentName: string): string {
  const lines: string[] = [];
  const myData = snap.byAgent[agentName];

  lines.push(
    `# Your Context (auto-generated ${snap.generatedAt.slice(0, 16)})`,
  );
  lines.push("");
  lines.push(
    `**System:** ${snap.totalSessions} sessions/${snap.windowHours}h, ${snap.errorRate}% error rate`,
  );

  if (myData) {
    lines.push(
      `**You:** ${myData.sessions} sessions, ${myData.totalKB}KB total (${myData.avgKB}KB avg)`,
    );
    if (myData.errors > 0) {
      lines.push(`**⚠️ Your errors:** ${myData.errors} error sessions`);
    }
  }

  lines.push("");
  lines.push("**Top spenders:**");
  const sorted = Object.entries(snap.byAgent)
    .sort(([, a], [, b]) => b.totalKB - a.totalKB)
    .slice(0, 5);
  for (const [name, data] of sorted) {
    const marker = name === agentName ? " ← you" : "";
    lines.push(`- ${name}: ${data.sessions}s, ${data.totalKB}KB${marker}`);
  }

  // Show this agent's errors
  const myErrors = snap.recentErrors.filter((e) => e.agent === agentName);
  if (myErrors.length > 0) {
    lines.push("");
    lines.push("**Your active error patterns:**");
    for (const e of myErrors) {
      lines.push(`- ${e.code}: ${e.count}x`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ── Metrics Integration ───────────────────────────────────────────────

interface MetricRow {
  id: string;
  name: string;
  current: number | null;
  target: number | null;
  unit: string | null;
  type: string;
  threshold: number | null;
  alert_direction: string | null;
  direction: string | null; // 'higher_is_better' (default) or 'lower_is_better'
  last_value: number | null;
  measured_at: number | null;
  source: string | null;
  source_query: string | null;
  source_command: string | null;
}

function getAgentMetrics(baseDir: string, agentName: string): MetricRow[] {
  const dbPath = join(baseDir, ".state", "may.db");
  if (!existsSync(dbPath)) return [];
  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    // Check if metrics table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='metrics'"
    ).get();
    if (!tableCheck) return [];

    return db.prepare(
      `SELECT m.id, m.name, m.current, m.target, m.unit, m.type, m.threshold,
              m.alert_direction, m.direction, m.source, m.source_query, m.source_command,
              s.value as last_value, s.measured_at
       FROM metrics m
       LEFT JOIN metric_snapshots s ON m.id = s.metric_id
         AND s.measured_at = (SELECT MAX(measured_at) FROM metric_snapshots WHERE metric_id = m.id)
       WHERE m.owner = ? AND m.status = 'active'
       ORDER BY m.type, m.id`
    ).all(agentName) as MetricRow[];
  } catch {
    return [];
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

/**
 * Generate a breadcrumb investigation hint for a metric that needs attention.
 * Returns empty string if metric is healthy or no useful hint can be generated.
 */
function generateBreadcrumb(m: MetricRow): string {
  // Only generate breadcrumbs for metrics that need attention
  const needsAttention = (() => {
    if (m.current == null) return false;
    if (m.threshold != null) {
      const alertAbove = m.alert_direction === 'above';
      return alertAbove ? m.current > m.threshold : m.current < m.threshold;
    }
    if (m.target != null) {
      // More than 20% away from target
      const dist = Math.abs(m.current - m.target);
      const scale = Math.max(Math.abs(m.target), 1);
      return dist / scale > 0.2;
    }
    return false;
  })();

  if (!needsAttention) return "";

  // Generate hint based on source type
  if (m.source === 'auto' && m.source_query) {
    // Simplify the SQL query into a quick-check command
    const safeQuery = m.source_query.replace(/'/g, "\\'");
    return `  → Quick check: bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});console.log(JSON.stringify(db.prepare('${safeQuery}').all()))"`;
  }
  if (m.source === 'command' && m.source_command) {
    return `  → Quick check: ${m.source_command}`;
  }

  // Fallback: suggest looking at the metric's data
  return `  → Quick check: search .state/may.db metric_snapshots for ${m.id} trends`;
}

/**
 * Determine the warning label for a metric based on its type and current value.
 * Health metrics: threshold-based (existing behavior).
 * Continuous metrics: target-based with direction polarity (M5b addition).
 */
function getMetricWarning(m: MetricRow): string {
  if (m.current == null) return "";

  // Health metrics: threshold-based
  if (m.type === "health" && m.threshold != null) {
    const alertAbove = m.alert_direction === 'above';
    const breaching = alertAbove ? m.current > m.threshold : m.current < m.threshold;
    return breaching ? " ⚠️ NEEDS ATTENTION" : "";
  }

  // Continuous/ongoing metrics with threshold: use threshold + alert_direction
  if ((m.type === "continuous" || m.type === "ongoing") && m.threshold != null) {
    const alertAbove = m.alert_direction === 'above';
    const breaching = alertAbove ? m.current > m.threshold : m.current < m.threshold;
    if (breaching) return " ⚠️ NEEDS ATTENTION";
  }

  // Continuous/ongoing metrics without threshold: flag when >20% away from target
  if ((m.type === "continuous" || m.type === "ongoing") && m.target != null && m.target !== 0 && m.threshold == null) {
    // Use direction column (M5b) if available, fall back to alert_direction inference
    const higherIsBetter = m.direction
      ? m.direction === 'higher_is_better'
      : m.alert_direction !== 'above';
    const gap = higherIsBetter
      ? (m.target - m.current) / Math.max(Math.abs(m.target), 1)
      : (m.current - m.target) / Math.max(Math.abs(m.target), 1);
    if (gap > 0.2) return " ⚠️ OFF TARGET";
  }

  return "";
}

function formatMetricsContext(metrics: MetricRow[]): string {
  if (metrics.length === 0) return "";
  const lines: string[] = [];
  lines.push("");
  lines.push("**📊 Your Metrics:**");
  for (const m of metrics) {
    const val = m.current != null ? `${m.current}` : (m.last_value != null ? `~${m.last_value}` : "unmeasured");
    const unit = m.unit ? ` ${m.unit}` : "";
    const targetStr = m.target != null ? ` → ${m.target}${unit}` : "";
    const warn = getMetricWarning(m);
    lines.push(`- ${m.name}: **${val}**${unit}${targetStr}${warn}`);
    const breadcrumb = generateBreadcrumb(m);
    if (breadcrumb) lines.push(breadcrumb);
  }
  lines.push("");
  return lines.join("\n");
}

// ── Handler Module (correct HandlerModule["create"] signature) ────────

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  _entry: CronEntry,
) => {
  return async () => {
    const baseDir = process.cwd();
    const snap = buildSnapshot(baseDir);
    const formatted = formatSnapshot(snap);

    // Write system-wide context to .state (ephemeral, not in agents/ repo)
    const stateContextDir = join(baseDir, ".state", "context");
    if (!existsSync(stateContextDir)) {
      mkdirSync(stateContextDir, { recursive: true });
    }
    const outPath = join(stateContextDir, "system-context.md");
    writeFileSync(outPath, formatted, "utf-8");

    // Write per-agent context files (with nudge injection per brief-active-nudging.md §3)
    let written = 0;
    let nudgesInjected = 0;
    for (const agentName of CONTEXT_AGENTS) {
      const agentWorkspace = join(baseDir, "agents", agentName, "workspace");
      if (existsSync(agentWorkspace)) {
        let agentContext = "";

        // Check for active nudge file — prepend with URGENT priority
        const nudgePath = join(agentWorkspace, "nudge-active.md");
        if (existsSync(nudgePath)) {
          try {
            const nudgeContent = readFileSync(nudgePath, "utf-8").trim();
            if (nudgeContent) {
              agentContext += `# ⚠️ URGENT — Active Nudge\n\n`;
              agentContext += nudgeContent;
              agentContext += `\n\n---\n\n`;
              nudgesInjected++;
            }
          } catch {
            /* skip unreadable nudge file */
          }
        }

        agentContext += formatAgentContext(snap, agentName);

        // Inject pre-computed startup context (cold-start-fix integration)
        try {
          const { getStartupContext } = await import("../../../src/lib/index.js");
          const agentDir = join(baseDir, "agents", agentName);
          const startupCtx = await getStartupContext(agentDir);
          if (startupCtx.formattedContext) {
            agentContext += `\n\n${startupCtx.formattedContext}\n`;
          }
        } catch {
          /* startup context unavailable — non-fatal */
        }

        // Inject owned metrics from may.db
        const metrics = getAgentMetrics(baseDir, agentName);
        if (metrics.length > 0) {
          agentContext += formatMetricsContext(metrics);
        }

        writeFileSync(
          join(agentWorkspace, "heartbeat-context.md"),
          agentContext,
          "utf-8",
        );
        written++;
      }
    }

    // Log result via notify (shows in cron output)
    const nudgeNote = nudgesInjected > 0 ? ` ${nudgesInjected} active nudge(s) injected.` : "";
    const summary = `Generated system context: ${snap.totalSessions} sessions, ${snap.totalKB}KB in ${snap.windowHours}h window. Context files written for ${written} agents (with metrics injection).${nudgeNote}`;
    ctx.log(summary);
  };
};
