/**
 * context-learn-poller — Cron-based poller that bypasses the broken session.completed event chain.
 *
 * Problem: session-eval listens for `session.completed` events, but nothing in the runtime
 * emits that event. This means context-learn never fires organically.
 *
 * Solution: This handler runs every 30 minutes, scans recent completed sessions,
 * and dispatches `context-learn` events directly for unprocessed sessions.
 * Skips session-eval (evaluation) step — goes straight to lesson extraction.
 *
 * Tracks processed sessions in a state file to avoid re-processing.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import type { HandlerContext, HandlerModule, CronEntry } from "../../shared/agent-sdk.js";

const STATE_FILE = "context-learn-poller-processed.json";
const MAX_SESSIONS_PER_RUN = 20;
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // Only process sessions from last 6 hours

// Agents to skip (meta-agents that shouldn't generate lessons)
// NOTE: coach removed — downstream context-learn handler has its own exclusion list
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
      ctx.log("[context-learn-poller] No history directory found");
      return;
    }

    const state = loadState(ctx.persistDir);
    const processedSet = new Set(state.processedSessionIds);
    const now = Date.now();
    let dispatched = 0;

    // Scan history directory for recent sessions
    let sessionDirs: string[];
    try {
      sessionDirs = readdirSync(historyDir);
    } catch {
      ctx.log("[context-learn-poller] Failed to read history directory");
      return;
    }

    // Filter to recent sessions (extract timestamp from dir name like s_1234567890_42 or cron_1234567890_42)
    const recentSessions = sessionDirs
      .filter((dir) => dir.startsWith("s_") || dir.startsWith("cron_"))
      .map((dir) => {
        const parts = dir.split("_");
        const ts = parseInt(parts[1], 10);
        return { dir, ts };
      })
      .filter(({ ts }) => !isNaN(ts) && now - ts < MAX_AGE_MS)
      .sort((a, b) => b.ts - a.ts) // newest first
      .slice(0, MAX_SESSIONS_PER_RUN * 2); // read more than needed, some will be filtered

    for (const { dir } of recentSessions) {
      if (dispatched >= MAX_SESSIONS_PER_RUN) break;

      const sessionId = dir;
      if (processedSet.has(sessionId)) continue;

      // Read meta to get agent name and check completion
      const metaPath = resolve(historyDir, dir, "meta.json");
      if (!existsSync(metaPath)) continue;

      let meta: { agent?: string; status?: string; kind?: string; parentSessionId?: string };
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch {
        continue;
      }

      // Only process completed sessions with an agent
      if (!meta.agent || meta.status !== "done") continue;
      if (SKIP_AGENTS.has(meta.agent)) continue;

      // Dispatch context-learn event directly
      try {
        ctx.dispatchEvent("context-learn", {
          agentName: meta.agent,
          sessionId,
          persistDir: ctx.persistDir,
        });
        dispatched++;
        processedSet.add(sessionId);
        state.processedSessionIds.push(sessionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.log(`[context-learn-poller] Failed to dispatch for ${sessionId}: ${msg}`);
      }
    }

    state.lastRunAt = now;
    saveState(ctx.persistDir, state);

    if (dispatched > 0) {
      ctx.log(`[context-learn-poller] Dispatched ${dispatched} context-learn event(s)`);
    }
  };
};
