/**
 * classify-error.ts — Pure string-matching error classifier.
 *
 * Kept standalone to avoid any transitive dependency on bun:sqlite
 * when consumers only need error classification.
 */

export type ErrorClass = "infra" | "logic" | "abort" | "overflow";

/**
 * Classify an error string into a category.
 * Pure function — no IO, no database, no Bun-specific deps.
 */
export function classifyError(error: string | undefined | null): ErrorClass {
  if (!error) return "logic";
  const e = error.toLowerCase();

  // Infrastructure errors (retryable)
  if (
    e.includes("empty response") ||
    e.includes("0 output tokens") ||
    e.includes("stream error") ||
    e.includes("stream closed") ||
    e.includes("502") ||
    e.includes("503") ||
    e.includes("429") ||
    e.includes("econnreset") ||
    e.includes("rate limit") ||
    e.includes("timeout") ||
    e.includes("connection") ||
    e.includes("network") ||
    e.includes("no deployments available for selected model") ||
    (e.includes("model is not supported") && e.includes("model group")) ||
    (e.includes("bad request") && e.includes("model group"))
  ) {
    return "infra";
  }

  // Context overflow (not retryable without modification)
  if (
    e.includes("context window") ||
    e.includes("max tokens") ||
    e.includes("context_length_exceeded") ||
    e.includes("too many tokens")
  ) {
    return "overflow";
  }

  // Abort (user or system initiated)
  if (e.includes("abort") || e.includes("cancel")) {
    return "abort";
  }

  // Logic errors (not retryable — bug or permission issue)
  if (
    e.includes("tool not found") ||
    e.includes("permission denied") ||
    e.includes("call depth exceeded") ||
    e.includes("not allowed") ||
    e.includes("401") ||
    e.includes("403") ||
    e.includes("unauthorized") ||
    e.includes("forbidden")
  ) {
    return "logic";
  }

  // Default to logic (conservative — unknown errors shouldn't auto-retry)
  return "logic";
}

/**
 * manager-utils.ts — Pure utility functions shared by manager.ts and agents-tool.
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SubagentDefinition } from "./types.js";
import { createHash, randomUUID } from "node:crypto";

// ── ID Generation ──────────────────────────────────────────────────────

/**
 * Session paths are shared across isolated workers and process restarts.
 * A timestamp plus process-local counter is not a globally unique identity.
 */
export function generateId(prefix = "s"): string {
  return `${prefix}_${Date.now()}_${randomUUID()}`;
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

export function isRetryableEmptyAssistantFailure(reason: string | undefined): boolean {
  return (
    reason === "Agent ended on an empty tool-use assistant turn" ||
    reason === "Agent ended with an empty assistant turn"
  );
}

export function trimTerminalEmptyAssistantTurn(messages: AgentMessage[]): boolean {
  const last = messages[messages.length - 1] as any;
  if (last?.role !== "assistant") return false;
  const blocks = Array.isArray(last.content) ? last.content : [];
  const hasText = blocks.some((block: any) => block?.type === "text" && String(block.text ?? "").trim());
  const hasToolCall = blocks.some((block: any) => block?.type === "toolCall");
  if (hasText || hasToolCall) return false;
  messages.pop();
  return true;
}

/** Truncate text to maxLen chars for prompt injection. */
export function truncateForPrompt(text: string, maxLen: number): string {
  const oneLine = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "…";
}

export const TOOL_PIVOT_LIMIT = 3;

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
