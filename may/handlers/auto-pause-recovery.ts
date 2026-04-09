/**
 * auto-pause-recovery — Circuit breaker recovery for auto-paused agents.
 *
 * Implements the RUNNING → AUTO-PAUSED → PROBING state machine described in
 * `agents/shared/may-agent-docs/design/auto-pause-recovery.md`.
 *
 * The `may-agent` binary has a built-in circuit breaker (`isAgentAutoPaused()`)
 * that halts heartbeats after N consecutive session errors. However, it has
 * NO recovery path — once paused, agents stay paused indefinitely.
 *
 * This handler runs on its own cron schedule (every 30 min) and:
 *   1. Detects which agents are auto-paused (N consecutive errors)
 *   2. Manages probe sessions with exponential backoff
 *   3. Clears pause state when probes succeed (by creating a successful session)
 *   4. Escalates to May (P1 request) on pause, notifies on recovery (P2)
 *   5. Enforces a TTL — no agent paused > 24h without at least one probe
 *
 * State is derived entirely from the sessions table (Option A from design doc).
 * Probe sessions are tagged with source="probe" so they can be identified.
 *
 * Design: agents/shared/may-agent-docs/design/auto-pause-recovery.md
 * Review: agents/tech-lead/workspace/review-auto-pause-recovery.md
 *
 * Addresses review feedback:
 *   F1: Any non-error status counts as probe success (infra health, not task quality)
 *   F2: Watchdog timeout serves as probe timeout; watchdog-cancelled = failed probe
 *   F3: TTL forced probe → on fail, backoff doubles from current position, TTL resets
 *   F4: Implemented as JS handler (parallel to binary), not binary modification
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Configuration Defaults ────────────────────────────────────────────

/** Consecutive error sessions to consider an agent "auto-paused". */
const DEFAULT_PAUSE_THRESHOLD = 3;

/** Time before first probe after pause detection (ms). */
const DEFAULT_INITIAL_PROBE_DELAY_MS = 60 * 60 * 1000; // 1 hour

/** Multiplier for each failed probe. */
const DEFAULT_PROBE_BACKOFF_MULTIPLIER = 2;

/** Maximum interval between probes (ms). */
const DEFAULT_MAX_PROBE_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Maximum time an agent can stay paused before forced probe (ms). */
const DEFAULT_PAUSE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Agent to receive escalation requests. */
const DEFAULT_ESCALATION_AGENT = "may";

/** Timeout for probe sessions (ms). Subject to watchdog anyway. */
const PROBE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum turns for a probe session (minimal — just confirm it works). */
const PROBE_MAX_TURNS = 5;

/** Agents to monitor. Must have heartbeat entries in cron.json. */
const MONITORED_AGENTS = [
  "optimizer",
  "coach",
  "tech-lead",
  "bob",
  "scout",
  "amy-kimi",
  "qa",
  "evaluator",
];

// ── Types ─────────────────────────────────────────────────────────────

interface SessionRow {
  sessionId: string;
  agent: string;
  status: string;
  source: string | null;
  startedAt: number;
  endedAt: number | null;
  error: string | null;
}

interface PauseState {
  agent: string;
  isPaused: boolean;
  pausedAt: number | null;         // timestamp of Nth consecutive error
  consecutiveErrors: number;
  probeFailCount: number;          // how many probes have failed since pause
  lastProbeAt: number | null;      // timestamp of last probe attempt
  lastProbeStatus: string | null;  // status of last probe
  nextProbeAt: number | null;      // when the next probe is due
}

/** Persisted state for probes (survives process restarts). */
interface ProbeTracker {
  /** Per-agent tracking of escalation and probe scheduling. */
  agents: Record<string, {
    /** When we first detected this pause epoch. */
    pauseDetectedAt: number;
    /** Number of probes we've attempted for this pause epoch. */
    probesSent: number;
    /** Timestamp of last probe sent. */
    lastProbeSentAt: number | null;
    /** Whether we've sent an escalation for this pause epoch. */
    escalationSent: boolean;
    /** Whether we've sent a recovery notification. */
    recoverySent: boolean;
    /** The pausedAt timestamp from sessions — identifies the "pause epoch". */
    pauseEpoch: number;
  }>;
}

// ── Persistence ───────────────────────────────────────────────────────

function getTrackerPath(persistDir: string): string {
  return join(persistDir, "auto-pause-tracker.json");
}

function loadTracker(persistDir: string): ProbeTracker {
  const path = getTrackerPath(persistDir);
  if (!existsSync(path)) return { agents: {} };
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ProbeTracker;
  } catch {
    return { agents: {} };
  }
}

function saveTracker(persistDir: string, tracker: ProbeTracker): void {
  const path = getTrackerPath(persistDir);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(tracker, null, 2));
}

// ── Session Analysis ──────────────────────────────────────────────────

/**
 * Get the pause state for an agent by analyzing recent sessions.
 *
 * An agent is considered "auto-paused" if its last N sessions (by startedAt)
 * all have status = 'error'. Probe sessions (source = 'probe') are excluded
 * from this count — they don't affect the binary's auto-pause check.
 *
 * Probe session history is analyzed separately to determine backoff position.
 */
function analyzePauseState(
  db: { prepare: (sql: string) => { all: (...args: unknown[]) => SessionRow[] } },
  agent: string,
  threshold: number,
): PauseState {
  // Get last N non-probe sessions to check consecutive error streak
  const recentSessions = db.prepare(
    `SELECT sessionId, agent, status, source, startedAt, endedAt, error
     FROM sessions
     WHERE agent = ? AND (source IS NULL OR source != 'probe')
     ORDER BY startedAt DESC
     LIMIT ?`
  ).all(agent, threshold) as SessionRow[];

  // Count consecutive errors from most recent
  let consecutiveErrors = 0;
  for (const s of recentSessions) {
    if (s.status === "error") {
      consecutiveErrors++;
    } else {
      break;
    }
  }

  const isPaused = consecutiveErrors >= threshold;

  // If not paused, return early
  if (!isPaused) {
    return {
      agent,
      isPaused: false,
      pausedAt: null,
      consecutiveErrors,
      probeFailCount: 0,
      lastProbeAt: null,
      lastProbeStatus: null,
      nextProbeAt: null,
    };
  }

  // Find when the pause started (timestamp of the Nth error — the one that tripped the threshold)
  // We need to look further back to find where the error streak started
  const extendedSessions = db.prepare(
    `SELECT sessionId, agent, status, source, startedAt, endedAt, error
     FROM sessions
     WHERE agent = ? AND (source IS NULL OR source != 'probe')
     ORDER BY startedAt DESC
     LIMIT ?`
  ).all(agent, threshold + 20) as SessionRow[];

  let errorStreakStart = 0;
  for (const s of extendedSessions) {
    if (s.status === "error") {
      errorStreakStart = s.startedAt;
    } else {
      break;
    }
  }
  const pausedAt = errorStreakStart;

  // Analyze probe sessions since pausedAt
  const probeSessions = db.prepare(
    `SELECT sessionId, agent, status, source, startedAt, endedAt, error
     FROM sessions
     WHERE agent = ? AND source = 'probe' AND startedAt > ?
     ORDER BY startedAt DESC`
  ).all(agent, pausedAt) as SessionRow[];

  let probeFailCount = 0;
  let lastProbeAt: number | null = null;
  let lastProbeStatus: string | null = null;

  if (probeSessions.length > 0) {
    lastProbeAt = probeSessions[0].startedAt;
    lastProbeStatus = probeSessions[0].status;

    // Count consecutive probe failures from most recent
    for (const p of probeSessions) {
      if (p.status === "error") {
        probeFailCount++;
      } else {
        break;
      }
    }
  }

  return {
    agent,
    isPaused: true,
    pausedAt,
    consecutiveErrors,
    probeFailCount,
    lastProbeAt,
    lastProbeStatus,
    nextProbeAt: null, // Calculated by the scheduler
  };
}

/**
 * Calculate when the next probe should fire based on backoff schedule.
 */
function calculateNextProbeTime(
  pauseState: PauseState,
  config: {
    initialProbeDelayMs: number;
    probeBackoffMultiplier: number;
    maxProbeIntervalMs: number;
    pauseTTLMs: number;
  },
): number {
  const { initialProbeDelayMs, probeBackoffMultiplier, maxProbeIntervalMs, pauseTTLMs } = config;
  const pausedAt = pauseState.pausedAt!;
  const now = Date.now();

  // TTL check — if pause has exceeded TTL, force immediate probe
  if (now - pausedAt > pauseTTLMs) {
    return now; // Force probe NOW
  }

  // Calculate backoff interval based on probe fail count
  const interval = Math.min(
    initialProbeDelayMs * Math.pow(probeBackoffMultiplier, pauseState.probeFailCount),
    maxProbeIntervalMs,
  );

  // Next probe is relative to last probe (or pausedAt if no probes yet)
  const referenceTime = pauseState.lastProbeAt ?? pausedAt;
  return referenceTime + interval;
}

/**
 * Get a summary of the last few errors for an agent (for escalation context).
 */
function getRecentErrorSummaries(
  db: { prepare: (sql: string) => { all: (...args: unknown[]) => SessionRow[] } },
  agent: string,
  limit: number = 3,
): string[] {
  const rows = db.prepare(
    `SELECT error FROM sessions
     WHERE agent = ? AND status = 'error'
     ORDER BY startedAt DESC
     LIMIT ?`
  ).all(agent, limit) as SessionRow[];

  return rows
    .map(r => (r.error || "unknown error").slice(0, 200))
    .filter(Boolean);
}

// ── Core Handler Logic ────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const config = (_entry.handlerConfig || {}) as {
    /** Override monitored agents list. */
    agents?: string[];
    /** Consecutive errors to trigger pause detection. */
    pauseThreshold?: number;
    /** Initial probe delay in ms. */
    initialProbeDelayMs?: number;
    /** Backoff multiplier per failed probe. */
    probeBackoffMultiplier?: number;
    /** Max probe interval in ms. */
    maxProbeIntervalMs?: number;
    /** Max pause duration before forced probe in ms. */
    pauseTTLMs?: number;
    /** Agent to receive escalation requests. */
    escalationAgent?: string;
  };

  const agents = config.agents ?? MONITORED_AGENTS;
  const pauseThreshold = config.pauseThreshold ?? DEFAULT_PAUSE_THRESHOLD;
  const initialProbeDelayMs = config.initialProbeDelayMs ?? DEFAULT_INITIAL_PROBE_DELAY_MS;
  const probeBackoffMultiplier = config.probeBackoffMultiplier ?? DEFAULT_PROBE_BACKOFF_MULTIPLIER;
  const maxProbeIntervalMs = config.maxProbeIntervalMs ?? DEFAULT_MAX_PROBE_INTERVAL_MS;
  const pauseTTLMs = config.pauseTTLMs ?? DEFAULT_PAUSE_TTL_MS;
  const escalationAgent = config.escalationAgent ?? DEFAULT_ESCALATION_AGENT;

  const backoffConfig = { initialProbeDelayMs, probeBackoffMultiplier, maxProbeIntervalMs, pauseTTLMs };

  return async () => {
    const db = ctx.getDb();
    const tracker = loadTracker(ctx.persistDir);
    const now = Date.now();

    let pausedCount = 0;
    let probesSent = 0;
    let recoveries = 0;

    for (const agent of agents) {
      const state = analyzePauseState(db, agent, pauseThreshold);

      if (!state.isPaused) {
        // Agent is running normally — check if we need to send a recovery notification
        const tracked = tracker.agents[agent];
        if (tracked && !tracked.recoverySent) {
          // Agent recovered! (Either via probe or manual intervention)
          const pauseDurationMs = now - tracked.pauseDetectedAt;
          const pauseDurationHours = Math.round(pauseDurationMs / 3600000 * 10) / 10;
          const probeCount = tracked.probesSent;

          try {
            ctx.emit({
              type: "message_created",
              from: "auto-pause-recovery",
              to: escalationAgent,
              task: `Agent "${agent}" recovered from auto-pause after ${probeCount} probe(s) ` +
                    `(${pauseDurationHours}h total pause time). ` +
                    `Investigate root cause if not already addressed.`,
              requestId: `apr-recovery-${Date.now()}-${agent}`,
            });
          } catch {
            /* best-effort escalation */
          }

          ctx.log(`[auto-pause-recovery] ✅ ${agent} recovered from auto-pause (${pauseDurationHours}h, ${probeCount} probes)`);
          tracked.recoverySent = true;
          recoveries++;
        }

        // Clean up tracker for agents that are running
        if (tracked && tracked.recoverySent) {
          delete tracker.agents[agent];
        }
        continue;
      }

      // Agent IS paused
      pausedCount++;

      // Initialize tracker for this pause epoch
      if (!tracker.agents[agent] || tracker.agents[agent].pauseEpoch !== state.pausedAt!) {
        tracker.agents[agent] = {
          pauseDetectedAt: now,
          probesSent: 0,
          lastProbeSentAt: null,
          escalationSent: false,
          recoverySent: false,
          pauseEpoch: state.pausedAt!,
        };
      }

      const tracked = tracker.agents[agent];

      // Send escalation on first detection
      if (!tracked.escalationSent) {
        const recentErrors = getRecentErrorSummaries(db, agent);
        const nextProbeTime = calculateNextProbeTime(state, backoffConfig);
        const probeInMinutes = Math.round((nextProbeTime - now) / 60000);

        try {
          ctx.emit({
            type: "message_created",
            from: "auto-pause-recovery",
            to: escalationAgent,
            task: `⚠️ Agent "${agent}" auto-paused after ${pauseThreshold} consecutive errors. ` +
                  `Last errors: ${recentErrors.join("; ").slice(0, 300)}. ` +
                  `Probe scheduled in ~${Math.max(0, probeInMinutes)} minutes. TTL: ${Math.round(pauseTTLMs / 3600000)}h. ` +
                  `Check agent config, model availability, and ERROR_LOG.`,
            requestId: `apr-escalation-${Date.now()}-${agent}`,
          });
        } catch {
          /* best-effort escalation */
        }

        ctx.log(`[auto-pause-recovery] 🚨 ${agent} auto-paused — escalation sent to ${escalationAgent}`);
        tracked.escalationSent = true;
      }

      // Check if it's time to send a probe
      const nextProbeTime = calculateNextProbeTime(state, backoffConfig);

      if (now >= nextProbeTime) {
        // Check if there's already a running probe session for this agent
        const runningProbes = db.prepare(
          `SELECT sessionId FROM sessions
           WHERE agent = ? AND source = 'probe' AND status = 'running'`
        ).all(agent) as { sessionId: string }[];

        if (runningProbes.length > 0) {
          ctx.log(`[auto-pause-recovery] ⏳ ${agent} — probe already running (${runningProbes[0].sessionId})`);
          continue;
        }

        // Time to probe! Create a minimal heartbeat session.
        // The probe message is a simple health check — just confirm the agent can run.
        const probeMessage =
          `[probe] Health check — this is an automated probe session to test if ` +
          `${agent} can run successfully. Complete any minimal task (e.g., read your ` +
          `SOUL.md and confirm you're operational). Keep this session minimal.`;

        try {
          const sessionId = ctx.manager.run(agent, probeMessage, {
            source: "probe",
            opBudget: PROBE_MAX_TURNS,
          });

          tracked.probesSent++;
          tracked.lastProbeSentAt = now;

          ctx.log(`[auto-pause-recovery] 🔍 ${agent} — probe #${tracked.probesSent} sent (session: ${sessionId})`);
          probesSent++;

          // Wait for probe to complete (with timeout)
          // Note: The watchdog also provides a safety net for stuck sessions (F2).
          try {
            const result = await Promise.race([
              ctx.manager.waitFor(sessionId),
              new Promise<never>((_, reject) => {
                const timer = setTimeout(() => reject(new Error("probe timeout")), PROBE_TIMEOUT_MS);
                if (timer.unref) timer.unref();
              }),
            ]);

            // F1: Any non-error status counts as probe success.
            // This tests infrastructure health, not task quality.
            if (result.status !== "error") {
              ctx.log(`[auto-pause-recovery] ✅ ${agent} — probe succeeded (status: ${result.status}). Agent should resume.`);
              // The successful probe session breaks the consecutive error streak,
              // so the binary's isAgentAutoPaused() will return false on next check.
              // We'll detect the recovery on the next handler invocation.
            } else {
              ctx.log(`[auto-pause-recovery] ❌ ${agent} — probe #${tracked.probesSent} failed (status: error). Backoff continues.`);
              // F3: On TTL-forced probe failure, backoff doubles from current position.
              // The analyzePauseState() will see the new probe failure and compute
              // the correct backoff on next invocation.
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes("probe timeout")) {
              ctx.log(`[auto-pause-recovery] ⏱️ ${agent} — probe timed out after ${PROBE_TIMEOUT_MS / 1000}s. Cancelling.`);
              try {
                ctx.manager.cancel(sessionId);
              } catch {
                /* session may have already finished */
              }
            } else {
              ctx.log(`[auto-pause-recovery] ❌ ${agent} — probe error: ${errMsg.slice(0, 200)}`);
            }
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          ctx.log(`[auto-pause-recovery] ⚠️ ${agent} — failed to start probe: ${errMsg.slice(0, 200)}`);
        }
      } else {
        const minutesUntilProbe = Math.round((nextProbeTime - now) / 60000);
        const hoursSincePause = Math.round((now - state.pausedAt!) / 3600000 * 10) / 10;
        ctx.log(`[auto-pause-recovery] ⏸️ ${agent} — paused ${hoursSincePause}h, next probe in ~${minutesUntilProbe}min (fail count: ${state.probeFailCount})`);
      }
    }

    // Save updated tracker
    saveTracker(ctx.persistDir, tracker);

    // Summary log
    if (pausedCount > 0 || recoveries > 0 || probesSent > 0) {
      ctx.log(`[auto-pause-recovery] Summary: ${pausedCount} paused, ${probesSent} probes sent, ${recoveries} recoveries`);
    } else {
      ctx.log(`[auto-pause-recovery] All ${agents.length} monitored agents running normally`);
    }
  };
};

// ── Exports for testing ───────────────────────────────────────────────

export {
  analyzePauseState,
  calculateNextProbeTime,
  getRecentErrorSummaries,
  loadTracker,
  saveTracker,
};
export type { PauseState, ProbeTracker, SessionRow };
