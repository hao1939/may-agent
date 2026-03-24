/**
 * Session Read Guard — beforeToolCall hook.
 *
 * Prevents agents from reading raw session.jsonl files via:
 *   1. read() tool — always blocked (30-300KB+ files)
 *   2. bash tool — blocks `cat` of session.jsonl (dumps entire file)
 *                — blocks unbounded `grep` without `| head` / `| tail` / `-c` / `-l` / `-m`
 *
 * Motivation: Coach common-sense-verify sessions read full session.jsonl files
 * (188KB+) costing $2-5/session in wasted tokens. The original read()-only guard
 * was bypassed by using bash + grep, producing 50-102KB tool results (session s_72:
 * 401KB from 35 bash calls). This extended guard closes that bypass.
 *
 * Source: Optimizer cost findings 2026-03-18 (read guard), 2026-03-23 (bash bypass).
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** Pattern matching session.jsonl files in .state/sessions/ */
const SESSION_JSONL_PATTERN = /\.state\/sessions\/.*\/session\.jsonl/;

/**
 * Matches bash commands that would dump an entire session.jsonl
 * (cat, less, more, or plain file redirect).
 */
const BASH_CAT_PATTERN = /\b(cat|less|more)\b[^|]*session\.jsonl/;

/**
 * Matches bash commands that grep/rg session.jsonl files.
 */
const BASH_GREP_PATTERN = /\b(grep|rg|ripgrep|egrep|fgrep)\b[^|]*session\.jsonl/;

/**
 * Matches output limiters that make grep safe (piped to head/tail, or using
 * count-only flags like -c, -l, -m, --count, --files-with-matches).
 */
const OUTPUT_LIMITER_PATTERN = /\|\s*(head|tail)\b|\s-[^\s]*[clm]\b|\s--count\b|\s--files-with-matches\b|\s-l\b/;

/**
 * Create a beforeToolCall hook that blocks wasteful access to session.jsonl files.
 *
 * Blocks:
 *   - read() of session.jsonl (always)
 *   - bash cat/less/more of session.jsonl (always — dumps full file)
 *   - bash grep of session.jsonl WITHOUT output limiter (unbounded output)
 *
 * Allows:
 *   - bash grep ... session.jsonl | head -N  (bounded)
 *   - bash grep -c ... session.jsonl  (count only)
 *   - bash grep -l ... session.jsonl  (filenames only)
 *   - bash jq ... session.jsonl | head -N  (bounded)
 *   - reading meta.json (small files)
 */
export function createSessionReadGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;

    // --- Guard 1: Block read() of session.jsonl ---
    if (toolName === "read") {
      const args = ctx.args as { path?: string };
      if (!args.path) return undefined;

      const normalizedPath = args.path.replace(/^\.\//, "").replace(/\/+/g, "/");
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
    }

    // --- Guard 2: Block bash commands that dump/grep session.jsonl unbounded ---
    if (toolName === "bash") {
      const args = ctx.args as { command?: string };
      if (!args.command) return undefined;

      const cmd = args.command;

      // Check if the command references session.jsonl at all
      if (!cmd.includes("session.jsonl")) return undefined;

      // Block: cat/less/more of session.jsonl (always dumps full file)
      if (BASH_CAT_PATTERN.test(cmd)) {
        return {
          block: true,
          reason:
            `🚫 SESSION_BASH_CAT: Dumping session.jsonl via cat/less/more is blocked — these files ` +
            `are 30-300KB+ and will waste your token budget. Use targeted extraction instead:\n` +
            `  • grep 'pattern' <file> | head -20\n` +
            `  • jq 'select(.role=="assistant") | .content' <file> | head -50\n` +
            `  • grep -c 'pattern' <file>  (count only)\n` +
            `  • cat .state/sessions/history/<id>/meta.json  (meta.json is fine — it's small)`,
        };
      }

      // Check: grep/rg of session.jsonl without output limiter
      if (BASH_GREP_PATTERN.test(cmd) && !OUTPUT_LIMITER_PATTERN.test(cmd)) {
        return {
          block: true,
          reason:
            `🚫 SESSION_BASH_GREP: Unbounded grep of session.jsonl is blocked — these files are ` +
            `30-300KB+ and grep without a limiter can produce 50-100KB+ of output. Add a limiter:\n` +
            `  • grep 'pattern' <file> | head -20     (pipe to head)\n` +
            `  • grep -c 'pattern' <file>              (count only)\n` +
            `  • grep -l 'pattern' <file>              (filename only)\n` +
            `  • grep -m 5 'pattern' <file>            (max 5 matches)`,
        };
      }
    }

    return undefined;
  };
}
