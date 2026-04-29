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
const MAX_SESSIONS_PER_RUN = 8; // Cap LLM evaluations per run to control costs
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // Only process sessions from last 6 hours

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
  // Keep only last 500 processed IDs to avoid unbounded growth
  state.processedSessionIds = state.processedSessionIds.slice(-500);
  writeFileSync(path, JSON.stringify(state, null, 2));
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
      .sort((a, b) => b.ts - a.ts) // newest first
      .slice(0, MAX_SESSIONS_PER_RUN * 3); // read more than needed, some will be filtered

    for (const { dir } of recentSessions) {
      if (evaluated >= MAX_SESSIONS_PER_RUN) break;

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

      // Only process completed sessions
      if (!meta.agent || meta.status !== "done") continue;
      if (SKIP_AGENTS.has(meta.agent)) continue;

      // Run standalone evaluation
      try {
        const result = await evaluateStandaloneSession({
          manager: ctx.manager,
          ctx,
          sessionId,
          agent: meta.agent,
          task: meta.task || "unknown",
          status: meta.status,
        });

        evaluated++;
        processedSet.add(sessionId);
        state.processedSessionIds.push(sessionId);

        if (result) {
          ctx.log(`[eval-poller] Evaluated ${meta.agent}/${sessionId}: Q=${result.quality} E=${result.efficiency} ${result.verdict}`);

          // Dispatch context-learn event for this session
          ctx.dispatchEvent("context-learn", {
            agentName: meta.agent,
            sessionId,
            persistDir: ctx.persistDir,
          });
        } else {
          ctx.log(`[eval-poller] Skipped ${meta.agent}/${sessionId} (already evaluated or no messages)`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.log(`[eval-poller] Failed to evaluate ${sessionId}: ${msg}`);
        // Still mark as processed to avoid retrying broken sessions forever
        processedSet.add(sessionId);
        state.processedSessionIds.push(sessionId);
      }
    }

    state.lastRunAt = now;
    saveState(ctx.persistDir, state);

    if (evaluated > 0) {
      ctx.log(`[eval-poller] Evaluated ${evaluated} session(s)`);
    } else {
      ctx.log(`[eval-poller] No new sessions to evaluate`);
    }
  };
};
