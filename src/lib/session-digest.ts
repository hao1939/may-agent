/**
 * Session digests — explicit facts from lifecycle events and Host handlers.
 *
 * Captures what happened, why, and what's still open at each lifecycle event.
 * Digests are stored in the session_digests DB table (append-only per session).
 *
 * Writers record supplied metadata, summaries, and file claims without invoking
 * an agent or guessing changes from transcript text. The retained standalone
 * recovery classifier annotates explicit recovery observations; it does not
 * dispatch work or decide whether an App Task is complete.
 *
 * See projects/may-agent.app/docs/2a-design/sessions.md for the contract.
 */

import { getDb } from "./requests.js";
import { describeText, sessionMetaRef } from "./artifacts.js";
import { log } from "./log.js";

// ── Types ──────────────────────────────────────────────────────────────

export interface DigestRow {
  id: number;
  sessionId: string;
  agent: string;
  trigger: string;
  step: number;
  task: string | null;
  what_happened: string | null;
  outcome: string | null;
  still_open: string | null;
  files_modified: string | null; // JSON array
  details: string | null; // JSON object
  action: string | null;
  action_reason: string | null;
  created_at: number;
}

export interface DigestInput {
  sessionId: string;
  agent: string;
  trigger: string;
  task?: string;
  what_happened?: string;
  outcome?: string;
  still_open?: string;
  files_modified?: string[];
  details?: Record<string, unknown>;
}

export type DigestAction = "resume" | "requeue" | "escalate" | "kill" | "nothing";

// ── Triggers that invoke the classifier ────────────────────────────────

const CLASSIFY_TRIGGERS = new Set([
  "stuck_detected",
  "circuit_break",
  "timeout",
  "zombie_cleanup",
  "resume_exhausted",
  "overflow",
  "session_end_blocked",
  "session_end_failure",
  "auto_resume",
]);

// ── DB Operations ──────────────────────────────────────────────────────

/**
 * Get the latest digest row for a session.
 */
export function getLastDigest(persistDir: string, sessionId: string): DigestRow | null {
  const db = getDb(persistDir);
  const row = db
    .prepare(`SELECT * FROM session_digests WHERE sessionId = ? ORDER BY step DESC LIMIT 1`)
    .get(sessionId) as unknown as DigestRow | undefined;
  return row ?? null;
}

/**
 * Insert a new digest row. Returns the auto-generated ID.
 */
function insertDigest(
  persistDir: string,
  row: {
    sessionId: string;
    agent: string;
    trigger: string;
    step: number;
    task?: string | null;
    what_happened?: string | null;
    outcome?: string | null;
    still_open?: string | null;
    files_modified?: string[] | null;
    details?: Record<string, unknown> | null;
    action?: string | null;
    action_reason?: string | null;
    created_at: number;
  },
  opts?: { onConflict?: "ignore" },
): number {
  const db = getDb(persistDir);
  const insertVerb = opts?.onConflict === "ignore" ? "INSERT OR IGNORE" : "INSERT";
  const fullTask = row.task ?? "";
  const taskRef = sessionMetaRef(row.sessionId);
  const taskArtifact = describeText(taskRef, fullTask);
  const taskPreview =
    fullTask.length <= 2_000
      ? fullTask
      : `${fullTask.slice(0, 2_000)}\n...[full task in session meta; ${fullTask.length} chars]`;
  const result = db
    .prepare(
      `${insertVerb} INTO session_digests
       (sessionId, agent, trigger, step, task, task_ref, task_sha256, task_bytes, what_happened, outcome, still_open,
        files_modified, details, action, action_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.sessionId,
      row.agent,
      row.trigger,
      row.step,
      row.task == null ? null : taskPreview,
      row.task == null ? null : taskArtifact.ref,
      row.task == null ? null : taskArtifact.sha256,
      row.task == null ? null : taskArtifact.bytes,
      row.what_happened ?? null,
      row.outcome ?? null,
      row.still_open ?? null,
      row.files_modified ? JSON.stringify(row.files_modified) : null,
      row.details ? JSON.stringify(row.details) : null,
      row.action ?? null,
      row.action_reason ?? null,
      row.created_at,
    );
  // node:sqlite returns { changes, lastInsertRowid }, bun returns { lastInsertRowid }
  return Number((result as any).lastInsertRowid ?? 0);
}

/**
 * Update the action/reason on an existing digest row.
 */
function updateDigestAction(persistDir: string, id: number, action: string, reason: string): void {
  const db = getDb(persistDir);
  db.prepare(`UPDATE session_digests SET action = ?, action_reason = ? WHERE id = ?`).run(action, reason, id);
}

// ── Classifier ─────────────────────────────────────────────────────────

/**
 * Determine what recovery action to take based on digest content and trigger.
 */
export function classifyDigest(
  digest: { outcome: string; still_open: string | null; what_happened: string },
  trigger: string,
): { action: DigestAction; reason: string } {
  switch (trigger) {
    case "stuck_detected":
    case "circuit_break":
      return digest.outcome === "in_progress" && digest.still_open
        ? { action: "escalate", reason: digest.still_open }
        : { action: "nothing", reason: "No recoverable work" };

    case "timeout":
      return digest.still_open
        ? { action: "escalate", reason: `Timed out: ${digest.still_open}` }
        : { action: "nothing", reason: "Timed out, nothing critical left" };

    case "zombie_cleanup":
      return digest.still_open
        ? { action: "requeue", reason: `Zombie had unfinished: ${digest.still_open}` }
        : { action: "nothing", reason: "No recoverable work" };

    case "resume_exhausted":
      return { action: "escalate", reason: `Exhausted retries: ${digest.what_happened}` };

    case "overflow":
      return digest.still_open
        ? { action: "escalate", reason: `Context overflow: ${digest.still_open}` }
        : { action: "nothing", reason: "Overflow, no critical work left" };

    case "session_end_blocked":
      // Blocked sessions almost always need human attention
      return { action: "escalate", reason: digest.still_open ?? digest.what_happened };

    case "session_end_failure":
      // Failure with open work → escalate; clean failure → nothing
      return digest.still_open
        ? { action: "escalate", reason: digest.still_open }
        : { action: "nothing", reason: "Failure with no open work — no escalation needed" };

    case "auto_resume":
      // Resume only if session was making progress and has unfinished work
      return digest.outcome === "in_progress" && digest.still_open
        ? { action: "resume", reason: `Resuming: ${digest.still_open}` }
        : { action: "nothing", reason: "No recoverable work worth resuming" };

    default:
      return { action: "nothing", reason: "Informational trigger" };
  }
}

// ── Core Entry Point ───────────────────────────────────────────────────

/**
 * Append a Host handler's supplied observation and optional recovery annotation.
 * Omitted facts stays unknown. The async return is retained for handler callers.
 */
export async function upsertDigest(
  persistDir: string,
  input: DigestInput,
): Promise<DigestRow | null> {
  try {
    const last = getLastDigest(persistDir, input.sessionId);
    const step = (last?.step ?? 0) + 1;
    const now = Date.now();

    // ── CREATE: session.start ────────────────────────────────────────
    if (input.trigger === "session.start") {
      insertDigest(persistDir, {
        sessionId: input.sessionId,
        agent: input.agent,
        trigger: input.trigger,
        step,
        task: input.task ?? null,
        outcome: "in_progress",
        created_at: now,
      });
      return getLastDigest(persistDir, input.sessionId);
    }

    const what_happened = input.what_happened ?? null;
    const outcome = input.outcome ?? null;
    const still_open = input.still_open ?? null;

    const id = insertDigest(persistDir, {
      sessionId: input.sessionId,
      agent: input.agent,
      trigger: input.trigger,
      step,
      task: last?.task ?? input.task ?? null,
      what_happened,
      outcome,
      still_open,
      files_modified: input.files_modified ?? null,
      details: input.details ?? null,
      created_at: now,
    });

    // ── CLASSIFY: recovery triggers ────────────────────────────────
    if (CLASSIFY_TRIGGERS.has(input.trigger) && what_happened) {
      const classification = classifyDigest(
        { outcome: outcome ?? "in_progress", still_open, what_happened },
        input.trigger,
      );
      updateDigestAction(persistDir, id, classification.action, classification.reason);
      log(
        "info",
        `[digest] Classified ${input.sessionId} (${input.trigger}): action=${classification.action}, reason=${classification.reason}`,
      );
    }

    return getLastDigest(persistDir, input.sessionId);
  } catch (err) {
    log("warn", `[digest] Failed to upsert digest for ${input.sessionId}: ${err}`);
    return null;
  }
}

// ── Convenience: session.start digest (no LLM) ────────────────────────

/**
 * Create the initial digest entry when a session starts.
 * Lightweight — no LLM, just metadata.
 */
export function createStartDigest(persistDir: string, sessionId: string, agent: string, task: string): void {
  try {
    insertDigest(
      persistDir,
      {
        sessionId,
        agent,
        trigger: "session.start",
        step: 1,
        task,
        outcome: "in_progress",
        created_at: Date.now(),
      },
      { onConflict: "ignore" },
    );
  } catch (err) {
    log("warn", `[digest] Failed to create start digest for ${sessionId}: ${err}`);
  }
}

// ── Convenience: end digest with pre-computed fields ───────────────────

/**
 * Create an end digest with fields already computed (e.g., piggybacked on evaluation).
 * No LLM call needed.
 */
export function createEndDigest(
  persistDir: string,
  sessionId: string,
  agent: string,
  fields: {
    what_happened: string;
    outcome: string;
    still_open?: string | null;
    files_modified?: string[];
    details?: Record<string, unknown>;
  },
): void {
  try {
    const last = getLastDigest(persistDir, sessionId);
    const step = (last?.step ?? 0) + 1;
    insertDigest(persistDir, {
      sessionId,
      agent,
      trigger: "end",
      step,
      task: last?.task ?? null,
      what_happened: fields.what_happened,
      outcome: fields.outcome,
      still_open: fields.still_open ?? null,
      files_modified: fields.files_modified ?? null,
      details: fields.details ?? null,
      created_at: Date.now(),
    });
  } catch (err) {
    log("warn", `[digest] Failed to create end digest for ${sessionId}: ${err}`);
  }
}

// ── Convenience: checkpoint digest ─────────────────────────────────────

/**
 * Create a digest entry from a checkpoint.
 * Uses the checkpoint data directly — no LLM call.
 */
export function createCheckpointDigest(
  persistDir: string,
  sessionId: string,
  agent: string,
  checkpoint: {
    summary: string;
    data?: Record<string, unknown>;
  },
): void {
  try {
    const last = getLastDigest(persistDir, sessionId);
    const step = (last?.step ?? 0) + 1;

    // Extract files from checkpoint data if available
    const filesModified = checkpoint.data?.files_modified as string[] | undefined;

    insertDigest(persistDir, {
      sessionId,
      agent,
      trigger: "checkpoint",
      step,
      task: last?.task ?? null,
      what_happened: typeof checkpoint.summary === "string" ? checkpoint.summary : JSON.stringify(checkpoint.summary),
      outcome: "in_progress",
      still_open:
        typeof checkpoint.data?.next_steps === "string"
          ? checkpoint.data.next_steps
          : checkpoint.data?.next_steps
            ? JSON.stringify(checkpoint.data.next_steps)
            : null,
      files_modified: filesModified ?? null,
      details: checkpoint.data ?? null,
      created_at: Date.now(),
    });
  } catch (err) {
    log("warn", `[digest] Failed to create checkpoint digest for ${sessionId}: ${err}`);
  }
}
