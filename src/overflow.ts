import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Regex patterns for detecting context overflow from error strings.
 * Matches the same patterns as pi-ai's isContextOverflow but works on raw error strings
 * (since agent.state.error is a string, not an AssistantMessage).
 */
const OVERFLOW_PATTERNS = [
  /prompt is too long/i,
  /input is too long for requested model/i,
  /exceeds the context window/i,
  /input token count.*exceeds the maximum/i,
  /maximum prompt length is \d+/i,
  /reduce the length of the messages/i,
  /maximum context length is \d+ tokens/i,
  /exceeds the limit of \d+/i,
  /exceeds the available context size/i,
  /greater than the context length/i,
  /context window exceeds limit/i,
  /exceeded model token limit/i,
  /context[_ ]length[_ ]exceeded/i,
  /too many tokens/i,
  /token limit exceeded/i,
  /^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i,
];

/** Keys whose values should be redacted from tool call arguments. */
const REDACT_KEYS = new Set([
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "authorization",
  "credential",
  "credentials",
  "access_token",
  "refresh_token",
  "private_key",
  "privatekey",
]);

/** Check if an error string indicates a context overflow. */
export function isOverflowError(error: string): boolean {
  return OVERFLOW_PATTERNS.some((p) => p.test(error));
}

/**
 * Redact sensitive values from a tool arguments object.
 * Returns a shallow-redacted copy (only top-level keys are checked).
 */
function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Extract structured progress from a conversation that hit context overflow.
 * Produces a markdown document that a new session can use to continue.
 */
export function extractProgress(task: string, messages: AgentMessage[], error: string): string {
  const sections: string[] = [];

  sections.push(`# Overflow Recovery — Pick Up From Here`);
  sections.push(``);
  sections.push(`> The previous session hit a context overflow error and could not continue.`);
  sections.push(`> This file captures the progress made so far. Use it to continue the task.`);
  sections.push(``);

  // Original task
  sections.push(`## Original Task`);
  sections.push(``);
  sections.push(task);
  sections.push(``);

  // Extract key actions taken (tool calls and their results)
  const actions: string[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "toolCall") {
          // Redact sensitive keys, then summarize tool calls — name + truncated args
          const safeArgs = redactArgs(block.arguments as Record<string, unknown>);
          const argsStr = JSON.stringify(safeArgs);
          const truncatedArgs = argsStr.length > 300 ? argsStr.slice(0, 300) + "..." : argsStr;
          actions.push(`- **${block.name}**: ${truncatedArgs}`);
        }
      }
    }
  }
  if (actions.length > 0) {
    sections.push(`## Actions Taken (${actions.length} tool calls)`);
    sections.push(``);
    // Show last 30 actions (most relevant for picking up)
    const recentActions = actions.slice(-30);
    if (actions.length > 30) {
      sections.push(`_(showing last 30 of ${actions.length})_`);
      sections.push(``);
    }
    sections.push(recentActions.join("\n"));
    sections.push(``);
  }

  // Extract the last few assistant text outputs (most recent thinking/decisions)
  const assistantTexts: string[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "text" && block.text.trim()) {
          assistantTexts.push(block.text);
        }
      }
    }
  }
  if (assistantTexts.length > 0) {
    sections.push(`## Last Assistant Output`);
    sections.push(``);
    // Only the last one, truncated — keep the beginning (plan/summary) rather than the end
    const last = assistantTexts[assistantTexts.length - 1];
    const truncated = last.length > 2000 ? last.slice(0, 2000) + "\n\n_(truncated)_" : last;
    sections.push(truncated);
    sections.push(``);
  }

  // Extract any file paths that were read or written (from exec/read/write tool calls)
  const filesRead = new Set<string>();
  const filesWritten = new Set<string>();
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "toolCall") {
          const args = block.arguments as Record<string, unknown>;
          if (block.name === "read" && typeof args.path === "string") {
            filesRead.add(args.path);
          }
          if (block.name === "write" && typeof args.path === "string") {
            filesWritten.add(args.path);
          }
        }
      }
    }
  }
  if (filesRead.size > 0 || filesWritten.size > 0) {
    sections.push(`## Files Touched`);
    sections.push(``);
    if (filesRead.size > 0) {
      sections.push(`### Read`);
      for (const f of filesRead) sections.push(`- ${f}`);
      sections.push(``);
    }
    if (filesWritten.size > 0) {
      sections.push(`### Written`);
      for (const f of filesWritten) sections.push(`- ${f}`);
      sections.push(``);
    }
  }

  // Error info
  sections.push(`## Error`);
  sections.push(``);
  sections.push("```");
  sections.push(error);
  sections.push("```");
  sections.push(``);

  return sections.join("\n");
}

/**
 * Write progress.md to the agent's workspace directory.
 * Creates the directory if it doesn't exist.
 */
export function writeProgressFile(workspace: string, content: string): void {
  mkdirSync(workspace, { recursive: true });
  const filePath = join(workspace, "progress.md");
  writeFileSync(filePath, content, "utf-8");
}
