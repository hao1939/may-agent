/**
 * Empty Args Guard — beforeToolCall hook.
 *
 * Blocks tool calls that are missing required parameters BEFORE they reach
 * the tool executor. This catches a common LLM failure mode where agents
 * call tools with empty/missing args (e.g., `read({})`, `bash({})`).
 *
 * Instead of letting the validation error reach the tool and count as a
 * wasted call, this guard returns a helpful error message that coaches
 * the agent to fix the call.
 *
 * Impact: 18+ wasted calls/day from empty-args pattern (coach 10 read:empty,
 * coder 8 bash:empty as of 2026-03-24 tool-quality-report).
 *
 * Source: Optimizer tool-quality regression finding 2026-03-24.
 */

import type { BeforeToolCallContext, BeforeToolCallResult } from "./compose-guards.js";

/**
 * Required parameters for common tools.
 * Maps tool name → array of required parameter names.
 *
 * Note: edit:newText is intentionally excluded — empty string is valid (deletion).
 * write:content could also be empty, but that's almost never intentional.
 */
const REQUIRED_PARAMS: Record<string, string[]> = {
  read: ["path"],
  bash: ["command"],
  edit: ["path", "oldText"],
  write: ["path", "content"],
};

/**
 * Friendly hints for what each parameter should contain.
 */
const PARAM_HINTS: Record<string, string> = {
  "read:path": 'Use read({ path: "path/to/file.md" })',
  "bash:command": 'Use bash({ command: "your-command-here" })',
  "edit:path": "Specify the file path to edit",
  "edit:oldText": "Specify the exact text to find and replace",
  "write:path": "Specify the file path to write",
  "write:content": "Specify the content to write",
};

/**
 * Create a beforeToolCall hook that blocks tool calls with missing required parameters.
 *
 * This is a stateless guard — no per-session state needed.
 */
export function createEmptyArgsGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;
    const requiredParams = REQUIRED_PARAMS[toolName];

    // Not a tool we track — allow
    if (!requiredParams) return undefined;

    const args = ctx.args ?? {};
    const missing: string[] = [];

    for (const param of requiredParams) {
      const value = args[param];
      // Check for missing, undefined, null, or empty string
      if (value === undefined || value === null || value === "") {
        missing.push(param);
      }
    }

    // All required params present — allow
    if (missing.length === 0) return undefined;

    // Build helpful error message
    const hints = missing
      .map((p) => {
        const hint = PARAM_HINTS[`${toolName}:${p}`];
        return hint ? `  - ${p}: ${hint}` : `  - ${p}: required`;
      })
      .join("\n");

    return {
      block: true,
      reason:
        `🚫 EMPTY_ARGS: ${toolName}() called with missing required parameter(s): ${missing.join(", ")}.\n` +
        `Fix:\n${hints}\n` +
        `Do NOT call ${toolName}({}) — you must provide the required arguments.`,
    };
  };
}
