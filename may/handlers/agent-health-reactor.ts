/**
 * agent-health-reactor — Detects agents with repeated low evaluation scores
 * and auto-investigates root causes (broken tools, wrong config, missing files).
 *
 * Runs every 30 minutes. For each agent, checks recent evaluations. If an agent
 * has N consecutive low scores (quality < threshold), forks an investigation
 * session to diagnose and fix the issue.
 *
 * This closes the gap: evaluator scores sessions, but nobody acts on repeated failures.
 */

import type { CronEntry, HandlerContext, HandlerModule } from "../../shared/agent-sdk.ts";

type Config = {
  /** Minimum consecutive low-quality sessions to trigger investigation */
  consecutiveFailThreshold?: number;
  /** Quality score below which a session is considered "low" */
  qualityThreshold?: number;
  /** How far back to look for evaluations (ms) */
  lookbackMs?: number;
  /** Cooldown: don't re-investigate same agent within this window (ms) */
  cooldownMs?: number;
  /** Max agents to investigate per tick */
  maxInvestigations?: number;
};

type EvalRow = {
  sessionId: string;
  agent: string;
  quality: number;
  verdict: string;
  issues: string | null;
  createdAt: number;
};

type AgentHealth = {
  agent: string;
  recentEvals: EvalRow[];
  consecutiveLowCount: number;
  commonIssues: string[];
};

const DEFAULT_CONSECUTIVE_FAIL_THRESHOLD = 3;
const DEFAULT_QUALITY_THRESHOLD = 0.4;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60_000; // 24h
const DEFAULT_COOLDOWN_MS = 4 * 60 * 60_000;  // 4h
const DEFAULT_MAX_INVESTIGATIONS = 2;

function extractCommonIssues(evals: EvalRow[]): string[] {
  const issueCounts = new Map<string, number>();
  for (const ev of evals) {
    if (!ev.issues) continue;
    try {
      const parsed = JSON.parse(ev.issues);
      const items = Array.isArray(parsed) ? parsed : [];
      for (const item of items) {
        const text = typeof item === "string" ? item : (item?.tag ?? item?.type ?? item?.evidence ?? JSON.stringify(item));
        const key = String(text).slice(0, 120);
        issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
      }
    } catch { /* skip malformed */ }
  }
  return [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue, count]) => `(${count}x) ${issue}`);
}

function buildInvestigationTask(health: AgentHealth): string {
  const issueList = health.commonIssues.length > 0
    ? health.commonIssues.map(i => `  - ${i}`).join("\n")
    : "  (no structured issues extracted)";

  const evalSummary = health.recentEvals
    .slice(0, 5)
    .map(e => `  - ${e.sessionId}: quality=${e.quality}, verdict=${e.verdict}`)
    .join("\n");

  return [
    `[agent-health-reactor] Investigate why agent "${health.agent}" has ${health.consecutiveLowCount} consecutive low-quality sessions.`,
    "",
    "## Task",
    `Agent "${health.agent}" has scored below quality threshold for ${health.consecutiveLowCount} consecutive sessions.`,
    "Investigate the root cause and fix it. Common causes:",
    "- Missing or broken tools (files referenced in context.md that don't exist)",
    "- Wrong URLs or API endpoints",
    "- Stale instructions that reference removed features",
    "- Workspace clutter causing confusion",
    "",
    "## Steps",
    `1. Read agents/${health.agent}/context.md and agents/${health.agent}/AGENTS.md`,
    `2. Verify every tool/file referenced actually exists (ls, cat)`,
    `3. Check agents/${health.agent}/tools/ for working tools`,
    `4. Read the evaluation issues below to understand what's failing`,
    "5. Fix any broken references, wrong URLs, or missing tools",
    "6. If the fix requires human input, write to agents/${health.agent}/INBOX.md",
    "",
    "## Recent Evaluations",
    evalSummary,
    "",
    "## Most Common Issues",
    issueList,
  ].join("\n");
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig ?? {}) as Config;
  const consecutiveFailThreshold = config.consecutiveFailThreshold ?? DEFAULT_CONSECUTIVE_FAIL_THRESHOLD;
  const qualityThreshold = config.qualityThreshold ?? DEFAULT_QUALITY_THRESHOLD;
  const lookbackMs = config.lookbackMs ?? DEFAULT_LOOKBACK_MS;
  const cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const maxInvestigations = config.maxInvestigations ?? DEFAULT_MAX_INVESTIGATIONS;

  return async () => {
    const db = ctx.sdk.getDb();
    const now = Date.now();
    const cutoff = now - lookbackMs;

    // Get all agents with evaluations in the lookback window
    const agents = db.prepare(
      `SELECT DISTINCT agent FROM evaluations
       WHERE createdAt >= ? AND agent NOT IN ('evaluator', 'judge', 'may')
       ORDER BY agent`
    ).all(cutoff) as Array<{ agent: string }>;

    if (agents.length === 0) {
      ctx.sdk.log("info", "[agent-health-reactor] No evaluations found in lookback window.");
      return;
    }

    const unhealthyAgents: AgentHealth[] = [];

    for (const { agent } of agents) {
      // Get recent evaluations ordered newest first
      const evals = db.prepare(
        `SELECT sessionId, agent, quality, verdict, issues, createdAt
         FROM evaluations
         WHERE agent = ? AND createdAt >= ?
         ORDER BY createdAt DESC
         LIMIT 10`
      ).all(agent, cutoff) as EvalRow[];

      if (evals.length < consecutiveFailThreshold) continue;

      // Count consecutive low-quality sessions from most recent
      let consecutiveLow = 0;
      for (const ev of evals) {
        if (ev.quality < qualityThreshold) {
          consecutiveLow++;
        } else {
          break; // streak broken
        }
      }

      if (consecutiveLow >= consecutiveFailThreshold) {
        const lowEvals = evals.slice(0, consecutiveLow);
        unhealthyAgents.push({
          agent,
          recentEvals: evals,
          consecutiveLowCount: consecutiveLow,
          commonIssues: extractCommonIssues(lowEvals),
        });
      }
    }

    if (unhealthyAgents.length === 0) {
      ctx.sdk.log("info", "[agent-health-reactor] All agents healthy (no consecutive low-quality streaks).");
      return;
    }

    ctx.sdk.log("info", `[agent-health-reactor] Found ${unhealthyAgents.length} unhealthy agent(s): ${unhealthyAgents.map(a => `${a.agent}(${a.consecutiveLowCount}x)`).join(", ")}`);

    // Check cooldown and dispatch investigations
    let dispatched = 0;
    for (const health of unhealthyAgents) {
      if (dispatched >= maxInvestigations) break;

      // Check cooldown: was there a recent investigation for this agent?
      const recentInvestigation = db.prepare(
        `SELECT sessionId FROM sessions
         WHERE agent = 'may'
           AND source = ?
           AND startedAt > ?
         LIMIT 1`
      ).get(`agent-health-reactor:${health.agent}`, now - cooldownMs) as { sessionId: string } | null;

      if (recentInvestigation) {
        ctx.sdk.log("info", `[agent-health-reactor] Skipping ${health.agent} — investigated recently (${recentInvestigation.sessionId})`);
        continue;
      }

      const task = buildInvestigationTask(health);

      try {
        ctx.sdk.runAgent("may", task, { source: `agent-health-reactor:${health.agent}` })
          .then(() => {
            ctx.sdk.log("info", `[agent-health-reactor] Investigation completed for ${health.agent}`);
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            ctx.sdk.log("info", `[agent-health-reactor] Investigation failed for ${health.agent}: ${msg.slice(0, 200)}`);
          });
        ctx.sdk.log("info", `[agent-health-reactor] Dispatched investigation for ${health.agent} (${health.consecutiveLowCount} consecutive low scores)`);
        dispatched++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.sdk.log("info", `[agent-health-reactor] Failed to dispatch for ${health.agent}: ${msg.slice(0, 200)}`);
      }
    }

    if (dispatched === 0) {
      ctx.sdk.log("info", "[agent-health-reactor] All unhealthy agents are in cooldown.");
    }
  };
};
