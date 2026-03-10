/**
 * Chat session tool harness.
 *
 * Wraps agent tools to reject blocking actions when used in the chat session.
 * The chat session must never block — blocking freezes the human interface
 * until the sub-agent or workflow completes.
 *
 * Applied transparently at session creation time. Tool implementations
 * remain unaware of the chat/task distinction.
 *
 * Blocked actions:
 * - subagents.delegate  → "Use subagents.run() to dispatch async"
 * - subagents.waitFor   → "Use status/progress/result instead"
 * - workflow.run        → "Use subagents.run(\"tech-lead\", task)"
 * - workflow.resume     → "Use in heartbeat/cron context only"
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

function errorResult(message: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    details: JSON.stringify({ error: message }),
  };
}

/** Actions blocked per tool name. Each entry maps action → error message. */
const BLOCKED_ACTIONS: Record<string, Record<string, string>> = {
  subagents: {
    delegate: "delegate blocks the chat session. Use subagents.run() to dispatch async, then follow up with status/progress/result.",
    waitFor: "waitFor blocks the chat session. Use subagents.status() or subagents.progress() to poll, or subagents.result() for completed sessions.",
  },
  workflow: {
    run: "workflow.run blocks the chat session. Use subagents.run(\"tech-lead\", task) to dispatch async, or use workflow.run in heartbeat/cron context only.",
    resume: "workflow.resume blocks the chat session. Use in heartbeat/cron context only.",
  },
};

/**
 * Wrap tools for use in the chat session. Returns new tool objects where
 * blocking actions are intercepted before reaching the original execute().
 * Tools not in BLOCKED_ACTIONS are passed through unchanged.
 */
export function wrapToolsForChat(tools: AgentTool[]): AgentTool[] {
  return tools.map((tool) => {
    const blocked = BLOCKED_ACTIONS[tool.name];
    if (!blocked) return tool;

    return {
      ...tool,
      execute: async (toolCallId, params, signal?, onUpdate?) => {
        const action = (params as { action?: string })?.action;
        if (action && blocked[action]) {
          return errorResult(blocked[action]);
        }
        return tool.execute(toolCallId, params, signal, onUpdate);
      },
    };
  });
}
