/**
 * Path Hallucination Guard — beforeToolCall hook.
 *
 * Blocks bash/read/edit/write calls that reference paths which don't exist
 * in this environment. LLMs commonly hallucinate home-directory paths like
 * `/home/user/`, `/Users/user/`, `~/`, or `/var/tmp/repos/` — none of
 * which exist here (the filesystem root is `/app`).
 *
 * Instead of letting the tool fail with a confusing "file not found" error
 * (and wasting a turn), this guard blocks the call early and coaches the
 * agent to use `ls` or `find` to discover the correct paths.
 *
 * Source: #1 failure mode as of 2026-03-29.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/**
 * Path patterns that never exist in this environment.
 */
const HALLUCINATED_PATHS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\/home\/\w+/, label: "/home/<user>" },
  { pattern: /\/Users\/\w+/, label: "/Users/<user>" },
  { pattern: /~\//, label: "~/" },
  { pattern: /\/var\/tmp\/repos\//, label: "/var/tmp/repos/" },
];

/** Tools whose arguments we inspect for hallucinated paths. */
const CHECKED_TOOLS = new Set(["bash", "read", "edit", "write"]);

/**
 * Create a beforeToolCall hook that blocks tool calls targeting hallucinated paths.
 *
 * This is a stateless guard — no per-session state needed.
 */
export function createPathHallucinationGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;

    // Not a tool we check — allow
    if (!CHECKED_TOOLS.has(toolName)) return undefined;

    const args = ctx.args ?? {};

    // Determine the string to scan for hallucinated paths
    let target: string | undefined;
    if (toolName === "bash") {
      target = typeof args.command === "string" ? args.command : undefined;
    } else {
      // read, edit, write — check the path argument
      target = typeof args.path === "string" ? args.path : undefined;
    }

    // No scannable string — let other guards handle missing args
    if (!target) return undefined;

    // Check each hallucinated path pattern
    for (const { pattern, label } of HALLUCINATED_PATHS) {
      if (pattern.test(target)) {
        return {
          block: true,
          reason:
            `🚫 PATH_HALLUCINATION: Detected hallucinated path pattern "${label}" in ${toolName}() call.\n` +
            `This path does not exist in this environment. The filesystem root is /app.\n` +
            `Use \`ls\` or \`find /app -name "filename"\` to discover the correct paths.`,
        };
      }
    }

    // No hallucinated paths found — allow
    return undefined;
  };
}
