/**
 * manager-utils.ts — Pure utility functions shared by manager.ts and agents-tool.
 */
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SubagentDefinition } from "./types.js";

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

/** Truncate text to maxLen chars for prompt injection. */
export function truncateForPrompt(text: string, maxLen: number): string {
  const oneLine = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "…";
}

// ── Interfaces ─────────────────────────────────────────────────────────

export interface RegisteredAgent {
  definition: SubagentDefinition;
}
