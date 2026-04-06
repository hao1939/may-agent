/**
 * Session Digest System — structured lifecycle understanding per session.
 *
 * Captures what happened, why, and what's still open at each lifecycle event.
 * Digests are stored in the session_digests DB table (append-only per session).
 *
 * Three operations:
 * - CREATE (session_start): metadata only, no LLM
 * - DIGEST (checkpoint, end, etc.): LLM synthesizes what happened from transcript delta
 * - CLASSIFY (recovery triggers): code-level decision on what to do next
 *
 * See docs/design/session-digest.md for full design rationale.
 */

import { getDb } from "./requests.js";
import { readSessionMessages } from "./persistence.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SubagentManager } from "./manager.js";
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
  details: string | null;        // JSON object
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
 * Get the full digest timeline for a session.
 */
export function getDigestTimeline(persistDir: string, sessionId: string): DigestRow[] {
  const db = getDb(persistDir);
  return db
    .prepare(`SELECT * FROM session_digests WHERE sessionId = ? ORDER BY step ASC`)
    .all(sessionId) as unknown as DigestRow[];
}

/**
 * Get recent digests for an agent (for context injection).
 */
export function getRecentDigests(
  persistDir: string,
  agent: string,
  limit = 5,
): DigestRow[] {
  const db = getDb(persistDir);
  return db
    .prepare(
      `SELECT * FROM session_digests
       WHERE agent = ? AND trigger IN ('end', 'checkpoint')
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(agent, limit) as unknown as DigestRow[];
}

/**
 * Format recent digests into a context block for injection into agent sessions.
 * Replaces the memory-based "Recent Task History" with richer digest data.
 *
 * Output format per entry:
 *   - YYYY-MM-DD HH:MM: "task summary" — status (duration) — what happened
 *     [files: a.ts, b.ts] [open: still unfinished work]
 */
export function formatDigestContext(
  digests: DigestRow[],
): string | null {
  if (digests.length === 0) return null;

  // Reverse so oldest is first (digests come in DESC order from getRecentDigests)
  const ordered = [...digests].reverse();

  const lines: string[] = [];
  for (const d of ordered) {
    const ts = formatDigestTimestamp(d.created_at);
    const taskStr = truncateStr(d.task ?? "unknown task", 120);
    const details: Record<string, unknown> = d.details ? JSON.parse(d.details) : {};
    const duration = (details.duration as string) ?? "";
    const outcome = d.outcome ?? d.trigger;
    const durationStr = duration ? ` (${duration})` : "";

    // Main line: timestamp, task, outcome, duration
    let line = `- ${ts}: "${taskStr}" — ${outcome}${durationStr}`;

    // what_happened gives the real substance
    if (d.what_happened) {
      line += ` — ${truncateStr(d.what_happened, 200)}`;
    }

    lines.push(line);

    // Sub-details on next lines if present
    const extras: string[] = [];
    if (d.files_modified) {
      try {
        const files = JSON.parse(d.files_modified) as string[];
        if (files.length > 0) {
          extras.push(`files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`);
        }
      } catch { /* skip */ }
    }
    if (d.still_open) {
      extras.push(`open: ${truncateStr(d.still_open, 100)}`);
    }
    if (extras.length > 0) {
      lines.push(`  [${extras.join("] [")}]`);
    }
  }

  return lines.join("\n");
}

/** Format epoch ms → "YYYY-MM-DD HH:MM" in UTC. */
function formatDigestTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Truncate a string to maxLen chars, adding "…" if truncated. */
function truncateStr(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
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
): number {
  const db = getDb(persistDir);
  const result = db
    .prepare(
      `INSERT INTO session_digests
       (sessionId, agent, trigger, step, task, what_happened, outcome, still_open,
        files_modified, details, action, action_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.sessionId,
      row.agent,
      row.trigger,
      row.step,
      row.task ?? null,
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
function updateDigestAction(
  persistDir: string,
  id: number,
  action: string,
  reason: string,
): void {
  const db = getDb(persistDir);
  db.prepare(`UPDATE session_digests SET action = ?, action_reason = ? WHERE id = ?`).run(
    action,
    reason,
    id,
  );
}

// ── Transcript helpers ─────────────────────────────────────────────────

/**
 * Format messages into a compact transcript for the LLM.
 * Similar to evaluator's formatTranscript but lighter — focuses on what happened.
 */
function formatTranscriptCompact(messages: AgentMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (!("role" in msg)) continue;

    if (msg.role === "assistant") {
      const content = msg.content;
      if (typeof content === "string") {
        lines.push(`ASSISTANT: ${content.slice(0, 500)}`);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === "string") {
            lines.push(`ASSISTANT: ${block.slice(0, 300)}`);
          } else if (block.type === "text") {
            lines.push(`ASSISTANT: ${block.text.slice(0, 300)}`);
          } else if (block.type === "toolCall") {
            const args = JSON.stringify(block.arguments ?? {}).slice(0, 200);
            lines.push(`TOOL_CALL: ${block.name}(${args})`);
          }
        }
      }
    } else if (msg.role === "toolResult") {
      const text =
        msg.content?.map((c: { type: string; text?: string }) => (c.type === "text" ? c.text : "")).join("") ?? "";
      const preview = text.slice(0, 300);
      const suffix = text.length > 300 ? `... [${text.length} chars]` : "";
      lines.push(`TOOL_RESULT(${msg.toolName}): ${preview}${suffix}`);
    } else if (msg.role === "user") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      lines.push(`USER: ${text.slice(0, 300)}`);
    }
  }
  return lines.join("\n");
}

/**
 * Read transcript messages since a given timestamp (approximate — uses message index).
 * Falls back to full transcript if no previous digest exists.
 */
function readTranscriptDelta(
  persistDir: string,
  sessionId: string,
  lastDigestStep: number,
): { messages: AgentMessage[]; full: boolean } {
  const messages = readSessionMessages(persistDir, sessionId);
  if (lastDigestStep <= 1 || messages.length === 0) {
    return { messages, full: true };
  }

  // Heuristic: estimate messages consumed by previous digests.
  // Each digest covers roughly (totalMessages / currentStep) messages.
  // Take the latter portion.
  const estimatedStartIdx = Math.floor((messages.length * (lastDigestStep - 1)) / (lastDigestStep + 1));
  const startIdx = Math.max(0, Math.min(estimatedStartIdx, messages.length - 1));
  return { messages: messages.slice(startIdx), full: false };
}

/**
 * Extract files modified from tool calls in messages.
 */
function extractFilesModified(messages: AgentMessage[]): string[] {
  // Known file extensions for project files
  const FILE_EXTS = new Set([
    "ts", "js", "tsx", "jsx", "json", "md", "yaml", "yml", "toml",
    "css", "html", "sh", "sql", "txt", "env", "lock", "jsonl",
  ]);

  function isLikelyFilePath(s: string): boolean {
    // Must contain a / (real paths) or start with known project dirs
    if (!s.includes("/") && !s.startsWith("package.")) return false;
    // Must have a known extension
    const ext = s.split(".").pop()?.toLowerCase() ?? "";
    if (!FILE_EXTS.has(ext)) return false;
    // Reject paths with spaces or special chars
    if (/\s|[(){}[\]|;`]/.test(s)) return false;
    // Reject very short segments (t.name, s.time, etc.)
    if (!s.includes("/") && s.split(".")[0].length <= 2) return false;
    return true;
  }

  const files = new Set<string>();
  for (const msg of messages) {
    if (!("role" in msg) || msg.role !== "assistant") continue;
    const content = msg.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === "toolCall") {
        const args = block.arguments ?? {};
        // Common patterns: edit(path), write(path)
        if (typeof args.path === "string" && ["edit", "write"].includes(block.name)) {
          files.add(args.path);
        }
        // bash commands — extract file paths from write operations
        if (block.name === "bash" && typeof args.command === "string") {
          const writePatterns = args.command.match(/(?:>\s*|tee\s+|cp\s+\S+\s+)([\w./-]+\.\w+)/g);
          if (writePatterns) {
            for (const match of writePatterns) {
              const file = match.replace(/^[>|\s]+|^tee\s+|^cp\s+\S+\s+/, "").trim();
              if (file && !file.startsWith("-") && isLikelyFilePath(file)) {
                files.add(file);
              }
            }
          }
        }
      }
    }
  }
  return [...files];
}

// ── LLM Synthesis ──────────────────────────────────────────────────────

/**
 * Use the evaluator agent to synthesize a digest from transcript data.
 * Returns structured digest fields.
 */
async function llmSynthesize(
  manager: SubagentManager,
  opts: {
    agent: string;
    trigger: string;
    previous?: string | null;
    delta: string;
    triggerContext?: string;
  },
): Promise<{
  what_happened: string;
  outcome: string;
  still_open: string | null;
}> {
  const contextSection = opts.previous
    ? `Previous digest: ${opts.previous}`
    : "This is the first digest for this session.";

  const triggerSection = opts.triggerContext
    ? `\nTrigger context: ${opts.triggerContext}`
    : "";

  const prompt = [
    `# Session Digest Request`,
    ``,
    `Agent: ${opts.agent}`,
    `Trigger: ${opts.trigger}`,
    `${contextSection}${triggerSection}`,
    ``,
    `## Transcript (delta)`,
    opts.delta.slice(0, 8000),
    ``,
    `## Instructions`,
    `Produce a brief structured digest of what happened in this session segment.`,
    `Output EXACTLY this format (no markdown fences, no extra text):`,
    ``,
    `WHAT_HAPPENED: <1-3 sentences describing what the agent did>`,
    `OUTCOME: <one of: success, partial, failure, in_progress, interrupted>`,
    `STILL_OPEN: <what remains to be done, or "none">`,
  ].join("\n");

  try {
    const sessionId = manager.run("evaluator", prompt, { kind: "job" });
    const result = await manager.waitFor(sessionId);
    const text = result?.lastAssistantText ?? "";
    return parseDigestResponse(text);
  } catch (err) {
    log("warn", `[digest] LLM synthesis failed for ${opts.agent}: ${err}`);
    return {
      what_happened: `[digest synthesis failed: ${String(err).slice(0, 100)}]`,
      outcome: "in_progress",
      still_open: null,
    };
  }
}

/**
 * Parse the structured digest response from the LLM.
 */
function parseDigestResponse(text: string): {
  what_happened: string;
  outcome: string;
  still_open: string | null;
} {
  const whatMatch = text.match(/WHAT_HAPPENED:\s*(.+?)(?=\nOUTCOME:|\n\n|$)/s);
  const outcomeMatch = text.match(/OUTCOME:\s*(\S+)/);
  const stillOpenMatch = text.match(/STILL_OPEN:\s*(.+?)(?=\n\n|$)/s);

  const validOutcomes = new Set(["success", "partial", "failure", "in_progress", "interrupted"]);
  const rawOutcome = outcomeMatch?.[1]?.trim().toLowerCase() ?? "in_progress";

  return {
    what_happened: whatMatch?.[1]?.trim() ?? text.slice(0, 500),
    outcome: validOutcomes.has(rawOutcome) ? rawOutcome : "in_progress",
    still_open:
      stillOpenMatch?.[1]?.trim().toLowerCase() === "none"
        ? null
        : stillOpenMatch?.[1]?.trim() ?? null,
  };
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

    default:
      return { action: "nothing", reason: "Informational trigger" };
  }
}

// ── Shadow Comparison Logging ───────────────────────────────────────────

/**
 * Log a shadow comparison between the existing recovery action and the digest classifier's recommendation.
 * Used during Phase 3 to observe classifier accuracy before switchover.
 */
export function logShadowComparison(
  sessionId: string,
  trigger: string,
  existingAction: string,
  digest: DigestRow | null,
): void {
  try {
    const classifierAction = digest?.action ?? "none(no_digest)";
    const match = existingAction === classifierAction;
    log("info",
      `[digest-shadow] ${sessionId} trigger=${trigger} existing_action=${existingAction} classifier_action=${classifierAction} match=${match}`,
    );
  } catch {
    /* best-effort — shadow logging must never crash */
  }
}

// ── Core Entry Point ───────────────────────────────────────────────────

/**
 * The single entry point for all digest operations.
 *
 * - session_start: CREATE (no LLM, just metadata)
 * - checkpoint, end, etc.: DIGEST (LLM synthesis)
 * - Recovery triggers: DIGEST + CLASSIFY
 *
 * @param persistDir - Path to the persistence directory
 * @param input - Digest input data
 * @param manager - SubagentManager for LLM calls (optional for session_start)
 * @param triggerContext - Additional context for the LLM
 */
export async function upsertDigest(
  persistDir: string,
  input: DigestInput,
  manager?: SubagentManager,
  triggerContext?: string,
): Promise<DigestRow | null> {
  try {
    const last = getLastDigest(persistDir, input.sessionId);
    const step = (last?.step ?? 0) + 1;
    const now = Date.now();

    // ── CREATE: session_start ────────────────────────────────────────
    if (input.trigger === "session_start") {
      const id = insertDigest(persistDir, {
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

    // ── DIGEST: LLM synthesis ────────────────────────────────────────
    let what_happened = input.what_happened ?? null;
    let outcome = input.outcome ?? null;
    let still_open = input.still_open ?? null;
    let files_modified = input.files_modified ?? null;

    // Read transcript delta once — reused for both LLM synthesis and file extraction
    const needsLlm = !what_happened && manager;
    const needsFiles = !files_modified;
    const delta = (needsLlm || needsFiles)
      ? readTranscriptDelta(persistDir, input.sessionId, last?.step ?? 0)
      : null;

    // If what_happened is already provided (e.g., piggybacked on eval), skip LLM
    if (needsLlm && delta) {
      const transcript = formatTranscriptCompact(delta.messages);

      if (transcript.length > 0) {
        const synthesized = await llmSynthesize(manager!, {
          agent: input.agent,
          trigger: input.trigger,
          previous: last?.what_happened,
          delta: transcript,
          triggerContext,
        });
        what_happened = synthesized.what_happened;
        outcome = outcome ?? synthesized.outcome;
        still_open = still_open ?? synthesized.still_open;
      }
    }

    // Extract files if not provided (reuse delta from above)
    if (needsFiles && delta) {
      files_modified = extractFilesModified(delta.messages);
    }

    const id = insertDigest(persistDir, {
      sessionId: input.sessionId,
      agent: input.agent,
      trigger: input.trigger,
      step,
      task: last?.task ?? input.task ?? null,
      what_happened,
      outcome,
      still_open,
      files_modified: files_modified && files_modified.length > 0 ? files_modified : null,
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
      log("info", `[digest] Classified ${input.sessionId} (${input.trigger}): action=${classification.action}, reason=${classification.reason}`);
    }

    return getLastDigest(persistDir, input.sessionId);
  } catch (err) {
    log("warn", `[digest] Failed to upsert digest for ${input.sessionId}: ${err}`);
    return null;
  }
}

// ── Convenience: session_start digest (no LLM) ────────────────────────

/**
 * Create the initial digest entry when a session starts.
 * Lightweight — no LLM, just metadata.
 */
export function createStartDigest(
  persistDir: string,
  sessionId: string,
  agent: string,
  task: string,
): void {
  try {
    insertDigest(persistDir, {
      sessionId,
      agent,
      trigger: "session_start",
      step: 1,
      task,
      outcome: "in_progress",
      created_at: Date.now(),
    });
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
      what_happened: checkpoint.summary,
      outcome: "in_progress",
      still_open: (checkpoint.data?.next_steps as string) ?? null,
      files_modified: filesModified ?? null,
      details: checkpoint.data ?? null,
      created_at: Date.now(),
    });
  } catch (err) {
    log("warn", `[digest] Failed to create checkpoint digest for ${sessionId}: ${err}`);
  }
}

// ── Query helpers ──────────────────────────────────────────────────────

/**
 * Get all failure digests since a given timestamp.
 */
export function getFailureDigests(persistDir: string, since: number): DigestRow[] {
  const db = getDb(persistDir);
  return db
    .prepare(
      `SELECT * FROM session_digests
       WHERE outcome = 'failure' AND created_at > ?
       ORDER BY created_at DESC`,
    )
    .all(since) as unknown as DigestRow[];
}

/**
 * Get agent health summary since a given timestamp.
 */
export function getAgentDigestHealth(
  persistDir: string,
  since: number,
): Array<{
  agent: string;
  clean_ends: number;
  problems: number;
  escalations: number;
}> {
  const db = getDb(persistDir);
  return db
    .prepare(
      `SELECT agent,
        SUM(CASE WHEN trigger = 'end' THEN 1 ELSE 0 END) as clean_ends,
        SUM(CASE WHEN trigger IN ('stuck_detected','circuit_break','timeout') THEN 1 ELSE 0 END) as problems,
        SUM(CASE WHEN action = 'escalate' THEN 1 ELSE 0 END) as escalations
      FROM session_digests WHERE created_at > ? GROUP BY agent`,
    )
    .all(since) as unknown as Array<{
    agent: string;
    clean_ends: number;
    problems: number;
    escalations: number;
  }>;
}

/**
 * Get classifier action log (most recent actions first).
 */
export function getActionLog(persistDir: string, limit = 20): DigestRow[] {
  const db = getDb(persistDir);
  return db
    .prepare(
      `SELECT * FROM session_digests
       WHERE action IS NOT NULL
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as unknown as DigestRow[];
}
