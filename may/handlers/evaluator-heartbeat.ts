/**
 * evaluator-heartbeat.ts — Lightweight JS handler replacing the evaluator LLM heartbeat.
 *
 * The evaluator LLM heartbeat fired 48x/day (~250 ops/day) for zero value —
 * 100% of runs resulted in `meta_agent_skipped` (1 op each). Real evaluation
 * work happens via `evaluation-sync` (JS handler) and LLM evaluation sessions
 * spawned by `evaluateTask()`.
 *
 * This handler checks DB state and only spawns an LLM evaluator session when
 * calibration work is actually needed. Returns early (no LLM cost) otherwise.
 *
 * Calibration triggers:
 *   1. Zero evaluations in last 24h AND unevaluated sessions exist → pipeline may be stale
 *   2. Evaluator workspace files haven't been updated in >7 days → criteria may need refresh
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Constants ─────────────────────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;

/** Evaluator workspace directory (relative to project root). */
const EVALUATOR_WORKSPACE = "agents/evaluator/workspace";

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const now = Date.now();
    const db = ctx.getDb();

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
        `[evaluator-heartbeat] Skip: ${recentEvalCount} evals in 24h, ` +
        `${unevaluatedCount} unevaluated sessions, workspace fresh. No calibration needed.`,
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
      const result = await ctx.manager.callAgent("evaluator", task, {
        source: "evaluator-heartbeat",
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
