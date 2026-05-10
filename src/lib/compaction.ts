/**
 * compaction.ts — deterministic transcript compaction helpers.
 *
 * The transform is intentionally simple: when a transcript crosses a model
 * context threshold, summarize the older prefix into one user message and keep
 * the newest messages verbatim.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model, ToolResultMessage } from "@mariozechner/pi-ai";

const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_KEEP_RATIO = 0.35;
const MAX_EXEC_COMMANDS_IN_FACTS = 15;
const ORIGINAL_TASK_MAX_LENGTH = 500;
const REASONING_MAX_LENGTH = 2000;
const MIN_SUMMARY_BUDGET_CHARS = 8000;
const COMPACTION_SEPARATOR = "\n\n--- (compacted) ---\n\n";

export interface CompactionInfo {
  compactionCount: number;
  messagesCompacted: number;
  messagesKept: number;
  tokensBefore: number;
  tokensAfter: number;
}

export interface CompactionOptions {
  threshold?: number;
  keepRatio?: number;
  onCompact?: (info: CompactionInfo) => void;
}

/**
 * Structured key facts extracted from messages. Sets let compaction merge facts
 * across rounds without duplicating "Files read" text.
 */
export interface KeyFacts {
  filesRead: Set<string>;
  filesWritten: Set<string>;
  filesEdited: Set<string>;
  agentCalls: Array<{ agent: string; task: string }>;
  execCommands: Array<{ command: string; failed: boolean }>;
}

function emptyFacts(): KeyFacts {
  return {
    filesRead: new Set(),
    filesWritten: new Set(),
    filesEdited: new Set(),
    agentCalls: [],
    execCommands: [],
  };
}

function messageText(message: AgentMessage): string {
  const content = (message as any).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      if (block.type === "text") return block.text ?? "";
      if (block.type === "toolCall") return `[${block.name}] ${JSON.stringify(block.arguments ?? {})}`;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function estimateTokens(messages: AgentMessage[]): number {
  const chars = messages.reduce((sum, message) => sum + messageText(message).length, 0);
  return Math.ceil(chars / 3);
}

function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function previewWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function textMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

export function extractOriginalTask(messages: AgentMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = messageText(message).trim();
    if (!text || text.includes("COMPACTED CONTEXT")) return null;
    return text;
  }
  return null;
}

function extractOriginalTaskFromSummary(text: string): string | null {
  const match = text.match(/\[Original task\]\n([\s\S]*?)(?:\n\n\[|\n\n---|\n*$)/);
  return match?.[1]?.trim() || null;
}

function extractExistingSummary(messages: AgentMessage[]): string | null {
  const first = messages[0];
  if (!first || first.role !== "user") return null;
  const text = messageText(first);
  return text.includes("COMPACTED CONTEXT") ? text : null;
}

function lastSubstantialReasoning(messages: AgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const text = messageText(message).trim();
    if (text.length < 100) continue;
    if (text.length <= REASONING_MAX_LENGTH) return text;
    return `${text.slice(0, REASONING_MAX_LENGTH)}\n_(reasoning truncated)_`;
  }
  return null;
}

function summarizeMessages(messages: AgentMessage[]): string[] {
  const lines: string[] = [];
  let pendingTool: string | null = null;

  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray((message as any).content)) {
      for (const block of (message as any).content) {
        if (block?.type === "toolCall") {
          pendingTool = block.name;
          const args = JSON.stringify(block.arguments ?? {});
          lines.push(`[${block.name}] ${truncateWithEllipsis(args, 180)}`);
        }
      }
    } else if (message.role === "toolResult") {
      const tr = message as ToolResultMessage;
      const text = messageText(message) || ((tr as any).content?.[0]?.text ?? "");
      const label = tr.isError ? "ERROR" : "ok";
      const limit = tr.isError ? 300 : 200;
      lines.push(`[${pendingTool ?? tr.toolName ?? "tool"} ${label}] ${previewWithEllipsis(text, limit)}`);
      pendingTool = null;
    }
  }

  return lines;
}

/**
 * Extract key facts from messages: file paths accessed, exec commands run
 * and their outcomes. These survive summary trimming because they help agents
 * avoid re-reading files or repeating commands after compaction.
 */
export function extractKeyFacts(messages: AgentMessage[]): KeyFacts {
  const facts = emptyFacts();
  const pendingExecCalls = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray((msg as any).content)) {
      for (const block of (msg as any).content) {
        if (!block || block.type !== "toolCall") continue;
        const args = block.arguments as Record<string, any>;

        if (block.name === "read" && args.path) {
          facts.filesRead.add(args.path);
        } else if (block.name === "write" && args.path) {
          facts.filesWritten.add(args.path);
        } else if (block.name === "edit" && args.path) {
          facts.filesEdited.add(args.path);
        } else if ((block.name === "exec" || block.name === "bash") && (args.command || args.cmd)) {
          pendingExecCalls.set(block.id, args.command ?? args.cmd);
        } else if (block.name === "agents" && args.action === "call" && args.agent) {
          facts.agentCalls.push({
            agent: args.agent,
            task: (args.task ?? "").slice(0, 120),
          });
        }
      }
    } else if (msg.role === "toolResult") {
      const trMsg = msg as ToolResultMessage;
      if (pendingExecCalls.has(trMsg.toolCallId)) {
        const command = pendingExecCalls.get(trMsg.toolCallId)!;
        pendingExecCalls.delete(trMsg.toolCallId);
        facts.execCommands.push({ command, failed: !!trMsg.isError });
      }
    }
  }

  for (const command of pendingExecCalls.values()) {
    facts.execCommands.push({ command, failed: false });
  }

  if (facts.execCommands.length > MAX_EXEC_COMMANDS_IN_FACTS) {
    facts.execCommands.splice(0, facts.execCommands.length - MAX_EXEC_COMMANDS_IN_FACTS);
  }

  return facts;
}

export function mergeKeyFacts(a: Partial<KeyFacts>, b: Partial<KeyFacts>): KeyFacts {
  const merged = emptyFacts();

  for (const value of a.filesRead ?? []) merged.filesRead.add(value);
  for (const value of b.filesRead ?? []) merged.filesRead.add(value);
  for (const value of a.filesWritten ?? []) merged.filesWritten.add(value);
  for (const value of b.filesWritten ?? []) merged.filesWritten.add(value);
  for (const value of a.filesEdited ?? []) merged.filesEdited.add(value);
  for (const value of b.filesEdited ?? []) merged.filesEdited.add(value);

  const calls = [...(a.agentCalls ?? []), ...(b.agentCalls ?? [])];
  const seenCalls = new Set<string>();
  for (const call of calls) {
    const key = `${call.agent}\0${call.task}`;
    if (seenCalls.has(key)) continue;
    seenCalls.add(key);
    merged.agentCalls.push(call);
  }

  const byCommand = new Map<string, { command: string; failed: boolean }>();
  for (const command of [...(a.execCommands ?? []), ...(b.execCommands ?? [])]) {
    byCommand.delete(command.command);
    byCommand.set(command.command, command);
  }
  merged.execCommands = [...byCommand.values()].slice(-MAX_EXEC_COMMANDS_IN_FACTS);

  return merged;
}

export function formatKeyFacts(facts: Partial<KeyFacts>): string[] {
  const lines: string[] = [];
  if ((facts.filesRead?.size ?? 0) > 0) lines.push(`Files read: ${[...facts.filesRead!].join(", ")}`);
  if ((facts.filesWritten?.size ?? 0) > 0) lines.push(`Files written: ${[...facts.filesWritten!].join(", ")}`);
  if ((facts.filesEdited?.size ?? 0) > 0) lines.push(`Files edited: ${[...facts.filesEdited!].join(", ")}`);
  if ((facts.agentCalls?.length ?? 0) > 0) {
    lines.push("Agent calls:");
    for (const call of facts.agentCalls!) lines.push(`  ${call.agent}: ${call.task}`);
  }
  if ((facts.execCommands?.length ?? 0) > 0) {
    lines.push("Exec commands run:");
    for (const command of facts.execCommands!) {
      lines.push(`  [${command.failed ? "FAILED" : "ok"}] ${truncateWithEllipsis(command.command, 120)}`);
    }
  }
  return lines;
}

export function trimAccumulatedSummary(summary: string, budget = MIN_SUMMARY_BUDGET_CHARS): string {
  if (summary.length <= budget) return summary;

  const sections = summary.split(COMPACTION_SEPARATOR);
  if (sections.length <= 1) {
    const marker = "_(earlier context trimmed)_\n";
    return `${marker}${summary.slice(Math.max(0, summary.length - budget))}`;
  }

  const kept: string[] = [];
  let length = 0;
  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    const nextLength = length + section.length + (kept.length > 0 ? COMPACTION_SEPARATOR.length : 0);
    if (nextLength > budget && kept.length > 0) break;
    kept.unshift(section);
    length = nextLength;
    if (length >= budget) break;
  }

  return `_(earlier compaction rounds trimmed)_${COMPACTION_SEPARATOR}${kept.join(COMPACTION_SEPARATOR)}`;
}

function buildSummary(messages: AgentMessage[], previousSummary: string | null): string {
  const parts: string[] = ["COMPACTED CONTEXT"];

  const originalTask =
    extractOriginalTask(messages) ??
    (previousSummary ? extractOriginalTaskFromSummary(previousSummary) : null);
  if (originalTask) {
    parts.push(`[Original task]\n${previewWithEllipsis(originalTask, ORIGINAL_TASK_MAX_LENGTH)}`);
  }

  if (previousSummary) {
    parts.push(`_(compacted previous context)_${COMPACTION_SEPARATOR}${trimAccumulatedSummary(previousSummary, MIN_SUMMARY_BUDGET_CHARS)}`);
  }

  const facts = extractKeyFacts(messages);
  const factLines = formatKeyFacts(facts);
  if (factLines.length > 0) {
    parts.push(`[Key facts]\n${factLines.join("\n")}`);
  }

  const toolLines = summarizeMessages(messages);
  if (toolLines.length > 0) {
    parts.push(`[Compacted tool trace]\n${toolLines.join("\n")}`);
  }

  const reasoning = lastSubstantialReasoning(messages);
  if (reasoning) {
    parts.push(`[Last reasoning before compaction]\n${reasoning}`);
  }

  return trimAccumulatedSummary(parts.join("\n\n"), MIN_SUMMARY_BUDGET_CHARS + 3000);
}

function splitMessages(messages: AgentMessage[], keepRatio: number): number {
  let splitAt = Math.max(1, Math.floor(messages.length * (1 - keepRatio)));
  if (splitAt >= messages.length) splitAt = messages.length - 1;

  const firstKept = messages[splitAt];
  if (firstKept?.role === "toolResult" && splitAt > 1) {
    splitAt -= 1;
  }

  return splitAt;
}

export function createCompactionTransform(model: Model<any>, options: CompactionOptions = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const keepRatio = options.keepRatio ?? DEFAULT_KEEP_RATIO;
  let compactionCount = 0;

  return async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    if (messages.length <= 1) return messages;

    const tokensBefore = estimateTokens(messages);
    if (tokensBefore < model.contextWindow * threshold) return messages;

    const splitAt = splitMessages(messages, keepRatio);
    if (splitAt <= 0) return messages;

    const previousSummary = extractExistingSummary(messages);
    const compacted = messages.slice(0, splitAt);
    const kept = messages.slice(splitAt);
    const summary = buildSummary(compacted, previousSummary);
    const result = [textMessage(summary), ...kept];
    const tokensAfter = estimateTokens(result);

    compactionCount += 1;
    options.onCompact?.({
      compactionCount,
      messagesCompacted: compacted.length,
      messagesKept: kept.length,
      tokensBefore,
      tokensAfter,
    });

    return result;
  };
}
