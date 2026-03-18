/**
 * finish() Evidence Validation Guard — beforeToolCall hook.
 *
 * Intercepts `finish(status: "success")` calls and validates that the session
 * transcript contains write/edit evidence when deliverables are claimed.
 *
 * Motivation: 8 FM-3.1/FM-2.2 failures in 7 days where agents claimed success
 * with deliverables that were never actually written. Text coaching was 0%
 * effective — this is a mechanical enforcement.
 *
 * Policy: Common Sense 7.1 (Don't lie), 7.2 (Don't fabricate), 2.3 (Verify after acting)
 * Source: exp-056 via Coach → Optimizer → Tech Lead
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Tool names that produce file artifacts. */
const WRITE_TOOL_NAMES = new Set(["write", "edit"]);

/** Tool names whose args may indicate file creation (e.g., bash with redirects). */
const BASH_TOOL_NAME = "bash";

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
 * Create a beforeToolCall hook that guards finish(status: "success") calls.
 *
 * When an agent calls `finish({ status: "success", deliverables: [...] })`,
 * this hook checks the session transcript for evidence that files were actually
 * written or edited. If no write/edit/bash-write evidence is found, the finish
 * call is blocked with a helpful error message.
 *
 * Exceptions (not blocked):
 * - `finish()` with status other than "success"
 * - `finish({ status: "success" })` with no deliverables or empty deliverables
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

    // Only guard success with deliverables
    if (args.status !== "success") return undefined;
    if (!args.deliverables || args.deliverables.length === 0) return undefined;

    // Check for write/edit evidence in the transcript
    const toolNames = extractToolCallNames(ctx.context.messages);

    // Direct file-writing tools used?
    for (const name of WRITE_TOOL_NAMES) {
      if (toolNames.has(name)) return undefined; // Evidence found — allow
    }

    // Bash commands that write files?
    if (toolNames.has(BASH_TOOL_NAME) && hasBashWriteEvidence(ctx.context.messages)) {
      return undefined; // Evidence found — allow
    }

    // No evidence found — block the finish call
    const deliverablePaths = args.deliverables.map((d) => d.path).join(", ");
    return {
      block: true,
      reason:
        `finish(status: "success") blocked: You claimed ${args.deliverables.length} deliverable(s) ` +
        `(${deliverablePaths}) but your session transcript contains no write, edit, or file-producing ` +
        `bash commands. Either:\n` +
        `1. Actually write/edit the files before calling finish()\n` +
        `2. Remove deliverables you didn't create this session\n` +
        `3. Use status: "partial" if work is incomplete`,
    };
  };
}
