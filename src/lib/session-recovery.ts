/**
 * session-recovery.ts — Session Drop Recovery ("Ambulance" Protocol)
 *
 * Detects sessions that failed due to transient infrastructure errors
 * (model API exhaustion, empty responses, stream corruption) and provides
 * recovery support: classification, requeue eligibility, and tracking.
 *
 * This closes three gaps:
 *   A) agents.call errors go unread if caller ends before processing
 *   B) agents.send has zero completion tracking
 *   C) heartbeat failures just log to job-history.jsonl without escalation
 *
 * Design: append-only JSONL log at `.state/delegations.jsonl` (already exists).
 * Recovery entries are appended with status "needs_recovery" or "recovered".
 */

import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface RecoveryEntry {
  timestamp: string;
  sessionId: string;
  agent: string;
  task: string;
  error: string;
  errorClass: "infra" | "logic" | "abort" | "overflow";
  retryable: boolean;
  recoveryStatus: "needs_recovery" | "recovered" | "escalated";
  originalStartedAt: number;
  parentSessionId?: string;
  retryCount: number;
}

// ── Error Classification ───────────────────────────────────────────────

/** Infra error patterns that are safe to retry (transient). */
const INFRA_ERROR_PATTERNS = [
  "empty response",
  "0 output tokens",
  "model/API issue",
  "stream/API error",
  "Unexpected end of JSON",
  "JSON Parse error",
  "Unexpected non-whitespace character after JSON",
  "Unexpected event order",
  "stopReason \"toolUse\" but no tool call",
  "truncated the streaming response",
  "503",
  "502",
  "500",
  "rate limit",
  "ECONNRESET",
  "ETIMEDOUT",
  "socket hang up",
];

/** Patterns that indicate non-retryable logic/permission errors. */
const LOGIC_ERROR_PATTERNS = [
  "Tool not found",  // Tool X not found, etc.
  "not registered",
  "Permission denied",
  "WRITE BLOCKED",
  "Call depth limit exceeded",
];

/**
 * Classify a session error as infra (retryable), logic (not retryable),
 * abort, or overflow.
 */
export function classifyError(error: string | undefined): RecoveryEntry["errorClass"] {
  if (!error) return "logic";

  // Abort — never retry
  if (error.includes("aborted")) return "abort";

  // Overflow — never retry (same context will overflow again)
  if (
    error.includes("context window") ||
    error.includes("max_tokens") ||
    error.includes("token limit") ||
    error.includes("context length") ||
    error.includes("overflow")
  ) {
    return "overflow";
  }

  // Check infra patterns first (more specific)
  const lowerError = error.toLowerCase();
  for (const pattern of INFRA_ERROR_PATTERNS) {
    if (lowerError.includes(pattern.toLowerCase())) {
      return "infra";
    }
  }

  // Logic errors
  for (const pattern of LOGIC_ERROR_PATTERNS) {
    if (error.includes(pattern)) {
      return "logic";
    }
  }

  // Default to logic (don't retry unknown errors)
  return "logic";
}

// ── Recovery Log ───────────────────────────────────────────────────────

const RECOVERY_LOG = "recovery.jsonl";
const MAX_RECOVERY_RETRIES = 2;

/**
 * Log a session for potential recovery. Called when a session completes
 * with an error after exhausting its infra retries.
 */
export function logRecoveryNeeded(
  persistDir: string,
  entry: {
    sessionId: string;
    agent: string;
    task: string;
    error: string;
    startedAt: number;
    parentSessionId?: string;
  },
): RecoveryEntry | null {
  const errorClass = classifyError(entry.error);
  const retryable = errorClass === "infra";

  const record: RecoveryEntry = {
    timestamp: new Date().toISOString(),
    sessionId: entry.sessionId,
    agent: entry.agent,
    task: entry.task,
    error: entry.error,
    errorClass,
    retryable,
    recoveryStatus: retryable ? "needs_recovery" : "escalated",
    originalStartedAt: entry.startedAt,
    parentSessionId: entry.parentSessionId,
    retryCount: 0,
  };

  try {
    const logPath = join(persistDir, RECOVERY_LOG);
    appendFileSync(logPath, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    /* best-effort */
  }

  return retryable ? record : null;
}

/**
 * Log that a session was successfully recovered (requeued).
 */
export function logRecovered(
  persistDir: string,
  originalSessionId: string,
  newSessionId: string,
): void {
  try {
    const logPath = join(persistDir, RECOVERY_LOG);
    appendFileSync(
      logPath,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        originalSessionId,
        newSessionId,
        recoveryStatus: "recovered",
      }) + "\n",
      "utf-8",
    );
  } catch {
    /* best-effort */
  }
}

/**
 * Get sessions that need recovery. Reads recovery.jsonl and returns
 * entries with status "needs_recovery" that haven't been recovered yet.
 */
export function getPendingRecoveries(persistDir: string): RecoveryEntry[] {
  const logPath = join(persistDir, RECOVERY_LOG);
  if (!existsSync(logPath)) return [];

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Track which sessions have been recovered
    const recoveredSessions = new Set<string>();
    const needsRecovery: RecoveryEntry[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.recoveryStatus === "recovered" && entry.originalSessionId) {
          recoveredSessions.add(entry.originalSessionId);
        } else if (entry.recoveryStatus === "needs_recovery") {
          needsRecovery.push(entry);
        }
      } catch {
        /* skip malformed lines */
      }
    }

    // Filter out already-recovered sessions
    return needsRecovery.filter(
      (e) => !recoveredSessions.has(e.sessionId) && e.retryCount < MAX_RECOVERY_RETRIES,
    );
  } catch {
    return [];
  }
}
