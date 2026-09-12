/**
 * finish() write-activity signal — beforeToolCall hook.
 *
 * Warn when success claims file deliverables but the transcript has no apparent
 * writing or delegation activity. This heuristic examines calls, not outcomes:
 * silence does not prove writes succeeded or verification was meaningful.
 * The finish tool checks required facts and file existence; the caller/App
 * judges correctness against its acceptance criteria.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

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
function hasBashWriteFacts(messages: BeforeToolCallContext["context"]["messages"]): boolean {
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
 * Create a beforeToolCall hook that guards finish(status: "success") calls.
 *
 * Signals absent apparent write activity for typed file claims. It does not
 * grade verification depth or enforce a checklist/process artifact.
 *
 * Exceptions (no signal):
 * - `finish()` with status other than "success"
 * - Sessions without typed deliverables; summary prose is not facts
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
      deliverables?: { path: string; description: string }[];
    };

    // Only guard success
    if (args.status !== "success") return undefined;

    // Check for write/edit facts in the transcript
    const toolNames = extractToolCallNames(ctx.context.messages);

    // Direct file-writing tools used?
    let hasWriteFacts = false;
    if (toolNames.has("write") || toolNames.has("edit")) {
      hasWriteFacts = true;
    }

    // Orchestration tools delegate work to child sessions whose writes don't
    // appear in the parent transcript. A CLI task is only facts after the
    // caller has also read its durable result or deliverable; acceptance alone
    // is not completion.
    if (
      !hasWriteFacts &&
      (toolNames.has("workflow") ||
        toolNames.has("agents") ||
        (toolNames.has("run_cli_agent") && toolNames.has("read")))
    ) {
      hasWriteFacts = true;
    }

    // Bash commands that write files?
    if (!hasWriteFacts && toolNames.has(BASH_TOOL_NAME) && hasBashWriteFacts(ctx.context.messages)) {
      hasWriteFacts = true;
    }

    const hasDeliverables = args.deliverables && args.deliverables.length > 0;
    // Without typed deliverables there is no mechanical claim for this guard
    // to validate. Meaning in the summary remains the model's responsibility.
    if (!hasDeliverables) return undefined;

    // ── Gate 1: No write facts at all — signal (original FM-3.1/FM-2.2 guard) ──
    if (!hasWriteFacts) {
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

    return undefined;
  };
}
