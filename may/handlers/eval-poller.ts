/**
 * eval-poller — Cron-based poller that evaluates recent completed sessions.
 *
 * Problem: session-eval listens for `session.completed` events, but nothing in
 * the runtime emits that event. Additionally, all sessions have null parentSessionId,
 * so evaluateTask() (which requires parent-child relationships) finds 0 children.
 *
 * Solution: This handler runs every 30 minutes, scans recent completed sessions,
 * and evaluates them using evaluateStandaloneSession() which works on individual
 * sessions without requiring parent-child relationships.
 *
 * After evaluating, dispatches context-learn events for each evaluated session.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import type { HandlerContext, HandlerModule, CronEntry } from "../../shared/agent-sdk.js";
import { evaluateStandaloneSession } from "../../shared/evaluation/evaluator.js";

const STATE_FILE = "eval-poller-processed.json";
const MAX_LLM_EVALS_PER_RUN = 1; // LLM evals can approach the 300s handler timeout; run at most one per poll
const MAX_HEURISTIC_EVALS_PER_RUN = 200; // Heuristic evals are instant (no LLM) — process in bulk
const WALL_CLOCK_BUDGET_MS = 150_000; // Total handler budget; keep margin below the platform's 300s timeout
const MIN_REMAINING_MS_FOR_LLM_EVAL = 120_000; // Do not start a slow LLM eval without enough timeout headroom
const LLM_EVAL_TIMEOUT_MS = 110_000; // Bound one slow evaluator session so eval-poller itself can exit cleanly
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days to match coverage metric window

// Meta-agents that shouldn't be evaluated
const SKIP_AGENTS = new Set(["evaluator", "judge"]);

interface ProcessedState {
  lastRunAt: number;
  processedSessionIds: string[];
}

function loadState(persistDir: string): ProcessedState {
  const path = resolve(persistDir, STATE_FILE);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      // Corrupted state, start fresh
    }
  }
  return { lastRunAt: 0, processedSessionIds: [] };
}

function saveState(persistDir: string, state: ProcessedState): void {
  const path = resolve(persistDir, STATE_FILE);
  mkdirSync(persistDir, { recursive: true });
  // Keep processed IDs bounded — 10k covers ~1 week of bulk processing
  state.processedSessionIds = state.processedSessionIds.slice(-10000);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const historyDir = resolve(".state/sessions/history");
    if (!existsSync(historyDir)) {
      ctx.log("[eval-poller] No history directory found");
      return;
    }

    const state = loadState(ctx.persistDir);
    const processedSet = new Set(state.processedSessionIds);
    const now = Date.now();
    const deadline = now + WALL_CLOCK_BUDGET_MS;
    let evaluated = 0;

    // Scan history directory for recent sessions
    let sessionDirs: string[];
    try {
      sessionDirs = readdirSync(historyDir);
    } catch {
      ctx.log("[eval-poller] Failed to read history directory");
      return;
    }

    // Filter to recent sessions
    const recentSessions = sessionDirs
      .filter((dir) => dir.startsWith("s_") || dir.startsWith("cron_"))
      .map((dir) => {
        const parts = dir.split("_");
        const ts = parseInt(parts[1], 10);
        return { dir, ts };
      })
      .filter(({ ts }) => !isNaN(ts) && now - ts < MAX_AGE_MS)
      .sort((a, b) => b.ts - a.ts); // newest first

    let llmEvals = 0;
    let heuristicEvals = 0;
    let skippedNoEval = 0;

    for (const { dir } of recentSessions) {
      // Stop when both budgets exhausted or wall clock exceeded
      if (llmEvals >= MAX_LLM_EVALS_PER_RUN && heuristicEvals >= MAX_HEURISTIC_EVALS_PER_RUN) break;
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        ctx.log(`[eval-poller] Wall clock budget exceeded (${WALL_CLOCK_BUDGET_MS}ms), stopping early`);
        break;
      }

      const sessionId = dir;
      if (processedSet.has(sessionId)) continue;

      // Read meta to get agent name and check completion
      const metaPath = resolve(historyDir, dir, "meta.json");
      if (!existsSync(metaPath)) continue;

      let meta: { agent?: string; status?: string; task?: string };
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {
        continue;
      }

      // Only process completed sessions (done, error, failed, interrupted)
      if (!meta.agent || !meta.status) continue;
      if (meta.status !== "done" && meta.status !== "error" && meta.status !== "failed" && meta.status !== "interrupted") continue;
      if (SKIP_AGENTS.has(meta.agent)) continue;

      // Pre-check: will this session need LLM eval? Count messages to predict.
      const sessionJsonlPath = resolve(historyDir, dir, "session.jsonl");
      let msgCount = 0;
      if (existsSync(sessionJsonlPath)) {
        try {
          const content = readFileSync(sessionJsonlPath, "utf-8");
          msgCount = content.trim().split("\n").length;
        } catch { /* continue with 0 */ }
      }

      // Predict if heuristic (no LLM call needed):
      // - no messages → returns null (still mark processed)
      // - trivial error: status error/failed + ≤4 messages
      // - shallow: status done/interrupted + ≤3 messages
      // - read-only dispatcher sessions are also heuristic but hard to predict without parsing
      const willBeHeuristic =
        msgCount === 0 ||
        ((meta.status === "error" || meta.status === "failed") && msgCount <= 4) ||
        ((meta.status === "done" || meta.status === "interrupted") && msgCount <= 3);

      // Budget gating: skip if the relevant budget is exhausted.
      // LLM evaluations can take long enough to overrun the handler timeout, and
      // evaluateStandaloneSession() may retry once, so do not start one unless
      // there is explicit headroom remaining.
      if (!willBeHeuristic && llmEvals >= MAX_LLM_EVALS_PER_RUN) {
        continue;
      }
      if (!willBeHeuristic && deadline - Date.now() < MIN_REMAINING_MS_FOR_LLM_EVAL) {
        ctx.log(`[eval-poller] Remaining budget below ${MIN_REMAINING_MS_FOR_LLM_EVAL}ms; stopping before LLM eval`);
        break;
      }
      if (willBeHeuristic && heuristicEvals >= MAX_HEURISTIC_EVALS_PER_RUN) {
        continue;
      }

      // Run standalone evaluation
      try {
        const evalPromise = evaluateStandaloneSession({
          manager: ctx.manager,
          ctx,
          sessionId,
          agent: meta.agent,
          task: meta.task || "unknown",
          status: meta.status,
        });
        const result = willBeHeuristic
          ? await evalPromise
          : await withTimeout(evalPromise, Math.min(LLM_EVAL_TIMEOUT_MS, Math.max(1_000, deadline - Date.now())), `evaluation ${sessionId}`);

        processedSet.add(sessionId);
        state.processedSessionIds.push(sessionId);

        if (result) {
          if (willBeHeuristic) {
            heuristicEvals++;
          } else {
            // Check if the evaluator actually used a heuristic (read-only dispatcher etc.)
            // by looking at whether the result came back instantly (no LLM was called).
            // For safety, count against LLM budget regardless of prediction miss.
            llmEvals++;
          }
          evaluated++;
          ctx.log(`[eval-poller] Evaluated ${meta.agent}/${sessionId}: Q=${result.quality} E=${result.efficiency} ${result.verdict}`);

          // Dispatch context-learn event for this session
          ctx.dispatchEvent("context-learn", {
            agentName: meta.agent,
            sessionId,
            persistDir: ctx.persistDir,
          });
        } else {
          skippedNoEval++;
          ctx.log(`[eval-poller] Skipped ${meta.agent}/${sessionId} (already evaluated or no messages)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.log(`[eval-poller] Failed to evaluate ${sessionId}: ${msg}`);
        // Still mark as processed to avoid retrying broken sessions forever
        processedSet.add(sessionId);
        state.processedSessionIds.push(sessionId);
        if (!willBeHeuristic) llmEvals++; // Count against budget on failure too
      }
    }

    state.lastRunAt = now;
    saveState(ctx.persistDir, state);

    if (evaluated > 0) {
      ctx.log(`[eval-poller] Evaluated ${evaluated} session(s) (${llmEvals} LLM, ${heuristicEvals} heuristic, ${skippedNoEval} skipped)`);
    } else {
      ctx.log(`[eval-poller] No new sessions to evaluate (${skippedNoEval} skipped)`);
    }
  };
};
