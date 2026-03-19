/**
 * transcript-utils.ts — Parse agent session transcripts for behavioral scoring.
 *
 * Session JSONL files contain one JSON object per line with the structure:
 *   { role, content, toolCallId?, toolName?, timestamp?, ... }
 *
 * Provides helpers for gym scorers to answer "how did the agent behave?"
 * rather than just "what files did it produce?"
 *
 * Design: agents/bob/workspace/gym-evolution-design.md §2.1
 */

import { readFileSync, existsSync } from "node:fs";

// ── Types ──────────────────────────────────────────────────────────────

export interface ToolCall {
  /** Tool call ID from the API */
  id: string;
  /** Tool name (e.g., "bash", "read", "write", "finish") */
  name: string;
  /** Parsed arguments object */
  arguments: Record<string, unknown>;
  /** Index of the entry in the transcript (0-based) */
  entryIndex: number;
  /** Timestamp from the entry, if present */
  timestamp?: number;
}

export interface ToolResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;
  /** Tool name */
  toolName: string;
  /** Raw text content of the result */
  content: string;
  /** Whether the tool returned an error */
  isError: boolean;
  /** Index of the entry in the transcript */
  entryIndex: number;
  /** Timestamp from the entry, if present */
  timestamp?: number;
}

export interface TranscriptEntry {
  role: string;
  content?: unknown;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  timestamp?: number;
  usage?: {
    input?: number;
    output?: number;
    totalTokens?: number;
    cost?: { total?: number };
  };
  stopReason?: string;
}

export interface Transcript {
  /** All raw entries from the JSONL */
  entries: TranscriptEntry[];
  /** All tool calls made by the assistant */
  toolCalls: ToolCall[];
  /** All tool results returned to the assistant */
  toolResults: ToolResult[];
}

export interface FinishCall {
  status: string;
  summary?: string;
  deliverables?: Array<{ path: string; description: string }>;
  blockers?: Array<{ reason: string; context: string }>;
}

// ── Parsing ────────────────────────────────────────────────────────────

/**
 * Load and parse a session JSONL transcript file.
 * Returns null if the file doesn't exist.
 */
export function loadTranscript(transcriptPath: string): Transcript | null {
  if (!existsSync(transcriptPath)) return null;

  const raw = readFileSync(transcriptPath, "utf-8");
  const entries: TranscriptEntry[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines
    }
  }

  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Assistant entries contain tool calls in their content array
    if (entry.role === "assistant" && Array.isArray(entry.content)) {
      for (const part of entry.content) {
        if (part.type === "toolCall" || part.type === "tool_use") {
          let args: Record<string, unknown> = {};
          if (typeof part.arguments === "string") {
            try { args = JSON.parse(part.arguments); } catch { /* keep empty */ }
          } else if (typeof part.arguments === "object" && part.arguments !== null) {
            args = part.arguments;
          } else if (typeof part.input === "object" && part.input !== null) {
            // Anthropic format uses "input" instead of "arguments"
            args = part.input;
          }
          toolCalls.push({
            id: part.id || part.toolCallId || "",
            name: part.name || part.toolName || "",
            arguments: args,
            entryIndex: i,
            timestamp: entry.timestamp,
          });
        }
      }
    }

    // Tool result entries
    if (entry.role === "toolResult" || entry.role === "tool") {
      let content = "";
      if (typeof entry.content === "string") {
        content = entry.content;
      } else if (Array.isArray(entry.content)) {
        content = entry.content
          .map((p: { text?: string }) => p.text || "")
          .join("\n");
      }
      toolResults.push({
        toolCallId: entry.toolCallId || "",
        toolName: entry.toolName || "",
        content,
        isError: entry.isError === true,
        entryIndex: i,
        timestamp: entry.timestamp,
      });
    }
  }

  return { entries, toolCalls, toolResults };
}

// ── Query Helpers ──────────────────────────────────────────────────────

/**
 * Check if a specific tool was called at least once.
 */
export function hasToolCall(transcript: Transcript, toolName: string): boolean {
  return transcript.toolCalls.some((tc) => tc.name === toolName);
}

/**
 * Find all calls to a specific tool.
 */
export function getToolCalls(transcript: Transcript, toolName: string): ToolCall[] {
  return transcript.toolCalls.filter((tc) => tc.name === toolName);
}

/**
 * Count how many times a tool was used.
 */
export function countToolUsage(transcript: Transcript, toolName: string): number {
  return getToolCalls(transcript, toolName).length;
}

/**
 * Get the output/result for a specific tool call by its ID.
 */
export function getToolResult(transcript: Transcript, toolCallId: string): ToolResult | undefined {
  return transcript.toolResults.find((tr) => tr.toolCallId === toolCallId);
}

/**
 * Check if a tool call with specific argument patterns exists.
 * `argPatterns` is an object where each key is an arg name and each value
 * is either an exact value or a RegExp to match against the string value.
 */
export function hasToolCallWithArgs(
  transcript: Transcript,
  toolName: string,
  argPatterns: Record<string, string | RegExp | number | boolean>
): boolean {
  return transcript.toolCalls.some((tc) => {
    if (tc.name !== toolName) return false;
    for (const [key, pattern] of Object.entries(argPatterns)) {
      const actual = tc.arguments[key];
      if (pattern instanceof RegExp) {
        if (typeof actual !== "string" || !pattern.test(actual)) return false;
      } else {
        if (actual !== pattern) return false;
      }
    }
    return true;
  });
}

/**
 * Check if a read/bash-cat happened AFTER a write to the same file.
 * Used to detect verification behavior (C3 in common-sense.md).
 *
 * Returns true if any write to `filePath` is followed by a read of the same file.
 */
export function hasVerificationAfterWrite(transcript: Transcript, filePath: string): boolean {
  // Find all writes to this file
  const writes = transcript.toolCalls.filter(
    (tc) =>
      tc.name === "write" &&
      typeof tc.arguments.path === "string" &&
      tc.arguments.path.includes(filePath)
  );

  if (writes.length === 0) return false;

  for (const write of writes) {
    // Look for reads after this write
    const readsAfter = transcript.toolCalls.filter(
      (tc) =>
        tc.entryIndex > write.entryIndex &&
        ((tc.name === "read" &&
          typeof tc.arguments.path === "string" &&
          tc.arguments.path.includes(filePath)) ||
          (tc.name === "bash" &&
            typeof tc.arguments.command === "string" &&
            (tc.arguments.command.includes(`cat `) || tc.arguments.command.includes(`head `)) &&
            tc.arguments.command.includes(filePath)))
    );

    if (readsAfter.length > 0) return true;
  }

  return false;
}

/**
 * Get the finish() call details, if the agent called finish().
 * Returns null if finish was never called.
 */
export function getFinishCall(transcript: Transcript): FinishCall | null {
  const finishCalls = transcript.toolCalls.filter((tc) => tc.name === "finish");
  if (finishCalls.length === 0) return null;

  // Use the last finish call (in case of retries)
  const last = finishCalls[finishCalls.length - 1];
  return {
    status: (last.arguments.status as string) || "unknown",
    summary: last.arguments.summary as string | undefined,
    deliverables: last.arguments.deliverables as FinishCall["deliverables"],
    blockers: last.arguments.blockers as FinishCall["blockers"],
  };
}

/**
 * Count total assistant turns (entries with role === "assistant").
 */
export function countTurns(transcript: Transcript): number {
  return transcript.entries.filter((e) => e.role === "assistant").length;
}

/**
 * Calculate total estimated cost from usage data in the transcript.
 */
export function totalCost(transcript: Transcript): number {
  let cost = 0;
  for (const entry of transcript.entries) {
    if (entry.usage?.cost?.total) {
      cost += entry.usage.cost.total;
    }
  }
  return cost;
}

/**
 * Count total tool operations (all tool calls made).
 */
export function totalOps(transcript: Transcript): number {
  return transcript.toolCalls.length;
}

/**
 * Get a chronological summary of tool calls for debugging.
 * Returns lines like: "  [3] bash({ command: 'npm test' })"
 */
export function summarizeToolCalls(transcript: Transcript): string {
  return transcript.toolCalls
    .map((tc) => {
      const argsStr = Object.entries(tc.arguments)
        .map(([k, v]) => {
          const s = typeof v === "string" ? v : JSON.stringify(v);
          return `${k}: ${s.length > 60 ? s.slice(0, 57) + "..." : s}`;
        })
        .join(", ");
      return `  [${tc.entryIndex}] ${tc.name}({ ${argsStr} })`;
    })
    .join("\n");
}
