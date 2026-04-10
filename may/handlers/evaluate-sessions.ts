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
      getDb: ctx.getDb,
      loadAllSessionMetas: ctx.loadAllSessionMetas,
      evaluateTask: ctx.evaluateTask,
      writeSkippedEvaluations: ctx.writeSkippedEvaluations,
      writeHeuristicEvaluations: ctx.writeHeuristicEvaluations,
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
          ctx.emit({
            type: "message_created",
            from: "evaluate-sessions",
            to: "coach",
            task: `Review session ${parentId} (verdict: needs_improvement). Query evaluations table in .state/may.db for details. Identify which agent needs coaching and run a targeted exercise.`,
            requestId: `eval-${Date.now()}-${parentId}`,
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
export function findParentsWithUnevaluatedChildren(persistDir: string, getDb: () => any, loadAllSessionMetas: () => Record<string, any>): string[] {
  const allSessions = loadAllSessionMetas();

  // Build evaluated set from SQLite DB (primary) + legacy evaluations/ dir (fallback)
  const evaluatedIds = new Set<string>();
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT sessionId FROM evaluations`).all() as Array<{ sessionId: string }>;
    for (const r of rows) evaluatedIds.add(r.sessionId);
  } catch {
    // DB unavailable — fall back to legacy directory
    const evalDir = join(persistDir, "evaluations");
    if (existsSync(evalDir)) {
      for (const f of readdirSync(evalDir)) {
        if (f.endsWith(".json")) evaluatedIds.add(f.replace(".json", ""));
      }
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
  getDb: () => any;
  loadAllSessionMetas: () => Record<string, any>;
  evaluateTask: (evalOpts: any) => Promise<any>;
  writeSkippedEvaluations: (skipAgents?: Set<string>) => Promise<number>;
  writeHeuristicEvaluations: () => Promise<number>;
}): Promise<EvaluateSessionsResult> {
  const { persistDir, manager, onLog } = opts;
  const result: EvaluateSessionsResult = { skipped: 0, parentsEvaluated: [], parentVerdicts: {}, sessionsEvaluated: 0, errors: [] };

  try {
    result.skipped = await opts.writeSkippedEvaluations();
    if (result.skipped > 0) onLog?.(`[eval] Wrote ${result.skipped} skip evaluation(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeSkippedEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeSkippedEvaluations failed: ${msg}`);
  }

  // Heuristic evaluation for root sessions (no parent)
  try {
    const heuristic = await opts.writeHeuristicEvaluations();
    if (heuristic > 0) {
      onLog?.(`[eval] Wrote ${heuristic} heuristic evaluation(s) for root sessions`);
    }
    result.skipped += heuristic; // Count in skipped bucket for reporting
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeHeuristicEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeHeuristicEvaluations failed: ${msg}`);
  }

  const allParents = findParentsWithUnevaluatedChildren(persistDir, opts.getDb, opts.loadAllSessionMetas);
  if (allParents.length === 0) { onLog?.("[eval] No unevaluated sessions — all caught up"); return result; }
  // Limit to 3 parents per run to prevent cascade when many sessions are pending.
  // Remaining parents will be picked up in subsequent runs (every 30min).
  const MAX_PARENTS_PER_RUN = 3;
  const parents = allParents.slice(0, MAX_PARENTS_PER_RUN);
  if (allParents.length > MAX_PARENTS_PER_RUN) {
    onLog?.(`[eval] Found ${allParents.length} parent(s) — limiting to ${MAX_PARENTS_PER_RUN} this run`);
  } else {
    onLog?.(`[eval] Found ${parents.length} parent(s) with unevaluated children`);
  }

  for (const parentId of parents) {
    try {
      const evalResult = await opts.evaluateTask({ manager, persistDir, parentSessionId: parentId });
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
