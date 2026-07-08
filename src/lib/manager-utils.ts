/**
 * manager-utils.ts — Pure utility functions shared by manager.ts and agents-tool.
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SubagentDefinition } from "./types.js";
import { createHash } from "node:crypto";

// ── ID Generation ──────────────────────────────────────────────────────

let nextId = 0;
/**
 * Generate a unique session ID.
 * Format: `{prefix}_{timestamp}_{counter}` — e.g. `s_1700000000000_0`.
 */
export function generateId(prefix = "s"): string {
  return `${prefix}_${Date.now()}_${nextId++}`;
}

// ── Formatting Helpers ─────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m${remaining}s`;
}

export function extractLastAssistantText(messages: AgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block?.type === "text" && block.text?.trim()) {
          return block.text;
        }
      }
    }
  }
  return null;
}

export function extractLastAssistantError(messages: AgentMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; errorMessage?: unknown };
    if (msg.role !== "assistant") continue;
    if (typeof msg.errorMessage === "string" && msg.errorMessage.trim()) {
      return msg.errorMessage;
    }
    return undefined;
  }
  return undefined;
}

export function classifyTerminalAssistantFailure(messages: AgentMessage[]): string | undefined {
  const last = messages[messages.length - 1] as any;
  if (last?.role !== "assistant") return undefined;

  const blocks = Array.isArray(last.content) ? last.content : [];
  const hasText = blocks.some((block: any) => block?.type === "text" && String(block.text ?? "").trim());
  const toolCalls = blocks.filter((block: any) => block?.type === "toolCall");
  const stopReason = typeof last.stopReason === "string" ? last.stopReason : undefined;

  if (stopReason === "toolUse" && toolCalls.length === 0 && !hasText) {
    return "Agent ended on an empty tool-use assistant turn";
  }
  if (stopReason === "toolUse" && toolCalls.length > 0) {
    return "Agent ended while waiting for tool results";
  }
  if (!hasText && toolCalls.length === 0) {
    return "Agent ended with an empty assistant turn";
  }
  return undefined;
}

/** Truncate text to maxLen chars for prompt injection. */
export function truncateForPrompt(text: string, maxLen: number): string {
  const oneLine = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "…";
}

export const TOOL_PIVOT_LIMIT = 3;
export const STUCK_WARNING_THRESHOLD = 3;
export const STATE_CHANGING_TOOLS = new Set(["bash", "write", "edit", "commit"]);

export function computeToolArgsKey(toolName: string, params: unknown): string {
  const normalized = params == null ? {} : params;
  const hash = createHash("sha256")
    .update(stableStringify(normalized))
    .digest("hex")
    .slice(0, 16);
  return `${toolName}:${hash}`;
}

export function isToolError(output: string): boolean {
  if (!output) return false;
  return /Command exited with code [1-9]\d*/.test(output)
    || output.startsWith("❌")
    || /\b(ENOENT|EACCES)\b/.test(output)
    || /command not found|No such file or directory|Permission denied/.test(output)
    || /Could not find the exact text|File not found:|Found \d+ occurrences/.test(output)
    || /OpBudgetExceeded|E_RETRY_LIMIT/.test(output);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

// ── Interfaces ─────────────────────────────────────────────────────────

export interface RegisteredAgent {
  definition: SubagentDefinition;
}
