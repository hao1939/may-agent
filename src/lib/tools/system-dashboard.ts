/**
 * system-dashboard.ts — CLI status dashboard for may-agent
 *
 * Enhanced `--status` output: single pane of glass showing system health,
 * agent performance, process health, and progress trends.
 *
 * Data sources (all existing, no new infra):
 * - may.db sessions table → agent completion rates, work stats
 * - may.db events table → handler health (paired started/completed/failed events)
 * - .state/evaluations/ → per-agent quality/efficiency scores
 * - .state/human-inputs.jsonl → human correction trends
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getEvaluationsSince, getDb } from "../requests.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function ago(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  if (diff < HOUR) return `${Math.round(diff / 60000)}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  return `${Math.round(diff / DAY)}d ago`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ── Types ────────────────────────────────────────────────────────────

interface EvalRecord {
  agent: string;
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
  ts: number;
}

interface AgentStats {
  total: number;
  completed: number;
  failed: number;
  avgDuration: number | null;
}

interface ProcessInfo {
  name: string;
  lastFire: number | null;
  lastStatus: string | null;
}

interface AttentionItem {
  level: "red" | "yellow" | "green";
  message: string;
}

// ── Data loading ─────────────────────────────────────────────────────

/** Load flat-format evaluations (agent, quality, efficiency, verdict) within a time window. */
function loadEvals(persistDir: string, sinceMs: number): EvalRecord[] {
  return getEvaluationsSince(persistDir, sinceMs).map((ev) => ({
    agent: ev.agent,
    quality: ev.quality,
    efficiency: ev.efficiency,
    verdict: ev.verdict,
    issues: ev.issues,
    ts: ev.createdAt,
  }));
}

/** Load human input counts per day from human-inputs.jsonl. */
function loadHumanInputCounts(persistDir: string, days: number): number[] {
  const filePath = join(persistDir, "human-inputs.jsonl");
  if (!existsSync(filePath)) return [];

  const _now = Date.now();
  // Buckets: [oldest ... today], each is a day
  const buckets = new Array<number>(days).fill(0);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (typeof entry.ts !== "number") continue;
        const daysAgo = Math.floor((todayMs - entry.ts) / DAY);
        if (daysAgo < 0) {
          // Today (after midnight)
          buckets[days - 1]++;
        } else if (daysAgo < days) {
          buckets[days - 1 - daysAgo]++;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }

  return buckets;
}

/** Load process last-fire times from events table (handler.started events). */
function loadProcessHealth(persistDir: string): ProcessInfo[] {
  const db = getDb(persistDir);
  try {
    return db.prepare(
      `WITH handlers AS (
         SELECT COALESCE(handler, json_extract(data, '$.handler')) AS name, MAX(timestamp) AS lastFire
         FROM events
         WHERE event_type = 'handler.started'
           AND COALESCE(handler, json_extract(data, '$.handler')) IS NOT NULL
         GROUP BY COALESCE(handler, json_extract(data, '$.handler'))
       )
       SELECT h.name, h.lastFire,
         CASE latest.event_type
           WHEN 'handler.completed' THEN 'COMPLETED'
           WHEN 'handler.failed' THEN 'FAILED'
           ELSE NULL
         END AS lastStatus
       FROM handlers h
       LEFT JOIN events latest ON latest.id = (
         SELECT e.id FROM events e
         WHERE e.event_type IN ('handler.completed', 'handler.failed')
           AND json_extract(e.data, '$.handler') = h.name
         ORDER BY e.timestamp DESC, e.id DESC LIMIT 1
       )
       ORDER BY h.lastFire DESC
       LIMIT 30`,
    ).all() as unknown as ProcessInfo[];
  } catch {
    return [];
  }
}

/** Load convention compliance summary if it exists. */
function loadConventionSummary(persistDir: string): Record<string, unknown> | null {
  const summaryPath = join(persistDir, "convention-checks", "summary.json");
  if (!existsSync(summaryPath)) return null;
  try {
    return JSON.parse(readFileSync(summaryPath, "utf-8"));
  } catch {
    return null;
  }
}

// ── Triage logic ─────────────────────────────────────────────────────

function triageItems(
  processes: ProcessInfo[],
  agentCompletionRates: Map<string, AgentStats>,
  evals24h: EvalRecord[],
  humanCounts: number[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Process failures are reported from observed handler lifecycle events.
  // Schedule freshness belongs to cron/handler metrics, not a duplicated list.
  for (const proc of processes) {
    if (proc.lastStatus === "FAILED") {
      items.push({
        level: "yellow",
        message: `${proc.name}: last run FAILED (${proc.lastFire ? ago(proc.lastFire) : "time unknown"})`,
      });
    }
  }

  // Agent failures — any agent with >10% failure rate in 24h
  for (const [agent, stats] of agentCompletionRates) {
    if (stats.total < 5) continue; // Too few to judge
    const failRate = stats.failed / stats.total;
    if (failRate > 0.1) {
      items.push({
        level: "yellow",
        message: `${agent}: ${Math.round(failRate * 100)}% failure rate (${stats.failed}/${stats.total})`,
      });
    }
  }

  // Quality decline — any agent with avg quality < 0.3 in last 24h
  //    Scale is 0.0-1.0. Exclude interrupted sessions (not the agent's fault).
  const agentQuality = new Map<string, { total: number; count: number }>();
  for (const e of evals24h) {
    if (e.issues.includes("session_interrupted")) continue;
    const entry = agentQuality.get(e.agent) ?? { total: 0, count: 0 };
    entry.total += e.quality;
    entry.count++;
    agentQuality.set(e.agent, entry);
  }
  for (const [agent, { total, count }] of agentQuality) {
    if (count < 3) continue;
    const avg = total / count;
    if (avg < 0.3) {
      items.push({
        level: "red",
        message: `${agent}: avg quality ${avg.toFixed(2)} in last 24h (${count} evals)`,
      });
    }
  }

  // Human correction trend — increasing over 3+ days
  if (humanCounts.length >= 3) {
    const recent3 = humanCounts.slice(-3);
    if (recent3[0] < recent3[1] && recent3[1] < recent3[2] && recent3[2] > 5) {
      items.push({
        level: "yellow",
        message: `Human corrections trending up: ${recent3.join(" → ")} (last 3 days)`,
      });
    }
  }

  // Sort: red first, then yellow
  items.sort((a, b) => {
    if (a.level === b.level) return 0;
    return a.level === "red" ? -1 : 1;
  });

  return items;
}

// ── Formatting ───────────────────────────────────────────────────────

function trendArrow(trend: "improving" | "declining" | "stable"): string {
  switch (trend) {
    case "improving":
      return "↗";
    case "declining":
      return "↘";
    case "stable":
      return "→";
  }
}

function computeWindowedTrend(
  evals: EvalRecord[],
  agent: string,
  windowMs: number,
): "improving" | "declining" | "stable" {
  const now = Date.now();
  const agentEvals = evals.filter((e) => e.agent === agent).sort((a, b) => a.ts - b.ts);
  if (agentEvals.length < 4) return "stable";

  const midpoint = now - windowMs / 2;
  const firstHalf = agentEvals.filter((e) => e.ts < midpoint);
  const secondHalf = agentEvals.filter((e) => e.ts >= midpoint);

  if (firstHalf.length === 0 || secondHalf.length === 0) return "stable";

  const firstAvg = firstHalf.reduce((sum, e) => sum + e.quality, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, e) => sum + e.quality, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  if (diff >= 0.3) return "improving";
  if (diff <= -0.3) return "declining";
  return "stable";
}

// ── Main ─────────────────────────────────────────────────────────────

export interface StatusOptions {
  persistDir: string;
  /** Set to false to omit process health section (e.g. in tests). */
  includeProcessHealth?: boolean;
  /** Set to false to omit evaluation sections. */
  includeEvals?: boolean;
}

/**
 * Generate the full status dashboard.
 * Used by `--status` CLI flag.
 */
export function printSystemStatus(persistDir: string, opts?: Partial<StatusOptions>): string {
  const includeProcessHealth = opts?.includeProcessHealth ?? true;
  const includeEvals = opts?.includeEvals ?? true;

  const lines: string[] = [];
  const now = Date.now();
  const nowStr = new Date(now).toISOString().slice(0, 16).replace("T", " ");

  lines.push("");
  lines.push("═".repeat(62));
  lines.push(` may-agent status — ${nowStr} UTC`);
  lines.push("═".repeat(62));

  // ── Load all data ──────────────────────────────────────────────────

  const evals7d = includeEvals ? loadEvals(persistDir, now - WEEK) : [];
  const evals24h = evals7d.filter((e) => e.ts >= now - DAY);
  const evals7dScored = evals7d.filter((e) => e.verdict !== "skipped");
  const evals24hScored = evals24h.filter((e) => e.verdict !== "skipped");
  const humanCounts = loadHumanInputCounts(persistDir, 7);
  const processes = includeProcessHealth ? loadProcessHealth(persistDir) : [];

  // ── Agent completion rates (last 24h) ──────────────────────────────

  let agentStatsRows: Array<{
    agentName: string;
    total: number;
    completed: number;
    failed: number;
    avgDuration: number | null;
  }> = [];

  try {
    const db = getDb(persistDir);
    const cutoff = now - DAY;
    agentStatsRows = db
      .prepare(
        `SELECT agent as agentName,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
                AVG(CASE WHEN endedAt IS NOT NULL AND startedAt IS NOT NULL THEN endedAt - startedAt END) as avgDuration
         FROM sessions
         WHERE startedAt > ?
         GROUP BY agent
         ORDER BY total DESC`,
      )
      .all(cutoff) as unknown as typeof agentStatsRows;
  } catch {
    // DB unavailable — continue with empty stats
  }

  const agentCompletionRates = new Map<string, AgentStats>();
  for (const s of agentStatsRows) {
    agentCompletionRates.set(s.agentName, {
      total: s.total,
      completed: s.completed,
      failed: s.failed,
      avgDuration: s.avgDuration,
    });
  }

  // ── Triage ─────────────────────────────────────────────────────────

  const attention = triageItems(processes, agentCompletionRates, evals24hScored, humanCounts);

  const reds = attention.filter((i) => i.level === "red");
  const yellows = attention.filter((i) => i.level === "yellow");

  if (reds.length > 0) {
    lines.push("");
    lines.push("🔴 ATTENTION");
    for (const item of reds) {
      lines.push(`  • ${item.message}`);
    }
  }

  if (yellows.length > 0) {
    lines.push("");
    lines.push("🟡 WATCH");
    for (const item of yellows) {
      lines.push(`  • ${item.message}`);
    }
  }

  if (reds.length === 0 && yellows.length === 0) {
    lines.push("");
    lines.push("🟢 ALL CLEAR");
    lines.push("  No issues detected");
  }

  // ── Agents table (enhanced) ────────────────────────────────────────

  lines.push("");
  lines.push("─".repeat(62));
  lines.push(" AGENTS (last 24h)");
  lines.push("─".repeat(62));

  if (agentStatsRows.length > 0) {
    // Build per-agent quality from 24h evals (excluding skipped)
    const agentQuality24h = new Map<string, { total: number; count: number }>();
    for (const e of evals24hScored) {
      const entry = agentQuality24h.get(e.agent) ?? { total: 0, count: 0 };
      entry.total += e.quality;
      entry.count++;
      agentQuality24h.set(e.agent, entry);
    }

    lines.push(
      `  ${"Agent".padEnd(14)} ${"Sess".padStart(5)} ${"Done".padStart(5)} ${"Fail".padStart(5)} ${"Rate".padStart(5)} ${"Qual".padStart(5)} ${"Trend".padStart(6)}`,
    );

    for (const s of agentStatsRows) {
      const rate = s.total > 0 ? `${Math.round((s.completed / s.total) * 100)}%` : "—";

      // Quality from 24h evals
      const qEntry = agentQuality24h.get(s.agentName);
      const qualStr = qEntry && qEntry.count > 0 ? `${(qEntry.total / qEntry.count).toFixed(1)}` : "—";

      // Trend from 7d evals (excluding skipped)
      const trend = includeEvals ? trendArrow(computeWindowedTrend(evals7dScored, s.agentName, WEEK)) : "—";

      lines.push(
        `  ${s.agentName.padEnd(14)} ${String(s.total).padStart(5)} ${String(s.completed).padStart(5)} ${String(s.failed).padStart(5)} ${rate.padStart(5)} ${qualStr.padStart(5)} ${trend.padStart(6)}`,
      );
    }
  } else {
    lines.push("  No sessions in the last 24h.");
  }

  // ── Process health ─────────────────────────────────────────────────

  if (includeProcessHealth && processes.length > 0) {
    lines.push("");
    lines.push("─".repeat(62));
    lines.push(" PROCESS HEALTH");
    lines.push("─".repeat(62));
    lines.push(`  ${"Process".padEnd(22)} ${"Last Run".padEnd(12)} ${"Status".padEnd(10)}`);

    for (const proc of processes) {
      const lastRun = proc.lastFire ? ago(proc.lastFire) : "never";
      let status = "—";
      if (proc.lastFire === null) {
        status = "⚠ new";
      } else {
        if (proc.lastStatus === "FAILED") {
          status = "✗ failed";
        } else if (proc.lastStatus === "IN_PROGRESS") {
          status = "⏳ running";
        } else {
          status = "✓ ok";
        }
      }

      lines.push(`  ${proc.name.padEnd(22)} ${lastRun.padEnd(12)} ${status}`);
    }
  }

  // ── Convention compliance ──────────────────────────────────────────

  const conventionSummary = loadConventionSummary(persistDir);
  if (conventionSummary && Array.isArray((conventionSummary as Record<string, unknown>).conventions)) {
    const conventions = (conventionSummary as Record<string, unknown>).conventions as Array<Record<string, unknown>>;
    if (conventions.length > 0) {
      lines.push("");
      lines.push("─".repeat(62));
      lines.push(" CONVENTION COMPLIANCE");
      lines.push("─".repeat(62));
      lines.push(
        `  ${"Convention".padEnd(22)} ${"System".padEnd(8)} ${"Worst Agent".padEnd(18)} ${"Status".padEnd(10)}`,
      );

      for (const c of conventions) {
        const name = typeof c.name === "string" ? c.name : "?";
        const rate = typeof c.systemRate === "number" ? `${Math.round(c.systemRate * 100)}%` : "—";
        const worst =
          typeof c.worstAgent === "string" && typeof c.worstRate === "number"
            ? `${c.worstAgent} ${Math.round((c.worstRate as number) * 100)}%`
            : "—";
        const status = typeof c.status === "string" ? c.status : "—";

        lines.push(
          `  ${truncate(name, 21).padEnd(22)} ${rate.padEnd(8)} ${truncate(worst, 17).padEnd(18)} ${status.padEnd(10)}`,
        );
      }
    }
  }

  // ── Progress (7-day trends) ────────────────────────────────────────

  if (includeEvals || humanCounts.length > 0) {
    lines.push("");
    lines.push("─".repeat(62));
    lines.push(" PROGRESS (7-day)");
    lines.push("─".repeat(62));

    // Human corrections per day
    if (humanCounts.length > 0) {
      const hasAny = humanCounts.some((c) => c > 0);
      if (hasAny) {
        lines.push(`  Human inputs/day:  ${humanCounts.join(" → ")}`);
      }
    }

    // Average quality trend
    if (includeEvals && evals7dScored.length > 0) {
      // Group by day
      const dailyQuality: number[] = [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayMs = startOfToday.getTime();

      for (let d = 6; d >= 0; d--) {
        const dayStart = todayMs - d * DAY;
        const dayEnd = dayStart + DAY;
        const dayEvals = evals7dScored.filter((e) => e.ts >= dayStart && e.ts < dayEnd);
        if (dayEvals.length > 0) {
          const avg = dayEvals.reduce((sum, e) => sum + e.quality, 0) / dayEvals.length;
          dailyQuality.push(Math.round(avg * 10) / 10);
        } else {
          dailyQuality.push(-1); // No data
        }
      }

      const qualStr = dailyQuality.map((q) => (q < 0 ? "—" : q.toFixed(1))).join(" → ");
      lines.push(`  Avg quality/day:   ${qualStr}`);

      // Verdict distribution (24h) — exclude skipped
      const verdictCounts: Record<string, number> = {};
      for (const e of evals24hScored) {
        verdictCounts[e.verdict] = (verdictCounts[e.verdict] ?? 0) + 1;
      }
      const verdictStr = Object.entries(verdictCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([v, c]) => `${c} ${v}`)
        .join(", ");
      if (verdictStr) {
        lines.push(`  Verdicts (24h):    ${verdictStr}`);
      }
    }

    // Coach experiments (from sessions)
    try {
      const db = getDb(persistDir);
      const coachExperimentsRow = db
        .prepare(
          `SELECT COUNT(*) as total
           FROM sessions
           WHERE agent = 'coach'
             AND task LIKE '%growth-cycle%'
             AND startedAt > ?`,
        )
        .get(now - WEEK) as { total: number } | null;
      if (coachExperimentsRow && coachExperimentsRow.total > 0) {
        lines.push(`  Coach growth cycles (7d): ${coachExperimentsRow.total}`);
      }
    } catch {
      // best-effort
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ── Telegram notification ────────────────────────────────────────────

/**
 * Send the status dashboard to Telegram.
 * Used by `--status --notify` CLI flag.
 */
export async function notifyStatus(persistDir: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);

  if (!token || chatIds.length === 0) {
    console.error("[status] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — cannot notify");
    return;
  }

  const status = printSystemStatus(persistDir);
  // Telegram max message length is 4096 chars
  const MAX_LEN = 4000;
  const chunks: string[] = [];
  if (status.length <= MAX_LEN) {
    chunks.push(status);
  } else {
    // Split on section boundaries (double newline before ─ lines)
    let current = "";
    for (const line of status.split("\n")) {
      if (current.length + line.length + 1 > MAX_LEN) {
        chunks.push(current);
        current = "";
      }
      current += (current ? "\n" : "") + line;
    }
    if (current) chunks.push(current);
  }

  for (const chatId of chatIds) {
    for (const chunk of chunks) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: chunk }),
        });
        if (!resp.ok) {
          const body = await resp.text();
          console.error(`[status] Telegram send failed: ${resp.status} ${body}`);
        }
      } catch (err) {
        console.error(`[status] Telegram send error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log(`[status] Sent to ${chatIds.length} Telegram chat(s)`);
}
