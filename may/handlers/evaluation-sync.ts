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
 * ## Scale: 0.0–1.0 (unified with LLM evaluator, per DOMAIN.md)
 *
 * All scores are on a 0.0–1.0 scale to match the LLM evaluator's DOMAIN.md spec.
 * This enables cross-method comparisons (heuristic vs LLM) without scale conversion.
 *
 * Scoring logic:
 * - Evaluator sessions → skipped (meta agents don't evaluate themselves)
 * - Error sessions → Q:0.1, E:0.4, needs_improvement
 * - 0-op interrupted → skipped
 * - Done sessions → Q:1.0, E:0.8, good (default heuristic)
 * - Shallow sessions (≤2 ops, not evaluator) → Q:1.0, E:0.8, good
 *
 * Verdict thresholds (same as DOMAIN.md):
 * - good: efficiency ≥ 0.7 AND quality ≥ 0.7
 * - acceptable: efficiency ≥ 0.4 AND quality ≥ 0.4
 * - needs_improvement: any metric < 0.4
 *
 * On first run after upgrade, migrates existing 1-5 scale scores to 0-1.
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { evaluateStandaloneSession } from "../../../src/lib/evaluator.js";

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

  // Evaluator sessions are meta agents — skip them (don't assign quality scores).
  // We still write a skip row so they don't pile up as "unevaluated" backlog
  // (see system-status anomaly: writeSkippedEvaluations may need to run).
  if (agent === "evaluator") {
    return {
      quality: 0, efficiency: 0,
      productiveCalls: 0, wastedCalls: 0,
      verdict: "skipped",
      issues: [],
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
      quality: 0.1, efficiency: 0.4,
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
      quality: 1.0, efficiency: 0.8,
      productiveCalls: productive, wastedCalls: wasted,
      verdict: "good",
      issues: [],
      evaluatedByHeuristic: true,
      skippedByJs: false,
    };
  }

  // Compute efficiency based on waste ratio
  let effScore = 0.8;
  const totalCalls = productive + wasted;
  if (totalCalls > 0) {
    const wasteRatio = wasted / totalCalls;
    if (wasteRatio > 0.3) effScore = 0.3;
    else if (wasteRatio > 0.15) effScore = 0.5;
    else effScore = 0.8;
  }

  // Default: done session with reasonable ops
  const issues: string[] = [];
  let quality = 1.0;
  let verdict = "good";

  // Flag high waste
  if (wasted > 5 && totalCalls > 0 && wasted / totalCalls > 0.2) {
    issues.push("high_waste_ratio");
    quality = 0.75;
    verdict = "acceptable";
  }

  // Flag very high op count (possible runaway)
  if (opCount > 100) {
    issues.push("high_op_count");
    if (quality > 0.5) quality = 0.75;
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
      // ── Migration: convert existing 1-5 scale scores to 0-1 ──────────
      // The old heuristic evaluator used 1-5 scale (matching evaluator-scoring SKILL.md).
      // DOMAIN.md uses 0-1 scale. This one-time migration normalizes all existing
      // heuristic evaluations to 0-1 so cross-method comparisons work.
      // Detection: if any heuristic evaluation has quality > 1.0, it's old-scale.
      const oldScaleCount = (db.prepare(
        "SELECT COUNT(*) as cnt FROM evaluations WHERE evaluatedByHeuristic = 1 AND (quality > 1.0 OR efficiency > 1.0)"
      ).get() as { cnt: number }).cnt;
      if (oldScaleCount > 0) {
        // Convert 1-5 → 0-1: newScore = (oldScore - 1) / 4
        // quality: 1→0.0, 2→0.25, 3→0.5, 4→0.75, 5→1.0
        // efficiency: same mapping
        db.exec(`
          UPDATE evaluations
          SET quality = ROUND((quality - 1.0) / 4.0, 2),
              efficiency = ROUND((efficiency - 1.0) / 4.0, 2),
              overall = json_set(
                json_set(overall, '$.quality', ROUND((quality - 1.0) / 4.0, 2)),
                '$.efficiency', ROUND((efficiency - 1.0) / 4.0, 2)
              )
          WHERE evaluatedByHeuristic = 1 AND (quality > 1.0 OR efficiency > 1.0)
        `);
        ctx.log(`[evaluation-sync] Migrated ${oldScaleCount} evaluations from 1-5 scale to 0-1`);
      }

      // Get already-evaluated session IDs
      const evaluatedIds = new Set<string>();
      const rows = db.prepare("SELECT sessionId FROM evaluations").all() as Array<{ sessionId: string }>;
      for (const r of rows) evaluatedIds.add(r.sessionId);

      // Get all session IDs from the sessions table.
      // Include evaluator sessions — they get a skip row (via computeEvaluation
      // early branch) so they don't accumulate as unevaluated backlog. Previously
      // they were filtered here, causing the system-status anomaly to fire forever.
      const sessions = db.prepare(
        "SELECT sessionId, agent, task, status, opCount FROM sessions WHERE status IN ('done', 'error', 'interrupted')"
      ).all() as Array<{ sessionId: string; agent: string; task: string; status: string; opCount: number }>;

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
            if (isEvaluator) {
              // Evaluator sessions: write skip row so they don't become permanent backlog.
              upsert.run(
                session.sessionId,
                session.agent,
                0, 0,
                0, 0,
                "skipped",
                "[]",
                JSON.stringify({ quality: 0, efficiency: 0, verdict: "skipped", result_delivered: false }),
                JSON.stringify({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 }),
                "[]",
                0, // evaluatedByHeuristic
                1, // skippedByJs
                Date.now(),
              );
              synced++;
              continue;
            }
            upsert.run(
              session.sessionId,
              session.agent,
              isError ? 0.1 : 1.0,
              isError ? 0.4 : 0.8,
              0, 0,
              isError ? "needs_improvement" : "good",
              "[]",
              JSON.stringify({
                quality: isError ? 0.1 : 1.0,
                efficiency: isError ? 0.4 : 0.8,
                verdict: isError ? "needs_improvement" : "good",
                result_delivered: !isError,
              }),
              JSON.stringify({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 }),
              "[]",
              1,
              0,
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

      // ── LLM evaluation sampling (~30% of heuristic-evaluated sessions) ──
      // After heuristic batch, upgrade a random sample to LLM evaluation.
      // This runs OUTSIDE the transaction since it's async and spawns child sessions.
      const MAX_LLM_PER_RUN = 5;
      const heuristicSessions = unevaluated.slice(0, MAX_PER_RUN).filter(s => {
        // Only sample sessions that were actually heuristic-evaluated (not skipped)
        const isSkipped = s.status === "interrupted" && (s.opCount || 0) === 0;
        return !isSkipped;
      });

      // Sample ~30%
      const sampled = heuristicSessions
        .filter(() => Math.random() < 0.3)
        .slice(0, MAX_LLM_PER_RUN);

      if (sampled.length > 0) {
        ctx.log(`[evaluation-sync] LLM-evaluating ${sampled.length} of ${heuristicSessions.length} heuristic sessions`);

        let llmEvaluated = 0;
        for (const session of sampled) {
          try {
            const result = await evaluateStandaloneSession({
              manager: ctx.manager,
              persistDir: join(ctx.projectRoot, ".state"),
              sessionId: session.sessionId,
              agent: session.agent,
              task: session.task,
              status: session.status,
            });

            if (result) {
              llmEvaluated++;
              ctx.log(
                `[evaluation-sync] LLM eval: ${session.agent}/${session.sessionId} → ` +
                `Q:${result.quality.toFixed(2)} E:${result.efficiency.toFixed(2)} ${result.verdict}`,
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ctx.log(`[evaluation-sync] LLM eval error for ${session.sessionId}: ${msg}`);
          }
        }

        if (llmEvaluated > 0) {
          ctx.log(`[evaluation-sync] Upgraded ${llmEvaluated}/${sampled.length} sessions to LLM evaluation`);
        }
      }
    } finally {
      db.close();
    }
  };
};
