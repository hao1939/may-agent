/**
 * finish() Evidence Validation Guard — beforeToolCall hook.
 *
 * Intercepts `finish(status: "success")` calls and validates TWO things:
 * 1. Write evidence: the session transcript contains write/edit evidence when
 *    deliverables are claimed. (Original guard — 8 FM-3.1/FM-2.2 failures.)
 * 2. Verification evidence: after the last write/edit, the agent ran at least
 *    one verification command (read-back, test, type-check, etc.).
 *    (FM-3.3 guard — 4+ FM-3.3 failures in 48h, 52% higher in Gemini/Opus.)
 *
 * Policy: Common Sense 7.1 (Don't lie), 7.2 (Don't fabricate), 2.3 (Verify after acting)
 * Source: exp-056 via Coach → Optimizer → Tech Lead; FM-3.3 analysis via Bob → Optimizer
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Tool names that produce file artifacts. */
const WRITE_TOOL_NAMES = new Set(["write", "edit"]);

/** Tool names whose args may indicate file creation (e.g., bash with redirects). */
const BASH_TOOL_NAME = "bash";

/** Patterns in bash commands that indicate verification activity. */
const BASH_VERIFY_PATTERNS =
  /\b(?:vitest|jest|tsc|node\s+-c|npx\s+tsc|npx\s+vitest|grep|diff|wc\b|ls\s+-[la]|test\s+-[fde]|cat\b|head\b|tail\b)/;

/**
 * Extract all tool call names from the session transcript.
 *
 * Walks context.messages looking for assistant messages with toolCall blocks.
 * Returns a Set of tool names that were invoked during the session.
 */
function extractToolCallNames(messages: BeforeToolCallContext["context"]["messages"]): Set<string> {
  const names = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block && typeof block === "object" && "type" in block && block.type === "toolCall" && "name" in block) {
          names.add((block as { name: string }).name);
        }
      }
    }
  }
  return names;
}

/**
 * Check if any bash tool calls in the transcript contain write-like commands.
 *
 * Looks for patterns like: >, >>, tee, cp, mv, mkdir, touch, echo...>
 * This is a heuristic — it catches common file-creation patterns from bash.
 */
function hasBashWriteEvidence(messages: BeforeToolCallContext["context"]["messages"]): boolean {
  const writePatterns = /(?:>\s|>>\s|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bgit\s+commit)/;
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (
          block &&
          typeof block === "object" &&
          "type" in block &&
          block.type === "toolCall" &&
          "name" in block &&
          (block as { name: string }).name === BASH_TOOL_NAME &&
          "arguments" in block
        ) {
          const args = (block as { arguments: Record<string, unknown> }).arguments;
          if (args && typeof args.command === "string" && writePatterns.test(args.command)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Check if the transcript contains verification evidence AFTER the last write/edit.
 *
 * FM-3.3 guard: agents claim success without verifying. This checks temporal ordering —
 * there must be at least one verification action (read-back, test, type-check) that
 * occurs in the message list AFTER the last write/edit tool call.
 *
 * Returns true if verification evidence exists after last write, false otherwise.
 * Returns true (safe) if no write/edit calls exist (nothing to verify).
 */
function hasVerificationAfterLastWrite(messages: BeforeToolCallContext["context"]["messages"]): boolean {
  // Walk messages to find indices of tool calls
  let lastWriteIdx = -1;
  let hasVerifyAfterWrite = false;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (!block || typeof block !== "object" || !("type" in block) || block.type !== "toolCall" || !("name" in block)) continue;

      const name = (block as { name: string }).name;

      // Is this a write/edit?
      if (WRITE_TOOL_NAMES.has(name)) {
        lastWriteIdx = i;
        hasVerifyAfterWrite = false; // Reset — need new verification after this write
        continue;
      }

      // Is this a bash write? (redirect, tee, cp, etc.)
      if (name === BASH_TOOL_NAME && "arguments" in block) {
        const args = (block as { arguments: Record<string, unknown> }).arguments;
        if (args && typeof args.command === "string") {
          const cmd = args.command;
          const bashWritePatterns = /(?:>\s|>>\s|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b|\bgit\s+commit)/;
          if (bashWritePatterns.test(cmd)) {
            lastWriteIdx = i;
            hasVerifyAfterWrite = false;
            continue;
          }
        }
      }

      // Only check for verification if we've seen a write
      if (lastWriteIdx === -1) continue;
      // Only count verification AFTER the last write
      if (i <= lastWriteIdx) continue;

      // Is this a verification action?
      if (name === "read") {
        hasVerifyAfterWrite = true;
        continue;
      }

      if (name === BASH_TOOL_NAME && "arguments" in block) {
        const args = (block as { arguments: Record<string, unknown> }).arguments;
        if (args && typeof args.command === "string" && BASH_VERIFY_PATTERNS.test(args.command)) {
          hasVerifyAfterWrite = true;
          continue;
        }
      }
    }
  }

  // No writes found — nothing to verify, safe to proceed
  if (lastWriteIdx === -1) return true;

  return hasVerifyAfterWrite;
}

/**
 * Keywords in a finish() summary that imply code/file changes were made.
 * If these appear in the summary but no write/edit/bash-write evidence exists
 * in the transcript, the ghost deliverable guard blocks the call.
 */
const GHOST_KEYWORDS = /\b(?:fix(?:ed)?|implement(?:ed)?|refactor(?:ed)?|rewrote|rewrite|updat(?:ed?)|deploy(?:ed)?|patch(?:ed)?|add(?:ed)?|creat(?:ed)?|modif(?:ied|y)|chang(?:ed?)|delet(?:ed?)|remov(?:ed?)|migrat(?:ed?)|rewir(?:ed?))\b/i;

/**
 * Create a beforeToolCall hook that guards finish(status: "success") calls.
 *
 * Five gates:
 * 0. Contradictory Status Guard: blocks when summary mentions blockers/missing
 *    prerequisites but status is "success" (EXP-215).
 * 0b. Transcript Contradiction Guard: blocks when assistant messages in the
 *     transcript contain evidence of unresolved blockers (missing files, etc.)
 *     but status is "success". Catches agents that write clean summaries while
 *     acknowledging problems in conversation (Gate 3v2, req:8c85fec9).
 * 1. Ghost Deliverable Guard (FM-3.1 preventive): blocks when summary implies
 *    code changes ("Fixed", "Implemented", etc.) but no write/edit evidence
 *    exists in the transcript AND no deliverables are listed. This catches the
 *    #1 behavioral failure: agents claiming work without doing it.
 * 2. Write Evidence Guard: blocks when deliverables are listed but no write/edit
 *    evidence exists in the transcript.
 * 3. Verification Guard (FM-3.3): blocks when writes exist but no verification
 *    (read-back, test, type-check) occurs after the last write.
 *
 * Exceptions (not blocked):
 * - `finish()` with status other than "success"
 * - Summaries that don't match ghost keywords (e.g., "Analyzed logs", "No new work")
 * - Sessions where write, edit, or file-producing bash commands were used
 */
export function createFinishGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept finish() calls
    if (ctx.toolCall.name !== "finish") return undefined;

    const args = ctx.args as {
      status?: string;
      summary?: string;
      deliverables?: { path: string; description: string }[];
    };

    // Only guard success
    if (args.status !== "success") return undefined;

    const summary = args.summary ?? "";

    // ── Gate 3: Contradictory Status Guard ──────
    // Summary mentions blockers/missing/errors but status is "success".
    // This is a model-level judgment default that prompting can't fix (EXP-215, N=10).
    const BLOCKER_PATTERNS = /\b(missing|not found|does not exist|blocked|cannot proceed|unable to|prerequisite.*missing|failed to find|not available|not installed|could not find)\b/i;

    if (BLOCKER_PATTERNS.test(summary)) {
      return {
        block: true,
        reason:
          `finish(status: "success") blocked [Contradictory Status]: Your summary mentions blockers ` +
          `or missing prerequisites ("${summary.slice(0, 120)}") but your status is "success". ` +
          `If the task objectives were NOT fully met, use the appropriate status:\n` +
          `1. finish(status: "blocked", blockers: [...]) — when external dependency is missing\n` +
          `2. finish(status: "partial", next_steps: "...") — when some work done but not complete\n` +
          `3. finish(status: "failure", blockers: [...]) — when the task cannot be done\n` +
          `If you genuinely succeeded despite the mentioned issue, rephrase your summary to be unambiguous.`,
      };
    }

    // ── Gate 3b: Transcript Contradiction Guard ──────
    // The agent may write a clean summary but the transcript reveals
    // acknowledged blockers/missing prerequisites that were never resolved.
    const TRANSCRIPT_BLOCKER_PATTERNS = /\b(?:file\s+(?:is\s+)?(?:missing|not\s+found|does\s+not\s+exist)|(?:missing|absent|not\s+(?:found|present|available))\s+(?:file|dependency|prerequisite|input|data)|cannot\s+(?:proceed|continue)\s+(?:without|until)|required\s+.*?\s+(?:is|are)\s+(?:missing|not\s+(?:found|present|available))|no\s+such\s+file)\b/i;

    // Extract assistant text and check for unresolved blocker language
    let transcriptBlockerMatch: string | null = null;
    for (const msg of ctx.context.messages) {
      if (msg.role !== "assistant") continue;
      const text = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join(" ")
          : "";
      const match = text.match(TRANSCRIPT_BLOCKER_PATTERNS);
      if (match) {
        transcriptBlockerMatch = match[0];
        break;
      }
    }

    if (transcriptBlockerMatch) {
      return {
        block: true,
        reason:
          `finish(status: "success") blocked [Transcript Contradiction]: Your session transcript ` +
          `contains evidence of unresolved blockers ("${transcriptBlockerMatch}") but you're claiming success. ` +
          `If you discovered missing files, unmet prerequisites, or blockers during this session, ` +
          `your finish status must reflect that:\n` +
          `1. finish(status: "blocked", blockers: [...]) — when external dependency is missing\n` +
          `2. finish(status: "partial", next_steps: "...") — when some work done but not complete\n` +
          `3. finish(status: "failure", blockers: [...]) — when the task cannot be done\n` +
          `Discovering and reporting a problem is valuable work, but the status must be "blocked" or "partial", not "success".`,
      };
    }

    // Check for write/edit evidence in the transcript
    const toolNames = extractToolCallNames(ctx.context.messages);

    // Direct file-writing tools used?
    let hasWriteEvidence = false;
    if (toolNames.has("write") || toolNames.has("edit")) {
      hasWriteEvidence = true;
    }

    // Bash commands that write files?
    if (!hasWriteEvidence && toolNames.has(BASH_TOOL_NAME) && hasBashWriteEvidence(ctx.context.messages)) {
      hasWriteEvidence = true;
    }

    // ── Gate 0: Ghost Deliverable Guard (FM-3.1 preventive) ──────
    // Summary implies code changes but no write evidence AND no deliverables.
    // This catches "Fixed the bug" with zero file modifications.
    const hasDeliverables = args.deliverables && args.deliverables.length > 0;
    if (!hasWriteEvidence && !hasDeliverables && GHOST_KEYWORDS.test(summary)) {
      return {
        block: true,
        reason:
          `finish(status: "success") blocked [FM-3.1 Ghost Deliverable]: Your summary implies ` +
          `code changes ("${summary.slice(0, 80)}") but your session contains no write, edit, or ` +
          `file-producing bash commands, and no deliverables are listed. Either:\n` +
          `1. Actually write/edit the files, list them as deliverables, then call finish()\n` +
          `2. Rephrase summary to reflect what you actually did (e.g., "Analyzed X", "Verified Y")\n` +
          `3. Use status: "partial" if work is incomplete`,
      };
    }

    // If no deliverables listed and no ghost keywords, allow (analysis-only sessions)
    if (!hasDeliverables) return undefined;

    // ── Gate 1: No write evidence at all — block (original FM-3.1/FM-2.2 guard) ──
    if (!hasWriteEvidence) {
      const deliverablePaths = args.deliverables!.map((d) => d.path).join(", ");
      return {
        block: true,
        reason:
          `finish(status: "success") blocked: You claimed ${args.deliverables!.length} deliverable(s) ` +
          `(${deliverablePaths}) but your session transcript contains no write, edit, or file-producing ` +
          `bash commands. Either:\n` +
          `1. Actually write/edit the files before calling finish()\n` +
          `2. Remove deliverables you didn't create this session\n` +
          `3. Use status: "partial" if work is incomplete`,
      };
    }

    // ── Gate 2: Write evidence exists but no verification after last write — block (FM-3.3) ──
    if (!hasVerificationAfterLastWrite(ctx.context.messages)) {
      return {
        block: true,
        reason:
          `finish(status: "success") blocked [FM-3.3]: You edited/wrote files but your transcript ` +
          `contains no verification AFTER your last edit. Before calling finish(), you must verify ` +
          `your changes using at least one of:\n` +
          `1. read() — read back the changed file to confirm correctness\n` +
          `2. bash("npx vitest --run test/...") — run the relevant test\n` +
          `3. bash("npx tsc --noEmit") — type-check the project\n` +
          `4. bash("node -c file.js") — syntax-check the file\n` +
          `5. bash("ls -la file && wc -l file") — verify file exists with expected size\n` +
          `Run a verification command, then call finish() again.`,
      };
    }

    // All gates passed — allow
    return undefined;
  };
}
