/**
 * evaluation-sync — Standalone heuristic evaluator for may.db.
 *
 * Problem: The evaluate-sessions handler uses binary ctx.writeHeuristicEvaluations()
 * which writes via ctx.getDb() (shared connection). Due to the WAL persistence bug,
 * these evaluations are visible within the handler's connection but never checkpoint
 * to the DB file on disk. Result: evaluations table stuck at 733 entries from
 * pre-March-23 restart.
 *
 * Solution: This handler independently computes heuristic evaluations and writes
 * them to may.db using its own Database connection (same pattern as session-sync fix).
 *
 * Pure JS — no LLM calls, no cost.
 *
 * Scoring logic (replicates the binary's heuristic evaluator):
 * - Evaluator sessions → skipped (meta agents don't evaluate themselves)
 * - Error sessions → Q:1, E:3, needs_improvement
 * - 0-op interrupted → skipped
 * - Done sessions → Q:5, E:4, good (default heuristic)
 * - Shallow sessions (≤2 ops, not evaluator) → Q:2, E:3, acceptable
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

interface SessionMeta {
  agent?: string;
  task?: string;
  status?: string;
  kind?: string;
  startedAt?: number;
  endedAt?: number;
  opCount?: number;
  error?: string;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
}

function loadSessionMeta(metaPath: string): SessionMeta | null {
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

function loadSessionUsage(sessionDir: string): UsageData {
  const defaults: UsageData = {
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
    cacheWriteTokens: 0, totalTokens: 0, cost: 0,
  };

  // Try to read usage from receipts.jsonl
  const receiptsPath = join(sessionDir, "receipts.jsonl");
  if (!existsSync(receiptsPath)) return defaults;

  try {
    const lines = readFileSync(receiptsPath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const r = JSON.parse(line);
        if (r.usage) {
          defaults.inputTokens += r.usage.input_tokens || r.usage.inputTokens || 0;
          defaults.outputTokens += r.usage.output_tokens || r.usage.outputTokens || 0;
          defaults.cacheReadTokens += r.usage.cache_read_input_tokens || r.usage.cacheReadTokens || 0;
          defaults.cacheWriteTokens += r.usage.cache_creation_input_tokens || r.usage.cacheWriteTokens || 0;
          defaults.cost += r.cost || 0;
        }
      } catch { /* skip bad line */ }
    }
    defaults.totalTokens = defaults.inputTokens + defaults.outputTokens + defaults.cacheReadTokens + defaults.cacheWriteTokens;
  } catch { /* ignore read errors */ }

  return defaults;
}

function countToolCalls(sessionDir: string): { productive: number; wasted: number } {
  const jsonlPath = join(sessionDir, "session.jsonl");
  if (!existsSync(jsonlPath)) return { productive: 0, wasted: 0 };

  let productive = 0;
  let wasted = 0;

  try {
    const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "toolResult" || entry.role === "tool") {
          const isError = entry.isError === true || entry.content?.some?.((c: any) => c.type === "text" && c.text?.includes?.("Error:"));
          if (isError) wasted++;
          else productive++;
        }
      } catch { /* skip bad line */ }
    }
  } catch { /* ignore read errors */ }

  return { productive, wasted };
}

function computeEvaluation(meta: SessionMeta, sessionDir: string): {
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string[];
  evaluatedByHeuristic: boolean;
  skippedByJs: boolean;
} {
  const agent = meta.agent || "unknown";
  const status = meta.status || "unknown";
  const opCount = meta.opCount || 0;

  // Skip evaluator sessions (meta agents)
  if (agent === "evaluator") {
    return {
      quality: 0, efficiency: 0,
      productiveCalls: 0, wastedCalls: 0,
      verdict: "skipped",
      issues: [`meta_agent_skipped (${agent})`],
      evaluatedByHeuristic: false,
      skippedByJs: true,
    };
  }

  // Skip 0-op interrupted sessions
  if (status === "interrupted" && opCount === 0) {
    return {
      quality: 0, efficiency: 0,
      productiveCalls: 0, wastedCalls: 0,
      verdict: "skipped",
      issues: [],
      evaluatedByHeuristic: false,
      skippedByJs: true,
    };
  }

  const { productive, wasted } = countToolCalls(sessionDir);

  // Error sessions
  if (status === "error") {
    const issues: string[] = ["session_error"];
    if (opCount <= 2) issues.push("shallow_session");
    return {
      quality: 1, efficiency: 3,
      productiveCalls: productive, wastedCalls: wasted,
      verdict: "needs_improvement",
      issues,
      evaluatedByHeuristic: true,
      skippedByJs: false,
    };
  }

  // Shallow sessions (very few ops, not a normal completion)
  if (opCount <= 2 && status === "done") {
    return {
      quality: 5, efficiency: 4,
      productiveCalls: productive, wastedCalls: wasted,
      verdict: "good",
      issues: [],
      evaluatedByHeuristic: true,
      skippedByJs: false,
    };
  }

  // Compute efficiency based on waste ratio
  let effScore = 4;
  const totalCalls = productive + wasted;
  if (totalCalls > 0) {
    const wasteRatio = wasted / totalCalls;
    if (wasteRatio > 0.3) effScore = 2;
    else if (wasteRatio > 0.15) effScore = 3;
    else effScore = 4;
  }

  // Default: done session with reasonable ops
  const issues: string[] = [];
  let quality = 5;
  let verdict = "good";

  // Flag high waste
  if (wasted > 5 && totalCalls > 0 && wasted / totalCalls > 0.2) {
    issues.push("high_waste_ratio");
    quality = 4;
    verdict = "acceptable";
  }

  // Flag very high op count (possible runaway)
  if (opCount > 100) {
    issues.push("high_op_count");
    if (quality > 3) quality = 4;
  }

  return {
    quality,
    efficiency: effScore,
    productiveCalls: productive,
    wastedCalls: wasted,
    verdict,
    issues,
    evaluatedByHeuristic: true,
    skippedByJs: false,
  };
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const sessionsDir = join(ctx.projectRoot, ".state", "sessions");
    const dbPath = join(ctx.projectRoot, ".state", "may.db");

    // Use our own connection (same pattern as session-sync fix)
    const db = new Database(dbPath);

    try {
      // Get already-evaluated session IDs
      const evaluatedIds = new Set<string>();
      const rows = db.prepare("SELECT sessionId FROM evaluations").all() as Array<{ sessionId: string }>;
      for (const r of rows) evaluatedIds.add(r.sessionId);

      // Get all session IDs from the sessions table
      const sessions = db.prepare(
        "SELECT sessionId, agent, status, opCount FROM sessions WHERE status IN ('done', 'error', 'interrupted')"
      ).all() as Array<{ sessionId: string; agent: string; status: string; opCount: number }>;

      const unevaluated = sessions.filter(s => !evaluatedIds.has(s.sessionId));
      if (unevaluated.length === 0) return;

      const upsert = db.prepare(`
        INSERT OR REPLACE INTO evaluations
          (sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
           verdict, issues, overall, usage, failureChains,
           evaluatedByHeuristic, skippedByJs, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let synced = 0;
      const MAX_PER_RUN = 50; // Limit to avoid very long runs

      const transaction = db.transaction(() => {
        for (const session of unevaluated.slice(0, MAX_PER_RUN)) {
          // Find the session directory
          let sessionDir = join(sessionsDir, session.sessionId);
          if (!existsSync(sessionDir)) {
            sessionDir = join(sessionsDir, "history", session.sessionId);
          }

          const metaPath = join(sessionDir, "meta.json");
          const meta = existsSync(metaPath) ? loadSessionMeta(metaPath) : null;
          if (!meta) {
            // Minimal evaluation from DB data only
            const isEvaluator = session.agent === "evaluator";
            const isError = session.status === "error";
            upsert.run(
              session.sessionId,
              session.agent,
              isEvaluator ? 0 : isError ? 1 : 5,
              isEvaluator ? 0 : isError ? 3 : 4,
              0, 0,
              isEvaluator ? "skipped" : isError ? "needs_improvement" : "good",
              isEvaluator ? JSON.stringify([`meta_agent_skipped (${session.agent})`]) : "[]",
              JSON.stringify({
                quality: isEvaluator ? 0 : isError ? 1 : 5,
                efficiency: isEvaluator ? 0 : isError ? 3 : 4,
                verdict: isEvaluator ? "skipped" : isError ? "needs_improvement" : "good",
                result_delivered: !isEvaluator && !isError,
              }),
              JSON.stringify({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 }),
              "[]",
              isEvaluator ? 0 : 1,
              isEvaluator ? 1 : 0,
              Date.now(),
            );
            synced++;
            continue;
          }

          const evaluation = computeEvaluation(meta, sessionDir);
          const usage = loadSessionUsage(sessionDir);

          upsert.run(
            session.sessionId,
            session.agent,
            evaluation.quality,
            evaluation.efficiency,
            evaluation.productiveCalls,
            evaluation.wastedCalls,
            evaluation.verdict,
            JSON.stringify(evaluation.issues),
            JSON.stringify({
              quality: evaluation.quality,
              efficiency: evaluation.efficiency,
              verdict: evaluation.verdict,
              result_delivered: evaluation.verdict !== "skipped" && evaluation.verdict !== "needs_improvement",
            }),
            JSON.stringify(usage),
            "[]", // failureChains — would need tool-quality-scan logic to populate
            evaluation.evaluatedByHeuristic ? 1 : 0,
            evaluation.skippedByJs ? 1 : 0,
            Date.now(),
          );
          synced++;
        }
      });

      transaction();

      if (synced > 0) {
        ctx.log(`[evaluation-sync] Synced ${synced} evaluations (${unevaluated.length - synced} remaining)`);
      }
    } finally {
      db.close();
    }
  };
};
