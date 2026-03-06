/**
 * Evaluate-sessions — pure JS replacement for the [cron:evaluate-sessions] LLM call.
 *
 * Previously, the evaluate-sessions cron fired a message into May's session, which
 * caused an LLM call to list session directories, check for evaluation files,
 * and delegate unevaluated sessions to the evaluator. This is entirely formulaic —
 * same steps every time, no reasoning needed.
 *
 * This module does exactly the same thing in JS:
 *   1. Write skip evaluations for meta-agents and no-transcript sessions
 *   2. Find all unevaluated sessions grouped by parent
 *   3. Call evaluateTask() for each parent with unevaluated children
 *
 * Cost saved: ~$0.10-0.30 per invocation × 6/day = ~$0.60-1.80/day
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadAllSessionMetas,
  type PersistedSession,
} from "../../src/persistence.js";
import {
  evaluateTask,
  writeSkippedEvaluations,
} from "../../src/evaluator.js";
import type { SubagentManager } from "../../src/index.js";

export interface EvaluateSessionsResult {
  /** Number of skip-evaluations written (meta-agents, no-transcript). */
  skipped: number;
  /** Parent session IDs that had unevaluated children and were submitted for evaluation. */
  parentsEvaluated: string[];
  /** Number of individual sessions evaluated across all parents. */
  sessionsEvaluated: number;
  /** Errors encountered during evaluation (non-fatal). */
  errors: string[];
}

export interface EvaluateSessionsOptions {
  persistDir: string;
  manager: SubagentManager;
  /** Callback for logging (optional). */
  onLog?: (message: string) => void;
}

const META_AGENTS = new Set(["evaluator", "optimizer", "may"]);

/**
 * Find parent session IDs that have unevaluated child sessions.
 * Pure filesystem check — no LLM needed.
 */
export function findParentsWithUnevaluatedChildren(
  persistDir: string,
): string[] {
  const allSessions = loadAllSessionMetas(persistDir);
  const evalDir = join(persistDir, "evaluations");

  // Build set of already-evaluated session IDs
  const evaluatedIds = new Set<string>();
  if (existsSync(evalDir)) {
    for (const f of readdirSync(evalDir)) {
      if (f.endsWith(".json")) evaluatedIds.add(f.replace(".json", ""));
    }
  }

  // Find parent IDs that have at least one unevaluated, actionable child
  const parentsWithUnevaluated = new Set<string>();

  for (const [sid, session] of Object.entries(allSessions)) {
    // Skip already evaluated
    if (evaluatedIds.has(sid)) continue;

    // Skip running/idle sessions
    if (session.status === "running" || session.status === "idle") continue;

    // Skip meta-agents (handled by writeSkippedEvaluations)
    if (META_AGENTS.has(session.agent)) continue;

    // Must have a parent
    if (!session.parentSessionId) continue;

    // Must have a transcript
    const activeJsonl = join(persistDir, "sessions", sid, "session.jsonl");
    const archivedJsonl = join(
      persistDir,
      "sessions",
      "history",
      sid,
      "session.jsonl",
    );
    if (!existsSync(activeJsonl) && !existsSync(archivedJsonl)) continue;

    parentsWithUnevaluated.add(session.parentSessionId);
  }

  return [...parentsWithUnevaluated];
}

/**
 * Run the evaluate-sessions handler.
 * 1. Write skip evaluations for trivial cases
 * 2. Find parents with unevaluated children
 * 3. Call evaluateTask for each
 */
export async function handleEvaluateSessions(
  opts: EvaluateSessionsOptions,
): Promise<EvaluateSessionsResult> {
  const { persistDir, manager, onLog } = opts;
  const result: EvaluateSessionsResult = {
    skipped: 0,
    parentsEvaluated: [],
    sessionsEvaluated: 0,
    errors: [],
  };

  // Step 1: Write skip evaluations (meta-agents, no-transcript, no-metadata)
  try {
    result.skipped = writeSkippedEvaluations(persistDir);
    if (result.skipped > 0) {
      onLog?.(
        `[eval] Wrote ${result.skipped} skip evaluation(s) — no LLM needed`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`writeSkippedEvaluations failed: ${msg}`);
    onLog?.(`[eval] writeSkippedEvaluations failed: ${msg}`);
  }

  // Step 2: Find parents with unevaluated children
  const parents = findParentsWithUnevaluatedChildren(persistDir);
  if (parents.length === 0) {
    onLog?.("[eval] No unevaluated sessions found — all caught up");
    return result;
  }

  onLog?.(
    `[eval] Found ${parents.length} parent(s) with unevaluated children`,
  );

  // Step 3: Evaluate each parent's task tree
  for (const parentId of parents) {
    try {
      const evalResult = await evaluateTask({
        manager,
        persistDir,
        parentSessionId: parentId,
      });

      if (evalResult) {
        const agentNames = Object.keys(evalResult.agents).join(", ");
        const count = evalResult.sessionIds.length;
        result.parentsEvaluated.push(parentId);
        result.sessionsEvaluated += count;
        onLog?.(
          `[eval] Evaluated ${count} session(s) for parent ${parentId} (${agentNames}): ${evalResult.overall.verdict}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`evaluateTask(${parentId}) failed: ${msg}`);
      onLog?.(`[eval] evaluateTask(${parentId}) failed: ${msg}`);
    }
  }

  return result;
}
