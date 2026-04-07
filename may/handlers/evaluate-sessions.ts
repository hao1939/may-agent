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

// ── Post-heuristic rescoring ──────────────────────────────────────────

/**
 * Clean up stale heuristic evaluation data (migration tasks only).
 *
 * Phase 3 (rubber-stamp rescoring) was REMOVED 2026-04-06 because the
 * heuristic evaluator now computes real scores. The rescorer was
 * overwriting legitimate scores and creating column/overall-blob mismatches.
 * See commit history for details.
 */
function rescoreHeuristicEvaluations(persistDir: string, getDb: () => any): number {
  let db: any;
  try {
    db = getDb();
  } catch {
    return 0; // DB not available
  }

  // Phase 1: Clean up stale heuristic evaluations with incorrect issue tags.
  // The binary fix (a6250b0) corrected writeHeuristicEvaluations() going forward,
  // but old evaluations still have session_error/opBudget_exhaustion for interrupted
  // 0-op sessions that should be skipped. Fix them here.
  try {
    const staleEvals = db.prepare(
      `SELECT e.sessionId, s.status, s.opCount
       FROM evaluations e
       JOIN sessions s ON e.sessionId = s.sessionId
       WHERE e.evaluatedByHeuristic = 1
         AND (e.issues LIKE '%session_error%' OR e.issues LIKE '%opBudget%')
         AND s.status = 'interrupted' AND (s.opCount IS NULL OR s.opCount = 0)`
    ).all() as Array<{ sessionId: string; status: string; opCount: number }>;

    if (staleEvals.length > 0) {
      const fixStmt = db.prepare(
        `UPDATE evaluations SET verdict = 'skipped', quality = 0, efficiency = 0, issues = '[]', skippedByJs = 1
         WHERE sessionId = ?`
      );
      for (const { sessionId } of staleEvals) {
        fixStmt.run(sessionId);
      }
    }
  } catch { /* best-effort cleanup */ }

  // Phase 2: Also clean up opBudget_exhaustion from any heuristic eval (opBudget removed Mar 30)
  try {
    const opBudgetEvals = db.prepare(
      `SELECT sessionId, issues FROM evaluations
       WHERE evaluatedByHeuristic = 1 AND issues LIKE '%opBudget_exhaustion%'`
    ).all() as Array<{ sessionId: string; issues: string }>;

    if (opBudgetEvals.length > 0) {
      const updateIssuesStmt = db.prepare(
        `UPDATE evaluations SET issues = ? WHERE sessionId = ?`
      );
      for (const { sessionId, issues } of opBudgetEvals) {
        try {
          const parsed = JSON.parse(issues) as string[];
          const cleaned = parsed.filter((i: string) => i !== "opBudget_exhaustion");
          updateIssuesStmt.run(JSON.stringify(cleaned), sessionId);
        } catch { /* skip unparseable */ }
      }
    }
  } catch { /* best-effort cleanup */ }

  // Phase 3: REMOVED (2026-04-06)
  //
  // Previously rescored evaluations with quality=5, efficiency=4 (the old
  // "rubber stamp" signature from the bundled heuristic evaluator). But the
  // heuristic evaluator in evaluator.ts now has sophisticated scoring (Phases
  // 2-4 of H-009) and Q=5, E=4 is a legitimate score. The rescorer was:
  //   1. Overwriting real scores with crude file-size-based efficiency
  //   2. Not updating the `overall` JSON blob, creating column/blob mismatch
  //   3. Penalizing large sessions (tech-lead) with E=1 despite high quality
  //
  // Phases 1 & 2 above handle stale data migration and are retained.

  return 0;
}

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

  // Clean up stale heuristic evaluation data (legacy migration).
  // Phase 3 (rubber-stamp rescoring) was removed — heuristic evaluator now
  // produces real scores, so no rescoring is needed.
  try {
    const rescored = rescoreHeuristicEvaluations(persistDir, opts.getDb);
    if (rescored > 0) onLog?.(`[eval] Cleaned up ${rescored} stale heuristic evaluation(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`rescoreHeuristicEvaluations failed: ${msg}`);
    onLog?.(`[eval] rescoreHeuristicEvaluations failed: ${msg}`);
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
