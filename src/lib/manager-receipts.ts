/**
 * Experience Replay Enforcement (P114).
 *
 * Blocks complex state-changing actions if the agent hasn't checked its
 * error logs recently.  Builds on top of the ops-gate logging system
 * (`ops-gate.ts`) — receipts with `action === "error-log-review"` are
 * used as proof that the agent has reviewed its error logs.
 *
 * Uses only Node.js built-in modules + the local ops-gate module.
 */

import { join } from "node:path";
import { getReceipts, logOpsReceipt } from "./ops-gate.js";

// ── Constants ─────────────────────────────────────────────────────────

/** Actions that require a recent error-log review before execution. */
export const CRITICAL_ACTIONS = [
  "deploy",
  "rollback",
  "delete",
  "promote",
  "discard",
  "git-push",
  "schema-migrate",
] as const;

/** How far back to look for an error-log review (2 hours). */
const SESSION_WINDOW_MS = 2 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────

/** Default base path for the JSONL file. */
const DEFAULT_BASE = join(process.cwd(), ".state");

// ── Public API ────────────────────────────────────────────────────────

/**
 * Check whether the error log has been reviewed in the current session
 * (last 2 hours).
 *
 * @param basePath  Directory containing `ops-receipts.jsonl` (default `.state/`).
 * @returns `true` if a recent `error-log-review` receipt exists.
 */
export function checkErrorLogReviewed(
  basePath: string = DEFAULT_BASE,
): boolean {
  const since = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();
  const receipts = getReceipts({ action: "error-log-review", since }, basePath);
  return receipts.length > 0;
}

/**
 * Enforce the replay check before a state-changing action.
 *
 * - If error log has been reviewed → allowed.
 * - If not reviewed AND action is critical → blocked.
 * - If not reviewed but action is non-critical → allowed.
 *
 * @param intendedAction  The action the agent wants to perform.
 * @param basePath        Directory containing `ops-receipts.jsonl` (default `.state/`).
 * @returns `{ allowed, reason }` describing whether the action may proceed.
 */
export function enforceReplayCheck(
  intendedAction: string,
  basePath: string = DEFAULT_BASE,
): { allowed: boolean; reason: string } {
  const reviewed = checkErrorLogReviewed(basePath);

  if (reviewed) {
    return { allowed: true, reason: "Error log reviewed" };
  }

  if ((CRITICAL_ACTIONS as readonly string[]).includes(intendedAction)) {
    return {
      allowed: false,
      reason:
        `Must review error logs before performing: ${intendedAction}. ` +
        `Call logOpsReceipt('error-log-review', ...) after checking errors.`,
    };
  }

  return { allowed: true, reason: "Non-critical action, no review required" };
}

/**
 * Convenience function: mark the error log as reviewed by logging an
 * ops receipt with `action === "error-log-review"`.
 *
 * @param agent     Who performed the review (default `"unknown"`).
 * @param basePath  Directory containing `ops-receipts.jsonl` (default `.state/`).
 */
export function markErrorLogReviewed(
  agent?: string,
  basePath: string = DEFAULT_BASE,
): void {
  logOpsReceipt(
    "error-log-review",
    "reviewed",
    { agent: agent ?? "unknown" },
    basePath,
  );
}
