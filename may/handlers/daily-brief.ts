/**
 * Daily brief — agent-owned cron handler.
 *
 * Collects system metrics and produces a formatted summary.
 * Emits the brief as a bus event (forwarded to Telegram).
 *
 * Exports create() conforming to HandlerModule.
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async () => {
    const brief = collectDailyBrief({
      persistDir: ctx.persistDir,
      agentsRoot: ctx.agentsRoot,
      projectRoot: ctx.projectRoot,
      getDb: ctx.getDb,
    });
    ctx.notify(brief);
  };
};

// ── Pure logic ────────────────────────────────────────────────────────

export interface DailyBriefOptions {
  persistDir: string;
  agentsRoot: string;
  projectRoot: string;
  getDb: () => { exec: (sql: string) => void; prepare: (sql: string) => any; run: (sql: string, params?: unknown[]) => any; close: () => void };
}

interface EvalSummary { agent: string; efficiency: number; quality: number; verdict: string; }
interface AgentSummary { name: string; todoCount: number; journalLines: number; }

export function collectDailyBrief(opts: DailyBriefOptions): string {
  const { persistDir, agentsRoot, projectRoot } = opts;
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // 1. Session counts
  const sessionsDir = join(persistDir, "sessions");
  let totalSessions = 0, sessions24h = 0;
  try {
    const dirs = readdirSync(sessionsDir, { withFileTypes: true }).filter(d => d.isDirectory());
    totalSessions = dirs.length;
    for (const d of dirs) {
      try { if (statSync(join(sessionsDir, d.name)).mtimeMs > oneDayAgo) sessions24h++; } catch { /* best-effort */ }
    }
  } catch { /* best-effort */ }

  // 2. Recent evaluations
  const evalsDir = join(persistDir, "evaluations");
  const recentEvals: EvalSummary[] = [];
  let totalEvals = 0;
  try {
    const files = readdirSync(evalsDir).filter(f => f.endsWith(".json"));
    totalEvals = files.length;
    for (const f of files) {
      try {
        const fpath = join(evalsDir, f);
        if (statSync(fpath).mtimeMs > oneDayAgo) {
          const data = JSON.parse(readFileSync(fpath, "utf-8"));
          if (data.efficiency !== undefined && data.quality !== undefined) {
            recentEvals.push({ agent: data.agent || "unknown", efficiency: data.efficiency, quality: data.quality, verdict: data.verdict || "unknown" });
          }
        }
      } catch { /* best-effort */ }
    }
  } catch { /* best-effort */ }

  // 3. Agent pending task counts (from DB)
  const agentSummaries: AgentSummary[] = [];
  try {
    const db = opts.getDb();
    const rows = db
      .prepare(
        `SELECT toAgent, COUNT(*) as count FROM requests
         WHERE status IN ('CREATED', 'IN_PROGRESS') AND method = 'send'
         GROUP BY toAgent`
      )
      .all() as { toAgent: string; count: number }[];
    for (const row of rows) {
      if (row.toAgent !== "shared") {
        agentSummaries.push({ name: row.toAgent, todoCount: row.count, journalLines: 0 });
      }
    }
  } catch { /* best-effort */ }

  // 4. Git commits
  let commits24h = 0;
  try { commits24h = parseInt(execSync("git log --since='24 hours ago' --oneline 2>/dev/null | wc -l", { cwd: projectRoot, encoding: "utf-8" }).trim()) || 0; } catch { /* best-effort */ }

  // 5. Cron job count (from actual cron.json)
  let cronJobCount = 0;
  try {
    const cronPath = join(agentsRoot, "may", "cron.json");
    const cronEntries = JSON.parse(readFileSync(cronPath, "utf-8")) as unknown[];
    cronJobCount = cronEntries.length;
  } catch { /* best-effort */ }

  // 6. Top issue
  let topIssue = "No analysis available";
  try {
    const analysisPath = join(agentsRoot, "bob", "workspace", "analysis.md");
    if (existsSync(analysisPath)) {
      const content = readFileSync(analysisPath, "utf-8");
      const match = content.match(/##\s+(?:Top|#1|1\.).*?\n\n(.*?)(?:\n\n|\n##)/s);
      if (match) topIssue = match[1].split("\n")[0].trim().substring(0, 120);
      else { const sm = content.match(/##\s+Executive Summary\s*\n\n(.*?)(?:\n\n)/s); if (sm) topIssue = sm[1].trim().substring(0, 120); }
    }
  } catch { /* best-effort */ }

  // 7. Aggregate scores
  const avgEff = recentEvals.length > 0 ? recentEvals.reduce((s, e) => s + e.efficiency, 0) / recentEvals.length : 0;
  const avgQual = recentEvals.length > 0 ? recentEvals.reduce((s, e) => s + e.quality, 0) / recentEvals.length : 0;

  const agentScores = new Map<string, { eff: number[]; qual: number[] }>();
  for (const e of recentEvals) {
    if (!agentScores.has(e.agent)) agentScores.set(e.agent, { eff: [], qual: [] });
    agentScores.get(e.agent)!.eff.push(e.efficiency);
    agentScores.get(e.agent)!.qual.push(e.quality);
  }

  // 8. Cron job health from request tracking DB
  const cronHealth = collectCronHealth(persistDir, oneDayAgo);

  // Format
  const dateStr = new Date().toISOString().split("T")[0];
  const lines: string[] = [];
  lines.push(`📊 *Daily Brief — ${dateStr}*`, ``);
  lines.push(`*Activity*`);
  lines.push(`• Sessions: ${sessions24h} today / ${totalSessions} total`);
  lines.push(`• Commits: ${commits24h} in last 24h`);
  lines.push(`• Evaluations: ${recentEvals.length} new / ${totalEvals} total`);
  lines.push(`• Cron jobs: ${cronJobCount} active`, ``);

  if (recentEvals.length > 0) {
    lines.push(`*Scores (24h avg)*`);
    lines.push(`• Efficiency: ${(avgEff * 100).toFixed(0)}% | Quality: ${(avgQual * 100).toFixed(0)}%`);
    for (const [agent, scores] of agentScores) {
      const e = scores.eff.reduce((a, b) => a + b, 0) / scores.eff.length;
      const q = scores.qual.reduce((a, b) => a + b, 0) / scores.qual.length;
      const icon = e >= 0.7 && q >= 0.7 ? "🟢" : e >= 0.5 && q >= 0.5 ? "🟡" : "🔴";
      lines.push(`  ${icon} ${agent}: eff ${(e * 100).toFixed(0)}% / qual ${(q * 100).toFixed(0)}% (${scores.eff.length} sessions)`);
    }
    lines.push(``);
  }

  const withTodos = agentSummaries.filter(a => a.todoCount > 0).sort((a, b) => b.todoCount - a.todoCount);
  if (withTodos.length > 0) {
    lines.push(`*Backlogs*`);
    for (const a of withTodos) lines.push(`• ${a.name}: ${a.todoCount} pending`);
    lines.push(``);
  }

  lines.push(`*Top Issue*`, topIssue, ``);

  // Cron job health
  if (cronHealth.jobs.length > 0) {
    lines.push(`*Cron Jobs (24h)*`);
    for (const job of cronHealth.jobs) {
      const failRate = job.total > 0 ? job.failures / job.total : 0;
      const icon = job.failures === 0 ? "✅" : failRate > 0.3 ? "🔴" : "🟡";
      const avgDur = job.total > 0 ? Math.round(job.totalDurationMs / job.total / 1000) : 0;
      let detail = `${icon} ${job.name}: ${job.successes}/${job.total} ok`;
      if (job.failures > 0) detail += `, ${job.failures} fail`;
      if (job.skipped > 0) detail += `, ${job.skipped} skip`;
      detail += ` (avg ${avgDur}s)`;
      if (job.agent) detail += ` [${job.agent}]`;
      lines.push(`  ${detail}`);
    }
    if (cronHealth.issues.length > 0) {
      lines.push(``);
      lines.push(`*Cron Issues*`);
      for (const issue of cronHealth.issues) {
        lines.push(`  ⚠️ ${issue}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Cron health analysis ──────────────────────────────────────────────

interface CronJobStats {
  name: string;
  agent?: string;
  total: number;
  successes: number;
  failures: number;
  skipped: number;
  totalDurationMs: number;
  lastError?: string;
  lastRunAt?: string;
}

interface CronHealthResult {
  jobs: CronJobStats[];
  issues: string[];
}

function collectCronHealth(persistDir: string, since: number): CronHealthResult {
  const jobMap = new Map<string, CronJobStats>();
  const issues: string[] = [];

  try {
    const db = opts.getDb();
    const rows = db
      .prepare(
        `SELECT artifact, toAgent as agent, status, summary, error,
                createdAt, completedAt, durationMs
         FROM requests
         WHERE fromEntity = 'cron' AND artifact IS NOT NULL AND createdAt >= ?
         ORDER BY createdAt ASC`,
      )
      .all(since) as Array<{
        artifact: string;
        agent: string | null;
        status: string;
        summary: string | null;
        error: string | null;
        createdAt: number;
        completedAt: number | null;
        durationMs: number | null;
      }>;

    for (const row of rows) {
      if (!jobMap.has(row.artifact)) {
        jobMap.set(row.artifact, {
          name: row.artifact,
          agent: row.agent ?? undefined,
          total: 0,
          successes: 0,
          failures: 0,
          skipped: 0,
          totalDurationMs: 0,
        });
      }
      const stats = jobMap.get(row.artifact)!;
      stats.total++;
      if (row.completedAt) {
        stats.lastRunAt = new Date(row.completedAt).toISOString();
      }
      if (row.status === "COMPLETED") {
        stats.successes++;
        stats.totalDurationMs += row.durationMs ?? 0;
      } else if (row.status === "FAILED") {
        stats.failures++;
        stats.lastError = row.error || row.summary || undefined;
      }
      // CREATED/IN_PROGRESS requests aren't counted as skipped — they're still running
    }
  } catch { /* best-effort — db may not be available */ }

  const jobs = Array.from(jobMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Detect issues
  for (const job of jobs) {
    if (job.total > 0 && job.failures / job.total > 0.5) {
      issues.push(`${job.name}: >50% failure rate (${job.failures}/${job.total})${job.lastError ? ` — last: ${job.lastError.slice(0, 80)}` : ""}`);
    }
    if (job.skipped > job.total * 0.5 && job.skipped > 3) {
      issues.push(`${job.name}: ${job.skipped} skipped — may be running too frequently or sessions stuck`);
    }
    if (job.total > 0 && job.successes > 0) {
      const avgMs = job.totalDurationMs / job.successes;
      if (avgMs > 300_000) { // > 5 min average
        issues.push(`${job.name}: avg ${Math.round(avgMs / 1000)}s — may be too slow`);
      }
    }
  }

  return { jobs, issues };
}
