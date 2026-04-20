/**
 * evaluator-heartbeat.ts — Lightweight JS handler replacing the evaluator LLM heartbeat.
 *
 * Two responsibilities:
 *
 * 1. **Calibration** (original): Spawns an evaluator LLM session when the pipeline
 *    is stale or workspace criteria are outdated.
 *
 * 2. **Top-level LLM sampling** (new): Picks a small batch of heuristic-only
 *    top-level sessions and upgrades them to LLM evaluations via
 *    `evaluateStandaloneSession()`. This fixes the gap where `evaluateTask()`
 *    only fires for child sessions (requires parentSessionId), leaving heartbeat
 *    sessions for coach, qa, scout, etc. stuck at 100% heuristic evaluation.
 *
 * Cost budget: ≤3 LLM eval sessions per heartbeat run (~$0.03-0.05 each).
 * Sampling priority: agents with the lowest LLM evaluation rate get sampled first.
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { evaluateStandaloneSession } from "../../../src/lib/evaluator.js";

// ── Constants ─────────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;

/** Max LLM evaluation sessions per heartbeat run. Controls cost. */
const MAX_LLM_EVALS_PER_RUN = 3;

/** Evaluator workspace directory (relative to project root). */
const EVALUATOR_WORKSPACE = "agents/evaluator/workspace";

/** Agents to skip for LLM evaluation (meta agents / high-volume noise). */
const SKIP_LLM_EVAL_AGENTS = new Set(["evaluator", "may"]);

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const now = Date.now();
    const db = ctx.getDb();

    // ════════════════════════════════════════════════════════════════════
    // Part 1: Top-level LLM evaluation sampling
    // ════════════════════════════════════════════════════════════════════

    try {
      await sampleAndEvaluateTopLevel(ctx, db, now);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log(`[evaluator-heartbeat] LLM sampling error: ${msg}`);
    }

    // ════════════════════════════════════════════════════════════════════
    // Part 2: Calibration checks (original logic)
    // ════════════════════════════════════════════════════════════════════

    // ── Check 1: Are there recent evaluations? ────────────────────────
    let recentEvalCount = 0;
    try {
      const row = db.query("SELECT COUNT(*) as cnt FROM evaluations WHERE createdAt > ?", [
        now - MS_24H,
      ]);
      recentEvalCount = (row as any)?.cnt ?? 0;
    } catch {
      // Table may not exist yet — treat as 0
    }

    // ── Check 2: Are there unevaluated sessions? ──────────────────────
    let unevaluatedCount = 0;
    try {
      // Sessions that completed in the last 24h but have no evaluation row
      const row = db.query(
        `SELECT COUNT(*) as cnt FROM sessions s
         WHERE s.status IN ('done', 'error')
           AND s.endedAt > ?
           AND s.agent NOT IN ('evaluator', 'may')
           AND NOT EXISTS (SELECT 1 FROM evaluations e WHERE e.sessionId = s.sessionId)`,
        [now - MS_24H],
      );
      unevaluatedCount = (row as any)?.cnt ?? 0;
    } catch {
      // Tables may not exist — treat as 0
    }

    // ── Check 3: Workspace file staleness ─────────────────────────────
    let workspaceStale = false;
    const workspacePath = join(ctx.projectRoot, EVALUATOR_WORKSPACE);
    try {
      if (existsSync(workspacePath)) {
        const files = readdirSync(workspacePath).filter((f) => f.endsWith(".md"));
        if (files.length > 0) {
          let newestMtime = 0;
          for (const file of files) {
            try {
              const stat = statSync(join(workspacePath, file));
              if (stat.mtimeMs > newestMtime) newestMtime = stat.mtimeMs;
            } catch {
              // skip unreadable files
            }
          }
          workspaceStale = newestMtime > 0 && (now - newestMtime) > MS_7D;
        } else {
          // No workspace files at all — stale by definition
          workspaceStale = true;
        }
      } else {
        workspaceStale = true;
      }
    } catch {
      // Can't read workspace — don't trigger on this alone
    }

    // ── Decision ──────────────────────────────────────────────────────

    // Trigger 1: No recent evaluations but unevaluated sessions exist
    const pipelineStale = recentEvalCount === 0 && unevaluatedCount > 0;

    if (!pipelineStale && !workspaceStale) {
      ctx.log(
        `[evaluator-heartbeat] Calibration skip: ${recentEvalCount} evals in 24h, ` +
        `${unevaluatedCount} unevaluated sessions, workspace fresh.`,
      );
      return;
    }

    // Build calibration task description
    const reasons: string[] = [];
    if (pipelineStale) {
      reasons.push(
        `Evaluation pipeline may be stale: 0 evaluations in last 24h ` +
        `but ${unevaluatedCount} unevaluated session(s) found`,
      );
    }
    if (workspaceStale) {
      reasons.push("Evaluator workspace files haven't been updated in >7 days — criteria may need refresh");
    }

    const task =
      `[calibration] Evaluator calibration triggered by JS handler.\n\n` +
      `Reasons:\n${reasons.map((r) => `- ${r}`).join("\n")}\n\n` +
      `Read agents/evaluator/heartbeat.md and focus on calibration tasks. ` +
      `Check evaluation criteria freshness, review recent scoring patterns, ` +
      `and update workspace with findings.`;

    ctx.log(
      `[evaluator-heartbeat] Spawning evaluator session: ${reasons.join("; ")}`,
    );

    // Spawn evaluator LLM session
    try {
      const workflowRunId = `wr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const result = await ctx.manager.callAgent("evaluator", task, {
        source: "evaluator-heartbeat",
        workflowRunId,
      });
      ctx.log(
        `[evaluator-heartbeat] Evaluator session completed: ${result.status} ` +
        `(${result.sessionId})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log(`[evaluator-heartbeat] ERROR spawning evaluator: ${msg}`);
    }
  };
};

// ── Top-level LLM evaluation sampling ────────────────────────────────

/**
 * Find top-level sessions that only have heuristic evaluations and
 * upgrade a sample to LLM evaluations.
 *
 * Strategy: pick agents with the lowest LLM evaluation rate, then sample
 * their most recent heuristic-only sessions. This gradually raises the
 * LLM evaluation rate across all agents towards parity.
 */
async function sampleAndEvaluateTopLevel(
  ctx: HandlerContext,
  db: ReturnType<HandlerContext["getDb"]>,
  _now: number,
): Promise<void> {
  // Find agents with their LLM evaluation rates
  let agentRates: Array<{ agent: string; total: number; llm_count: number; rate: number }>;
  try {
    const rows = db.prepare(`
      SELECT
        e.agent,
        COUNT(*) as total,
        SUM(CASE WHEN e.evaluatedByHeuristic = 0 AND e.skippedByJs = 0 THEN 1 ELSE 0 END) as llm_count
      FROM evaluations e
      WHERE e.agent NOT IN ('evaluator', 'may')
      GROUP BY e.agent
      HAVING total >= 5
    `).all() as any[];
    agentRates = rows.map((r: any) => ({
      agent: r.agent,
      total: r.total,
      llm_count: r.llm_count,
      rate: r.total > 0 ? r.llm_count / r.total : 0,
    }));
  } catch {
    return; // Table doesn't exist or query failed
  }

  if (agentRates.length === 0) return;

  // Sort by LLM rate ascending — agents most in need of LLM evals first
  agentRates.sort((a, b) => a.rate - b.rate);

  // Find heuristic-only top-level sessions to upgrade
  // "Top-level" = sessions with no parentSessionId in the sessions table
  let candidates: Array<{ sessionId: string; agent: string; task: string; status: string }>;
  try {
    const rows = db.prepare(`
      SELECT s.sessionId, s.agent, s.task, s.status
      FROM sessions s
      JOIN evaluations e ON e.sessionId = s.sessionId
      WHERE e.evaluatedByHeuristic = 1
        AND s.agent NOT IN ('evaluator', 'may')
        AND s.status IN ('done', 'error')
        AND s.parentSessionId IS NULL
        AND s.opCount > 2
      ORDER BY s.endedAt DESC
      LIMIT 50
    `).all() as any[];
    candidates = rows.map((r: any) => ({
      sessionId: r.sessionId,
      agent: r.agent,
      task: r.task || "heartbeat",
      status: r.status,
    }));
  } catch {
    return; // parentSessionId column may not exist or query failed
  }

  if (candidates.length === 0) {
    ctx.log("[evaluator-heartbeat] No heuristic-only top-level sessions to upgrade.");
    return;
  }

  // Build priority order: for each agent (sorted by lowest LLM rate),
  // pick one candidate session. This ensures diversity across agents.
  const agentOrder = agentRates
    .filter((a) => !SKIP_LLM_EVAL_AGENTS.has(a.agent))
    .map((a) => a.agent);

  const selected: typeof candidates = [];
  const usedAgents = new Set<string>();

  // Round-robin: one session per agent, prioritizing lowest-LLM-rate agents
  for (const agent of agentOrder) {
    if (selected.length >= MAX_LLM_EVALS_PER_RUN) break;
    const candidate = candidates.find((c) => c.agent === agent && !usedAgents.has(c.agent));
    if (candidate) {
      selected.push(candidate);
      usedAgents.add(agent);
    }
  }

  // If we haven't filled the budget, pick more from any agent
  if (selected.length < MAX_LLM_EVALS_PER_RUN) {
    const selectedIds = new Set(selected.map((s) => s.sessionId));
    for (const candidate of candidates) {
      if (selected.length >= MAX_LLM_EVALS_PER_RUN) break;
      if (selectedIds.has(candidate.sessionId)) continue;
      if (SKIP_LLM_EVAL_AGENTS.has(candidate.agent)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.sessionId);
    }
  }

  if (selected.length === 0) return;

  ctx.log(
    `[evaluator-heartbeat] LLM-evaluating ${selected.length} top-level session(s): ` +
    selected.map((s) => `${s.agent}/${s.sessionId}`).join(", "),
  );

  let evaluated = 0;
  for (const session of selected) {
    try {
      const result = await evaluateStandaloneSession({
        manager: ctx.manager,
        persistDir: ctx.persistDir,
        sessionId: session.sessionId,
        agent: session.agent,
        task: session.task,
        status: session.status,
      });

      if (result) {
        evaluated++;
        ctx.log(
          `[evaluator-heartbeat] LLM eval: ${session.agent}/${session.sessionId} → ` +
          `Q:${result.quality.toFixed(2)} E:${result.efficiency.toFixed(2)} ${result.verdict}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log(
        `[evaluator-heartbeat] LLM eval error for ${session.sessionId}: ${msg}`,
      );
    }
  }

  if (evaluated > 0) {
    ctx.log(`[evaluator-heartbeat] Upgraded ${evaluated}/${selected.length} sessions to LLM evaluation.`);
  }
}
