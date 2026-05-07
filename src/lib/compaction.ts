/**
 * compaction.ts — Key fact extraction from agent message transcripts.
 *
 * Used by handoff.ts to build structured summaries for workflow step handoffs.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ToolResultMessage } from "@mariozechner/pi-ai";

/**
 * Maximum number of exec commands to track in key facts.
 */
const MAX_EXEC_COMMANDS_IN_FACTS = 15;

/**
 * Structured key facts extracted from messages.
 * Using structured data allows proper merging across compaction rounds
 * (e.g., unioning file sets instead of duplicating "Files read: ..." lines).
 */
export interface KeyFacts {
  filesRead: Set<string>;
  filesWritten: Set<string>;
  filesEdited: Set<string>;
  agentCalls: Array<{ agent: string; task: string }>;
  /** Exec commands run, with their outcome. Ordered oldest-first. */
  execCommands: Array<{ command: string; failed: boolean }>;
}

/**
 * Extract key facts from messages: file paths accessed, exec commands run
 * and their outcomes. These survive summary trimming because they help
 * the agent avoid re-reading files or repeating commands after compaction.
 */
export function extractKeyFacts(messages: AgentMessage[]): KeyFacts {
  const filesRead = new Set<string>();
  const filesWritten = new Set<string>();
  const filesEdited = new Set<string>();
  const agentCalls: Array<{ agent: string; task: string }> = [];
  const execCommands: Array<{ command: string; failed: boolean }> = [];

  // Build a map from toolCall IDs to exec commands so we can pair with results
  const pendingExecCalls = new Map<string, string>(); // toolCallId → command

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || block.type !== "toolCall") continue;
        const args = block.arguments as Record<string, any>;

        if (block.name === "read" && args.path) {
          filesRead.add(args.path);
        } else if (block.name === "write" && args.path) {
          filesWritten.add(args.path);
        } else if (block.name === "edit" && args.path) {
          filesEdited.add(args.path);
        } else if (block.name === "exec" && args.command) {
          pendingExecCalls.set(block.id, args.command);
        } else if (block.name === "agents" && args.action === "call" && args.agent) {
          agentCalls.push({
            agent: args.agent,
            task: (args.task ?? "").slice(0, 120),
          });
        }
      }
    } else if (msg.role === "toolResult") {
      const trMsg = msg as ToolResultMessage;
      if (trMsg.toolName === "exec" && pendingExecCalls.has(trMsg.toolCallId)) {
        const command = pendingExecCalls.get(trMsg.toolCallId)!;
        pendingExecCalls.delete(trMsg.toolCallId);
        execCommands.push({ command, failed: !!trMsg.isError });
      }
    }
  }

  // Any exec calls without a paired result (shouldn't happen normally, but be safe)
  for (const [_id, command] of pendingExecCalls) {
    execCommands.push({ command, failed: false });
  }

  // Cap exec commands
  if (execCommands.length > MAX_EXEC_COMMANDS_IN_FACTS) {
    execCommands.splice(0, execCommands.length - MAX_EXEC_COMMANDS_IN_FACTS);
  }

  return { filesRead, filesWritten, filesEdited, agentCalls, execCommands };
}
