/**
 * context-learn.ts — Extract durable knowledge and persist to context files.
 *
 * Three decoupled layers:
 *
 *   1. Extraction: take text (transcript, error log, chat, code review),
 *      return structured facts. Two modes: LLM (primary) or mechanical (fallback).
 *
 *   2. Context file management: apply add/remove updates to a markdown file
 *      with deduplication and size trimming.
 *
 *   3. Convenience wrappers: learnFromSession (for post-session hook),
 *      learnFromText (for ad-hoc use).
 *
 * Reuse examples:
 *   - Post-session: learnFromSession(agentDir, messages)
 *   - Ad-hoc from CLI: extractFacts(someText, manager) → applyContextUpdates(file, facts)
 *   - Cross-agent: extract from coder session → apply to tech-lead's context
 *   - Code review: extractFacts(prDiff + reviewComments) → apply to coder's context
 *   - Onboarding: extractFacts(readmeContent) → apply to new agent's context
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

export interface ContextUpdate {
  action: "add" | "remove";
  content: string;
}

export interface ContextUpdateResult {
  added: string[];
  removed: string[];
}

/** Minimal manager interface for running an LLM call. */
export interface LLMCaller {
  run: (agentName: string, task: string, opts?: { kind?: "chat" | "job" | "call" }) => string;
  waitFor: (sessionId: string) => Promise<{ lastAssistantText?: string | null } | null>;
}

export interface TranscriptMessage {
  role: string;
  content: unknown;
  toolName?: string;
  isError?: boolean;
}

// ── Layer 1: Extraction ────────────────────────────────────────────────

const EXTRACT_PROMPT = `You are a context extraction system. You read text and extract DURABLE facts worth remembering for future work on the same project.

## Rules
- Extract only facts that would help someone working on the SAME project in the future
- Each fact must be one line, specific and actionable
- DO NOT extract: session-specific details ("fixed bug in line 42"), obvious truths, opinions, generic advice
- DO extract: correct commands, runtime/tooling info, architectural patterns, gotchas, implicit constraints, file locations, user preferences
- Maximum 5 facts (be selective — only genuinely useful ones)
- If nothing new was learned, output an empty array

## Output format
Output a JSON array inside a \`\`\`json code fence:

\`\`\`json
[
  { "action": "add", "content": "Run tests with 'bun test' — project uses bun:test module, 'node test/file.js' fails" },
  { "action": "remove", "content": "old fact that this session proved wrong" }
]
\`\`\`

Use "remove" only if the text proves a previously-known fact is wrong.
Output \`[]\` if nothing worth learning.`;

/**
 * Extract durable facts from arbitrary text using an LLM.
 *
 * This is the core reusable extraction function. It takes any text
 * (transcript, error log, PR review, README) and returns structured
 * context updates.
 *
 * @param text - The text to analyze
 * @param manager - LLM caller (runs evaluator agent for cheap inference)
 * @param existingContext - Current context.md contents (to avoid duplicates)
 * @param label - Optional label for the prompt (e.g., "Agent: coder, Task: fix build")
 */
export async function extractFacts(
  text: string,
  manager: LLMCaller,
  existingContext?: string,
  label?: string,
): Promise<ContextUpdate[]> {
  // Cap input text
  const cappedText =
    text.length > 8000 ? text.slice(0, 3000) + "\n\n[... truncated ...]\n\n" + text.slice(-5000) : text;

  const prompt = [
    EXTRACT_PROMPT,
    "",
    label ? `## Context\n${label}\n` : "",
    existingContext ? `## Already known (do not duplicate)\n${existingContext}\n` : "",
    `## Text to analyze`,
    cappedText,
    "",
    "Output the JSON array:",
  ].join("\n");

  try {
    const sessionId = manager.run("evaluator", prompt, { kind: "job" });
    const result = await manager.waitFor(sessionId);
    const response = result?.lastAssistantText ?? "";
    return parseContextUpdates(response);
  } catch {
    return [];
  }
}

/**
 * Extract facts from a session transcript mechanically (no LLM).
 * Pattern-matches on tool calls for command corrections, runtime discovery, path fixes.
 */
export function extractFactsMechanical(messages: TranscriptMessage[]): ContextUpdate[] {
  const { toolCalls, toolResults } = parseToolEvents(messages);
  const facts: string[] = [];

  extractCommandCorrections(toolCalls, toolResults, facts);
  extractRuntimeFacts(toolCalls, toolResults, facts);
  extractPathDiscoveries(toolCalls, toolResults, facts);

  return facts.map((f) => ({ action: "add" as const, content: f }));
}

// ── Layer 2: Context file management ───────────────────────────────────

/**
 * Apply context updates to a markdown file.
 *
 * Handles: add (with dedup), remove, size trimming.
 * Creates the file and parent directories if they don't exist.
 *
 * @param contextPath - Path to the context.md file
 * @param updates - Facts to add or remove
 * @param maxSize - Max file size in bytes (default 2048)
 */
export function applyContextUpdates(
  contextPath: string,
  updates: ContextUpdate[],
  maxSize = 2048,
): ContextUpdateResult {
  let lines: string[] = [];
  try {
    lines = readFileSync(contextPath, "utf-8").split("\n");
  } catch {
    /* file may not exist */
  }

  const added: string[] = [];
  const removed: string[] = [];

  for (const u of updates) {
    const trimmed = u.content.trim();
    if (u.action === "add") {
      if (!lines.some((line) => line.toLowerCase().includes(trimmed.toLowerCase()))) {
        lines.push(`- ${trimmed}`);
        added.push(trimmed);
      }
    } else if (u.action === "remove") {
      const before = lines.length;
      lines = lines.filter((l) => !l.toLowerCase().includes(trimmed.toLowerCase()));
      if (lines.length < before) removed.push(trimmed);
    }
  }

  if (added.length === 0 && removed.length === 0) {
    return { added: [], removed: [] };
  }

  let content = lines.join("\n");
  while (content.length > maxSize) {
    const idx = content.indexOf("\n", 1);
    if (idx === -1) break;
    content = content.slice(idx + 1);
  }

  mkdirSync(dirname(contextPath), { recursive: true });
  writeFileSync(contextPath, content);

  return { added, removed };
}

/**
 * Read the current contents of a context file. Returns empty string if missing.
 */
export function readContext(contextPath: string): string {
  try {
    return readFileSync(contextPath, "utf-8").trim();
  } catch {
    return "";
  }
}

// ── Merge prompt (produces complete context.md, not patches) ───────────

const MERGE_PROMPT = `You maintain a knowledge file (context.md) for an AI agent — a concise collection of durable facts that help the agent work effectively.

You receive the agent's CURRENT context.md and new text to learn from. Output the COMPLETE UPDATED context.md.

**What belongs:** correct commands, runtime/tooling facts, architectural patterns, file locations, user preferences, gotchas.
**What doesn't:** session-specific details, obvious truths, opinions, generic advice.

**Merging:** If a new fact updates an existing one, REPLACE (e.g., "Bun 1.0" → "Bun 1.2"). If facts contradict, keep the newer one. Merge related facts into one line. Remove stale facts. Keep UNDER 30 lines.

Output ONLY the complete context.md inside a code fence:

\`\`\`markdown
- fact one
- fact two
\`\`\`

If nothing new to learn, output the existing context unchanged. If empty and nothing to learn, output an empty code fence.`;

/**
 * Merge new knowledge into a context file using an LLM.
 *
 * Unlike extractFacts + applyContextUpdates (which patches), this produces
 * the complete merged context.md — handling conflicts, dedup, and staleness.
 *
 * @param contextPath - Path to context.md
 * @param text - New text to learn from (transcript, error log, etc.)
 * @param manager - LLM caller
 * @param label - Optional context label
 * @param maxSize - Max file size in bytes
 */
export async function mergeContext(
  contextPath: string,
  text: string,
  manager: LLMCaller,
  label?: string,
  maxSize = 2048,
): Promise<ContextUpdateResult> {
  const existing = readContext(contextPath);

  const cappedText =
    text.length > 8000 ? text.slice(0, 3000) + "\n\n[... truncated ...]\n\n" + text.slice(-5000) : text;

  const prompt = [
    MERGE_PROMPT,
    "",
    label ? `## Agent context\n${label}\n` : "",
    `## Current context.md`,
    existing ? `\`\`\`\n${existing}\n\`\`\`` : "(empty)",
    "",
    `## New text to learn from`,
    cappedText,
    "",
    "Output the complete updated context.md:",
  ].join("\n");

  const sessionId = manager.run("evaluator", prompt, { kind: "job" });
  const result = await manager.waitFor(sessionId);
  const response = result?.lastAssistantText ?? "";

  const match = response.match(/```(?:markdown)?\s*\n([\s\S]*?)```/);
  if (!match) return { added: [], removed: [] };

  let merged = match[1].trim();

  // Enforce size limit
  if (merged.length > maxSize) {
    const lines = merged.split("\n");
    while (lines.join("\n").length > maxSize && lines.length > 1) {
      lines.shift();
    }
    merged = lines.join("\n");
  }

  // Compute diff for reporting
  const oldLines = new Set(existing.split("\n").filter((l) => l.startsWith("- ")));
  const newLines = new Set(merged.split("\n").filter((l) => l.startsWith("- ")));
  const added = [...newLines].filter((l) => !oldLines.has(l)).map((l) => l.replace(/^- /, ""));
  const removed = [...oldLines].filter((l) => !newLines.has(l)).map((l) => l.replace(/^- /, ""));

  if (added.length === 0 && removed.length === 0 && merged === existing) {
    return { added: [], removed: [] };
  }

  mkdirSync(dirname(contextPath), { recursive: true });
  writeFileSync(contextPath, merged);

  return { added, removed };
}

// ── Layer 3: Convenience wrappers ──────────────────────────────────────

export interface LearnFromSessionOptions {
  agentDir: string;
  messages: TranscriptMessage[];
  maxSize?: number;
}

export interface LearnFromSessionLLMOptions extends LearnFromSessionOptions {
  agentName: string;
  task: string;
  manager: LLMCaller;
}

/**
 * Post-session learning with LLM merge.
 * The LLM sees the full existing context + session transcript and produces
 * the complete updated context.md — handling conflicts, dedup, and staleness.
 * Falls back to mechanical extraction if LLM fails.
 */
export async function learnFromSessionLLM(opts: LearnFromSessionLLMOptions): Promise<ContextUpdateResult> {
  const { agentDir, messages, agentName, task, manager, maxSize = 2048 } = opts;
  const contextPath = `${agentDir}/context.md`;
  const transcript = formatTranscriptForLearning(messages);
  const label = `Agent: ${agentName}\nTask: ${task}`;

  try {
    return await mergeContext(contextPath, transcript, manager, label, maxSize);
  } catch {
    // Fallback to mechanical extraction
    return learnFromSession({ agentDir, messages, maxSize });
  }
}

/**
 * Post-session learning with mechanical extraction only (no LLM).
 * Use this in gym, tests, or when LLM is unavailable.
 */
export function learnFromSession(opts: LearnFromSessionOptions): ContextUpdateResult {
  const { agentDir, messages, maxSize = 2048 } = opts;
  const contextPath = `${agentDir}/context.md`;

  const updates = extractFactsMechanical(messages);
  if (updates.length === 0) return { added: [], removed: [] };

  return applyContextUpdates(contextPath, updates, maxSize);
}

/**
 * Learn from arbitrary text (ad-hoc). Uses LLM merge.
 *
 * Examples:
 *   - learnFromText(contextPath, readmeContent, manager, "Onboarding: reading project README")
 *   - learnFromText(contextPath, prReviewText, manager, "Code review feedback on PR #42")
 */
export async function learnFromText(
  contextPath: string,
  text: string,
  manager: LLMCaller,
  label?: string,
  maxSize = 2048,
): Promise<ContextUpdateResult> {
  return mergeContext(contextPath, text, manager, label, maxSize);
}

// ── Transcript formatting ──────────────────────────────────────────────

function formatTranscriptForLearning(messages: TranscriptMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content as Array<Record<string, unknown>>) {
        if (part.type === "text" && typeof part.text === "string") {
          const text = (part.text as string).slice(0, 500);
          if (text.trim()) lines.push(`[assistant] ${text}`);
        }
        if (part.type === "toolCall" || part.type === "tool_use") {
          const args = JSON.stringify(part.arguments ?? part.input ?? {}).slice(0, 300);
          lines.push(`[tool_call: ${part.name}] ${args}`);
        }
      }
    }
    if (msg.role === "toolResult" || msg.role === "tool") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? (msg.content as Array<{ text?: string }>).map((p) => p.text ?? "").join("\n")
            : "";
      const truncated = text.length > 1000 ? text.slice(0, 1000) + "..." : text;
      const errTag = msg.isError ? " [ERROR]" : "";
      lines.push(`[tool_result: ${msg.toolName ?? "?"}${errTag}] ${truncated}`);
    }
  }

  const full = lines.join("\n");
  if (full.length > 8000) {
    return full.slice(0, 3000) + "\n\n[... transcript truncated ...]\n\n" + full.slice(-5000);
  }
  return full;
}

// ── JSON parsing ───────────────────────────────────────────────────────

function parseContextUpdates(text: string): ContextUpdate[] {
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u: unknown): u is ContextUpdate =>
        typeof u === "object" &&
        u !== null &&
        "action" in u &&
        "content" in u &&
        typeof (u as Record<string, unknown>).action === "string" &&
        typeof (u as Record<string, unknown>).content === "string" &&
        ((u as Record<string, unknown>).action === "add" || (u as Record<string, unknown>).action === "remove"),
    );
  } catch {
    return [];
  }
}

// ── Tool event parsing ─────────────────────────────────────────────────

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  index: number;
}

interface ToolResult {
  toolName: string;
  content: string;
  isError: boolean;
  index: number;
}

function parseToolEvents(messages: TranscriptMessage[]): { toolCalls: ToolCall[]; toolResults: ToolResult[] } {
  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content as Array<Record<string, unknown>>) {
        if (part.type === "toolCall" || part.type === "tool_use") {
          const args =
            typeof part.arguments === "string"
              ? tryParseJson(part.arguments)
              : ((part.arguments ?? part.input ?? {}) as Record<string, unknown>);
          toolCalls.push({ name: (part.name ?? part.toolName ?? "") as string, args, index: i });
        }
      }
    }
    if (msg.role === "toolResult" || msg.role === "tool") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? (msg.content as Array<{ text?: string }>).map((p) => p.text ?? "").join("\n")
            : "";
      toolResults.push({
        toolName: (msg.toolName ?? "") as string,
        content: text,
        isError: msg.isError === true,
        index: i,
      });
    }
  }

  return { toolCalls, toolResults };
}

// ── Mechanical pattern extractors ──────────────────────────────────────

function extractCommandCorrections(calls: ToolCall[], results: ToolResult[], facts: string[]): void {
  const bashCalls = calls.filter((c) => c.name === "bash");
  const bashResults = results.filter((r) => r.toolName === "bash");

  for (let i = 0; i < bashCalls.length - 1; i++) {
    const call = bashCalls[i];
    const result = bashResults.find((r) => r.index > call.index && r.index < (bashCalls[i + 1]?.index ?? Infinity));
    if (!result || !result.isError) continue;

    const failedCmd = String(call.args.command ?? "");
    const errorText = result.content.slice(0, 500).toLowerCase();

    for (let j = i + 1; j < bashCalls.length; j++) {
      const nextCall = bashCalls[j];
      const nextResult = bashResults.find(
        (r) => r.index > nextCall.index && r.index < (bashCalls[j + 1]?.index ?? Infinity),
      );
      if (!nextResult || nextResult.isError) continue;

      const successCmd = String(nextCall.args.command ?? "");

      if (failedCmd.startsWith("npm ") && successCmd.startsWith("bun ")) {
        facts.push(`Use 'bun' not 'npm' — '${failedCmd.slice(0, 40)}' failed, '${successCmd.slice(0, 40)}' worked`);
        break;
      }
      if (failedCmd.startsWith("node ") && (successCmd.startsWith("bun ") || successCmd.startsWith("deno "))) {
        const runtime = successCmd.split(" ")[0];
        facts.push(
          `Use '${runtime}' not 'node' — '${failedCmd.slice(0, 40)}' failed, '${successCmd.slice(0, 40)}' worked`,
        );
        break;
      }
      if (
        failedCmd.includes("npm test") &&
        (successCmd.includes("bun test") ||
          successCmd.includes("deno test") ||
          successCmd.includes("vitest") ||
          successCmd.includes("jest"))
      ) {
        facts.push(`Test runner: '${successCmd.slice(0, 50)}' (not 'npm test')`);
        break;
      }
      if (errorText.includes("command not found") || errorText.includes("not found")) {
        const failedBin = failedCmd.split(" ")[0];
        const successBin = successCmd.split(" ")[0];
        if (failedBin !== successBin) {
          facts.push(`Use '${successBin}' not '${failedBin}' — '${failedBin}' not available`);
          break;
        }
      }

      const failedCore = failedCmd.replace(/^cd [^ ]+ && /, "");
      const successCore = successCmd.replace(/^cd [^ ]+ && /, "");
      if (failedCore !== successCore && failedCore.split(/\s+/)[0] === successCore.split(/\s+/)[0]) {
        facts.push(`Correct command: '${successCore.slice(0, 60)}' (not '${failedCore.slice(0, 60)}')`);
        break;
      }
    }
  }
}

function extractRuntimeFacts(calls: ToolCall[], results: ToolResult[], facts: string[]): void {
  const readCalls = calls.filter((c) => c.name === "read");

  for (const call of readCalls) {
    const path = String(call.args.path ?? "");
    const result = results.find((r) => r.index > call.index && !r.isError);
    if (!result) continue;

    if (path.endsWith("deno.json") || path.endsWith("deno.jsonc")) {
      facts.push("Project uses Deno runtime (deno.json found)");
    }
    if (path.endsWith("bunfig.toml")) {
      facts.push("Project uses Bun runtime (bunfig.toml found)");
    }
    if (path.endsWith("package.json") && result.content.includes('"bun"')) {
      if (result.content.includes('"runtime"') && result.content.includes('"bun"')) {
        facts.push("Project uses Bun runtime (package.json runtime field)");
      }
    }
  }
}

function extractPathDiscoveries(calls: ToolCall[], results: ToolResult[], facts: string[]): void {
  const readCalls = calls.filter((c) => c.name === "read");

  for (let i = 0; i < readCalls.length - 1; i++) {
    const call = readCalls[i];
    const result = results.find((r) => r.index > call.index);
    if (!result || !result.isError) continue;

    const failedPath = String(call.args.path ?? "");
    if (!failedPath) continue;

    for (let j = i + 1; j < readCalls.length; j++) {
      const nextCall = readCalls[j];
      const nextResult = results.find((r) => r.index > nextCall.index);
      if (!nextResult || nextResult.isError) continue;

      const successPath = String(nextCall.args.path ?? "");
      const failedFile = failedPath.split("/").pop();
      const successFile = successPath.split("/").pop();
      if (failedFile && failedFile === successFile && failedPath !== successPath) {
        facts.push(`'${successFile}' is at '${successPath}' (not '${failedPath}')`);
        break;
      }
    }
  }
}

function tryParseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
