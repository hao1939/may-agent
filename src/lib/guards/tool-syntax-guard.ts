/**
 * Tool Syntax Guard — beforeToolCall hook.
 *
 * Blocks bash() calls that use file-reading commands (cat, head, tail, etc.)
 * when the native read() tool should be used instead. This enforces P2
 * (Tool Protocol) and prevents context flooding from accidental
 * `cat large-file.txt`.
 *
 * Exception: cat/head/tail are allowed when used as part of a pipe or redirect
 * (e.g., `cat file | grep`, `head -1 file > out.txt`). Only "read-only" usage
 * is blocked.
 *
 * Source: design-harness-guards.md (Bob brief, req:0eef8ef9).
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "../tools/compose-guards.js";

/**
 * Commands that should use native tools instead of bash.
 * Maps command name → the native tool to use instead.
 */
const BLOCKED_COMMANDS: Record<string, string> = {
  cat: "read",
  head: "read (with limit parameter)",
  tail: "read (with offset parameter)",
  more: "read",
  less: "read",
  vi: "edit",
  vim: "edit",
  nano: "edit",
};

/**
 * Characters that indicate the command is part of a pipeline or redirect,
 * making it a legitimate bash usage rather than a simple file read.
 */
const PIPE_REDIRECT_CHARS = ["|", ">", ">>", "&&", "||", ";"];

/**
 * Check if a bash command is a "simple read" that should use native tools,
 * or a legitimate pipe/redirect usage.
 *
 * Returns the blocked command name if it should be blocked, null otherwise.
 */
function findBlockedCommand(command: string): string | null {
  const trimmed = command.trim();

  for (const cmd of Object.keys(BLOCKED_COMMANDS)) {
    // Check if command starts with the blocked command followed by space or end
    // Match: "cat file.txt", "cat -n file.txt"
    // Don't match: "catalog", "catch"
    if (trimmed === cmd || trimmed.startsWith(cmd + " ")) {
      // Check if there's a pipe/redirect AFTER the command — if so, allow it
      // e.g., "cat file.txt | grep foo" is OK
      // But "cat file.txt" alone is not
      const afterCmd = trimmed.slice(cmd.length);
      
      const hasPipeOrRedirect = PIPE_REDIRECT_CHARS.some((ch) => afterCmd.includes(ch));
      if (hasPipeOrRedirect) return null; // Legitimate pipe/redirect usage

      return cmd;
    }
  }

  return null;
}

/**
 * Create a beforeToolCall hook that blocks bash commands using file-reading
 * commands that should use native tools.
 */
export function createToolSyntaxGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    if (ctx.toolCall.name !== "bash") return undefined;

    const command = ctx.args?.command;
    if (typeof command !== "string" || command.length === 0) return undefined;

    const blockedCmd = findBlockedCommand(command);
    if (!blockedCmd) return undefined;

    const nativeTool = BLOCKED_COMMANDS[blockedCmd];
    return {
      block: true,
      reason:
        `🚫 TOOL_SYNTAX: bash("${blockedCmd} ...") blocked — use the native '${nativeTool}' tool instead.\n` +
        `The '${blockedCmd}' command wastes context and risks flooding with large files.\n` +
        `Fix: Use read({ path: "..." }) for reading files, or edit({ path: "...", ... }) for modifications.\n` +
        `Exception: '${blockedCmd}' is allowed in pipes (e.g., '${blockedCmd} file | grep pattern').`,
    };
  };
}
