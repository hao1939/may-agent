/**
 * Tool Schema Guard — beforeToolCall hook.
 *
 * Catches tool misuse patterns that go BEYOND empty-args:
 * - Cross-tool argument confusion (read({command:...}), bash({path:...}))
 * - finish() with missing required fields (status/summary)
 * - agents() with missing action
 *
 * Note: Basic empty-args detection (bash({}), read({}), edit({}), write({}))
 * is already handled by empty-args-guard.ts. This guard covers the patterns
 * that empty-args-guard cannot detect.
 *
 * Policy: FAIL-OPEN — if detection logic throws, allow the call through.
 * Source: EXP-114a analysis of 85 FM-2.1/TOOL_SCHEMA issues from may.db.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

// ─── Cross-Tool Confusion Patterns ──────────────────────────────────
//
// Agents sometimes swap argument names between tools:
//   read({command: "ls -la"})  — meant bash({command: "ls -la"})
//   bash({path: "file.ts"})    — meant read({path: "file.ts"})
//
// These pass empty-args-guard because they DO have args — just the wrong ones.

/**
 * Detect read() called with 'command' instead of 'path'.
 * 6 observed instances in may.db (READ_WRONG_ARG pattern).
 */
function detectReadWrongArg(args: Record<string, unknown>): string | undefined {
  if (args.command && !args.path) {
    const cmd = String(args.command);
    // If it looks like a file path, suggest read({path})
    if (
      cmd.includes("/") ||
      cmd.endsWith(".md") ||
      cmd.endsWith(".ts") ||
      cmd.endsWith(".json") ||
      cmd.endsWith(".js")
    ) {
      return (
        `read() takes a 'path' argument, not 'command'. ` +
        `Did you mean:\n` +
        `  read({ path: '${cmd}' })\n` +
        `Or if you wanted to run a shell command:\n` +
        `  bash({ command: '${cmd}' })`
      );
    }
    // Otherwise it's probably a bash command
    return (
      `read() takes a 'path' argument, not 'command'. ` +
      `It looks like you wanted to run a shell command. Use:\n` +
      `  bash({ command: '${cmd}' })\n` +
      `Or to read a file:\n` +
      `  read({ path: 'path/to/file' })`
    );
  }
  return undefined;
}

/**
 * Detect bash() called with 'path' instead of 'command'.
 * 2 observed instances in may.db (BASH_WRONG_ARG pattern).
 */
function detectBashWrongArg(args: Record<string, unknown>): string | undefined {
  if (args.path && !args.command) {
    const p = String(args.path);
    return (
      `bash() takes a 'command' argument, not 'path'. ` +
      `Did you mean:\n` +
      `  read({ path: '${p}' })  — to read a file\n` +
      `  bash({ command: 'cat ${p}' })  — to cat a file\n` +
      `  bash({ command: '${p}' })  — to run as a command`
    );
  }
  return undefined;
}

// ─── Missing Required Fields (not covered by empty-args-guard) ──────

/**
 * Detect finish() called without status or summary.
 * 16 observed instances in may.db (FINISH_EMPTY pattern).
 *
 * empty-args-guard doesn't cover finish() — it only checks read/bash/edit/write.
 */
function detectFinishMissingFields(args: Record<string, unknown>): string | undefined {
  if (Object.keys(args).length === 0) {
    return (
      "finish() requires at least `status` and `summary` arguments.\n" +
      "Usage: finish({ status: 'success', summary: 'What you accomplished' })\n" +
      "Valid statuses: 'success', 'partial', 'blocked', 'failure'"
    );
  }
  if (!args.status) {
    return (
      "finish() is missing the required `status` argument.\n" +
      "Usage: finish({ status: 'success', summary: '...' })\n" +
      "Valid statuses: 'success', 'partial', 'blocked', 'failure'"
    );
  }
  if (!args.summary) {
    return (
      "finish() is missing the required `summary` argument.\n" +
      "Usage: finish({ status: '...', summary: 'What you accomplished' })"
    );
  }
  return undefined;
}

/**
 * Detect agents() called without action.
 * 2 observed instances in may.db (AGENTS_EMPTY pattern).
 *
 * empty-args-guard doesn't cover agents() — it only checks read/bash/edit/write.
 */
function detectAgentsMissingAction(args: Record<string, unknown>): string | undefined {
  if (Object.keys(args).length === 0) {
    return (
      "agents() requires at least an `action` argument.\n" +
      "Usage: agents({ action: 'list' }) — see available agents\n" +
      "       agents({ action: 'call', agent: 'name', task: '...' }) — call an agent\n" +
      "       agents({ action: 'fork', agent: 'name', task: '...' }) — start a background session\n" +
      "Use the separate message({ to, content, intent?, priority? }) tool for inbox messages."
    );
  }
  if (!args.action) {
    return (
      "agents() is missing the required `action` argument.\n" +
      "Valid actions: 'list', 'call', 'fork', 'context', 'peek', 'cancel', 'requests'"
    );
  }
  return undefined;
}

// ─── Detector Registry ──────────────────────────────────────────────

/** A detector function bound to a specific tool name. */
interface ToolDetector {
  tool: string;
  id: string;
  detect: (args: Record<string, unknown>) => string | undefined;
}

/**
 * All detectors, ordered by frequency of the observed pattern.
 * Cross-tool confusion detectors are listed first since they're the most
 * confusing failure mode (the agent has args but the WRONG args).
 */
const DETECTORS: ToolDetector[] = [
  { tool: "finish", id: "FINISH_MISSING_FIELDS", detect: detectFinishMissingFields },
  { tool: "read", id: "READ_WRONG_ARG", detect: detectReadWrongArg },
  { tool: "agents", id: "AGENTS_MISSING_ACTION", detect: detectAgentsMissingAction },
  { tool: "bash", id: "BASH_WRONG_ARG", detect: detectBashWrongArg },
];

// ─── Guard Factory ──────────────────────────────────────────────────

/**
 * Create a beforeToolCall hook that catches tool schema misuse patterns
 * beyond what empty-args-guard covers.
 *
 * Covers:
 * - Cross-tool argument confusion (read↔bash arg swap)
 * - finish() missing status/summary (16 observed instances)
 * - agents() missing action (2 observed instances)
 *
 * Design: Pure argument inspection, no async/IO. Fail-open on any error.
 */
export function createToolSchemaGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (
    ctx: BeforeToolCallContext,
  ): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;
    const args = ctx.args;

    for (const detector of DETECTORS) {
      if (detector.tool !== toolName) continue;

      try {
        const errorMsg = detector.detect(args);
        if (errorMsg) {
          return {
            block: true,
            reason: `🚫 SCHEMA [${detector.id}]: ${errorMsg}`,
          };
        }
      } catch {
        // Fail-open: if a detector throws, skip it
        continue;
      }
    }

    // No pattern matched — allow the call through
    return undefined;
  };
}
