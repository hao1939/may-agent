/**
 * Coaching report — agent-owned cron handler.
 *
 * Produces a daily summary of agent quality scores, trends, and
 * coaching effectiveness. Pure JS — no LLM needed.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";
// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const report = collectCoachingReport({
      persistDir: ctx.persistDir,
      agentsRoot: ctx.agentsRoot,
      getDb: ctx.getDb,
    });
    ctx.log(report);
  };
};

// ── Types ─────────────────────────────────────────────────────────────

export interface CoachingReportOptions {
  persistDir: string;
  agentsRoot: string;
  getDb: () => { exec: (sql: string) => void; prepare: (sql: string) => any; run: (sql: string, params?: unknown[]) => any; close: () => void };
}

interface EvalRecord {
  sessionId: string;
  agent: string;
  efficiency: number;
  quality: number;
  verdict: string;
  timestamp: number; // file mtime
}

interface AgentStats {
  name: string;
  total: number;
  recent: number; // last 24h
  avgQuality: number;
  avgEfficiency: number;
  recentAvgQuality: number;
  recentAvgEfficiency: number;
  goodCount: number;
  needsImprovementCount: number;
  trend: "improving" | "stable" | "regressing" | "new";
}

// ── Pure logic ────────────────────────────────────────────────────────

export function collectCoachingReport(opts: CoachingReportOptions): string {
  const { persistDir, agentsRoot } = opts;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // 1. Load all evaluations
  const evalsDir = join(persistDir, "evaluations");
  const allEvals: EvalRecord[] = [];
  try {
    for (const f of readdirSync(evalsDir).filter(f => f.endsWith(".json"))) {
      try {
        const fpath = join(evalsDir, f);
        const stat = statSync(fpath);
        const data = JSON.parse(readFileSync(fpath, "utf-8"));
        if (data.efficiency !== undefined && data.quality !== undefined && data.agent) {
          allEvals.push({
            sessionId: f.replace(".json", ""),
            agent: data.agent,
            efficiency: data.efficiency,
            quality: data.quality,
            verdict: data.verdict || "unknown",
            timestamp: stat.mtimeMs,
          });
        }
      } catch { /* best-effort */ }
    }
  } catch { /* best-effort */ }

  if (allEvals.length === 0) {
    return "📋 *Coaching Report* — No evaluations found.";
  }

  // Sort by timestamp
  allEvals.sort((a, b) => a.timestamp - b.timestamp);

  // 2. Group by agent
  const byAgent = new Map<string, EvalRecord[]>();
  for (const e of allEvals) {
    if (!byAgent.has(e.agent)) byAgent.set(e.agent, []);
    byAgent.get(e.agent)!.push(e);
  }

  // 3. Compute per-agent stats
  const agentStats: AgentStats[] = [];
  for (const [name, evals] of byAgent) {
    const recent = evals.filter(e => e.timestamp > oneDayAgo);
    const older = evals.filter(e => e.timestamp <= oneWeekAgo);
    const recentWeek = evals.filter(e => e.timestamp > oneWeekAgo);

    const avg = (arr: EvalRecord[], key: "quality" | "efficiency") =>
      arr.length > 0 ? arr.reduce((s, e) => s + e[key], 0) / arr.length : 0;

    const avgQuality = avg(evals, "quality");
    const avgEfficiency = avg(evals, "efficiency");
    const recentAvgQuality = recent.length > 0 ? avg(recent, "quality") : avgQuality;
    const recentAvgEfficiency = recent.length > 0 ? avg(recent, "efficiency") : avgEfficiency;

    // Trend: compare last week's avg quality to older avg
    let trend: AgentStats["trend"] = "stable";
    if (older.length >= 3 && recentWeek.length >= 2) {
      const olderAvgQ = avg(older, "quality");
      const recentWeekAvgQ = avg(recentWeek, "quality");
      const delta = recentWeekAvgQ - olderAvgQ;
      if (delta > 0.1) trend = "improving";
      else if (delta < -0.1) trend = "regressing";
    } else if (evals.length < 5) {
      trend = "new";
    }

    agentStats.push({
      name,
      total: evals.length,
      recent: recent.length,
      avgQuality,
      avgEfficiency,
      recentAvgQuality,
      recentAvgEfficiency,
      goodCount: evals.filter(e => e.verdict === "good" || e.verdict === "excellent").length,
      needsImprovementCount: evals.filter(e => e.verdict === "needs_improvement").length,
      trend,
    });
  }

  // Sort: worst quality first (these need the most coaching attention)
  agentStats.sort((a, b) => a.avgQuality - b.avgQuality);

  // 4. System-wide stats
  const systemAvgQ = allEvals.reduce((s, e) => s + e.quality, 0) / allEvals.length;
  const systemAvgE = allEvals.reduce((s, e) => s + e.efficiency, 0) / allEvals.length;
  const recentAll = allEvals.filter(e => e.timestamp > oneDayAgo);
  const recentAvgQ = recentAll.length > 0 ? recentAll.reduce((s, e) => s + e.quality, 0) / recentAll.length : 0;
  const recentAvgE = recentAll.length > 0 ? recentAll.reduce((s, e) => s + e.efficiency, 0) / recentAll.length : 0;

  // 5. Coaching pending count from DB
  let coachTodoCount = 0;
  try {
    const db = opts.getDb();
    const row = db.prepare("SELECT COUNT(*) as cnt FROM requests WHERE toAgent = 'coach' AND status IN ('CREATED','IN_PROGRESS') AND method = 'send'").get() as { cnt: number } | null;
    coachTodoCount = row?.cnt ?? 0;
  } catch { /* best-effort — DB may not be available */ }

  // 6. Format report
  const dateStr = new Date().toISOString().split("T")[0];
  const lines: string[] = [];

  lines.push(`📋 *Coaching Report — ${dateStr}*`, ``);

  // System summary
  lines.push(`*System Overview*`);
  lines.push(`• ${allEvals.length} total evaluations across ${byAgent.size} agents`);
  if (recentAll.length > 0) {
    lines.push(`• Last 24h: ${recentAll.length} evals — quality ${pct(recentAvgQ)} / efficiency ${pct(recentAvgE)}`);
  }
  lines.push(`• All-time: quality ${pct(systemAvgQ)} / efficiency ${pct(systemAvgE)}`);
  lines.push(`• Coach backlog: ${coachTodoCount} pending items`);
  lines.push(``);

  // Per-agent breakdown
  lines.push(`*Per-Agent Scores* (sorted by quality, worst first)`);
  for (const s of agentStats) {
    const trendIcon = s.trend === "improving" ? "📈"
      : s.trend === "regressing" ? "📉"
      : s.trend === "new" ? "🆕"
      : "➡️";
    const statusIcon = s.avgQuality >= 0.7 ? "🟢"
      : s.avgQuality >= 0.5 ? "🟡"
      : "🔴";

    lines.push(`${statusIcon} *${s.name}* ${trendIcon}`);
    lines.push(`  quality ${pct(s.avgQuality)} / eff ${pct(s.avgEfficiency)} (${s.total} evals)`);
    if (s.recent > 0) {
      lines.push(`  24h: quality ${pct(s.recentAvgQuality)} / eff ${pct(s.recentAvgEfficiency)} (${s.recent} evals)`);
    }
    const niRate = s.total > 0 ? Math.round(s.needsImprovementCount / s.total * 100) : 0;
    lines.push(`  good: ${s.goodCount} | needs_improvement: ${s.needsImprovementCount} (${niRate}%)`);
  }
  lines.push(``);

  // Agents needing attention (>50% needs_improvement rate)
  const needsAttention = agentStats.filter(s => s.total >= 3 && s.needsImprovementCount / s.total > 0.5);
  if (needsAttention.length > 0) {
    lines.push(`*Needs Attention* (>50% needs_improvement rate)`);
    for (const s of needsAttention) {
      const niRate = Math.round(s.needsImprovementCount / s.total * 100);
      lines.push(`• ${s.name}: ${niRate}% failure rate across ${s.total} sessions`);
    }
    lines.push(``);
  }

  // Improving agents
  const improving = agentStats.filter(s => s.trend === "improving");
  if (improving.length > 0) {
    lines.push(`*Improving*`);
    for (const s of improving) {
      lines.push(`• ${s.name}: quality ${pct(s.avgQuality)} (trending up)`);
    }
    lines.push(``);
  }

  // Regressing agents
  const regressing = agentStats.filter(s => s.trend === "regressing");
  if (regressing.length > 0) {
    lines.push(`*Regressing*`);
    for (const s of regressing) {
      lines.push(`• ${s.name}: quality ${pct(s.avgQuality)} (trending down)`);
    }
  }

  return lines.join("\n");
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
