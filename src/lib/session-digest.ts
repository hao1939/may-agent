/**
 * Session Digest System — structured lifecycle understanding per session.
 *
 * Captures what happened, why, and what's still open at each lifecycle event.
 * Digests are stored in the session_digests DB table (append-only per session).
 *
 * Three operations:
 * - CREATE (session.start): metadata only, no LLM
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
 * Get recent digests for an agent (for context injection).
 * Deduplicates — returns only the latest row per session.
 */
export function getRecentDigests(
  persistDir: string,
  agent: string,
  limit = 10,
): DigestRow[] {
  const db = getDb(persistDir);
  return db
    .prepare(
      `SELECT d.* FROM session_digests d
       INNER JOIN (
         SELECT sessionId, MAX(step) as maxStep
         FROM session_digests 
         WHERE agent = ? AND trigger IN ('end', 'checkpoint')
         GROUP BY sessionId
       ) latest ON d.sessionId = latest.sessionId AND d.step = latest.maxStep
       ORDER BY d.created_at DESC LIMIT ?`,
    )
    .all(agent, limit) as unknown as DigestRow[];
}

/**
 * Get recent digests from OTHER agents that modified files the current agent also recently touched.
 * This provides cross-agent awareness: "someone else changed something you care about."
 */
/**
 * Get digests with unresolved `still_open` items — sessions that ended partial/in_progress/interrupted
 * and were never followed by a success in the same session. Surfaced regardless of recency (within 24h).
 */
export function getUnresolvedDigests(
  persistDir: string,
  agent: string,
  windowMs = 24 * 60 * 60 * 1000,
  limit = 3,
): DigestRow[] {
  const db = getDb(persistDir);
  const cutoff = Date.now() - windowMs;
  return db
    .prepare(
      `SELECT * FROM session_digests
       WHERE agent = ? AND still_open IS NOT NULL
         AND outcome IN ('partial', 'in_progress', 'interrupted')
         AND created_at > ?
         AND sessionId NOT IN (
           SELECT sessionId FROM session_digests
           WHERE outcome = 'success' AND created_at > ?
         )
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(agent, cutoff, cutoff, limit) as unknown as DigestRow[];
}

/**
 * Format digest data into a context block for injection into agent sessions.
 * Supports same-agent history, cross-agent activity, and unresolved items.
 *
 * Output format:
 *   - YYYY-MM-DD HH:MM: Description — outcome (duration) — what happened
 *     [files: a.ts, b.ts] [open: unfinished work]
 *   ### Cross-Agent Activity (last 2h)
 *   - agent HH:MM: What happened
 *     [files: ...]
 *   ### Unresolved Items
 *   - YYYY-MM-DD HH:MM: Description — outcome — what happened
 *     [open: ...]
 */
export function formatDigestContext(
  digests: DigestRow[],
  crossAgentDigests?: DigestRow[],
  unresolvedDigests?: DigestRow[],
): string | null {
  if (digests.length === 0 && !crossAgentDigests?.length && !unresolvedDigests?.length) return null;

  const lines: string[] = [];

  // Same-agent recent history (oldest first)
  const ordered = [...digests].reverse();
  for (const d of ordered) {
    lines.push(...formatDigestEntry(d));
  }

  // Unresolved items section — sessions with open items that were never resolved
  if (unresolvedDigests && unresolvedDigests.length > 0) {
    // Filter out any that are already in the main digests list
    const mainSessionIds = new Set(digests.map((d) => d.sessionId));
    const unique = unresolvedDigests.filter((d) => !mainSessionIds.has(d.sessionId));
    if (unique.length > 0) {
      lines.push("", "### Unresolved Items");
      for (const d of unique) {
        lines.push(...formatDigestEntry(d));
      }
    }
  }

  // Cross-agent section
  if (crossAgentDigests && crossAgentDigests.length > 0) {
    lines.push("", "### Cross-Agent Activity (last 2h)");
    for (const d of crossAgentDigests) {
      lines.push(...formatCrossAgentEntry(d));
    }
  }

  // Overflow protection: if total chars > 10,000 (~2,500 tokens), trim
  let result = lines.join("\n");
  if (result.length > 10000) {
    // Rebuild without cross-agent, limit to 5 same-agent entries
    const trimLines: string[] = [];
    const trimmed = ordered.slice(-5); // keep most recent 5
    for (const d of trimmed) {
      trimLines.push(...formatDigestEntry(d, 100)); // shorter what_happened
    }
    result = trimLines.join("\n");
  }

  return result || null;
}

/**
 * Format a single digest entry for same-agent history.
 */
function formatDigestEntry(d: DigestRow, whatHappenedMaxLen = 200): string[] {
  const ts = formatDigestTimestamp(d.created_at);
  const details: Record<string, unknown> = d.details ? JSON.parse(d.details) : {};
  const duration = (details.duration as string) ?? "";
  const outcome = d.outcome ?? d.trigger;
  const durationStr = duration ? ` (${duration})` : "";

  // Use what_happened as primary description; fall back to cleaned task text
  const description = d.what_happened
    ? truncateStr(d.task ?? "unknown task", 80)
    : cleanTaskText(d.task) ?? "unknown task";

  let line = `- ${ts}: ${description} — ${outcome}${durationStr}`;

  if (d.what_happened) {
    line += ` — ${truncateStr(d.what_happened, whatHappenedMaxLen)}`;
  }

  const result: string[] = [line];

  // Sub-details
  const extras: string[] = [];
  if (d.files_modified) {
    try {
      const files = JSON.parse(d.files_modified) as string[];
      if (files.length > 0) {
        extras.push(`files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`);
      }
    } catch {
      /* skip */
    }
  }
  if (d.still_open) {
    extras.push(`open: ${truncateStr(d.still_open, 100)}`);
  }
  if (extras.length > 0) {
    result.push(`  [${extras.join("] [")}]`);
  }

  return result;
}

/**
 * Format a single digest entry for cross-agent section.
 * More compact: "- agent HH:MM: What happened [files: ...]"
 */
function formatCrossAgentEntry(d: DigestRow): string[] {
  const ts = formatDigestTimestamp(d.created_at);
  const timeOnly = ts.split(" ")[1]; // just "HH:MM"
  const what = d.what_happened
    ? truncateStr(d.what_happened, 150)
    : cleanTaskText(d.task) ?? "unknown activity";

  const result: string[] = [`- ${d.agent} ${timeOnly}: ${what}`];

  if (d.files_modified) {
    try {
      const files = JSON.parse(d.files_modified) as string[];
      if (files.length > 0) {
        result.push(`  [files: ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}]`);
      }
    } catch {
      /* skip */
    }
  }

  return result;
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
 * Clean task text for display — strip heartbeat boilerplate and injected content.
 * Used as a fallback when `what_happened` is null.
 */
function cleanTaskText(task: string | null): string | null {
  if (!task) return null;
  let cleaned = task;
  if (cleaned.startsWith("[heartbeat]")) {
    cleaned = "Heartbeat";
  } else if (cleaned.startsWith("[WORK SESSION] ")) {
    cleaned = cleaned.replace("[WORK SESSION] ", "");
  }
  // Strip injected content after ---
  const dashIdx = cleaned.indexOf("\n---");
  if (dashIdx > 0) cleaned = cleaned.slice(0, dashIdx);
  return truncateStr(cleaned.trim(), 80) || null;
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
  const result = db
    .prepare(
      `${insertVerb} INTO session_digests
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

    case "auto_resume":
      // Resume only if session was making progress and has unfinished work
      return digest.outcome === "in_progress" && digest.still_open
        ? { action: "resume", reason: `Resuming: ${digest.still_open}` }
        : { action: "nothing", reason: "No recoverable work worth resuming" };

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
 * - session.start: CREATE (no LLM, just metadata)
 * - checkpoint, end, etc.: DIGEST (LLM synthesis)
 * - Recovery triggers: DIGEST + CLASSIFY
 *
 * @param persistDir - Path to the persistence directory
 * @param input - Digest input data
 * @param manager - SubagentManager for LLM calls (optional for session.start)
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

    // ── CREATE: session.start ────────────────────────────────────────
    if (input.trigger === "session.start") {
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

// ── Convenience: session.start digest (no LLM) ────────────────────────

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
      trigger: "session.start",
      step: 1,
      task,
      outcome: "in_progress",
      created_at: Date.now(),
    }, { onConflict: "ignore" });
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
      still_open: typeof checkpoint.data?.next_steps === "string" ? checkpoint.data.next_steps : checkpoint.data?.next_steps ? JSON.stringify(checkpoint.data.next_steps) : null,
      files_modified: filesModified ?? null,
      details: checkpoint.data ?? null,
      created_at: Date.now(),
    });
  } catch (err) {
    log("warn", `[digest] Failed to create checkpoint digest for ${sessionId}: ${err}`);
  }
}

