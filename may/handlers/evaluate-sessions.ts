/**
 * Evaluate-sessions — agent-owned cron handler.
 *
 * Finds unevaluated sessions, writes skip evaluations for trivial cases,
 * and calls evaluateTask() for the rest. Pure JS — no LLM needed.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadAllSessionMetas } from "../../../src/lib/persistence.js";
import { evaluateTask, writeSkippedEvaluations, writeHeuristicEvaluations } from "../../../src/lib/evaluator.js";
import { trackRequest, getDb } from "../../../src/lib/requests.js";
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
            task: `Review session ${parentId} (verdict: needs_improvement). Query evaluations table in .state/may.db for details. Identify which agent needs coaching and run a targeted exercise.`,
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

// ── Post-heuristic rescoring ──────────────────────────────────────────

/**
 * Rescore rubber-stamp heuristic evaluations with real transcript metrics.
 *
 * The bundled writeHeuristicEvaluations() assigns quality=5, efficiency=4
 * to everything. This function overwrites those scores using actual session
 * data: transcript size, tool call counts, error rates, and finish status.
 *
 * Only touches evaluations where quality=5 AND efficiency=4 (rubber-stamp
 * signature) to avoid re-scoring already-corrected evaluations.
 */
function rescoreHeuristicEvaluations(persistDir: string): number {
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb(persistDir);
  } catch {
    return 0; // DB not available
  }

  // Find rubber-stamp evaluations (quality=5, efficiency=4 is the signature)
  const rubberStamped = db.prepare(
    `SELECT sessionId, agent FROM evaluations WHERE quality = 5.0 AND efficiency = 4.0`
  ).all() as Array<{ sessionId: string; agent: string }>;

  if (rubberStamped.length === 0) return 0;

  const updateStmt = db.prepare(
    `UPDATE evaluations SET quality = ?, efficiency = ?, wastedCalls = ?, verdict = ? WHERE sessionId = ?`
  );

  let rescored = 0;
  for (const { sessionId, agent } of rubberStamped) {
    try {
      const metrics = extractSessionMetrics(persistDir, sessionId);
      if (!metrics) continue;

      // Score quality (1-5 scale):
      // - Has finish() call with success? +2 base
      // - Has productive tool calls? +1
      // - Error rate < 20%? +1
      // - Produced deliverables (wrote/edited files)? +1
      let quality = 1;
      if (metrics.hasFinish) quality += 1;
      if (metrics.hasSuccessFinish) quality += 1;
      if (metrics.productiveCalls > 0) quality += 1;
      if (metrics.totalCalls > 0 && metrics.errorRate < 0.2) quality += 1;

      // Score efficiency (1-5 scale):
      // - Session size < 50KB? 5
      // - Session size < 100KB? 4
      // - Session size < 200KB? 3
      // - Session size < 400KB? 2
      // - Else: 1
      let efficiency: number;
      if (metrics.sizeKB < 50) efficiency = 5;
      else if (metrics.sizeKB < 100) efficiency = 4;
      else if (metrics.sizeKB < 200) efficiency = 3;
      else if (metrics.sizeKB < 400) efficiency = 2;
      else efficiency = 1;

      // Verdict: based on quality score
      const verdict = quality >= 4 ? "good" : quality >= 3 ? "acceptable" : "needs_improvement";

      updateStmt.run(quality, efficiency, metrics.wastedCalls, verdict, sessionId);
      rescored++;
    } catch {
      // Best-effort per session — skip failures
    }
  }

  return rescored;
}

interface SessionMetrics {
  sizeKB: number;
  totalCalls: number;
  productiveCalls: number;
  wastedCalls: number;
  errorRate: number;
  hasFinish: boolean;
  hasSuccessFinish: boolean;
}

/**
 * Extract basic metrics from a session transcript (JSONL file).
 */
function extractSessionMetrics(persistDir: string, sessionId: string): SessionMetrics | null {
  // Try active sessions first, then history
  const paths = [
    join(persistDir, "sessions", sessionId, "session.jsonl"),
    join(persistDir, "sessions", "history", sessionId, "session.jsonl"),
  ];

  let transcriptPath: string | null = null;
  for (const p of paths) {
    if (existsSync(p)) { transcriptPath = p; break; }
  }
  if (!transcriptPath) return null;

  let sizeKB: number;
  try {
    sizeKB = statSync(transcriptPath).size / 1024;
  } catch {
    return null;
  }

  let totalCalls = 0;
  let errorCalls = 0;
  let hasFinish = false;
  let hasSuccessFinish = false;

  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        // Count tool calls from assistant messages
        if (entry.role === "assistant" && entry.content) {
          const text = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
          // Count tool_use / toolCall blocks
          if (Array.isArray(entry.content)) {
            for (const block of entry.content) {
              if (block.type === "tool_use" || block.type === "toolCall") totalCalls++;
            }
          }
        }
        // Count tool results
        if (entry.role === "tool" || entry.role === "toolResult" || entry.type === "tool_result") {
          // Prefer explicit isError field when available
          if (entry.isError === true) {
            errorCalls++;
          } else if (entry.isError !== false) {
            // Fallback: check for error patterns in output (only for formats without isError)
            const text = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
            if (text.includes("ENOENT:") || text.includes("FAILED") || text.includes("WRITE BLOCKED") ||
                text.includes("Command exited with code") || text.includes("Permission denied")) {
              errorCalls++;
            }
          }
        }
        // Check for finish() calls
        if (entry.role === "assistant" && entry.content) {
          if (Array.isArray(entry.content)) {
            for (const block of entry.content) {
              if ((block.type === "tool_use" || block.type === "toolCall") && block.name === "finish") {
                hasFinish = true;
                const args = block.input || block.arguments || {};
                if (args.status === "success") hasSuccessFinish = true;
              }
            }
          }
          // Fallback: text-based detection for other formats
          if (!hasFinish) {
            const text = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
            if (text.includes('"finish"') || text.includes("finish(")) {
              hasFinish = true;
              if (text.includes('"success"')) hasSuccessFinish = true;
            }
          }
        }
      } catch { /* skip unparseable lines */ }
    }
  } catch {
    // If we can't read the transcript, still score based on size
    return { sizeKB, totalCalls: 0, productiveCalls: 0, wastedCalls: 0, errorRate: 0, hasFinish: false, hasSuccessFinish: false };
  }

  const wastedCalls = errorCalls;
  const productiveCalls = totalCalls > 0 ? Math.max(0, totalCalls - errorCalls) : 0;
  const errorRate = totalCalls > 0 ? errorCalls / totalCalls : 0;

  return { sizeKB, totalCalls, productiveCalls, wastedCalls, errorRate, hasFinish, hasSuccessFinish };
}

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
    result.skipped = await writeSkippedEvaluations(persistDir);
    if (result.skipped > 0) onLog?.(`[eval] Wrote ${result.skipped} skip evaluation(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeSkippedEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeSkippedEvaluations failed: ${msg}`);
  }

  // Heuristic evaluation for root sessions (no parent)
  try {
    const heuristic = await writeHeuristicEvaluations(persistDir);
    if (heuristic > 0) {
      onLog?.(`[eval] Wrote ${heuristic} heuristic evaluation(s) for root sessions`);
      // Rescore rubber-stamp heuristic evaluations with real metrics
      const rescored = rescoreHeuristicEvaluations(persistDir);
      if (rescored > 0) onLog?.(`[eval] Rescored ${rescored} heuristic evaluation(s) with transcript metrics`);
    }
    result.skipped += heuristic; // Count in skipped bucket for reporting
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeHeuristicEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeHeuristicEvaluations failed: ${msg}`);
  }

  const allParents = findParentsWithUnevaluatedChildren(persistDir);
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
