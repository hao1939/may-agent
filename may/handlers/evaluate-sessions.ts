/**
 * Evaluate-sessions — agent-owned cron handler.
 *
 * Finds unevaluated sessions, writes skip evaluations for trivial cases,
 * and calls evaluateTask() for the rest. Pure JS — no LLM needed.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadAllSessionMetas } from "../../../src/lib/persistence.js";
import { evaluateTask, writeSkippedEvaluations } from "../../../src/lib/evaluator.js";
import { trackRequest } from "../../../src/lib/requests.js";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

export interface EvaluateSessionsResult {
  skipped: number;
  parentsEvaluated: string[];
  /** Per-parent verdict from overall evaluation. */
  parentVerdicts: Record<string, string>;
  sessionsEvaluated: number;
  errors: string[];
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const result = await handleEvaluateSessions({
      persistDir: ctx.persistDir,
      manager: ctx.manager,
      onLog: (msg) => ctx.log(msg),
    });
    if (result.sessionsEvaluated > 0 || result.skipped > 0) {
      ctx.log(`[cron:evaluate-sessions] ${result.skipped} skipped, ${result.sessionsEvaluated} evaluated, ${result.errors.length} errors`);
    }

    // Check for bad evaluations → reactive coaching trigger
    let triggered = false;
    for (const parentId of result.parentsEvaluated) {
      const verdict = result.parentVerdicts[parentId];
      if (verdict === "needs_improvement") {
        try {
          trackRequest(ctx.persistDir, {
            fromEntity: "evaluate-sessions",
            toAgent: "coach",
            task: `Review session ${parentId} (verdict: needs_improvement). Check .state/evaluations/ for details. Identify which agent needs coaching and run a targeted exercise.`,
            method: "send",
          });
        } catch { /* best-effort */ }
        triggered = true;
        ctx.log(`[evaluate-sessions] Bad score for ${parentId} → queued coaching item`);
      }
    }
    if (triggered) {
      ctx.triggerNow("heartbeat-coach");
      ctx.log(`[evaluate-sessions] Triggered coach heartbeat`);
    }
  };
};

// ── Pure logic ────────────────────────────────────────────────────────

/**
 * Find parent sessions that have unevaluated children.
 *
 * All agents are eligible for evaluation (P25: Everything Gets Reviewed).
 * No agents are excluded by default — evaluateTask() uses an empty
 * skipAgents set.
 */
export function findParentsWithUnevaluatedChildren(persistDir: string): string[] {
  const allSessions = loadAllSessionMetas(persistDir);
  const evalDir = join(persistDir, "evaluations");
  const evaluatedIds = new Set<string>();
  if (existsSync(evalDir)) {
    for (const f of readdirSync(evalDir)) {
      if (f.endsWith(".json")) evaluatedIds.add(f.replace(".json", ""));
    }
  }

  const parentsWithUnevaluated = new Set<string>();
  for (const [sid, session] of Object.entries(allSessions)) {
    if (evaluatedIds.has(sid)) continue;
    if (session.status === "running" || session.status === "idle") continue;
    if (!session.parentSessionId) continue;
    const activeJsonl = join(persistDir, "sessions", sid, "session.jsonl");
    const archivedJsonl = join(persistDir, "sessions", "history", sid, "session.jsonl");
    if (!existsSync(activeJsonl) && !existsSync(archivedJsonl)) continue;
    parentsWithUnevaluated.add(session.parentSessionId);
  }
  return [...parentsWithUnevaluated];
}

export async function handleEvaluateSessions(opts: {
  persistDir: string;
  manager: any;
  onLog?: (msg: string) => void;
}): Promise<EvaluateSessionsResult> {
  const { persistDir, manager, onLog } = opts;
  const result: EvaluateSessionsResult = { skipped: 0, parentsEvaluated: [], parentVerdicts: {}, sessionsEvaluated: 0, errors: [] };

  try {
    result.skipped = writeSkippedEvaluations(persistDir);
    if (result.skipped > 0) onLog?.(`[eval] Wrote ${result.skipped} skip evaluation(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeSkippedEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeSkippedEvaluations failed: ${msg}`);
  }

  const parents = findParentsWithUnevaluatedChildren(persistDir);
  if (parents.length === 0) { onLog?.("[eval] No unevaluated sessions — all caught up"); return result; }
  onLog?.(`[eval] Found ${parents.length} parent(s) with unevaluated children`);

  for (const parentId of parents) {
    try {
      const evalResult = await evaluateTask({ manager, persistDir, parentSessionId: parentId });
      if (evalResult) {
        result.parentsEvaluated.push(parentId);
        result.parentVerdicts[parentId] = evalResult.overall.verdict;
        result.sessionsEvaluated += evalResult.sessionIds.length;
        onLog?.(`[eval] Evaluated ${evalResult.sessionIds.length} session(s) for parent ${parentId}: ${evalResult.overall.verdict}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`evaluateTask(${parentId}) failed: ${msg}`);
      onLog?.(`[eval] evaluateTask(${parentId}) failed: ${msg}`);
    }
  }
  return result;
}
