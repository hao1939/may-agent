/**
 * stuck-detector.ts — Detects agents stuck in repetitive failure loops.
 *
 * Two detection layers:
 *
 * 1. **Tool-level**: Same tool + same args → same error, N times in a row.
 *    Already enforced inline by manager-receipts.ts via TOOL_PIVOT_LIMIT.
 *    This module provides the history-scanning version for offline analysis.
 *
 * 2. **Turn-level**: N consecutive turns where every tool call errored.
 *    Already enforced by manager.ts subscribeForPersistence via STUCK_WARNING_THRESHOLD
 *    and STUCK_TERMINATE_THRESHOLD. This module provides the pure-function version.
 *
 * Both layers are exposed as pure functions for testability.
 */
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { isToolError, computeToolArgsKey, TOOL_PIVOT_LIMIT, STUCK_WARNING_THRESHOLD } from "./manager-utils.js";

// ── Types ──────────────────────────────────────────────────────────────

interface StuckResult {
  stuck: boolean;
  reason: string;
}

interface ToolCall {
  name: string;
  args: any;
  output: string;
  isError: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract tool calls from a message history.
 * Handles assistant messages (with toolCall blocks) and toolResult messages.
 * Uses pi-ai message format: assistant.content[].type === "toolCall", role === "toolResult".
 */
export function extractToolCalls(messages: AgentMessage[]): ToolCall[] {
  const calls: ToolCall[] = [];
  const pendingCalls = new Map<string, { name: string; args: any }>();

  for (const msg of messages) {
    if (!("role" in msg)) continue;

    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "toolCall") {
          pendingCalls.set(block.id, { name: block.name, args: (block as any).arguments ?? (block as any).input });
        }
      }
    } else if (msg.role === "toolResult") {
      // pi-ai ToolResultMessage: role "toolResult", content is on the message directly
      const toolMsg = msg as any;
      const toolCallId = toolMsg.toolCallId;
      const pending = toolCallId ? pendingCalls.get(toolCallId) : undefined;
      if (pending) {
        const outputText = Array.isArray(toolMsg.content)
          ? toolMsg.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("")
          : typeof toolMsg.content === "string"
            ? toolMsg.content
            : "";
        calls.push({
          name: pending.name,
          args: pending.args,
          output: outputText,
          isError: toolMsg.isError === true || isToolError(outputText),
        });
        pendingCalls.delete(toolCallId);
      }
    }
  }

  return calls;
}

// ── Core Detection ─────────────────────────────────────────────────────

/**
 * Detect if an agent is stuck based on its message history.
 *
 * Checks:
 * 1. Repetitive tool calls: Same tool + same args failing N+ times consecutively.
 * 2. Consecutive error turns: N+ assistant turns where every tool call errored.
 *
 * @param history - The session's message array.
 * @param options - Override thresholds for testing.
 * @returns StuckResult with stuck=true and a reason string, or stuck=false.
 */
export function isStuck(
  history: AgentMessage[],
  options?: {
    toolRepeatLimit?: number;
    errorTurnLimit?: number;
  },
): StuckResult {
  const toolRepeatLimit = options?.toolRepeatLimit ?? TOOL_PIVOT_LIMIT;
  const errorTurnLimit = options?.errorTurnLimit ?? STUCK_WARNING_THRESHOLD;

  // ── Check 1: Repetitive identical tool calls ────────────────────────
  const toolCalls = extractToolCalls(history);
  if (toolCalls.length >= toolRepeatLimit) {
    // Look at the tail for consecutive identical failing calls
    const tail = toolCalls.slice(-toolRepeatLimit);
    const allSameTool = tail.every((c) => c.name === tail[0].name);
    const allErrors = tail.every((c) => c.isError);
    if (allSameTool && allErrors) {
      const allSameArgs = tail.every(
        (c) => computeToolArgsKey(c.name, c.args) === computeToolArgsKey(tail[0].name, tail[0].args),
      );
      if (allSameArgs) {
        return {
          stuck: true,
          reason: `Repeated ${tail[0].name} with identical arguments ${toolRepeatLimit} times, all failing. Last error: ${tail[tail.length - 1].output.slice(0, 200)}`,
        };
      }
    }
  }

  // ── Check 2: Consecutive all-error turns ────────────────────────────
  // A "turn" = one assistant message + its tool results.
  // Count backwards from the end to find consecutive error turns.
  const turns = groupIntoTurns(history);
  let consecutiveErrorTurns = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.toolCalls.length === 0) break; // No tool calls = not an error turn
    const allErrors = turn.toolCalls.every((c) => c.isError);
    const anySuccess = turn.toolCalls.some((c) => !c.isError);
    if (allErrors) {
      consecutiveErrorTurns++;
    } else if (anySuccess) {
      break; // Found a turn with at least one success — stop counting
    }
  }

  if (consecutiveErrorTurns >= errorTurnLimit) {
    return {
      stuck: true,
      reason: `${consecutiveErrorTurns} consecutive turns where every tool call errored.`,
    };
  }

  return { stuck: false, reason: "" };
}

// ── Turn Grouping ──────────────────────────────────────────────────────

interface Turn {
  toolCalls: ToolCall[];
}

/**
 * Group a message history into turns.
 * Each turn starts with an assistant message and includes subsequent tool results.
 * Uses pi-ai message format: assistant.content[].type === "toolCall", role === "toolResult".
 */
function groupIntoTurns(messages: AgentMessage[]): Turn[] {
  const turns: Turn[] = [];
  let currentTurn: Turn | null = null;
  const pendingCalls = new Map<string, { name: string; args: any }>();

  for (const msg of messages) {
    if (!("role" in msg)) continue;

    if (msg.role === "assistant") {
      currentTurn = { toolCalls: [] };
      turns.push(currentTurn);
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "toolCall") {
            pendingCalls.set(block.id, { name: block.name, args: (block as any).arguments ?? (block as any).input });
          }
        }
      }
    } else if (msg.role === "toolResult" && currentTurn) {
      const toolMsg = msg as any;
      const toolCallId = toolMsg.toolCallId;
      const pending = toolCallId ? pendingCalls.get(toolCallId) : undefined;
      if (pending) {
        const outputText = Array.isArray(toolMsg.content)
          ? toolMsg.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("")
          : typeof toolMsg.content === "string"
            ? toolMsg.content
            : "";
        currentTurn.toolCalls.push({
          name: pending.name,
          args: pending.args,
          output: outputText,
          isError: toolMsg.isError === true || isToolError(outputText),
        });
        pendingCalls.delete(toolCallId);
      }
    }
  }

  return turns;
}
