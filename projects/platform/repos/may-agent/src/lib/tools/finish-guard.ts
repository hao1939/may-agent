/**
 * finish() Evidence Validation Guard — beforeToolCall hook.
 *
 * Intercepts `finish(status: "success")` calls and validates TWO things:
 * 1. Write evidence: the session transcript contains write/edit evidence when
 *    deliverables are claimed. (Original guard — 8 FM-3.1/FM-2.2 failures.)
 * 2. Post-write verification is handled by verification-depth-guard.ts.
 *    Keeping it there avoids duplicate or conflicting finish() signals.
 *
 * Policy: Common Sense 7.1 (Don't lie), 7.2 (Don't fabricate), 2.3 (Verify after acting)
 * Source: exp-056 via Coach → Optimizer → Tech Lead; FM-3.3 analysis via Bob → Optimizer
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Tool names that produce file artifacts. */
const WRITE_TOOL_NAMES = new Set(["write", "edit"]);

/** Tool names whose args may indicate file creation (e.g., bash with redirects). */
const BASH_TOOL_NAME = "bash";

/** Patterns in bash commands that indicate file-writing activity (redirects, copies, etc.). */
const BASH_WRITE_PATTERNS = /(?:>\s|>>\s|\btee\b|\bcp\b|\bmv\b|\bmkdir\b|\btouch\b)/;

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
          if (args && typeof args.command === "string" && BASH_WRITE_PATTERNS.test(args.command)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Keywords in a finish() summary that imply code/file changes were made.
 * If these appear in the summary but no write/edit/bash-write evidence exists
 * in the transcript, the ghost deliverable guard emits a signal.
 */
const GHOST_KEYWORDS =
  /\b(?:fix(?:ed)?|implement(?:ed)?|refactor(?:ed)?|rewrote|rewrite|updat(?:ed?)|deploy(?:ed)?|patch(?:ed)?|modif(?:ied|y)|delet(?:ed?)|migrat(?:ed?)|rewir(?:ed?)|wrote)\b/i;

/**
 * Create a beforeToolCall hook that guards finish(status: "success") calls.
 *
 * Three gates:
 * 1. Ghost Deliverable Guard (FM-3.1 preventive): signals when summary implies
 *    code changes ("Fixed", "Implemented", etc.) but no write/edit evidence
 *    exists in the transcript AND no deliverables are listed. This catches the
 *    #1 behavioral failure: agents claiming work without doing it.
 * 2. Write Evidence Guard: signals when deliverables are listed but no write/edit
 *    evidence exists in the transcript.
 * 3. Verification Guard (FM-3.3): signals when writes exist but no verification
 *    (read-back, test, type-check) occurs after the last write.
 *
 * Exceptions (no signal):
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

    // Check for write/edit evidence in the transcript
    const toolNames = extractToolCallNames(ctx.context.messages);

    // Direct file-writing tools used?
    let hasWriteEvidence = false;
    if (toolNames.has("write") || toolNames.has("edit")) {
      hasWriteEvidence = true;
    }

    // CLI worker agents (cc_worker, codex_worker) have full filesystem
    // access — their writes don't appear in the tool transcript.
    if (
      !hasWriteEvidence &&
      (toolNames.has("cc_worker") || toolNames.has("codex_worker"))
    ) {
      hasWriteEvidence = true;
    }

    // Orchestration tools (workflow, agents) delegate work to child sessions
    // whose writes don't appear in the parent transcript.
    if (!hasWriteEvidence && (toolNames.has("workflow") || toolNames.has("agents"))) {
      hasWriteEvidence = true;
    }

    // Bash commands that write files?
    if (!hasWriteEvidence && toolNames.has(BASH_TOOL_NAME) && hasBashWriteEvidence(ctx.context.messages)) {
      hasWriteEvidence = true;
    }

    // ── Gate 0: Ghost Deliverable Guard (FM-3.1 preventive) ──────
    // Summary implies code changes but no write evidence AND no deliverables.
    // This catches "Fixed the bug" with zero file modifications.
    const summary = args.summary ?? "";
    const hasDeliverables = args.deliverables && args.deliverables.length > 0;
    if (!hasWriteEvidence && !hasDeliverables && GHOST_KEYWORDS.test(summary)) {
      return {
        block: false, // signal-only: guard emits metric but does not block
        reason:
          `finish(status: "success") guard signal [FM-3.1 Ghost Deliverable]: Your summary implies ` +
          `code changes ("${summary.slice(0, 80)}") but your session contains no write, edit, or ` +
          `file-producing bash commands, and no deliverables are listed. Either:\n` +
          `1. Actually write/edit the files, list them as deliverables, then call finish()\n` +
          `2. Rephrase summary to reflect what you actually did (e.g., "Analyzed X", "Verified Y")\n` +
          `3. Use status: "partial" if work is incomplete`,
      };
    }

    // If no deliverables listed and no ghost keywords, allow (analysis-only sessions)
    if (!hasDeliverables) return undefined;

    // ── Gate 1: No write evidence at all — signal (original FM-3.1/FM-2.2 guard) ──
    if (!hasWriteEvidence) {
      const deliverablePaths = args.deliverables!.map((d) => d.path).join(", ");
      return {
        block: false, // signal-only: guard emits metric but does not block
        reason:
          `finish(status: "success") guard signal: You claimed ${args.deliverables!.length} deliverable(s) ` +
          `(${deliverablePaths}) but your session transcript contains no write, edit, or file-producing ` +
          `bash commands. Either:\n` +
          `1. Actually write/edit the files before calling finish()\n` +
          `2. Remove deliverables you didn't create this session\n` +
          `3. Use status: "partial" if work is incomplete`,
      };
    }

    // Gate 2 (FM-3.3 post-write verification) removed — deduplicated.
    // verification-depth-guard.ts T2 covers this with better per-call-index tracking.
    // Keeping both caused duplicate signals: agents saw two messages for one issue.

    // All gates passed — allow
    return undefined;
  };
}
