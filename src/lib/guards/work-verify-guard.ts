/**
 * Work-Verify Guard — beforeToolCall hook.
 *
 * Blocks finish() if the agent edited files but hasn't run any verification
 * command (bash) since the last edit. This catches the "edit-and-pray" pattern
 * where agents trust text evidence over execution evidence.
 *
 * State is derived from the message history in context — no mutable state needed.
 * The guard scans messages backwards to find the last edit/write and checks if
 * a bash call occurred after it.
 *
 * Source: design-harness-guards.md (Bob brief, req:0eef8ef9).
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "../tools/compose-guards.js";

/**
 * Extract tool calls from the message history, returning them in chronological order.
 * Each entry has the tool name and its position in the message array.
 */
function extractToolCallsFromMessages(
  messages: Array<{ role: string; content: unknown }>,
): Array<{ tool: string; msgIndex: number }> {
  const calls: Array<{ tool: string; msgIndex: number }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const content = msg.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as any).type === "toolCall" &&
        "name" in block
      ) {
        calls.push({ tool: (block as any).name, msgIndex: i });
      }
    }
  }

  return calls;
}

/** Tools that count as "editing" — state-changing file operations */
const EDIT_TOOLS = new Set(["edit", "write"]);

/** Tools that count as "verification" — running something to check */
const VERIFY_TOOLS = new Set(["bash"]);

/**
 * Create a beforeToolCall hook that blocks finish() if no bash verification
 * happened after the most recent edit/write.
 */
export function createWorkVerifyGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only guard finish
    if (ctx.toolCall.name !== "finish") return undefined;

    const messages = ctx.context?.messages;
    if (!messages || messages.length === 0) return undefined;

    const calls = extractToolCallsFromMessages(messages);
    if (calls.length === 0) return undefined;

    // Find the last edit/write call
    let lastEditIdx = -1;
    for (let i = calls.length - 1; i >= 0; i--) {
      if (EDIT_TOOLS.has(calls[i].tool)) {
        lastEditIdx = i;
        break;
      }
    }

    // No edits in this session — allow finish
    if (lastEditIdx < 0) return undefined;

    // Check if any bash call happened AFTER the last edit
    for (let i = lastEditIdx + 1; i < calls.length; i++) {
      if (VERIFY_TOOLS.has(calls[i].tool)) {
        return undefined; // Found verification after edit — allow
      }
    }

    // Edit happened but no verification after it
    return {
      block: true,
      reason:
        `🚫 WORK_VERIFY: finish() blocked — you edited files but haven't run any ` +
        `verification command (bash) since the last edit.\n` +
        `You must verify your changes work before finishing. Run tests, a linter, ` +
        `or a check script (e.g., bash({ command: "node -e 'require(...)'" })) ` +
        `to confirm the edit is correct.\n` +
        `If no test exists, at least run: bash({ command: "cat <edited-file> | head -20" }) ` +
        `to visually confirm.`,
    };
  };
}
