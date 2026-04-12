/**
 * Analyze-failures — agent-owned cron handler.
 *
 * Replaces the LLM-based Bob analysis session (~11 ops/run, 78 ops/week)
 * with a pure JS handler that queries evaluations from SQLite, computes
 * verdict distributions, per-agent breakdowns, cost analysis, and trends,
 * then writes a structured report to agents/bob/workspace/analysis.md.
 *
 * Zero LLM cost. Runs daily.
 *
 * Exports create() conforming to HandlerModule.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const report = generateFailureAnalysis(ctx.getDb(), ctx.agentsRoot);
    const outPath = join(ctx.agentsRoot, "bob", "workspace", "analysis.md");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, report, "utf-8");
    ctx.log("[cron:analyze-failures] Analysis written to agents/bob/workspace/analysis.md");
  };
};

// ── Types ─────────────────────────────────────────────────────────────

interface EvalRow {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string;
  overall: string;
  usage: string;
  failureChains: string;
  evaluatedByHeuristic: number;
  createdAt: number;
}

interface SessionRow {
  sessionId: string;
  agent: string;
  status: string;
  opCount: number;
  startedAt: number;
  endedAt: number;
}

interface AgentBreakdown {
  agent: string;
  total: number;
  good: number;
  acceptable: number;
  needsImprovement: number;
  poor: number;
  skipped: number;
  goodRate: number;
  avgQuality: number;
  avgEfficiency: number;
  totalCost: number;
  avgCost: number;
  errorSessions: number;
  errorRate: number;
}

// ── Pure logic ────────────────────────────────────────────────────────

export function generateFailureAnalysis(
  db: { prepare: (sql: string) => { all: (...args: any[]) => any[] } },
  agentsRoot: string,
): string {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const twoDaysAgo = now - 48 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // 1. Load evaluations for last 24h and previous 24h
  const recentEvals: EvalRow[] = db.prepare(
    `SELECT * FROM evaluations WHERE createdAt > ? ORDER BY createdAt DESC`
  ).all(oneDayAgo);

  const prevEvals: EvalRow[] = db.prepare(
    `SELECT * FROM evaluations WHERE createdAt > ? AND createdAt <= ? ORDER BY createdAt DESC`
  ).all(twoDaysAgo, oneDayAgo);

  const weekEvals: EvalRow[] = db.prepare(
    `SELECT * FROM evaluations WHERE createdAt > ? ORDER BY createdAt DESC`
  ).all(oneWeekAgo);

  // 2. Load session data for correlation
  const recentSessions: SessionRow[] = db.prepare(
    `SELECT sessionId, agent, status, opCount, startedAt, endedAt FROM sessions WHERE startedAt > ?`
  ).all(oneDayAgo);

  const prevSessions: SessionRow[] = db.prepare(
    `SELECT sessionId, agent, status, opCount, startedAt, endedAt FROM sessions WHERE startedAt > ? AND startedAt <= ?`
  ).all(twoDaysAgo, oneDayAgo);

  // 3. Compute verdict distributions
  const recentVerdicts = countVerdicts(recentEvals);
  const prevVerdicts = countVerdicts(prevEvals);

  // 4. Compute per-agent breakdowns
  const agentBreakdowns = computeAgentBreakdowns(recentEvals, recentSessions);

  // 5. Compute cost analysis
  const costAnalysis = computeCostAnalysis(recentEvals, recentSessions);

  // 6. Compute 6-hour trend
  const sixHourTrend = compute6HourTrend(recentEvals, now);

  // 7. 7-day trend
  const weeklyTrend = computeWeeklyTrend(weekEvals, now);

  // 8. Top failure patterns (from issues/failureChains)
  const topIssues = computeTopIssues(recentEvals);

  // 9. Format report
  return formatReport({
    now,
    recentEvals,
    prevEvals,
    recentVerdicts,
    prevVerdicts,
    agentBreakdowns,
    costAnalysis,
    sixHourTrend,
    weeklyTrend,
    topIssues,
    recentSessions,
    prevSessions,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function countVerdicts(evals: EvalRow[]): Record<string, number> {
  const counts: Record<string, number> = {
    good: 0, acceptable: 0, needs_improvement: 0, poor: 0, skipped: 0, other: 0,
  };
  for (const e of evals) {
    const v = e.verdict || "other";
    if (v in counts) counts[v]++;
    else counts.other++;
  }
  return counts;
}

function computeAgentBreakdowns(evals: EvalRow[], sessions: SessionRow[]): AgentBreakdown[] {
  const byAgent = new Map<string, EvalRow[]>();
  for (const e of evals) {
    if (!byAgent.has(e.agent)) byAgent.set(e.agent, []);
    byAgent.get(e.agent)!.push(e);
  }

  // Session error counts
  const errorsByAgent = new Map<string, number>();
  const totalByAgent = new Map<string, number>();
  for (const s of sessions) {
    totalByAgent.set(s.agent, (totalByAgent.get(s.agent) || 0) + 1);
    if (s.status === "error") {
      errorsByAgent.set(s.agent, (errorsByAgent.get(s.agent) || 0) + 1);
    }
  }

  const breakdowns: AgentBreakdown[] = [];
  for (const [agent, agentEvals] of byAgent) {
    const good = agentEvals.filter(e => e.verdict === "good").length;
    const acceptable = agentEvals.filter(e => e.verdict === "acceptable").length;
    const ni = agentEvals.filter(e => e.verdict === "needs_improvement").length;
    const poor = agentEvals.filter(e => e.verdict === "poor").length;
    const skipped = agentEvals.filter(e => e.verdict === "skipped" || e.evaluatedByHeuristic === -1).length;
    const nonSkipped = agentEvals.length - skipped;

    let totalCost = 0;
    for (const e of agentEvals) {
      totalCost += parseCost(e.usage);
    }

    breakdowns.push({
      agent,
      total: agentEvals.length,
      good,
      acceptable,
      needsImprovement: ni,
      poor,
      skipped,
      goodRate: nonSkipped > 0 ? good / nonSkipped : 0,
      avgQuality: avg(agentEvals.map(e => e.quality)),
      avgEfficiency: avg(agentEvals.map(e => e.efficiency)),
      totalCost,
      avgCost: agentEvals.length > 0 ? totalCost / agentEvals.length : 0,
      errorSessions: errorsByAgent.get(agent) || 0,
      errorRate: (totalByAgent.get(agent) || 0) > 0
        ? (errorsByAgent.get(agent) || 0) / (totalByAgent.get(agent) || 0)
        : 0,
    });
  }

  breakdowns.sort((a, b) => b.total - a.total);
  return breakdowns;
}

function computeCostAnalysis(evals: EvalRow[], sessions: SessionRow[]) {
  let totalCost = 0;
  let goodCost = 0;
  let errorCost = 0;
  let goodCount = 0;
  let errorCount = 0;

  const sessionStatuses = new Map<string, string>();
  for (const s of sessions) sessionStatuses.set(s.sessionId, s.status);

  for (const e of evals) {
    const cost = parseCost(e.usage);
    totalCost += cost;
    const status = sessionStatuses.get(e.sessionId);
    if (e.verdict === "good") {
      goodCost += cost;
      goodCount++;
    } else if (status === "error") {
      errorCost += cost;
      errorCount++;
    }
  }

  return { totalCost, goodCost, errorCost, goodCount, errorCount };
}

function compute6HourTrend(evals: EvalRow[], now: number) {
  const windows = [
    { label: "0-6h ago", start: now - 6 * 3600000, end: now },
    { label: "6-12h ago", start: now - 12 * 3600000, end: now - 6 * 3600000 },
    { label: "12-18h ago", start: now - 18 * 3600000, end: now - 12 * 3600000 },
    { label: "18-24h ago", start: now - 24 * 3600000, end: now - 18 * 3600000 },
  ];

  return windows.map(w => {
    const wEvals = evals.filter(e => e.createdAt > w.start && e.createdAt <= w.end);
    const nonSkipped = wEvals.filter(e => e.verdict !== "skipped");
    const good = nonSkipped.filter(e => e.verdict === "good").length;
    return {
      label: w.label,
      total: nonSkipped.length,
      good,
      goodRate: nonSkipped.length > 0 ? good / nonSkipped.length : 0,
    };
  });
}

function computeWeeklyTrend(evals: EvalRow[], now: number) {
  const days: { label: string; goodRate: number; total: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const dayStart = now - (d + 1) * 86400000;
    const dayEnd = now - d * 86400000;
    const dayEvals = evals.filter(e => e.createdAt > dayStart && e.createdAt <= dayEnd);
    const nonSkipped = dayEvals.filter(e => e.verdict !== "skipped");
    const good = nonSkipped.filter(e => e.verdict === "good").length;
    const date = new Date(dayEnd).toISOString().split("T")[0];
    days.push({
      label: date,
      total: nonSkipped.length,
      goodRate: nonSkipped.length > 0 ? good / nonSkipped.length : 0,
    });
  }
  return days;
}

function computeTopIssues(evals: EvalRow[]) {
  const issueCounts = new Map<string, number>();
  for (const e of evals) {
    try {
      const issues: string[] = JSON.parse(e.issues || "[]");
      for (const issue of issues) {
        issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
      }
    } catch { /* skip */ }
    try {
      const chains: unknown[] = JSON.parse(e.failureChains || "[]");
      for (const chain of chains) {
        // Chains are objects with trigger/recovery info — extract a useful label
        if (typeof chain === "string") {
          issueCounts.set(`chain:${chain}`, (issueCounts.get(`chain:${chain}`) || 0) + 1);
        } else if (chain && typeof chain === "object") {
          const c = chain as Record<string, any>;
          const tool = c.trigger?.tool || "unknown";
          const isError = c.trigger?.isError ? "error" : "ok";
          const key = `chain:${tool}:${isError}`;
          issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
        }
      }
    } catch { /* skip */ }
  }

  return [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([issue, count]) => ({ issue, count }));
}

function parseCost(usageJson: string): number {
  try {
    const usage = JSON.parse(usageJson || "{}");
    return usage.cost || 0;
  } catch {
    return 0;
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function dollar(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ── Report formatting ─────────────────────────────────────────────────

function formatReport(data: {
  now: number;
  recentEvals: EvalRow[];
  prevEvals: EvalRow[];
  recentVerdicts: Record<string, number>;
  prevVerdicts: Record<string, number>;
  agentBreakdowns: AgentBreakdown[];
  costAnalysis: { totalCost: number; goodCost: number; errorCost: number; goodCount: number; errorCount: number };
  sixHourTrend: { label: string; total: number; good: number; goodRate: number }[];
  weeklyTrend: { label: string; goodRate: number; total: number }[];
  topIssues: { issue: string; count: number }[];
  recentSessions: SessionRow[];
  prevSessions: SessionRow[];
}): string {
  const { recentVerdicts: rv, prevVerdicts: pv, agentBreakdowns, costAnalysis, sixHourTrend, weeklyTrend, topIssues } = data;
  const dateStr = new Date(data.now).toISOString().split("T")[0];
  const timeStr = new Date(data.now).toISOString().slice(11, 16);

  const nonSkippedRecent = data.recentEvals.filter(e => e.verdict !== "skipped").length;
  const nonSkippedPrev = data.prevEvals.filter(e => e.verdict !== "skipped").length;
  const goodRate = nonSkippedRecent > 0 ? rv.good / nonSkippedRecent : 0;
  const prevGoodRate = nonSkippedPrev > 0 ? pv.good / nonSkippedPrev : 0;
  const goodRateDelta = goodRate - prevGoodRate;

  const sessionsByStatus = new Map<string, number>();
  for (const s of data.recentSessions) {
    sessionsByStatus.set(s.status, (sessionsByStatus.get(s.status) || 0) + 1);
  }

  const lines: string[] = [];

  // Header
  lines.push(`# Analysis: System Failure Patterns (${dateStr})`);
  lines.push(``);
  lines.push(`> Auto-generated by analyze-failures JS handler at ${timeStr} UTC`);
  lines.push(``);

  // Executive Summary
  lines.push(`## 1. Executive Summary`);
  lines.push(``);
  lines.push(`**Good rate (24h): ${pct(goodRate)} (${rv.good}/${nonSkippedRecent} non-skipped)**${
    goodRateDelta !== 0
      ? ` — ${goodRateDelta > 0 ? "up" : "down"} from ${pct(prevGoodRate)} (prev 24h), ${goodRateDelta > 0 ? "+" : ""}${(goodRateDelta * 100).toFixed(1)}pp`
      : ""
  }`);
  lines.push(``);

  // Session overview
  const totalSessions = data.recentSessions.length;
  const prevTotalSessions = data.prevSessions.length;
  lines.push(`**Sessions (24h):** ${totalSessions} (prev: ${prevTotalSessions})`);
  const statusParts: string[] = [];
  for (const [status, count] of [...sessionsByStatus.entries()].sort((a, b) => b[1] - a[1])) {
    statusParts.push(`${status}: ${count}`);
  }
  if (statusParts.length > 0) lines.push(`Status breakdown: ${statusParts.join(", ")}`);
  lines.push(``);

  // Cost summary
  lines.push(`**Cost (24h):** ${dollar(costAnalysis.totalCost)} total — good sessions: ${dollar(costAnalysis.goodCost)}, error sessions: ${dollar(costAnalysis.errorCost)}`);
  if (costAnalysis.totalCost > 0) {
    const wasteRate = costAnalysis.errorCost / costAnalysis.totalCost;
    lines.push(`Cost waste rate: ${pct(wasteRate)} of spend on error sessions`);
  }
  lines.push(``);

  // Verdict Distribution
  lines.push(`## 2. Verdict Distribution (24h)`);
  lines.push(``);
  lines.push(`| Verdict | Count | % | Prev 24h | Change |`);
  lines.push(`|---------|-------|---|----------|--------|`);
  for (const v of ["good", "acceptable", "needs_improvement", "poor", "skipped"] as const) {
    const count = rv[v] || 0;
    const prevCount = pv[v] || 0;
    const rate = data.recentEvals.length > 0 ? count / data.recentEvals.length : 0;
    const prevRate = data.prevEvals.length > 0 ? prevCount / data.prevEvals.length : 0;
    const delta = rate - prevRate;
    const deltaStr = delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`;
    lines.push(`| ${v} | ${count} | ${pct(rate)} | ${prevCount} | ${deltaStr} |`);
  }
  lines.push(``);

  // Per-Agent Breakdown
  lines.push(`## 3. Per-Agent Breakdown`);
  lines.push(``);
  lines.push(`| Agent | Total | Good | Acc | NI | Good% | Avg Q | Avg Eff | Cost | Error% |`);
  lines.push(`|-------|-------|------|-----|----|-------|-------|---------|------|--------|`);
  for (const a of agentBreakdowns) {
    lines.push(
      `| ${a.agent} | ${a.total} | ${a.good} | ${a.acceptable} | ${a.needsImprovement} | ${pct(a.goodRate)} | ${a.avgQuality.toFixed(1)} | ${a.avgEfficiency.toFixed(1)} | ${dollar(a.totalCost)} | ${pct(a.errorRate)} |`
    );
  }
  lines.push(``);

  // 6-Hour Trend
  lines.push(`## 4. 6-Hour Trend`);
  lines.push(``);
  lines.push(`| Window | Sessions | Good | Good% |`);
  lines.push(`|--------|----------|------|-------|`);
  for (const w of sixHourTrend) {
    const flag = w.goodRate < 0.4 && w.total >= 3 ? " ⚠️" : "";
    lines.push(`| ${w.label} | ${w.total} | ${w.good} | ${pct(w.goodRate)}${flag} |`);
  }
  lines.push(``);

  // 7-Day Trend
  lines.push(`## 5. 7-Day Trend`);
  lines.push(``);
  lines.push(`| Date | Sessions | Good% |`);
  lines.push(`|------|----------|-------|`);
  for (const d of weeklyTrend) {
    if (d.total === 0) continue;
    lines.push(`| ${d.label} | ${d.total} | ${pct(d.goodRate)} |`);
  }
  lines.push(``);

  // Top Issues
  if (topIssues.length > 0) {
    lines.push(`## 6. Top Failure Patterns`);
    lines.push(``);
    for (const { issue, count } of topIssues) {
      lines.push(`- **${issue}** — ${count} occurrences`);
    }
    lines.push(``);
  }

  // Recommendations (automated heuristics)
  lines.push(`## 7. Automated Observations`);
  lines.push(``);
  const observations: string[] = [];

  if (goodRate < 0.5) {
    observations.push(`⚠️ Good rate below 50% (${pct(goodRate)}) — system quality is degraded`);
  }
  if (goodRateDelta < -0.1 && nonSkippedPrev >= 5) {
    observations.push(`📉 Good rate dropped ${(-goodRateDelta * 100).toFixed(1)}pp vs previous 24h`);
  }
  if (goodRateDelta > 0.1 && nonSkippedPrev >= 5) {
    observations.push(`📈 Good rate improved ${(goodRateDelta * 100).toFixed(1)}pp vs previous 24h`);
  }
  if (costAnalysis.totalCost > 0 && costAnalysis.errorCost / costAnalysis.totalCost > 0.5) {
    observations.push(`💸 Error sessions consuming ${pct(costAnalysis.errorCost / costAnalysis.totalCost)} of total cost (${dollar(costAnalysis.errorCost)})`);
  }

  // Agent-specific alerts
  for (const a of agentBreakdowns) {
    if (a.errorRate > 0.7 && a.total >= 3) {
      observations.push(`🔴 ${a.agent}: ${pct(a.errorRate)} error rate (${a.errorSessions} errors)`);
    }
    if (a.needsImprovement > 0) {
      observations.push(`⚠️ ${a.agent}: ${a.needsImprovement} needs_improvement verdict(s)`);
    }
  }

  // 6h deterioration
  if (sixHourTrend.length >= 2 && sixHourTrend[0].total >= 3 && sixHourTrend[1].total >= 3) {
    if (sixHourTrend[0].goodRate < sixHourTrend[1].goodRate - 0.15) {
      observations.push(`📉 Recent 6h window deteriorating: ${pct(sixHourTrend[0].goodRate)} vs ${pct(sixHourTrend[1].goodRate)} previous`);
    }
  }

  if (observations.length === 0) {
    observations.push("✅ No anomalies detected — system operating normally");
  }

  for (const obs of observations) {
    lines.push(`- ${obs}`);
  }
  lines.push(``);

  // Signature
  lines.push(`[SIG: ${Date.now()}:analyze-failures-handler]`);
  lines.push(``);

  return lines.join("\n");
}
