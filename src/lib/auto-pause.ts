/**
 * auto-pause.ts — DB-based auto-pause for agents with consecutive failures.
 *
 * Checks the sessions table to determine if an agent should be paused.
 * An agent is auto-paused when its last N completed sessions ALL have status='error'.
 * Self-healing: if someone manually runs the agent and it succeeds, the pause lifts.
 *
 * This complements the in-memory circuit breaker in cron.ts:
 * - Circuit breaker: tracks errors during runtime (volatile, resets on restart)
 * - Auto-pause: reads from DB (persistent, survives restarts)
 *
 * Design: R39 from CR-289-weekend-synthesis
 */

import { getDb } from "./requests.js";

/** Number of consecutive error sessions required to trigger auto-pause. */
export const AUTO_PAUSE_THRESHOLD = 3;

/**
 * Check if an agent should be auto-paused based on session history.
 *
 * Returns true if the agent's last `threshold` completed sessions all have status='error'.
 * "Completed" means status is not 'running' (includes done, error, interrupted).
 *
 * Self-healing: if the most recent session is NOT an error (e.g., manual success),
 * the agent is automatically unpaused.
 */
export function isAgentAutoPaused(
  persistDir: string,
  agentName: string,
  threshold: number = AUTO_PAUSE_THRESHOLD,
): boolean {
  try {
    const db = getDb(persistDir);
    const rows = db
      .prepare(
        `SELECT status FROM sessions
         WHERE agent = ? AND status != 'running'
         ORDER BY startedAt DESC
         LIMIT ?`,
      )
      .all(agentName, threshold) as { status: string }[];

    // Not enough completed sessions to determine pause state
    if (rows.length < threshold) return false;

    // All must be errors for auto-pause to trigger
    return rows.every((r) => r.status === "error");
  } catch {
    // DB unavailable — don't pause (fail-open)
    return false;
  }
}
