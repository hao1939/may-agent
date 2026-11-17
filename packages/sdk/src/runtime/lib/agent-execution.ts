import type { TSchema } from "typebox";
import {
  Agent,
  type AgentMessage,
  type AgentTool,
  type BeforeToolCallContext as PiBeforeToolCallContext,
} from "@earendil-works/pi-agent-core";
import { createAssistantMessageEventStream, createInitialSystemMessage, getCurrentSystemMessage, toToolDeclaration, validateToolArguments, type Api, type AssistantMessage, type AssistantMessageEvent, type Message, type Model, type StreamFunction, type SimpleStreamOptions, type ToolCall, type ToolResultMessage } from "@earendil-works/pi-ai";
import { streamSimple } from "@earendil-works/pi-ai/compat";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
/**
 * compaction.ts — deterministic transcript compaction helpers.
 *
 * The transform is intentionally simple: when a transcript crosses a model
 * context threshold, summarize the older prefix into one user message and keep
 * the newest messages verbatim.
 */

import { estimateContextTokens } from "@earendil-works/pi-ai/utils/estimate";
import { estimateTokens as estimatePiMessageTokens } from "@earendil-works/pi-coding-agent";

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
 * Structured key facts extracted from one compacted prefix. Sets avoid duplicate
 * file paths within that prefix; previous rounds remain in the saved summary.
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

function estimateMessageTokens(message: AgentMessage): number {
  // May's /3 estimate is deliberately conservative for prose. Pi's estimator
  // understands thinking, images, custom messages, and tool arguments. Taking
  // the larger value preserves May's safety margin while tracking Pi formats.
  return Math.max(Math.ceil(messageText(message).length / 3), estimatePiMessageTokens(message));
}

function estimateTranscriptTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}

function estimateTokens(messages: AgentMessage[]): number {
  const isModelMessage = (message: AgentMessage): message is Message =>
    message.role === "system" || message.role === "user" || message.role === "assistant" || message.role === "toolResult";
  const modelMessages = messages.filter(isModelMessage);
  const estimate = estimateContextTokens(modelMessages);
  // The provider estimate excludes coding-agent custom messages. Add those
  // after its last usage record so they cannot disappear behind a larger billed prefix.
  const usageMessage = estimate.lastUsageIndex === null ? undefined : modelMessages[estimate.lastUsageIndex];
  const usageIndex = usageMessage ? messages.indexOf(usageMessage) : -1;
  const customTrailingTokens = messages.slice(usageIndex + 1)
    .filter((message) => !isModelMessage(message))
    .reduce((sum, message) => sum + estimateMessageTokens(message), 0);
  return Math.max(estimateTranscriptTokens(messages), estimate.tokens + customTrailingTokens);
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
    extractOriginalTask(messages) ?? (previousSummary ? extractOriginalTaskFromSummary(previousSummary) : null);
  if (originalTask) {
    parts.push(`[Original task]\n${previewWithEllipsis(originalTask, ORIGINAL_TASK_MAX_LENGTH)}`);
  }

  if (previousSummary) {
    parts.push(
      `_(compacted previous context)_${COMPACTION_SEPARATOR}${trimAccumulatedSummary(previousSummary, MIN_SUMMARY_BUDGET_CHARS)}`,
    );
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
  const keepTokenBudget = Math.max(1, Math.floor(estimateTranscriptTokens(messages) * keepRatio));
  let keptTokens = 0;
  let splitAt = messages.length - 1;

  for (let i = messages.length - 1; i > 0; i--) {
    keptTokens += estimateMessageTokens(messages[i]);
    splitAt = i;
    if (keptTokens >= keepTokenBudget) break;
  }

  // Keep the assistant tool-call message with all following tool results.
  while (messages[splitAt]?.role === "toolResult" && splitAt > 1) {
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

    // Pi stores instructions and tool declarations in system messages. Replay
    // those exactly; only conversation history may become a lossy summary.
    const baseline = getCurrentSystemMessage(messages);
    const history = messages.filter((message) => message.role !== "system");
    if (history.length <= 1) return messages;
    const splitAt = splitMessages(history, keepRatio);
    if (splitAt <= 0) return messages;

    const previousSummary = extractExistingSummary(history);
    const compacted = history.slice(0, splitAt);
    const kept = history.slice(splitAt);
    const summary = buildSummary(compacted, previousSummary);
    const result = [...(baseline ? [baseline] : []), textMessage(summary), ...kept];
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
import { formatBoundedSkillCatalog, invokeCatalogSkill, parseExplicitSkill, type MaySkill } from "./skills.js";
import type { SubagentDefinition } from "./manager-utils.js";
import { createWorkflowFinishTool } from "./tools/lifecycle.js";
import { createReadTool } from "./tools/read.js";
import { createBashTool } from "./tools/bash.js";
import { createEditTool } from "./tools/edit.js";
import { createWriteTool } from "./tools/write.js";
import {
  classifyError,
  classifyTerminalAssistantFailure,
  extractLastAssistantError,
  extractLastAssistantText,
  isRetryableEmptyAssistantFailure,
} from "./manager-utils.js";
import executionInstructions from "./execution-instructions.md" with { type: "text" };
export const RESPONSES_STREAM_TERMINAL_ERROR = "OpenAI Responses stream ended before a terminal response event";

export function validateOperationAllowance(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new TypeError("operationAllowance must be a finite positive integer");
  }
  return value;
}

export function shouldAttemptWorkflowFinishRecovery(reason: string | undefined): boolean {
  if (!reason) return false;
  return (
    reason === RESPONSES_STREAM_TERMINAL_ERROR ||
    isRetryableEmptyAssistantFailure(reason) ||
    classifyError(reason) === "infra"
  );
}

export function shouldRequestBoundedWorkflowFinish(
  requireFinish: boolean,
  toolCalls: number,
  alreadyRequested: boolean,
  timing?: { admittedTimeoutMs?: number; elapsedMs?: number; operationAllowance?: number },
): boolean {
  const operationAllowance = validateOperationAllowance(timing?.operationAllowance);
  return (
    requireFinish &&
    !alreadyRequested &&
    operationAllowance !== undefined &&
    toolCalls >= operationAllowance
  );
}

export function boundedWorkflowFinishPrompt(outputSchema?: TSchema): string {
  return (
    "Bounded completion guardrail: stop expanding the investigation. Use only facts already gathered and call finish() now with the smallest facts-honest payload" +
    (outputSchema ? ", including every required schema-validated output field." : ".") +
    " Report confirmed progress, unfinished work and uncertain effects honestly through that contract. " +
    "Interrupted helpers or tools do not establish completion. Do not start further work; the remaining allowance is for submitting and correcting your result."
  );
}

export function workflowFinishRecoveryPrompt(outputSchema?: TSchema, reason?: string): string {
  const prefix = shouldAttemptWorkflowFinishRecovery(reason)
    ? "Your last turn ended with a transient runtime/provider failure or no visible answer. "
    : "Your last turn ended with no visible answer. ";
  return (
    prefix +
    "Continue the original bounded assignment within its scope and remaining budget. " +
    "Do not repeat successful work or committed effects. " +
    "Use the App's instructions and current facts to choose the next step; inspect current state before repeating an uncertain effect. " +
    "When the facts support an outcome, call finish() with all required fields" +
    (outputSchema
      ? ", including the schema-validated output payload. If an external prerequisite prevents completion, use status blocked and include the required output."
      : ".")
  );
}

type RecoveryDisposition = "recovered" | "rejected" | "ineligible" | "already-committed";
export type CapturedFinishRecovery = {
  disposition: RecoveryDisposition;
  toolCallId?: string;
  error?: string;
};

const recoveriesInFlight = new Map<string, Promise<CapturedFinishRecovery>>();

function matchingToolResult(messages: any[], id: string): any | undefined {
  return messages.find((message) => message?.role === "toolResult" && message.toolCallId === id);
}

function capturedAbortedFinish(messages: any[], reason: string | undefined): ToolCall | null {
  if (reason !== RESPONSES_STREAM_TERMINAL_ERROR) return null;
  const assistant = [...messages].reverse().find((message: any) => message?.role === "assistant") as any;
  if (assistant?.stopReason !== "aborted" || assistant.errorMessage !== reason) return null;
  const calls = Array.isArray(assistant.content)
    ? assistant.content.filter((block: any) => block?.type === "toolCall" && block.name === "finish")
    : [];
  if (calls.length !== 1 || typeof calls[0].id !== "string" || !calls[0].id) return null;
  const raw = calls[0].arguments ?? calls[0].args;
  if (raw === undefined) return null;
  try {
    const args = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    return { type: "toolCall", id: calls[0].id, name: "finish", arguments: args } as ToolCall;
  } catch {
    return null;
  }
}

/**
 * Commit a complete finish call captured by the exact Responses aborted-terminal
 * failure. Use the same argument preparation and schema validation as the model
 * loop, followed by the real finish tool's semantic checks.
 */
export async function recoverCapturedWorkflowFinish(options: {
  sessionId: string;
  messages: AgentMessage[];
  tools: AgentTool[];
  reason?: string;
}): Promise<CapturedFinishRecovery> {
  const call = capturedAbortedFinish(options.messages as any[], options.reason);
  if (!call) return { disposition: "ineligible" };
  if (matchingToolResult(options.messages as any[], call.id)) {
    return { disposition: "already-committed", toolCallId: call.id };
  }
  const identity = `${options.sessionId}:${call.id}`;
  const existing = recoveriesInFlight.get(identity);
  if (existing) return existing;

  const recovery = (async (): Promise<CapturedFinishRecovery> => {
    const finish = options.tools.find((tool) => tool.name === "finish");
    if (!finish) return { disposition: "rejected", toolCallId: call.id, error: "finish tool unavailable" };
    let result: Awaited<ReturnType<AgentTool["execute"]>>;
    try {
      const preparedCall = finish.prepareArguments
        ? { ...call, arguments: finish.prepareArguments(call.arguments) as ToolCall["arguments"] }
        : call;
      const params = validateToolArguments(finish, preparedCall);
      result = await finish.execute(call.id, params);
    } catch (cause) {
      const error = `Captured finish recovery validation failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      options.messages.push({
        role: "toolResult",
        toolCallId: call.id,
        toolName: "finish",
        content: [{ type: "text", text: error }],
        isError: true,
        timestamp: Date.now(),
      } as any);
      return { disposition: "rejected", toolCallId: call.id, error };
    }

    const semanticError = result.content.find(
      (block: any) =>
        block?.type === "text" &&
        String(block.text ?? "")
          .trimStart()
          .startsWith("finish() error:"),
    );
    options.messages.push({
      role: "toolResult",
      toolCallId: call.id,
      toolName: "finish",
      content: result.content,
      isError: Boolean(semanticError),
      timestamp: Date.now(),
    } as any);
    return semanticError
      ? { disposition: "rejected", toolCallId: call.id, error: String((semanticError as any).text) }
      : { disposition: "recovered", toolCallId: call.id };
  })();
  recoveriesInFlight.set(identity, recovery);
  try {
    return await recovery;
  } finally {
    recoveriesInFlight.delete(identity);
  }
}

/** Generic runtime capability profile. Environment-specific profiles belong in their adapter. */
export type ToolPolicy = "full" | "readonly";

import { AsyncLocalStorage } from "node:async_hooks";

type AgentSessionContext = {
  agentName: string;
  sessionId: string;
};

const agentSessionContext = new AsyncLocalStorage<AgentSessionContext>();

export function runWithAgentSessionContext<T>(agentName: string, sessionId: string, fn: () => T): T {
  return agentSessionContext.run({ agentName, sessionId }, fn);
}

export function currentAgentSessionId(agentName: string): string | undefined {
  const context = agentSessionContext.getStore();
  return context?.agentName === agentName ? context.sessionId : undefined;
}

export type SourcedAgentTool = {
  tool: AgentTool;
  source: string;
};

/** Fail closed when two construction paths expose the same concrete model tool name. */
export function assertUniqueToolNames(entries: readonly SourcedAgentTool[], agentName: string): void {
  const seen = new Map<string, string>();
  for (const { tool, source } of entries) {
    const prior = seen.get(tool.name);
    if (prior !== undefined) {
      throw new Error(
        `Agent ${agentName} has duplicate model-visible tool name "${tool.name}" from ${prior} and ${source}`,
      );
    }
    seen.set(tool.name, source);
  }
}

/** A finish call is committed only when its matching tool result succeeded. */
function finishToolCallSucceeded(messages: any[], toolCallId: string | undefined): boolean {
  if (!toolCallId) return false;
  const result = messages.find((message) => message?.role === "toolResult" && message.toolCallId === toolCallId);
  if (!result) return false;
  if (result.isError === true) return false;
  const content = Array.isArray(result.content) ? result.content : [];
  return !content.some(
    (block: any) =>
      block?.type === "text" &&
      String(block.text ?? "")
        .trimStart()
        .startsWith("finish() error:"),
  );
}

export type FinishParams = {
  status: "done" | "blocked" | "error";
  summary: string;
  output?: unknown;
  facts?: unknown;
};

const hasOwn = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);

function normalizedFinishStatus(status: unknown): FinishParams["status"] {
  if (status === "done" || status === "success") return "done";
  if (status === "blocked" || status === "partial") return "blocked";
  return "error";
}

function isHistoricalFinish(args: Record<string, unknown>): boolean {
  const blockedWithLegacyEvidence =
    args.status === "blocked" &&
    ["verification_facts", "verification_evidence", "next_steps"].some((key) => hasOwn(args, key));
  return (
    args.status === "success" ||
    args.status === "failure" ||
    args.status === "partial" ||
    hasOwn(args, "result") ||
    hasOwn(args, "blockers") ||
    hasOwn(args, "deliverables") ||
    blockedWithLegacyEvidence
  );
}

function normalizedFinishFacts(args: Record<string, unknown>, historical: boolean): unknown {
  if (hasOwn(args, "facts")) return args.facts;
  if (!historical) return undefined;
  const facts = Object.fromEntries(
    ["blockers", "deliverables", "verification_facts", "verification_evidence", "next_steps"]
      .filter((key) => hasOwn(args, key))
      .map((key) => [key, args[key]]),
  );
  return Object.keys(facts).length > 0 ? facts : undefined;
}

export function extractFinishParams(messages: any[]): FinishParams | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      const rawArgs = block?.arguments ?? block?.args;
      if (block?.type !== "toolCall" || block.name !== "finish" || !rawArgs) continue;
      if (!finishToolCallSucceeded(messages, block.id ?? block.toolCallId)) continue;
      try {
        const args = (typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs) as Record<string, unknown>;
        if (typeof args.summary !== "string" || !args.summary.trim()) return null;
        const historical = isHistoricalFinish(args);
        const output = hasOwn(args, "output") ? args.output : historical ? args.result : undefined;
        return {
          status: normalizedFinishStatus(args.status),
          summary: args.summary,
          output,
          facts: normalizedFinishFacts(args, historical),
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

export type AgentRunnerConfig = ConstructorParameters<typeof Agent>[0];
export type AgentRuntimeListener = Parameters<Agent["subscribe"]>[0];

/**
 * Infrastructure-neutral handle for one model/tool loop.
 *
 * This module deliberately knows nothing about sessions, files, SQLite,
 * EventBus, projects, tasks, metrics, scheduling, or recovery. Callers may
 * subscribe to the Pi runtime observations and add those concerns outside the
 * agent execution boundary.
 */
export interface AgentRun {
  readonly state: Agent["state"];
  prompt: Agent["prompt"];
  followUp: Agent["followUp"];
  continue: Agent["continue"];
  waitForIdle: Agent["waitForIdle"];
  steer: Agent["steer"];
  cancel(): void;
  subscribe(listener: AgentRuntimeListener): ReturnType<Agent["subscribe"]>;
}

class PiAgentRun implements AgentRun {
  readonly prompt: Agent["prompt"];
  readonly followUp: Agent["followUp"];
  readonly continue: Agent["continue"];
  readonly waitForIdle: Agent["waitForIdle"];
  readonly steer: Agent["steer"];

  constructor(private readonly agent: Agent) {
    this.prompt = agent.prompt.bind(agent) as Agent["prompt"];
    this.followUp = agent.followUp.bind(agent) as Agent["followUp"];
    this.continue = agent.continue.bind(agent) as Agent["continue"];
    this.waitForIdle = agent.waitForIdle.bind(agent) as Agent["waitForIdle"];
    this.steer = agent.steer.bind(agent) as Agent["steer"];
  }

  get state(): Agent["state"] {
    return this.agent.state;
  }

  cancel(): void {
    this.agent.abort();
  }

  subscribe(listener: AgentRuntimeListener): ReturnType<Agent["subscribe"]> {
    return this.agent.subscribe(listener);
  }
}

export function createAgentRun(config: AgentRunnerConfig): AgentRun {
  return new PiAgentRun(new Agent(config));
}

/**
 * Restore work history under this invocation's current instructions and tools.
 * Saved transcripts may predate Pi's system messages or carry an older loadout.
 */
export function restoreAgentMessages(agent: AgentRun, messages: AgentMessage[]): void {
  const baseline = createInitialSystemMessage(agent.state.systemPrompt, agent.state.tools.map(toToolDeclaration));
  const history = messages.filter((message) => message.role !== "system");
  agent.state.messages = baseline ? [baseline, ...history] : history;
}

/** One invocation's limits. No storage, Task lifecycle, provider or retry policy. */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60_000;

/** A work stop leaves the model alive to judge and submit its existing result. */
export class ExecutionWorkEnded extends Error {
  constructor() {
    super(
      "Execution work allowance ended. Use retained evidence and call finish(); unfinished or interrupted work remains incomplete.",
    );
    this.name = "ExecutionWorkEnded";
  }
}

export function executionTimeout(timeoutMs = DEFAULT_EXECUTION_TIMEOUT_MS, deadlineAt?: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error("Execution timeout must be a positive bounded timer duration");
  }
  if (deadlineAt === undefined) return timeoutMs;
  const remaining = deadlineAt - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("Caller execution deadline expired");
  return Math.min(timeoutMs, remaining);
}

export class ExecutionScope {
  private readonly controller = new AbortController();
  private readonly workController = new AbortController();
  readonly signal = this.controller.signal;
  readonly workSignal = this.workController.signal;
  readonly timeoutMs: number;
  readonly deadlineAt: number;
  readonly workDeadlineAt: number;
  timedOut = false;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly workTimer?: ReturnType<typeof setTimeout>;
  private readonly parentAbort: () => void;

  constructor(
    timeoutMs?: number,
    private readonly parentSignal?: AbortSignal,
    deadlineAt?: number,
    private readonly onStop?: (reason: Error) => void,
    onFinishRequested?: () => void,
  ) {
    parentSignal?.throwIfAborted();
    this.timeoutMs = executionTimeout(timeoutMs, deadlineAt);
    this.deadlineAt = Date.now() + this.timeoutMs;
    // Reserve at most one minute, or one fifth of a short invocation. This is
    // part of the existing allowance, never a timeout extension.
    const finishMs = onFinishRequested ? Math.min(60_000, Math.floor(this.timeoutMs / 5)) : 0;
    this.workDeadlineAt = this.deadlineAt - finishMs;
    this.parentAbort = () => {
      const reason = parentSignal?.reason;
      // Preserve the work-stop distinction at every depth so joined helper
      // evidence can return while ordinary cancellation still interrupts.
      this.stop(
        reason instanceof ExecutionWorkEnded ? reason : new Error("Caller execution stopped", { cause: reason }),
      );
    };
    parentSignal?.addEventListener("abort", this.parentAbort, { once: true });
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.stop(new Error(`Agent timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);
    this.timer.unref?.();
    if (finishMs > 0) {
      this.workTimer = setTimeout(() => {
        if (this.signal.aborted) return;
        this.workController.abort(new ExecutionWorkEnded());
        onFinishRequested?.();
      }, this.timeoutMs - finishMs);
      this.workTimer.unref?.();
    }
  }

  stop(reason = new Error("Execution cancelled")): void {
    if (this.signal.aborted) return;
    this.controller.abort(reason);
    this.workController.abort(reason);
    this.onStop?.(reason);
  }

  close(): void {
    clearTimeout(this.timer);
    clearTimeout(this.workTimer);
    this.parentSignal?.removeEventListener("abort", this.parentAbort);
    // Remaining scoped children stop too; completing this invocation is not
    // cancellation of its already accepted result.
    this.controller.abort(new Error("Caller execution finished"));
    this.workController.abort(this.signal.reason);
  }
}

export type PreparationMeasurement = {
  preparer: string;
  entryHash: string | null;
  durationMs: number;
  taskBytes: number;
  promptBytes: number | null;
  systemBytes: number | null;
  failed: boolean;
};

export type ModelUsage = {
  provider: string;
  model: string;
  replies: number;
  measuredReplies: number;
  estimatedCostReplies: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  estimatedCost: number;
};

export type ExecutionUsage = {
  preparation: PreparationMeasurement;
  models: ModelUsage[];
  totals: Omit<ModelUsage, "provider" | "model">;
  toolCalls: number;
};

const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** New replies only. Never reads a transcript or attributes a child's usage to its parent. */
export function createExecutionUsage(preparation: PreparationMeasurement) {
  const models = new Map<string, ModelUsage>();
  const seen = new WeakSet<object>();
  let toolCalls = 0;
  const observe: AgentRuntimeListener = (event) => {
    if (event.type === "tool_execution_start") toolCalls++;
    if (event.type !== "message_end" || event.message.role !== "assistant") return;
    const message = event.message;
    if (seen.has(message)) return;
    seen.add(message);
    const provider = message.provider || "unknown";
    const model = message.model || "unknown";
    const key = JSON.stringify([provider, model]);
    let row = models.get(key);
    if (!row) {
      row = {
        provider,
        model,
        replies: 0,
        measuredReplies: 0,
        estimatedCostReplies: 0,
        input: 0,
        cacheRead: 0,
        cacheWrite: 0,
        output: 0,
        estimatedCost: 0,
      };
      models.set(key, row);
    }
    row.replies++;
    const usage = message.usage;
    // Pi normalizes input to exclude cache reads AND writes. Synthetic failure
    // messages use all-zero usage; that is not evidence of a free request.
    if (
      !usage ||
      ![usage.input, usage.cacheRead, usage.cacheWrite, usage.output].every(nonnegative) ||
      usage.input + usage.cacheRead + usage.cacheWrite + usage.output === 0
    )
      return;
    row.measuredReplies++;
    row.input += usage.input;
    row.cacheRead += usage.cacheRead;
    row.cacheWrite += usage.cacheWrite;
    row.output += usage.output;
    if (nonnegative(usage.cost?.total)) {
      row.estimatedCostReplies++;
      row.estimatedCost += usage.cost.total;
    }
  };
  return {
    observe,
    snapshot: (): ExecutionUsage => ({
      preparation: { ...preparation },
      models: [...models.values()]
        .sort((a, b) => JSON.stringify([a.provider, a.model]).localeCompare(JSON.stringify([b.provider, b.model])))
        .map((row) => ({ ...row })),
      totals: [...models.values()].reduce(
        (sum, row) => ({
          replies: sum.replies + row.replies,
          measuredReplies: sum.measuredReplies + row.measuredReplies,
          estimatedCostReplies: sum.estimatedCostReplies + row.estimatedCostReplies,
          input: sum.input + row.input,
          cacheRead: sum.cacheRead + row.cacheRead,
          cacheWrite: sum.cacheWrite + row.cacheWrite,
          output: sum.output + row.output,
          estimatedCost: sum.estimatedCost + row.estimatedCost,
        }),
        {
          replies: 0,
          measuredReplies: 0,
          estimatedCostReplies: 0,
          input: 0,
          cacheRead: 0,
          cacheWrite: 0,
          output: 0,
          estimatedCost: 0,
        },
      ),
      toolCalls,
    }),
  };
}

const READONLY_TOOL_ALLOWLIST = new Set(["finish", "query_db", "read"]);

const SEQUENTIAL_TOOL_NAMES = new Set([
  "agents",
  "workflows",
  "background_exec",
  "bash",
  "cron",
  "edit",
  "finish",
  "message",
  "run_cli_agent",
  "write",
]);

export const DEFAULT_MODEL_REQUEST_TIMEOUT_MS = 300_000;
const GITHUB_COPILOT_IDE_TOKEN_EXPIRED_PATTERN =
  /Github_copilotException\s*-\s*IDE token expired:\s*unauthorized:\s*token expired/i;

type ModelWithDeclaredFallback = Parameters<StreamFunction>[0] & {
  fallbackModel?: Parameters<StreamFunction>[0];
};

export function isGithubCopilotIdeTokenExpired(message: AssistantMessage): boolean {
  return (
    message.stopReason === "error" &&
    typeof message.errorMessage === "string" &&
    GITHUB_COPILOT_IDE_TOKEN_EXPIRED_PATTERN.test(message.errorMessage)
  );
}

function streamFailureMessage(model: Parameters<StreamFunction>[0], error: unknown): AssistantMessage {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage,
    timestamp: Date.now(),
  };
}

type SimpleStreamFunction = StreamFunction<Api, SimpleStreamOptions>;

/**
 * Switch once to a model's independent fallback when GitHub Copilot immediately
 * reports its IDE credential expired. The caller's context and options objects are
 * reused unchanged, preserving transcript/session ownership across the provider hop.
 */
export function withGithubCopilotIdeTokenRecovery(stream: SimpleStreamFunction): SimpleStreamFunction {
  return (model, context, options) => {
    const recovered = createAssistantMessageEventStream();
    void (async () => {
      const primary = model as ModelWithDeclaredFallback;
      const response = stream(primary, context, options);
      let firstEvent = true;
      for await (const event of response) {
        if (
          firstEvent &&
          event.type === "error" &&
          primary.provider === "github-copilot" &&
          primary.fallbackModel &&
          isGithubCopilotIdeTokenExpired(event.error)
        ) {
          const fallbackResponse = stream(primary.fallbackModel, context, options);
          for await (const fallbackEvent of fallbackResponse) {
            recovered.push(fallbackEvent as AssistantMessageEvent);
          }
          return;
        }
        firstEvent = false;
        recovered.push(event as AssistantMessageEvent);
      }
    })().catch((error) => {
      const failure = streamFailureMessage(model, error);
      recovered.push({ type: "error", reason: "error", error: failure });
    });
    return recovered;
  };
}

const boundedStreamSimple = withGithubCopilotIdeTokenRecovery((model, context, options) =>
  streamSimple(model, context, {
    ...options,
    signal: options?.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(DEFAULT_MODEL_REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(DEFAULT_MODEL_REQUEST_TIMEOUT_MS),
    timeoutMs: options?.timeoutMs ?? DEFAULT_MODEL_REQUEST_TIMEOUT_MS,
    maxRetries: options?.maxRetries ?? 1,
  }),
);

export type PreparedAgentExecution = {
  preparation: PreparationMeasurement;
  definition: SubagentDefinition;
  sessionId: string;
  task: string;
  prompt: string;
  requireFinish: boolean;
  outputSchema?: TSchema;
  activatedSkill?: MaySkill;
  skillActivation?: "explicit";
  systemPrompt: string;
  tools: AgentTool[];
  runner: AgentRunnerConfig;
};

export type AgentPreparationOptions = {
  /** Passive evidence; failures in this observer cannot change execution. */
  onPreparation?: (measurement: PreparationMeasurement) => void;
  definition: SubagentDefinition;
  projectRoot: string;
  sessionId: string;
  task: string;
  /** Optional environment rendering; explicit context preparation still receives the original task. */
  contextPrompt?: string;
  /** Source tree represented by executionRoot; null explicitly disables source mapping. */
  sourceRoot?: string | null;
  /** Fresh disposable messages appended to the provider view after compaction. */
  contextMessages?: () => AgentMessage[] | Promise<AgentMessage[]>;
  /** Enable transcript compaction in addition to the registered definition policy. */
  enableCompaction?: boolean;
  /** Override the preparation measurement label. */
  preparerLabel?: string;
  /** Additional environment-authored instructions appended to the system prompt. */
  systemPromptSuffix?: string;
  skill?: string;
  /** Interpret a leading $skill command; false keeps delegated task text literal. */
  parseSkillCommand?: boolean;
  requireFinish?: boolean;
  outputSchema?: TSchema;
  /** Pure caller admission check; rejection keeps this invocation open for correction. */
  validateOutput?: (result: unknown) => string | null;
  toolPolicy?: ToolPolicy;
  /** Override the registered agent's filesystem tools for this execution only. */
  executionRoot?: string;
  promptTimestamp?: string;
  /** Environment-authored execution facts/guidance; never caller task text or source content. */
  executionContext?: string;
  createFinish?: () => AgentTool;
  /** Exact durable owner for local bash setsid process groups. */
  bashProcessGroupOwner?: { persistDir: string; sessionId: string };
  onCompact?: (info: CompactionInfo, messages: AgentMessage[]) => void;
  onNotice?: (message: string) => void;
};

function definitionForExecution(options: AgentPreparationOptions): SubagentDefinition {
  const root = options.executionRoot;
  if (!root && !options.bashProcessGroupOwner) return options.definition;
  const executionRoot = root ?? options.definition.projectRoot ?? options.projectRoot;
  const agentName = options.definition.name;
  let fileWritePolicy = options.definition.fileWritePolicy;
  if (fileWritePolicy && root) {
    let execution = fileWritePolicy.execution;
    if (options.sourceRoot === null) {
      execution = undefined;
    } else if (typeof options.sourceRoot === "string") {
      execution = { root, sourceRoot: options.sourceRoot };
    } else if (execution && resolve(execution.root) !== resolve(root)) {
      execution = undefined;
    }
    fileWritePolicy = { ...fileWritePolicy, execution };
  }
  const tools = options.definition.tools.map((tool) => {
    switch (tool.name) {
      case "read":
        return root ? createReadTool(executionRoot) : tool;
      case "bash":
        return options.bashProcessGroupOwner
          ? createBashTool(executionRoot, { processGroupOwner: options.bashProcessGroupOwner })
          : root
            ? createBashTool(executionRoot)
            : tool;
      case "edit":
        return root ? createEditTool(executionRoot, { agentName, projectRoot: executionRoot, fileWritePolicy }) : tool;
      case "write":
        return root ? createWriteTool(executionRoot, { agentName, projectRoot: executionRoot, fileWritePolicy }) : tool;
      default:
        return tool;
    }
  });
  return { ...options.definition, ...(root ? { projectRoot: executionRoot, fileWritePolicy } : {}), tools };
}

export type DirectAgentExecutionResult = {
  usage: ExecutionUsage;
  status: "done" | "error" | "interrupted";
  messages: AgentMessage[];
  lastAssistantText: string | null;
  error?: string;
  finishResult?: FinishParams;
  structuredResult?: unknown;
  durationMs: number;
};

export type DirectAgentExecutionOptions = {
  initialMessages?: AgentMessage[];
  timeoutMs?: number;
  signal?: AbortSignal;
  deadlineAt?: number;
  operationAllowance?: number;
  onObservation?: AgentRuntimeListener;
};

export function normalizeExecutionSchema(schema: TSchema | undefined): TSchema | undefined {
  if (schema === undefined) return undefined;
  try {
    const normalized = JSON.parse(JSON.stringify(schema));
    if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
      throw new Error("schema must serialize to a JSON object");
    }
    return normalized as TSchema;
  } catch (error) {
    throw new Error(
      `Workflow output schema must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveAgentDir(definition: SubagentDefinition, projectRoot: string): string | undefined {
  if (definition.agentDir) return definition.agentDir;
  if (definition.knowledgeDir) return dirname(definition.knowledgeDir);
  if (definition.workspace) return dirname(definition.workspace);
  return join(definition.projectRoot ?? projectRoot, "agents", definition.name);
}

function loadPromptFile(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, "utf-8").trim();
  return text || undefined;
}

function runtimeEnvironment(
  definition: SubagentDefinition,
  projectRoot: string,
  agentDir: string | undefined,
  tools: AgentTool[],
  timestamp: string,
): string {
  const root = definition.projectRoot ?? projectRoot;
  const relative = (path: string | undefined): string | undefined =>
    path && root && path.startsWith(root) ? path.slice(root.length + 1) : path;
  const toolNames = tools.map((tool) => tool.name).filter(Boolean);
  const lines = ["# Runtime Environment", `- Project root: ${root}`];
  const relAgentDir = relative(agentDir);
  const relWorkspace = relative(definition.workspace);
  const relKnowledge = relative(definition.knowledgeDir);
  if (relAgentDir) lines.push(`- Agent directory: ${relAgentDir}`);
  if (relWorkspace) lines.push(`- Workspace: ${relWorkspace} (scratch/runtime work)`);
  if (relKnowledge) {
    lines.push(`- Knowledge: ${relKnowledge} (read on demand; start with INDEX.md when needed)`);
  }
  lines.push("- Already in context: shared/common-sense.md and this agent's AGENTS.md when present.");
  lines.push(
    "- Prompt precedence: common-sense is the shared default; this agent's AGENTS.md is the role-specific identity layer and takes precedence for agent-specific behavior.",
  );
  if (toolNames.length > 0) lines.push(`- Available tools: ${toolNames.join(", ")}`);
  lines.push(`- Environment captured at: ${timestamp}`);
  lines.push("", "All paths are relative to project root unless absolute paths are explicitly provided.");
  return lines.join("\n");
}

function resolveTools(options: AgentPreparationOptions, requireFinish: boolean): AgentTool[] {
  const { definition } = options;
  let tools = definition.tools;
  if (options.toolPolicy === "readonly") {
    tools = tools.filter((tool) => READONLY_TOOL_ALLOWLIST.has(tool.name));
  }
  if (!requireFinish) {
    assertUniqueToolNames(
      tools.map((tool) => ({ tool, source: `registered definition for "${definition.name}"` })),
      definition.name,
    );
    return applyToolExecutionPolicy(tools);
  }

  const scopedFinish = options.executionRoot ? options.createFinish?.() : undefined;
  const baseFinish =
    scopedFinish ??
    tools.find((tool) => tool.name === "finish") ??
    definition.tools.find((tool) => tool.name === "finish") ??
    options.createFinish?.();
  if (!baseFinish) {
    throw new Error(`Agent ${definition.name} requires finish() but no finish capability was supplied`);
  }
  const finish = createWorkflowFinishTool(baseFinish, options.outputSchema, options.validateOutput);
  const index = tools.findIndex((tool) => tool.name === "finish");
  const finalTools = index < 0 ? [...tools, finish] : tools.map((tool, offset) => (offset === index ? finish : tool));
  assertUniqueToolNames(
    finalTools.map((tool, offset) => ({
      tool,
      source:
        index < 0 && offset === finalTools.length - 1
          ? "required finish construction"
          : `registered definition for "${definition.name}"`,
    })),
    definition.name,
  );
  return applyToolExecutionPolicy(finalTools);
}

function applyToolExecutionPolicy(tools: AgentTool[]): AgentTool[] {
  return tools.map((tool) => (SEQUENTIAL_TOOL_NAMES.has(tool.name) ? { ...tool, executionMode: "sequential" } : tool));
}

function bindToolsToSession(tools: AgentTool[], agentName: string, sessionId: string): AgentTool[] {
  return tools.map((tool) => {
    const execute = tool.execute.bind(tool);
    return {
      ...tool,
      execute: (...args: Parameters<AgentTool["execute"]>) =>
        runWithAgentSessionContext(agentName, sessionId, () => execute(...args)),
    } as AgentTool;
  });
}

/** Stop cooperative work without cancelling the model's opportunity to finish. */
export function bindToolsToExecutionScope(tools: AgentTool[], getScope: () => ExecutionScope | undefined): AgentTool[] {
  return tools.map((tool) => ({
    ...tool,
    execute: (id, params, signal, onUpdate) => {
      const scope = getScope();
      const limit = tool.name === "finish" ? scope?.signal : scope?.workSignal;
      const combined = limit && signal ? AbortSignal.any([signal, limit]) : limit ?? signal;
      combined?.throwIfAborted();
      return tool.execute(id, params, combined, onUpdate);
    },
  }));
}

function resolveSystemPrompt(options: AgentPreparationOptions, tools: AgentTool[], requireFinish: boolean): string {
  const { definition, projectRoot } = options;
  let base = definition.systemPrompt;
  if (base === undefined) {
    const agentDir = resolveAgentDir(definition, projectRoot);
    const sections: string[] = [];
    const shared =
      definition.sharedPromptText !== undefined
        ? definition.sharedPromptText
        : loadPromptFile(join(definition.sharedRoot ?? join(projectRoot, "shared"), "common-sense.md"));
    if (shared) sections.push(shared);
    if (agentDir) {
      const identity =
        definition.identityText !== undefined ? definition.identityText : loadPromptFile(join(agentDir, "AGENTS.md"));
      if (identity) sections.push(identity);
    }
    if (definition.skillCatalog && tools.some((tool) => tool.name === "read")) {
      const catalog = formatBoundedSkillCatalog(definition.skillCatalog);
      if (catalog.text) sections.push(catalog.text);
      if (catalog.omitted.length > 0) {
        options.onNotice?.(
          `[skills] ${definition.name}: omitted ${catalog.omitted.length} skill(s) from prompt budget: ${catalog.omitted.join(", ")}`,
        );
      }
    }
    sections.push(
      runtimeEnvironment(definition, projectRoot, agentDir, tools, options.promptTimestamp ?? new Date().toISOString()),
    );
    base = `<system_instructions>\n${sections.join("\n\n")}\n</system_instructions>`;
  }

  // App overrides replace role guidance, not the Host execution contract.
  base += `\n\n<execution_instructions>\n${executionInstructions.trim()}\n</execution_instructions>`;
  if (options.executionContext) base += `\n\n<execution_context>\n${options.executionContext}\n</execution_context>`;
  if (requireFinish) {
    const resultInstruction = options.outputSchema
      ? "The finish() call must include the required schema-validated output payload."
      : "Use the standard finish() fields; no caller-defined output payload is required.";
    base += `\n\n<completion>\nComplete this invocation by calling finish() as your final action. ${resultInstruction} Correct any rejected result before finishing.\n</completion>`;
  }
  return base;
}

/**
 * Resolve one agent turn into a model prompt, capability set, guards, and
 * compaction policy. This layer has no EventBus, database, task, schedule, or
 * session-persistence dependency; durable and direct callers add those around
 * the returned runner configuration.
 */
export function prepareAgentExecution(options: AgentPreparationOptions): PreparedAgentExecution {
  const started = performance.now();
  const source = options.definition.contextPreparationSource;
  const measurement: PreparationMeasurement = {
    preparer:
      options.preparerLabel ??
      (options.definition.contextPreparation ? source?.path ?? "unidentified" : "full"),
    entryHash: options.definition.contextPreparation ? source?.entryHash ?? null : null,
    durationMs: 0,
    taskBytes: Buffer.byteLength(options.task),
    promptBytes: null,
    systemBytes: null,
    failed: true,
  };
  try {
    const prepared = prepareExecution(options);
    measurement.promptBytes = Buffer.byteLength(prepared.prompt);
    measurement.systemBytes = Buffer.byteLength(prepared.systemPrompt);
    measurement.failed = false;
    return { ...prepared, preparation: measurement };
  } finally {
    measurement.durationMs = performance.now() - started;
    try {
      options.onPreparation?.({ ...measurement });
    } catch {
      /* observation cannot reject work */
    }
  }
}

function prepareExecution(options: AgentPreparationOptions): Omit<PreparedAgentExecution, "preparation"> {
  const definition = definitionForExecution(options);
  options = { ...options, definition, projectRoot: options.executionRoot ?? options.projectRoot };
  const parsedSkill = options.parseSkillCommand === false ? { task: options.task } : parseExplicitSkill(options.task);
  const skillName = options.skill ?? parsedSkill.skill;
  const task = parsedSkill.skill ? parsedSkill.task : options.task;
  if (skillName && !task) throw new Error(`Skill "${skillName}" requires a task`);
  // Preparation changes model context only. Keep the accepted task for receipts,
  // and apply skill instructions afterwards so an adapter cannot discard them.
  const contextTask: unknown = options.definition.contextPreparation
    ? options.definition.contextPreparation({ task })
    : options.contextPrompt ?? task;
  if (typeof contextTask !== "string" || (task.trim() && !contextTask.trim())) {
    // Reject async adapters under the synchronous contract, but consume their
    // rejection so it cannot escape the caller's ordinary failure handling.
    void Promise.resolve(contextTask).catch(() => {});
    throw new Error("contextPreparation must return a non-empty task string");
  }
  const activation = skillName
    ? invokeCatalogSkill(options.definition.skillCatalog, skillName, contextTask)
    : undefined;
  const outputSchema = normalizeExecutionSchema(options.outputSchema);
  const requireFinish = options.requireFinish === true || outputSchema !== undefined || options.validateOutput !== undefined;
  const normalizedOptions = { ...options, outputSchema };
  const tools = bindToolsToSession(
    resolveTools(normalizedOptions, requireFinish),
    options.definition.name,
    options.sessionId,
  );
  // finish is sequential. Once accepted, later calls in that same batch have
  // no authority to add effects. A later invocation has a different message.
  let finishedTurn: PiBeforeToolCallContext["assistantMessage"] | undefined;
  const beforeToolCall = async (context: PiBeforeToolCallContext) => {
    if (finishedTurn && context.assistantMessage === finishedTurn)
      return { block: true, reason: "This invocation already finished; remaining tool calls were not executed." };
    return undefined;
  };

  let compactInfo: CompactionInfo | undefined;
  const compact =
    options.enableCompaction || options.definition.compaction
      ? createCompactionTransform(options.definition.model, {
          onCompact: (info) => {
            compactInfo = info;
          },
        })
      : undefined;
  const transformContext =
    compact || options.contextMessages
      ? async (messages: AgentMessage[]) => {
          compactInfo = undefined;
          const compacted = compact ? await compact(messages) : messages;
          if (compacted !== messages) messages.splice(0, messages.length, ...compacted);
          if (compactInfo) options.onCompact?.(compactInfo, messages);
          // A disposable provider view: fresh context is rebuilt after compaction
          // and does not accumulate in the durable conversation transcript.
          return options.contextMessages
            ? [...messages, ...(await options.contextMessages())]
            : messages;
        }
      : undefined;
  const systemPrompt =
    resolveSystemPrompt(normalizedOptions, tools, requireFinish) +
    (activation
      ? `\n\nSelected skill reference: ${JSON.stringify(activation.skill.canonicalPath)}. Read it again if its instructions were compacted.`
      : "") +
    (options.systemPromptSuffix ? `\n\n${options.systemPromptSuffix}` : "");

  return {
    definition: options.definition,
    sessionId: options.sessionId,
    task,
    prompt: activation?.prompt ?? contextTask,
    requireFinish,
    outputSchema,
    activatedSkill: activation?.skill,
    skillActivation: activation ? "explicit" : undefined,
    systemPrompt,
    tools,
    runner: {
      streamFn: boundedStreamSimple,
      sessionId: options.sessionId,
      initialState: {
        systemPrompt,
        model: options.definition.model,
        tools,
      },
      beforeToolCall,
      afterToolCall: async ({ toolCall, assistantMessage, result, isError }) => {
        if (toolCall.name === "finish" && !isError && result.terminate === true) finishedTurn = assistantMessage;
        return undefined;
      },
      // Pi's batch hint alone can continue mixed batches or consume queued input.
      // Stop before another model request; queued input belongs to later work.
      finishTurn: ({ message }) =>
        finishedTurn !== undefined && message === finishedTurn ? { action: "end" } : undefined,
      transformContext,
      getApiKey: options.definition.apiKey ? () => options.definition.apiKey! : undefined,
    },
  };
}

/** Execute one prepared turn without durable-session or autonomous infrastructure. */
export async function executePreparedAgent(
  prepared: PreparedAgentExecution,
  options: DirectAgentExecutionOptions = {},
): Promise<DirectAgentExecutionResult> {
  const operationAllowance = validateOperationAllowance(options.operationAllowance);
  const startedAt = Date.now();
  let scope: ExecutionScope | undefined;
  const tools = bindToolsToExecutionScope(prepared.tools, () => scope);
  const agent = createAgentRun({
    ...prepared.runner,
    initialState: { ...prepared.runner.initialState, tools },
  });
  const usage = createExecutionUsage(prepared.preparation);
  const unsubscribeUsage = agent.subscribe(usage.observe);
  if (options.initialMessages) restoreAgentMessages(agent, options.initialMessages);
  const unsubscribe = options.onObservation ? agent.subscribe(options.onObservation) : undefined;
  let boundedFinishRequested = false;
  const requestFinish = () => {
    if (boundedFinishRequested || extractFinishParams(agent.state.messages as any[])) return;
    boundedFinishRequested = true;
    agent.steer({
      role: "user",
      content: [{ type: "text", text: boundedWorkflowFinishPrompt(prepared.outputSchema) }],
    } as any);
  };
  let toolCalls = 0;
  const unsubscribeBoundedFinish = prepared.requireFinish
    ? agent.subscribe((event) => {
        if (event.type !== "tool_execution_start") return;
        toolCalls++;
        if (
          !shouldRequestBoundedWorkflowFinish(true, toolCalls, boundedFinishRequested, {
            admittedTimeoutMs: options.timeoutMs,
            elapsedMs: Date.now() - startedAt,
            operationAllowance,
          })
        )
          return;
        requestFinish();
      })
    : undefined;
  let timedOut = false;
  let interrupted = false;
  let error: string | undefined;
  scope = new ExecutionScope(
    options.timeoutMs ?? prepared.definition.timeoutMs,
    options.signal,
    options.deadlineAt,
    () => {
      timedOut = scope!.timedOut;
      interrupted = true;
      agent.cancel();
    },
    prepared.requireFinish ? requestFinish : undefined,
  );

  try {
    let recoveredThrownFailure = false;
    try {
      await agent.prompt(prepared.prompt);
      await agent.waitForIdle();
    } catch (initialCause) {
      scope.signal.throwIfAborted();
      const initialError = initialCause instanceof Error ? initialCause.message : String(initialCause);
      const messages = agent.state.messages as AgentMessage[];
      const captured = prepared.requireFinish
        ? await recoverCapturedWorkflowFinish({
            sessionId: prepared.sessionId,
            messages,
            tools,
            reason: initialError,
          })
        : { disposition: "ineligible" as const };
      if (captured.disposition === "recovered" || captured.disposition === "already-committed") {
        recoveredThrownFailure = true;
      } else if (
        prepared.requireFinish &&
        !extractFinishParams(messages as any[]) &&
        shouldAttemptWorkflowFinishRecovery(initialError)
      ) {
        recoveredThrownFailure = true;
        try {
          await agent.prompt(workflowFinishRecoveryPrompt(prepared.outputSchema, captured.error ?? initialError));
          await agent.waitForIdle();
        } catch (recoveryCause) {
          const recoveryError = recoveryCause instanceof Error ? recoveryCause.message : String(recoveryCause);
          throw new Error(
            `Initial workflow prompt failed: ${initialError}; bounded finish recovery failed: ${recoveryError}`,
            { cause: recoveryCause },
          );
        }
      } else {
        throw initialCause;
      }
    }
    if (prepared.requireFinish && !recoveredThrownFailure) {
      scope.signal.throwIfAborted();
      const messages = agent.state.messages as AgentMessage[];
      const terminalError = extractLastAssistantError(messages) ?? classifyTerminalAssistantFailure(messages);
      if (!extractFinishParams(messages as any[])) {
        if (shouldAttemptWorkflowFinishRecovery(terminalError)) {
          if (isRetryableEmptyAssistantFailure(terminalError)) {
            messages.pop();
          }
          await agent.prompt(workflowFinishRecoveryPrompt(prepared.outputSchema, terminalError));
          await agent.waitForIdle();
        } else if (!terminalError) {
          await agent.prompt(
            "This invocation has not returned its structured output. Call finish() now with all required fields" +
              (prepared.outputSchema ? ", including the schema-validated output payload." : "."),
          );
          await agent.waitForIdle();
        }
      }
    }
  } catch (cause) {
    error = timedOut
      ? `Agent timed out after ${scope.timeoutMs}ms`
      : cause instanceof Error
        ? cause.message
        : String(cause);
  } finally {
    scope.close();
    unsubscribeUsage();
    if (typeof unsubscribe === "function") unsubscribe();
    if (typeof unsubscribeBoundedFinish === "function") unsubscribeBoundedFinish();
  }

  const messages = agent.state.messages as AgentMessage[];
  const finishResult = extractFinishParams(messages as any[]) ?? undefined;
  // A committed finish survives a timeout while the turn unwinds. Validate the
  // caller's required payload below before treating that receipt as a result.
  if (finishResult && interrupted) error = undefined;
  if (interrupted && !finishResult) error ??= scope.signal.reason?.message ?? "Execution interrupted";
  const assistantError = !finishResult ? extractLastAssistantError(messages) : undefined;
  const terminalFailure = !finishResult ? classifyTerminalAssistantFailure(messages) : undefined;
  error ??= assistantError ?? terminalFailure;
  if (!error && prepared.requireFinish && !finishResult) {
    error = "Workflow agent step ended without calling finish() after one corrective prompt";
  }
  if (!error && prepared.outputSchema && finishResult && finishResult.output === undefined) {
    error = "Workflow agent step completed without the required schema-backed finish().output payload";
  }
  const assistantText = finishResult?.summary ?? extractLastAssistantText(messages);
  if (!error && !finishResult && !assistantText) {
    error = "Agent ended without producing a response";
  }
  // A committed finish is an execution result; caller-defined output may still describe incomplete domain work.
  const status = interrupted && !finishResult ? "interrupted" : error ? "error" : "done";

  return {
    status,
    usage: usage.snapshot(),
    messages: messages.filter((message) => message.role !== "system"),
    lastAssistantText: assistantText,
    ...(error ? { error } : {}),
    ...(finishResult ? { finishResult, structuredResult: finishResult.output } : {}),
    durationMs: Date.now() - startedAt,
  };
}
