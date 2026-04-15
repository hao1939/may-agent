/**
 * watchdog.ts — Monitors running sessions and cancels those exceeding timeouts.
 *
 * Checks all running sessions, warns at >75% of timeout, and cancels at 100%.
 * Skips persistent agent sessions (may without parentSessionId).
 */

import type { HandlerContext } from "../../../src/lib/handler-context.js";

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

/** Per-agent default timeouts (can be overridden via config) */
const AGENT_TIMEOUTS: Record<string, number> = {
  evaluator: 90 * 60 * 1000, // 90 minutes
};

export interface WatchdogConfig {
  agentTimeouts?: Record<string, number>;
  dryRun?: boolean;
}

interface SessionInfo {
  agent: string;
  sessionId: string;
  status: string;
  startedAt: number;
  parentSessionId?: string;
  autoClose?: string;
}

export interface WatchdogResult {
  checked: number;
  cancelled: Array<{ sessionId: string; agent: string; runtime: number }>;
  warned: Array<{ sessionId: string; agent: string; runtime: number }>;
}

export function runWatchdog(ctx: HandlerContext, config: WatchdogConfig): WatchdogResult {
  const now = Date.now();
  const sessions: SessionInfo[] = ctx.manager.status();
  const agentTimeouts = { ...AGENT_TIMEOUTS, ...(config.agentTimeouts ?? {}) };

  let checked = 0;
  const cancelled: WatchdogResult["cancelled"] = [];
  const warned: WatchdogResult["warned"] = [];

  for (const session of sessions) {
    // Skip non-running
    if (session.status !== "running") continue;

    // Skip persistent agent sessions (may without parentSessionId, autoClose=never)
    if (session.autoClose === "never" && !session.parentSessionId) continue;

    checked++;

    const timeout = agentTimeouts[session.agent] ?? DEFAULT_TIMEOUT_MS;
    const runtime = now - session.startedAt;

    if (runtime >= timeout) {
      // Cancel
      cancelled.push({ sessionId: session.sessionId, agent: session.agent, runtime });
      if (!config.dryRun) {
        ctx.manager.cancel(session.sessionId);
      }
    } else if (runtime >= timeout * 0.75) {
      // Warn
      warned.push({ sessionId: session.sessionId, agent: session.agent, runtime });
    }
  }

  return { checked, cancelled, warned };
}
