/**
 * Daily brief — collects system metrics and produces a summary.
 *
 * Runs as a JS cron handler. Emits the brief as a bus info event
 * which gets forwarded to Telegram.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface DailyBriefOptions {
  persistDir: string;
  agentsRoot: string;
  projectRoot: string;
  cronJobCount: number;
}

interface BriefData {
  date: string;
  sessions24h: number;
  totalSessions: number;
  evaluations: { total: number; recent: EvalSummary[] };
  agents: AgentSummary[];
  commits24h: number;
  testStatus: string;
  topIssue: string;
  cronJobs: number;
}

interface EvalSummary {
  agent: string;
  efficiency: number;
  quality: number;
  verdict: string;
}

interface AgentSummary {
  name: string;
  todoCount: number;
  journalLines: number;
}

export function collectDailyBrief(opts: DailyBriefOptions): string {
  const { persistDir, agentsRoot, projectRoot, cronJobCount } = opts;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // 1. Session counts
  const sessionsDir = join(persistDir, "sessions");
  let totalSessions = 0;
  let sessions24h = 0;
  try {
    const dirs = readdirSync(sessionsDir, { withFileTypes: true }).filter(d => d.isDirectory());
    totalSessions = dirs.length;
    for (const d of dirs) {
      try {
        const stat = statSync(join(sessionsDir, d.name));
        if (stat.mtimeMs > oneDayAgo) sessions24h++;
      } catch { /* skip */ }
    }
  } catch { /* no sessions dir */ }

  // 2. Recent evaluations (last 24h)
  const evalsDir = join(persistDir, "evaluations");
  const recentEvals: EvalSummary[] = [];
  let totalEvals = 0;
  try {
    const files = readdirSync(evalsDir).filter(f => f.endsWith(".json"));
    totalEvals = files.length;
    for (const f of files) {
      try {
        const fpath = join(evalsDir, f);
        const stat = statSync(fpath);
        if (stat.mtimeMs > oneDayAgo) {
          const data = JSON.parse(readFileSync(fpath, "utf-8"));
          if (data.efficiency !== undefined && data.quality !== undefined) {
            recentEvals.push({
              agent: data.agent || "unknown",
              efficiency: data.efficiency,
              quality: data.quality,
              verdict: data.verdict || "unknown",
            });
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* no evals dir */ }

  // 3. Agent workspace status
  const agentSummaries: AgentSummary[] = [];
  try {
    const agentDirs = readdirSync(agentsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== "shared");
    for (const d of agentDirs) {
      const todoPath = join(agentsRoot, d.name, "workspace", "todo.md");
      const journalPath = join(agentsRoot, d.name, "workspace", "journal.md");
      let todoCount = 0;
      let journalLines = 0;
      try {
        if (existsSync(todoPath)) {
          const content = readFileSync(todoPath, "utf-8");
          const todoSection = content.split("# Tracking")[0]; // only count items before Tracking
          todoCount = (todoSection.match(/^- \[ \]/gm) || []).length;
        }
      } catch { /* skip */ }
      try {
        if (existsSync(journalPath)) {
          journalLines = readFileSync(journalPath, "utf-8").split("\n").length;
        }
      } catch { /* skip */ }
      if (todoCount > 0 || journalLines > 0) {
        agentSummaries.push({ name: d.name, todoCount, journalLines });
      }
    }
  } catch { /* skip */ }

  // 4. Git commits in last 24h
  let commits24h = 0;
  try {
    const { execSync } = require("node:child_process");
    const out = execSync("git log --since='24 hours ago' --oneline 2>/dev/null | wc -l", {
      cwd: projectRoot,
      encoding: "utf-8",
    });
    commits24h = parseInt(out.trim()) || 0;
  } catch { /* skip */ }

  // 5. Top issue from bob's analysis
  let topIssue = "No analysis available";
  try {
    const analysisPath = join(agentsRoot, "bob", "workspace", "analysis.md");
    if (existsSync(analysisPath)) {
      const content = readFileSync(analysisPath, "utf-8");
      // Extract first pattern/finding
      const match = content.match(/##\s+(?:Top|#1|1\.).*?\n\n(.*?)(?:\n\n|\n##)/s);
      if (match) {
        topIssue = match[1].split("\n")[0].trim().substring(0, 120);
      } else {
        // Try executive summary
        const summaryMatch = content.match(/##\s+Executive Summary\s*\n\n(.*?)(?:\n\n)/s);
        if (summaryMatch) {
          topIssue = summaryMatch[1].trim().substring(0, 120);
        }
      }
    }
  } catch { /* skip */ }

  // 6. Aggregate eval scores
  const avgEff = recentEvals.length > 0
    ? recentEvals.reduce((s, e) => s + e.efficiency, 0) / recentEvals.length
    : 0;
  const avgQual = recentEvals.length > 0
    ? recentEvals.reduce((s, e) => s + e.quality, 0) / recentEvals.length
    : 0;

  // Agent score breakdown
  const agentScores = new Map<string, { eff: number[]; qual: number[] }>();
  for (const e of recentEvals) {
    if (!agentScores.has(e.agent)) agentScores.set(e.agent, { eff: [], qual: [] });
    agentScores.get(e.agent)!.eff.push(e.efficiency);
    agentScores.get(e.agent)!.qual.push(e.quality);
  }

  // Format the brief
  const dateStr = new Date().toISOString().split("T")[0];
  const lines: string[] = [];

  lines.push(`📊 *Daily Brief — ${dateStr}*`);
  lines.push(``);

  // Activity
  lines.push(`*Activity*`);
  lines.push(`• Sessions: ${sessions24h} today / ${totalSessions} total`);
  lines.push(`• Commits: ${commits24h} in last 24h`);
  lines.push(`• Evaluations: ${recentEvals.length} new / ${totalEvals} total`);
  lines.push(`• Cron jobs: ${cronJobCount} active`);
  lines.push(``);

  // Scores
  if (recentEvals.length > 0) {
    lines.push(`*Scores (24h avg)*`);
    lines.push(`• Efficiency: ${(avgEff * 100).toFixed(0)}% | Quality: ${(avgQual * 100).toFixed(0)}%`);

    // Per-agent breakdown
    for (const [agent, scores] of agentScores) {
      const e = scores.eff.reduce((a, b) => a + b, 0) / scores.eff.length;
      const q = scores.qual.reduce((a, b) => a + b, 0) / scores.qual.length;
      const icon = e >= 0.7 && q >= 0.7 ? "🟢" : e >= 0.5 && q >= 0.5 ? "🟡" : "🔴";
      lines.push(`  ${icon} ${agent}: eff ${(e * 100).toFixed(0)}% / qual ${(q * 100).toFixed(0)}% (${scores.eff.length} sessions)`);
    }
    lines.push(``);
  }

  // Agent backlogs
  const withTodos = agentSummaries.filter(a => a.todoCount > 0).sort((a, b) => b.todoCount - a.todoCount);
  if (withTodos.length > 0) {
    lines.push(`*Backlogs*`);
    for (const a of withTodos) {
      lines.push(`• ${a.name}: ${a.todoCount} pending`);
    }
    lines.push(``);
  }

  // Top issue
  lines.push(`*Top Issue*`);
  lines.push(`${topIssue}`);

  return lines.join("\n");
}
