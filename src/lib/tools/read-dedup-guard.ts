/**
 * Read Dedup Guard — beforeToolCall hook.
 *
 * Prevents agents from entering infinite read loops by tracking how many times
 * each file path is read within a session. After WARN_THRESHOLD reads of the
 * same file, a warning is injected. After BLOCK_THRESHOLD reads, the call is
 * blocked entirely.
 *
 * Motivation: Amy sessions reading signals.md (76KB) and insights.md (31KB)
 * 75× each in a loop — 152 reads/session costing ~$71. This guard prevents
 * any agent from burning budget on redundant file reads.
 *
 * Source: Optimizer cost finding 2026-03-18.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/** After this many reads of the same path, inject a warning into the response. */
export const READ_WARN_THRESHOLD = 3;

/** After this many reads of the same path, block the read entirely. */
export const READ_BLOCK_THRESHOLD = 5;

/**
 * Normalize a file path for dedup tracking.
 *
 * Strips leading "./" and collapses multiple slashes so that
 * "./foo/bar.md", "foo/bar.md", and "foo//bar.md" all match.
 */
function normalizePath(p: string): string {
  return p.replace(/^\.\//, "").replace(/\/+/g, "/");
}

/**
 * Create a beforeToolCall hook that detects and blocks excessive reads of
 * the same file path within a single session.
 *
 * Returns a stateful closure — one instance per agent session.
 */
export function createReadDedupGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  /** Per-path read count for this session. */
  const readCounts = new Map<string, number>();

  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept read() calls
    if (ctx.toolCall.name !== "read") return undefined;

    const args = ctx.args as { path?: string; offset?: number; limit?: number };
    if (!args.path) return undefined;

    const normalizedPath = normalizePath(args.path);
    const count = (readCounts.get(normalizedPath) ?? 0) + 1;
    readCounts.set(normalizedPath, count);

    // Below warn threshold — allow silently
    if (count <= READ_WARN_THRESHOLD) return undefined;

    // At block threshold — hard block
    if (count > READ_BLOCK_THRESHOLD) {
      return {
        block: true,
        reason:
          `🚫 READ_DEDUP: You have already read "${args.path}" ${count - 1} times this session. ` +
          `Further reads of this file are blocked to prevent infinite read loops. ` +
          `The file content has not changed since your last read. ` +
          `Use the information you already have, or read a different file.`,
      };
    }

    // Between warn and block — allow with warning
    return {
      block: false,
      reason:
        `⚠️ READ_DEDUP: You have read "${args.path}" ${count} times this session (limit: ${READ_BLOCK_THRESHOLD}). ` +
        `Re-reading the same file is usually a sign of a loop. ` +
        `Consider: do you actually need to re-read this, or can you use information from your earlier read?`,
    };
  };
}
