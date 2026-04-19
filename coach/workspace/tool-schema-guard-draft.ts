/**
 * Tool Schema Guard — beforeToolCall hook PROTOTYPE
 *
 * Intercepts common tool misuse patterns that cause FM-2.1 failures.
 * Based on analysis of 85 FM-2.1/TOOL_SCHEMA issues from may.db.
 *
 * Architecture: Same as commit-guard.ts and finish-guard.ts — implements
 * the BeforeToolCallHook interface and composes via composeGuards().
 *
 * Policy: FAIL-OPEN — if the guard can't determine, allow the call through.
 * This is a preventive guard, not a security gate.
 *
 * Coverage estimate: Would catch ~65 of 85 tool schema FM-2.1 instances (76%)
 * See analysis at bottom of file for per-pattern breakdown.
 *
 * Source: EXP-114a (FM-2.1 Approach Decomposition Guard → Tool Schema Hardening)
 * Data: .state/may.db, 85 FM-2.1 issues tagged TOOL_SCHEMA/TOOL_MISUSE/TOOL_ERROR
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "../../../src/lib/tools/compose-guards.js";

// ─── Pattern Definitions ─────────────────────────────────────────────
//
// Each pattern represents a class of tool misuse observed in production.
// Patterns are ordered by frequency (highest first).

interface MisusePattern {
  /** Pattern ID for logging/metrics */
  id: string;
  /** Which tool this pattern applies to */
  tool: string;
  /** Human description of the misuse */
  description: string;
  /** How many FM-2.1 instances this pattern covers in may.db */
  observedCount: number;
  /** Example session IDs from may.db */
  exampleSessions: string[];
  /** The detection function — returns error message if misuse detected, undefined if OK */
  detect: (args: Record<string, unknown>) => string | undefined;
}

const MISUSE_PATTERNS: MisusePattern[] = [
  // ── Pattern 1: bash({}) — 41 instances ─────────────────────────────
  // The single most common tool schema error. Agent calls bash with no
  // arguments at all. Often happens when the agent "thinks" about running
  // a command but emits the tool call before forming the command string.
  //
  // Real examples from may.db:
  //   s_1773500971636_107: "Issued invalid tool calls `bash({})` twice"
  //   s_1773802424817_389: "`bash({})` schema error"
  //   s_1773715307873_84: "`bash({})` appears repeatedly"
  {
    id: "BASH_EMPTY",
    tool: "bash",
    description: "bash() called with no command argument",
    observedCount: 41,
    exampleSessions: [
      "s_1773500971636_107",
      "s_1773802424817_389",
      "s_1773715307873_84",
    ],
    detect: (args) => {
      if (!args.command && Object.keys(args).length === 0) {
        return (
          "bash() requires a `command` argument. You called bash({}) with no arguments.\n" +
          "Usage: bash({ command: 'your shell command here' })\n" +
          "Example: bash({ command: 'ls -la agents/coach/workspace/' })"
        );
      }
      if (!args.command && typeof args.command !== "string") {
        // Has other args but not 'command' — probably confused arg names
        return undefined; // Let BASH_WRONG_ARG handle this
      }
      return undefined;
    },
  },

  // ── Pattern 2: read({}) — 19 instances ─────────────────────────────
  // Agent calls read with no arguments. Same root cause as bash({}) —
  // the agent emits the tool call skeleton without filling in the args.
  //
  // Real examples:
  //   s_1773892805986_1: "`read({})` missing required `path`"
  //   s_1773523451955_813: "`read({})` once, failing validation"
  //   s_1774348588663_50: "Three consecutive read validation failures: `Received arguments: {}`"
  {
    id: "READ_EMPTY",
    tool: "read",
    description: "read() called with no path argument",
    observedCount: 19,
    exampleSessions: [
      "s_1773892805986_1",
      "s_1773523451955_813",
      "s_1774348588663_50",
    ],
    detect: (args) => {
      if (!args.path && Object.keys(args).length === 0) {
        return (
          "read() requires a `path` argument. You called read({}) with no arguments.\n" +
          "Usage: read({ path: 'path/to/file.md' })\n" +
          "Example: read({ path: 'agents/coach/workspace/todo.md' })"
        );
      }
      return undefined;
    },
  },

  // ── Pattern 3: finish({}) — 16 instances ───────────────────────────
  // Agent calls finish with no arguments. This is often the SECOND call
  // after a valid finish was already attempted but blocked by another guard.
  // The agent retries but emits an empty call.
  //
  // Real examples:
  //   s_1773847115595_89: "`finish({})` (missing required fields)"
  //   s_1773843111393_69: "invalid tool calls: `finish({})` (missing required fields)"
  //   s_1774357973174_98: "invalid `finish({})` call that fails tool validation"
  {
    id: "FINISH_EMPTY",
    tool: "finish",
    description: "finish() called with no status/summary",
    observedCount: 16,
    exampleSessions: [
      "s_1773847115595_89",
      "s_1773843111393_69",
      "s_1774357973174_98",
    ],
    detect: (args) => {
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
    },
  },

  // ── Pattern 4: read({command: '...'}) — 6 instances ────────────────
  // Agent confuses read() and bash(): passes a 'command' arg to read()
  // when they meant either bash({command: '...'}) or read({path: '...'}).
  //
  // Real examples:
  //   s_1773715307873_84: "read() called with {command: ...}"
  //   s_1773745118927_106: "read() called with {command: ...}"
  //   s_1773715278800_70: "used read() with a 'command' field instead of 'path'"
  {
    id: "READ_WRONG_ARG",
    tool: "read",
    description: "read() called with 'command' instead of 'path'",
    observedCount: 6,
    exampleSessions: [
      "s_1773715307873_84",
      "s_1773745118927_106",
      "s_1773715278800_70",
    ],
    detect: (args) => {
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
    },
  },

  // ── Pattern 5: edit({}) — 4 instances ──────────────────────────────
  // Agent calls edit with no arguments. edit() requires path, oldText,
  // and newText.
  //
  // Real examples:
  //   s_1773747660034_18: "`edit({})` produced schema validation errors"
  //   s_1773747221376_10: "Two invalid tool invocations: `edit({})`"
  //   s_1773747181081_8: "`edit({})` produced schema validation errors"
  {
    id: "EDIT_EMPTY",
    tool: "edit",
    description: "edit() called with no arguments",
    observedCount: 4,
    exampleSessions: [
      "s_1773747660034_18",
      "s_1773747221376_10",
      "s_1773747181081_8",
    ],
    detect: (args) => {
      if (Object.keys(args).length === 0) {
        return (
          "edit() requires `path`, `oldText`, and `newText` arguments.\n" +
          "Usage: edit({ path: 'file.md', oldText: 'exact text to find', newText: 'replacement text' })\n" +
          "The oldText must match exactly (including whitespace)."
        );
      }
      if (!args.path) {
        return "edit() is missing the required `path` argument.";
      }
      if (args.oldText === undefined && args.newText === undefined) {
        return (
          "edit() is missing `oldText` and `newText` arguments.\n" +
          "Usage: edit({ path: '...', oldText: 'text to replace', newText: 'new text' })"
        );
      }
      return undefined;
    },
  },

  // ── Pattern 6: bash({path: '...'}) — 2 instances ──────────────────
  // Agent confuses bash() and read(): passes a 'path' arg to bash()
  // when they meant read({path: '...'}) or bash({command: 'cat ...'}).
  //
  // Real examples:
  //   s_1773715307873_84: "bash({path: ...}) instead of bash({command: ...})"
  //   s_1773715278800_70: "used bash({path: ...}) instead of bash({command: ...})"
  {
    id: "BASH_WRONG_ARG",
    tool: "bash",
    description: "bash() called with 'path' instead of 'command'",
    observedCount: 2,
    exampleSessions: ["s_1773715307873_84", "s_1773715278800_70"],
    detect: (args) => {
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
    },
  },

  // ── Pattern 7: agents({}) — 2 instances ────────────────────────────
  // Agent calls the agents tool with no arguments.
  //
  // Real examples:
  //   s_1773509958039_390: "called `agents({})` without required `action`"
  //   s_1773511093361_421: "agents({}) twice causing validation failures"
  {
    id: "AGENTS_EMPTY",
    tool: "agents",
    description: "agents() called with no action argument",
    observedCount: 2,
    exampleSessions: ["s_1773509958039_390", "s_1773511093361_421"],
    detect: (args) => {
      if (Object.keys(args).length === 0) {
        return (
          "agents() requires at least an `action` argument.\n" +
          "Usage: agents({ action: 'list' }) — see available agents\n" +
          "       agents({ action: 'call', agent: 'name', task: '...' }) — call an agent\n" +
          "       agents({ action: 'message', agent: 'name', message: '...' }) — send a message"
        );
      }
      if (!args.action) {
        return (
          "agents() is missing the required `action` argument.\n" +
          "Valid actions: 'list', 'call', 'fork', 'message', 'peek', 'cancel'"
        );
      }
      return undefined;
    },
  },

  // ── Pattern 8: write({}) — 1 instance ─────────────────────────────
  // Agent calls write with no arguments.
  //
  // Real example:
  //   s_1773756162738_11: "write({}) (2x), bash({}) (many), read({}) (at least 2x)"
  {
    id: "WRITE_EMPTY",
    tool: "write",
    description: "write() called with no arguments",
    observedCount: 1,
    exampleSessions: ["s_1773756162738_11"],
    detect: (args) => {
      if (Object.keys(args).length === 0) {
        return (
          "write() requires `path` and `content` arguments.\n" +
          "Usage: write({ path: 'path/to/file.md', content: 'file content here' })"
        );
      }
      if (!args.path) {
        return "write() is missing the required `path` argument.";
      }
      if (args.content === undefined) {
        return "write() is missing the required `content` argument.";
      }
      return undefined;
    },
  },
];

// ─── Guard Factory ───────────────────────────────────────────────────

/**
 * Create a beforeToolCall hook that catches common tool schema misuse patterns.
 *
 * This guard intercepts tool calls BEFORE they execute and checks for known
 * misuse patterns (empty args, swapped arg names, missing required fields).
 * When a pattern is detected, it blocks the call with a helpful error message
 * that includes the correct usage.
 *
 * Design principles:
 * 1. FAIL-OPEN: If no pattern matches, the call goes through
 * 2. HELPFUL: Error messages include correct usage examples
 * 3. SPECIFIC: Each pattern has its own targeted message
 * 4. FAST: Pure arg inspection, no async/IO operations
 *
 * @returns A beforeToolCall hook compatible with composeGuards()
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

    // Check all patterns that apply to this tool
    for (const pattern of MISUSE_PATTERNS) {
      if (pattern.tool !== toolName) continue;

      try {
        const errorMsg = pattern.detect(args);
        if (errorMsg) {
          return {
            block: true,
            reason: `Tool call blocked [${pattern.id}]: ${errorMsg}`,
          };
        }
      } catch {
        // Fail-open: if a pattern's detect function throws, skip it
        continue;
      }
    }

    // No pattern matched — allow the call through
    return undefined;
  };
}

// ─── Composition Example ─────────────────────────────────────────────
//
// To deploy this guard, add it to composeGuards() in manager.ts:
//
//   import { createToolSchemaGuard } from './tool-schema-guard.js';
//   import { createCommitGuard } from './commit-guard.js';
//   import { createFinishGuard } from './finish-guard.js';
//   import { composeGuards } from './compose-guards.js';
//
//   const beforeToolCall = composeGuards(
//     createToolSchemaGuard(),     // ← NEW: Catch schema misuse early
//     createFinishGuard(),          // Validate finish() evidence
//     createCommitGuard(agent, root), // Enforce commit before finish
//   );
//
// Order matters: schema guard should run FIRST because it catches
// the cheapest/most obvious errors before more expensive guards run.

// ─── Coverage Analysis ───────────────────────────────────────────────
//
// From may.db analysis of 85 FM-2.1 issues tagged as tool schema errors:
//
// CATCHABLE BY THIS GUARD:
//   Pattern              | Instances | Guard Pattern ID
//   ---------------------|-----------|------------------
//   bash({})             | 41        | BASH_EMPTY
//   read({})             | 19        | READ_EMPTY
//   finish({})           | 16        | FINISH_EMPTY
//   read({command:...})  | 6         | READ_WRONG_ARG
//   edit({})             | 4         | EDIT_EMPTY
//   bash({path:...})     | 2         | BASH_WRONG_ARG
//   agents({})           | 2         | AGENTS_EMPTY
//   write({})            | 1         | WRITE_EMPTY
//   ---------------------|-----------|------------------
//   Total catchable      | 91*       | 8 patterns
//
//   * Some issues match multiple patterns (e.g., bash({}) + read({}) in same session)
//   * Estimated unique issues catchable: ~65 of 85 (76%)
//
// NOT CATCHABLE BY THIS GUARD:
//   Pattern                  | Instances | Why Not
//   -------------------------|-----------|--------
//   Tool hallucination       | 21        | Non-existent tools (checkpoint, Read)
//     (checkpoint, agents.send)          | don't trigger beforeToolCall hooks
//   Write shrink block       | 4         | Already handled by platform
//   Truncated JSON args      | 3         | Malformed at serialization level
//   Read directory (EISDIR)  | 2         | Needs filesystem check (expensive)
//   Other (cp errors, etc.)  | 8         | Too varied for pattern matching
//   -------------------------|-----------|--------
//   Total not catchable      | ~38*      |
//
// OVERALL EXPECTED IMPACT:
//   - 65 of 85 tool schema FM-2.1 instances would be caught (76%)
//   - 65 of 219 total FM-2.1 instances (30% of ALL FM-2.1)
//   - Highest impact on coach (50+ of 61 coach tool schema errors)
//   - Zero false positives expected (all patterns check for clearly invalid args)
//
// IMPORTANT CAVEAT: This guard BLOCKS the invalid call and returns an error.
// This prevents the FM-2.1 from being recorded, but only if the agent LEARNS
// from the error and fixes its call. If the agent repeats the same error,
// the guard will block again (creating a loop). The error messages are designed
// to be maximally helpful to break this loop.
//
// The commit guard (EXP-110) showed that blocking + helpful message achieves
// 58% → 1% error reduction, so we expect similar adoption behavior here.
