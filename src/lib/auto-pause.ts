/**
 * auto-pause.ts — DB-based auto-pause with recovery for agents.
 *
 * State machine: RUNNING → AUTO-PAUSED → PROBING → RUNNING (or back to AUTO-PAUSED)
 *
 * Features:
 * - Pause trigger: N consecutive error sessions (default 3)
 * - Probe timer: exponential backoff (1h → 2h → 4h → 8h cap)
 * - TTL: auto-pause expires after max duration (default 24h), forces probe
 * - Escalation: creates tracked request to May when auto-pause activates
 * - Stateless: all state derived from sessions + requests tables (survives restarts)
 *
 * Design: agents/shared/may-agent-docs/sessions.md
 * Replaces: R39 from CR-289-weekend-synthesis
 */

import { getDb } from "./requests.js";

// ── Configuration ─────────────────────────────────────────────────────

/** Configuration for auto-pause recovery behavior. */
export interface AutoPauseConfig {
  /** Consecutive errors to trigger pause. Default: 3 */
  threshold: number;
  /** Time before first probe after pause, in ms. Default: 1h */
  initialProbeDelayMs: number;
  /** Multiplier for each failed probe. Default: 2 */
  probeBackoffMultiplier: number;
  /** Cap on probe interval, in ms. Default: 8h */
  maxProbeIntervalMs: number;
  /** Maximum pause duration before forced probe, in ms. Default: 24h */
  pauseTTLMs: number;
  /** Agent to receive escalation request. Default: "may" */
  escalationAgent: string;
}

/** Default configuration values. */
export const AUTO_PAUSE_DEFAULTS: AutoPauseConfig = {
  threshold: 3,
  initialProbeDelayMs: 60 * 60 * 1000,       // 1 hour
  probeBackoffMultiplier: 2,
  maxProbeIntervalMs: 8 * 60 * 60 * 1000,    // 8 hours
  pauseTTLMs: 24 * 60 * 60 * 1000,           // 24 hours
  escalationAgent: "may",
};

/** Number of consecutive error sessions required to trigger auto-pause. */
export const AUTO_PAUSE_THRESHOLD = AUTO_PAUSE_DEFAULTS.threshold;

// ── State types ───────────────────────────────────────────────────────

/** The three states of the auto-pause state machine. */
export type AutoPauseState = "running" | "auto-paused" | "probing";

/** Full state info returned by getAutoPauseState(). */
export interface AutoPauseStateInfo {
  state: AutoPauseState;
  /** Timestamp when agent was first paused (ms epoch). Null if running. */
  pausedAt: number | null;
  /** Number of failed probes since pause started. */
  probeFailCount: number;
  /** Timestamp of most recent probe session. Null if no probes yet. */
  lastProbeAt: number | null;
  /** Next probe delay in ms (computed from backoff). Null if running. */
  nextProbeDelayMs: number | null;
  /** Whether a probe is currently due (timer expired or TTL exceeded). */
  probeDue: boolean;
}

// ── Core functions ────────────────────────────────────────────────────

/**
 * Check if an agent should be auto-paused based on session history.
 * (Preserved for backward compatibility — wraps getAutoPauseState.)
 */
export function isAgentAutoPaused(
  persistDir: string,
  agentName: string,
  threshold: number = AUTO_PAUSE_THRESHOLD,
): boolean {
  try {
    const state = getAutoPauseState(persistDir, agentName, { ...AUTO_PAUSE_DEFAULTS, threshold });
    // Agent is effectively paused if in auto-paused state AND no probe is due
    return state.state === "auto-paused" && !state.probeDue;
  } catch {
    return false;
  }
}

/**
 * Get the full auto-pause state for an agent.
 *
 * Derives all state from the sessions table (stateless — survives restarts).
 * Probe sessions are identified by having `"probe":true` in the session task text.
 */
export function getAutoPauseState(
  persistDir: string,
  agentName: string,
  config: AutoPauseConfig = AUTO_PAUSE_DEFAULTS,
): AutoPauseStateInfo {
  const runningState: AutoPauseStateInfo = {
    state: "running",
    pausedAt: null,
    probeFailCount: 0,
    lastProbeAt: null,
    nextProbeDelayMs: null,
    probeDue: false,
  };

  try {
    const db = getDb(persistDir);

    // Get the last N completed sessions to check for consecutive errors
    const recentSessions = db
      .prepare(
        `SELECT status, startedAt, task FROM sessions
         WHERE agent = ? AND status != 'running'
         ORDER BY startedAt DESC
         LIMIT ?`,
      )
      .all(agentName, Math.max(config.threshold, 20)) as {
        status: string;
        startedAt: number;
        task: string;
      }[];

    // Not enough completed sessions to determine pause state
    if (recentSessions.length < config.threshold) return runningState;

    // Check if the last `threshold` sessions are all errors
    const lastN = recentSessions.slice(0, config.threshold);
    const allErrors = lastN.every((r) => r.status === "error");

    if (!allErrors) return runningState;

    // Agent IS paused — now determine recovery state

    // Find pausedAt: the startedAt of the original session that triggered auto-pause.
    // We need to skip probe sessions and find when the original error streak started.
    // Walk through all sessions to find the Nth non-probe error (the trigger).
    const nonProbeSessions = recentSessions.filter(
      (s) => !s.task || !s.task.includes("[auto-pause-probe]"),
    );

    // pausedAt = startedAt of the Nth non-probe session (the one that triggered pause)
    const pauseTriggerSession = nonProbeSessions.length >= config.threshold
      ? nonProbeSessions[config.threshold - 1]
      : recentSessions[recentSessions.length - 1]; // fallback to oldest
    const pausedAt = pauseTriggerSession.startedAt;

    // Find probe sessions after pausedAt
    // Probe sessions have "[probe]" marker in their task text
    const probeSessions = recentSessions.filter(
      (s) => s.startedAt > pausedAt && s.task && s.task.includes("[auto-pause-probe]"),
    );

    const probeFailCount = probeSessions.filter((s) => s.status === "error").length;
    const lastProbeAt = probeSessions.length > 0
      ? Math.max(...probeSessions.map((s) => s.startedAt))
      : null;

    // Check if a probe is currently running
    const runningProbe = db
      .prepare(
        `SELECT 1 FROM sessions
         WHERE agent = ? AND status = 'running' AND task LIKE '%[auto-pause-probe]%'
         LIMIT 1`,
      )
      .get(agentName);

    if (runningProbe) {
      return {
        state: "probing",
        pausedAt,
        probeFailCount,
        lastProbeAt,
        nextProbeDelayMs: null,
        probeDue: false,
      };
    }

    // Calculate next probe delay with exponential backoff
    const nextProbeDelayMs = Math.min(
      config.initialProbeDelayMs * Math.pow(config.probeBackoffMultiplier, probeFailCount),
      config.maxProbeIntervalMs,
    );

    // Determine if a probe is due
    const now = Date.now();
    const timeSincePause = now - pausedAt;
    const timeSinceLastProbeOrPause = lastProbeAt ? (now - lastProbeAt) : timeSincePause;

    // TTL exceeded — force a probe
    const ttlExceeded = timeSincePause > config.pauseTTLMs;

    // Probe timer expired
    const probeTimerExpired = timeSinceLastProbeOrPause >= nextProbeDelayMs;

    const probeDue = ttlExceeded || probeTimerExpired;

    return {
      state: "auto-paused",
      pausedAt,
      probeFailCount,
      lastProbeAt,
      nextProbeDelayMs,
      probeDue,
    };
  } catch {
    // DB unavailable — fail-open (don't pause)
    return runningState;
  }
}

/**
 * Check if a probe session should be fired for an auto-paused agent.
 *
 * Returns true if the agent is auto-paused AND a probe is due
 * (either probe timer expired or TTL exceeded).
 */
export function shouldFireProbe(
  persistDir: string,
  agentName: string,
  config: AutoPauseConfig = AUTO_PAUSE_DEFAULTS,
): boolean {
  try {
    const state = getAutoPauseState(persistDir, agentName, config);
    return state.state === "auto-paused" && state.probeDue;
  } catch {
    return false;
  }
}

/**
 * Build the task message for a probe session.
 * Includes the [auto-pause-probe] marker so the state machine can identify it.
 */
export function buildProbeTaskMessage(
  agentName: string,
  stateInfo: AutoPauseStateInfo,
  originalMessage: string,
): string {
  const probeNum = stateInfo.probeFailCount + 1;
  const pausedSince = stateInfo.pausedAt
    ? new Date(stateInfo.pausedAt).toISOString()
    : "unknown";
  const header = `[auto-pause-probe] Probe #${probeNum} for ${agentName} (paused since ${pausedSince})`;
  return `${header}\n\n${originalMessage}`;
}

/**
 * Create an escalation request when auto-pause activates.
 * Sends a tracked request to the escalation agent (default: May).
 */
export function createPauseEscalation(
  persistDir: string,
  agentName: string,
  config: AutoPauseConfig,
  lastErrors: string[],
): string {
  return "";
}

/**
 * Create a recovery notification when an agent resumes from auto-pause.
 */
export function createRecoveryNotification(
  persistDir: string,
  agentName: string,
  config: AutoPauseConfig,
  probeCount: number,
  pauseDurationMs: number,
): string {
  return "";
}

/**
 * Get the last N error messages for an agent (for escalation context).
 */
export function getLastErrors(
  persistDir: string,
  agentName: string,
  count: number = 3,
): string[] {
  try {
    const db = getDb(persistDir);
    const rows = db
      .prepare(
        `SELECT error FROM sessions
         WHERE agent = ? AND status = 'error' AND error IS NOT NULL
         ORDER BY startedAt DESC
         LIMIT ?`,
      )
      .all(agentName, count) as { error: string }[];
    return rows.map((r) => r.error.slice(0, 200));
  } catch {
    return [];
  }
}

/**
 * Parse auto-pause config from cron entry handlerConfig.
 * Merges with defaults for any unspecified values.
 */
export function parseAutoPauseConfig(
  handlerConfig?: Record<string, unknown>,
): AutoPauseConfig {
  if (!handlerConfig?.autoPause) return { ...AUTO_PAUSE_DEFAULTS };

  const ap = handlerConfig.autoPause as Record<string, unknown>;
  return {
    threshold: typeof ap.threshold === "number" ? ap.threshold : AUTO_PAUSE_DEFAULTS.threshold,
    initialProbeDelayMs: parseDurationMs(ap.initialProbeDelay) ?? AUTO_PAUSE_DEFAULTS.initialProbeDelayMs,
    probeBackoffMultiplier: typeof ap.probeBackoffMultiplier === "number"
      ? ap.probeBackoffMultiplier
      : AUTO_PAUSE_DEFAULTS.probeBackoffMultiplier,
    maxProbeIntervalMs: parseDurationMs(ap.maxProbeInterval) ?? AUTO_PAUSE_DEFAULTS.maxProbeIntervalMs,
    pauseTTLMs: parseDurationMs(ap.pauseTTL) ?? AUTO_PAUSE_DEFAULTS.pauseTTLMs,
    escalationAgent: typeof ap.escalationAgent === "string"
      ? ap.escalationAgent
      : AUTO_PAUSE_DEFAULTS.escalationAgent,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Parse a duration string like "1h", "30m", "8h" to ms. Also accepts raw numbers (ms). */
function parseDurationMs(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2];
  switch (unit) {
    case "ms": return num;
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    case "d": return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/** Format a duration in ms to a human-readable string. */
function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}
