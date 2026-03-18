/**
 * Session Read Guard — beforeToolCall hook.
 *
 * Prevents agents from reading raw session.jsonl files with the read() tool.
 * These files are 30-300KB+ of JSONL and are almost never useful to read directly.
 * Agents should use bash with grep/jq to extract specific data instead.
 *
 * Motivation: Coach common-sense-verify sessions reading full session.jsonl files
 * (188KB+) despite cron message instructions to use grep. This costs $2-5 per
 * session in wasted tokens. A structural guard is more reliable than instructions.
 *
 * Source: Optimizer cost finding 2026-03-18.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Pattern matching session.jsonl files in .state/sessions/ */
const SESSION_JSONL_PATTERN = /\.state\/sessions\/.*\/session\.jsonl$/;

/**
 * Create a beforeToolCall hook that blocks direct reads of session.jsonl files.
 *
 * Suggests using bash with grep/jq as an alternative.
 */
export function createSessionReadGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept read() calls
    if (ctx.toolCall.name !== "read") return undefined;

    const args = ctx.args as { path?: string };
    if (!args.path) return undefined;

    // Normalize the path
    const normalizedPath = args.path.replace(/^\.\//, "").replace(/\/+/g, "/");

    // Check if it matches a session.jsonl file
    if (!SESSION_JSONL_PATTERN.test(normalizedPath)) return undefined;

    return {
      block: true,
      reason:
        `🚫 SESSION_READ: Reading session.jsonl files directly is blocked — they are 30-300KB+ ` +
        `and will waste your token budget. Instead, use bash with grep/jq to extract what you need:\n` +
        `  • Find sessions: grep -l 'keyword' .state/sessions/history/*/session.jsonl\n` +
        `  • Extract data: grep 'pattern' <file> | head -20\n` +
        `  • Parse JSON: jq 'select(.role=="assistant")' <file> | head -50\n` +
        `  • Get metadata: cat .state/sessions/history/<id>/meta.json`,
    };
  };
}
