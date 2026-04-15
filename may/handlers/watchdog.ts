/**
 * Watchdog — stale session detector and canceller.
 *
 * Runs periodically (every 10 min) and checks for sessions that have been
 * "running" longer than their allowed threshold. Cancels them to prevent
 * resource leaks and stuck delegation chains.
 *
 * Thresholds are configurable per-agent via handlerConfig.agentTimeouts,
 * with a sensible default of 30 minutes for most agents.
 *
 * Persistent sessions (autoClose: "never") are never cancelled — they're
 * long-lived by design. Only "running" non-persistent sessions are eligible.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

/** Default max runtime for any session (60 minutes). */
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

/** Per-agent overrides — agents that do heavier work get more time. */
const DEFAULT_AGENT_TIMEOUTS: Record<string, number> = {
  evaluator: 90 * 60 * 1000,   // evaluator can be slower (LLM-as-judge)
  optimizer: 90 * 60 * 1000,   // optimizer does complex refactoring
  bob: 90 * 60 * 1000,         // bob does analysis + multi-file changes
  coach: 90 * 60 * 1000,       // coach runs exercises with sub-agents
  scout: 90 * 60 * 1000,       // scout does deep research that takes time
  "tech-lead": 90 * 60 * 1000, // tech-lead reviews can be thorough
};

export interface WatchdogResult {
  checked: number;
  cancelled: Array<{ sessionId: string; agent: string; runningMinutes: number }>;
  warned: Array<{ sessionId: string; agent: string; runningMinutes: number }>;
}

export interface WatchdogConfig {
  /** Per-agent timeout overrides in ms. Merged with defaults. */
  agentTimeouts?: Record<string, number>;
  /** Global default timeout in ms (overrides DEFAULT_TIMEOUT_MS). */
  defaultTimeoutMs?: number;
  /** Dry run — log but don't actually cancel. */
  dryRun?: boolean;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config: WatchdogConfig = (entry as any).handlerConfig ?? {};

  return async () => {
    const result = runWatchdog(ctx, config);

    if (result.cancelled.length > 0) {
      const details = result.cancelled
        .map((s) => `${s.agent}/${s.sessionId} (${s.runningMinutes}min)`)
        .join(", ");
      ctx.log(`[watchdog] ⚠️ Cancelled ${result.cancelled.length} stale session(s): ${details}`);
    }
    if (result.warned.length > 0) {
      const details = result.warned
        .map((s) => `${s.agent}/${s.sessionId} (${s.runningMinutes}min)`)
        .join(", ");
      ctx.log(`[watchdog] ⏳ ${result.warned.length} long-running session(s): ${details}`);
    }
  };
};

// ── Pure logic ────────────────────────────────────────────────────────

/**
 * Check all active sessions and cancel those exceeding their timeout.
 * Also warns about sessions at >75% of their timeout.
 */
export function runWatchdog(ctx: HandlerContext, config: WatchdogConfig): WatchdogResult {
  const { manager } = ctx;
  const now = Date.now();

  const defaultTimeout = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const agentTimeouts: Record<string, number> = {
    ...DEFAULT_AGENT_TIMEOUTS,
    ...(config.agentTimeouts ?? {}),
  };

  const sessions = manager.status();
  const result: WatchdogResult = {
    checked: 0,
    cancelled: [],
    warned: [],
  };

  for (const session of sessions) {
    // Skip non-running sessions
    if (session.status !== "running") continue;

    // Skip persistent/chat sessions (autoClose: "never") — they're long-lived by design.
    // Detected by session config rather than agent name (P44: no hardcoded agent names).
    if (session.autoClose === "never") continue;

    result.checked++;

    const runningMs = now - session.startedAt;
    const timeoutMs = agentTimeouts[session.agent] ?? defaultTimeout;
    const runningMinutes = Math.round(runningMs / 60_000);

    if (runningMs >= timeoutMs) {
      // Session has exceeded its timeout — cancel it
      if (!config.dryRun) {
        manager.cancel(session.sessionId);
      }
      result.cancelled.push({
        sessionId: session.sessionId,
        agent: session.agent,
        runningMinutes,
      });
    } else if (runningMs >= timeoutMs * 0.75) {
      // Session is at >75% of timeout — warn
      result.warned.push({
        sessionId: session.sessionId,
        agent: session.agent,
        runningMinutes,
      });
    }
  }

  return result;
}
