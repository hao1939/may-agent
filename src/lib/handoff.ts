import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { TaskResult } from "./types.js";
import { extractKeyFacts } from "./compaction.js";

// ── Configuration ──────────────────────────────────────────────────────

/** Maximum length for the agent's final response text in the handoff summary. */
const MAX_RESPONSE_LENGTH = 3000;

/** Maximum length for individual error previews. */
const MAX_ERROR_PREVIEW = 300;

/** Maximum number of errors to include in the summary. */
const MAX_ERRORS = 5;

/** Maximum length for each write-tool content preview. */
const MAX_WRITE_PREVIEW = 200;

/** Maximum number of exec commands to show in the handoff. */
const MAX_EXEC_COMMANDS = 20;

/** Maximum display length for exec commands. */
const MAX_COMMAND_LENGTH = 150;

// ── Types ──────────────────────────────────────────────────────────────

/**
 * Options for customizing the handoff summary.
 */
export interface HandoffOptions {
  /** Include the agent's final response text. Default: true. */
  includeResponse?: boolean;
  /** Include key facts (files read/written, exec commands). Default: true. */
  includeKeyFacts?: boolean;
  /** Include error summaries. Default: true. */
  includeErrors?: boolean;
  /** Include file content previews for written files. Default: false.
   *  When true, shows the first few lines of files written by the agent. */
  includeWriteContents?: boolean;
  /** Maximum total length of the handoff summary. Default: 8000. */
  maxLength?: number;
}

/**
 * Structured handoff data extracted from a completed session.
 * Use `formatHandoff()` to convert to a markdown string.
 */
export interface HandoffData {
  /** Agent status: "done" or "error". */
  status: string;
  /** Structured finish() status when the agent called finish(). */
  finishStatus?: string;
  /** Files that were read during the session. */
  filesRead: string[];
  /** Files that were written during the session. */
  filesWritten: string[];
  /** Exec commands run and their outcomes. */
  execCommands: Array<{ command: string; failed: boolean }>;
  /** Error messages from tool calls that failed. */
  errors: Array<{ tool: string; preview: string }>;
  /** The agent's final response text (truncated). */
  response: string | null;
  /** Duration of the session. */
  duration: string;
  /** Session ID for tracing. */
  sessionId: string;
  /** Previews of file contents that were written. */
  writeContents: Array<{ path: string; preview: string }>;
}

// ── Core extraction ────────────────────────────────────────────────────

/**
 * Extract structured handoff data from a completed TaskResult.
 *
 * Pulls together information that the next workflow step needs:
 * - Which files were read and written (from tool calls)
 * - What commands were run and whether they succeeded (from exec results)
 * - Any errors encountered (from tool results)
 * - The agent's final assessment (lastAssistantText)
 * - File content previews for written files (optional)
 *
 * This is a pure extraction — no LLM calls, deterministic, fast.
 */
export function extractHandoff(result: TaskResult, opts?: HandoffOptions): HandoffData {
  const includeWriteContents = opts?.includeWriteContents ?? false;
  const messages = result.messages;

  // Use the existing extractKeyFacts for files and exec commands
  const keyFacts = extractKeyFacts(messages);

  // Extract errors from tool results
  const errors = extractErrors(messages);

  // Extract write content previews if requested
  const writeContents = includeWriteContents ? extractWriteContents(messages) : [];

  return {
    status: result.status,
    finishStatus: result.finishResult?.status,
    filesRead: [...keyFacts.filesRead],
    filesWritten: [...keyFacts.filesWritten],
    execCommands: keyFacts.execCommands,
    errors,
    response: result.lastAssistantText,
    duration: result.duration,
    sessionId: result.sessionId,
    writeContents,
  };
}

/**
 * Extract error previews from tool result messages.
 *
 * Captures the first few errors that occurred during the session,
 * which helps the next step understand what went wrong and avoid
 * repeating the same mistakes.
 */
function extractErrors(messages: AgentMessage[]): Array<{ tool: string; preview: string }> {
  const errors: Array<{ tool: string; preview: string }> = [];

  for (const msg of messages) {
    if (msg.role !== "toolResult") continue;
    const tr = msg as ToolResultMessage;

    // Check for explicit error flag or tool-specific error patterns
    const text =
      tr.content
        ?.filter((b): b is { type: "text"; text: string } => b?.type === "text")
        .map((b) => b.text)
        .join(" ") ?? "";

    const isError =
      tr.isError ||
      text.startsWith("Error reading file:") ||
      text.startsWith("Error writing file:") ||
      /^(?:CWD:[^\n]*\n)?Exit code [^0]/.test(text);

    if (isError && text.trim()) {
      errors.push({
        tool: tr.toolName ?? "unknown",
        preview: text.slice(0, MAX_ERROR_PREVIEW),
      });
      if (errors.length >= MAX_ERRORS) break;
    }
  }

  return errors;
}

/**
 * Extract content previews from write tool calls.
 *
 * When the coder writes files, the reviewer needs to know what was written.
 * This extracts the first few lines of each written file's content.
 */
function extractWriteContents(messages: AgentMessage[]): Array<{ path: string; preview: string }> {
  const contents: Array<{ path: string; preview: string }> = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (!block || block.type !== "toolCall" || block.name !== "write") continue;
      const args = block.arguments as Record<string, unknown>;
      const path = typeof args.path === "string" ? args.path : null;
      const content = typeof args.content === "string" ? args.content : null;
      if (!path || !content) continue;

      // Keep only the latest write to each path
      if (seen.has(path)) {
        // Remove the old entry — we'll add the new one
        const idx = contents.findIndex((c) => c.path === path);
        if (idx >= 0) contents.splice(idx, 1);
      }
      seen.add(path);

      contents.push({
        path,
        preview: content.slice(0, MAX_WRITE_PREVIEW),
      });
    }
  }

  return contents;
}

// ── Formatting ─────────────────────────────────────────────────────────

/**
 * Format a TaskResult into a rich markdown summary for workflow step handoff.
 *
 * This is the primary function for passing context between workflow steps.
 * Instead of just passing `result.lastAssistantText`, this produces a
 * structured summary that includes files modified, commands run, errors
 * encountered, and the agent's final assessment.
 *
 * Usage in workflows:
 * ```ts
 * const coder = await ctx.runAgent("coder", ctx.task);
 * const reviewTask = `Review this implementation.\n\n` +
 *   `## Task\n${ctx.task}\n\n` +
 *   `## Implementation Summary\n${summarizeForHandoff(coder)}`;
 * const review = await ctx.runAgent("reviewer", reviewTask);
 * ```
 *
 * @param result - The completed TaskResult from a workflow step
 * @param opts - Options to customize what's included
 * @returns A markdown-formatted summary string
 */
export function summarizeForHandoff(result: TaskResult, opts?: HandoffOptions): string {
  const includeResponse = opts?.includeResponse ?? true;
  const includeKeyFacts = opts?.includeKeyFacts ?? true;
  const includeErrors = opts?.includeErrors ?? true;
  const maxLength = opts?.maxLength ?? 8000;

  const data = extractHandoff(result, opts);
  const sections: string[] = [];

  // Status line
  const statusLabel = data.finishStatus ? `${data.status} / finish(${data.finishStatus})` : data.status;
  sections.push(`**Status:** ${statusLabel} (${data.duration})`);

  // Key facts: files
  if (includeKeyFacts) {
    if (data.filesWritten.length > 0) {
      sections.push(`\n**Files modified:**`);
      for (const f of data.filesWritten) {
        sections.push(`- ${f}`);
      }
    }

    if (data.filesRead.length > 0) {
      // Only show files that were read but NOT written (written files are more important)
      const readOnly = data.filesRead.filter((f) => !data.filesWritten.includes(f));
      if (readOnly.length > 0) {
        sections.push(`\n**Files read (not modified):**`);
        for (const f of readOnly) {
          sections.push(`- ${f}`);
        }
      }
    }

    // Exec commands — show the important ones
    const cmds = data.execCommands.slice(-MAX_EXEC_COMMANDS);
    if (cmds.length > 0) {
      sections.push(`\n**Commands run:**`);
      for (const cmd of cmds) {
        const display =
          cmd.command.length > MAX_COMMAND_LENGTH ? cmd.command.slice(0, MAX_COMMAND_LENGTH) + "…" : cmd.command;
        const status = cmd.failed ? "❌" : "✓";
        sections.push(`- ${status} \`${display}\``);
      }
    }
  }

  // Errors
  if (includeErrors && data.errors.length > 0) {
    sections.push(`\n**Errors encountered:**`);
    for (const err of data.errors) {
      sections.push(`- [${err.tool}] ${err.preview}`);
    }
  }

  // Write content previews
  if (data.writeContents.length > 0) {
    sections.push(`\n**File content previews:**`);
    for (const wc of data.writeContents) {
      sections.push(`- ${wc.path}: \`${wc.preview.replace(/\n/g, "\\n").slice(0, 100)}…\``);
    }
  }

  // Agent's final response
  if (includeResponse && data.response) {
    const response =
      data.response.length > MAX_RESPONSE_LENGTH
        ? data.response.slice(0, MAX_RESPONSE_LENGTH) + "\n\n_(response truncated)_"
        : data.response;
    sections.push(`\n**Agent response:**\n${response}`);
  }

  let output = sections.join("\n");

  // Final length cap
  if (output.length > maxLength) {
    output = output.slice(0, maxLength) + "\n\n_(handoff summary truncated)_";
  }

  return output;
}
