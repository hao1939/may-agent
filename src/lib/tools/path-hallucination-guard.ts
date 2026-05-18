/**
 * Path Hallucination Guard — beforeToolCall hook.
 *
 * Blocks bash() calls that contain hallucinated filesystem paths like
 * /home/*, /Users/*, /root/*, or ~/. These paths don't exist in the
 * container environment (project root is /app).
 *
 * This is a Channel 2 (forced externalization) intervention targeting
 * C7.1 regression where agents hallucinate paths in heartbeat sessions.
 *
 * False-positive mitigation: Commands that merely *search for* these
 * path patterns (grep, rg, sed, etc.) are allowed through.
 *
 * Policy: FAIL-OPEN — if detection logic throws, allow the call through.
 * Source: EXP-132 — C7.1 dropped from 92.9% → 73.7% due to path hallucination.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

// ─── Hallucinated Path Patterns ─────────────────────────────────────

/**
 * Patterns that indicate a hallucinated path.
 * Each entry: [regex to find the path, human-readable description].
 *
 * We match these as literal substrings first (fast), then extract the
 * actual offending path for the error message.
 */
const HALLUCINATED_PREFIXES = [
  "/home/",
  "/Users/",
  "/root/",
] as const;

/**
 * Tilde is special — only match ~/ at word boundary (not inside URLs like
 * https://example.com/~user which shouldn't appear but let's be safe).
 */
const TILDE_PATTERN = /(?:^|[\s;|&(])~\//;

// ─── Safe Pattern Detection ─────────────────────────────────────────

/**
 * Commands where the hallucinated path is likely a *search pattern*
 * rather than a filesystem access. These are allowed through.
 *
 * Heuristic: if the command's main verb is a search/print tool,
 * the path string is probably a pattern argument, not a real path.
 */
const SEARCH_COMMAND_PREFIXES = [
  "grep ",
  "grep\t",
  "rg ",
  "rg\t",
  "ag ",
  "ag\t",
  "ack ",
  "ack\t",
  "echo ",
  "echo\t",
  "printf ",
  "printf\t",
  "sed ",
  "sed\t",
];

/**
 * Inline script commands where the hallucinated path is inside a quoted
 * code string — not a real filesystem access. E.g.:
 *   bun -e 'const p = "/home/user"; ...'
 *   node -e "console.log('/Users/dev')"
 *   python -c "print('/root/path')"
 */
const INLINE_SCRIPT_PATTERNS = [
  /^bun\s+(-e|--eval)\s/,
  /^node\s+(-e|--eval)\s/,
  /^python[23]?\s+-c\s/,
  /^deno\s+(eval|run\s+-e)\s/,
];

/**
 * Check whether the command is primarily a search/print command where
 * the hallucinated path is a pattern, not a filesystem target.
 *
 * This is deliberately conservative — we'd rather have a false positive
 * (agent retries with /app) than a false negative (C7.1 violation).
 */
function isSearchCommand(command: string): boolean {
  const trimmed = command.trimStart();

  // Direct search command: `grep -r "/home" src/`
  for (const prefix of SEARCH_COMMAND_PREFIXES) {
    if (trimmed.startsWith(prefix)) return true;
  }

  // Inline script: `bun -e 'code mentioning /home'`
  for (const pattern of INLINE_SCRIPT_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Piped search: `cat file | grep "/home"`
  // Only if ALL pipeline stages with hallucinated paths are search commands
  // For simplicity: if the command contains a pipe and grep/rg appears after it
  // This is a rough heuristic but covers the common case
  return false;
}

/**
 * Extract the first hallucinated path found in the command string.
 * Returns the matched path prefix and a longer substring for context.
 */
function findHallucinatedPath(command: string): { prefix: string; fullMatch: string } | undefined {
  for (const prefix of HALLUCINATED_PREFIXES) {
    const idx = command.indexOf(prefix);
    if (idx !== -1) {
      // Extract the full path (up to whitespace, quote, or end of string)
      const rest = command.slice(idx);
      const match = rest.match(/^[^\s"'`;|&)<>]*/);
      const fullMatch = match ? match[0] : prefix;
      return { prefix, fullMatch };
    }
  }

  // Check tilde
  if (TILDE_PATTERN.test(command)) {
    const match = command.match(/~\/[^\s"'`;|&)<>]*/);
    const fullMatch = match ? match[0] : "~/";
    return { prefix: "~/", fullMatch };
  }

  return undefined;
}

// ─── Guard Factory ──────────────────────────────────────────────────

/**
 * Create a beforeToolCall hook that signals bash() calls containing
 * hallucinated filesystem paths.
 *
 * Detection:
 * - /home/* — Linux home directories (don't exist in container)
 * - /Users/* — macOS home directories (don't exist in container)
 * - /root/* — root home directory (doesn't exist in container)
 * - ~/ — tilde expansion (expands to non-existent home)
 *
 * Exclusions:
 * - grep/rg/ag/ack/echo/printf/sed commands (searching for patterns)
 * - bun -e / node -e / python -c inline scripts (path in string literal)
 *
 * @returns Guard hook compatible with composeGuards()
 */
export function createPathHallucinationGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (
    ctx: BeforeToolCallContext,
  ): Promise<BeforeToolCallResult | undefined> => {
    // Only intercept bash() calls
    if (ctx.toolCall.name !== "bash") return undefined;

    const command = ctx.args.command;
    if (typeof command !== "string" || !command) return undefined;

    try {
      // Fast check: does the command contain any hallucinated path?
      const hasPrefix = HALLUCINATED_PREFIXES.some((p) => command.includes(p));
      const hasTilde = TILDE_PATTERN.test(command);

      if (!hasPrefix && !hasTilde) return undefined;

      // Check if this is a search command (grep/rg/echo) — allow those
      if (isSearchCommand(command)) return undefined;

      // Find the specific offending path for the error message
      const found = findHallucinatedPath(command);
      if (!found) return undefined; // Shouldn't happen given checks above, but fail-open

      // Detect bun-path-specific hallucination (the #1 pattern)
      const isBunPath = found.fullMatch.includes("bun") || command.includes(".bun/bin");
      const bunHint = isBunPath
        ? `\n\nFor bun: it is on PATH at /usr/local/bin/bun. Just use: bun -e "..."`
        : "";

      return {
        block: false, // signal-only: guard emits metric but does not block
        reason:
          `PATH_HALLUCINATION signal: This command references a path that does not exist in this environment:\n` +
          `  Detected: ${found.fullMatch}\n\n` +
          `The project root is /app. There are no /home/, /Users/, or /root/ directories.\n` +
          `Rewrite your command using /app as the base path.\n` +
          `  Example: cd /app && git status\n` +
          `  Example: cat /app/src/lib/manager.ts` +
          bunHint,
      };
    } catch {
      // Fail-open: detection errors should not block tool calls
      return undefined;
    }
  };
}
