import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { UserMessage, ToolResultMessage, Model } from "@mariozechner/pi-ai";

// ── Token estimation ───────────────────────────────────────────────────
//
// Rough approximation: 1 token ≈ 3 chars for mixed content (JSON, code,
// tool calls). This is intentionally conservative (overestimates token
// count) so we compact before actually hitting the limit. Previous value
// of 4 chars/token underestimated, causing context overflow on LLM calls.

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

function messageTokens(msg: AgentMessage): number {
  if (typeof msg.content === "string") return estimateTokens(msg.content);
  if (Array.isArray(msg.content)) {
    let total = 0;
    for (const block of msg.content) {
      if (!block) continue;
      if (block.type === "text") {
        total += estimateTokens(block.text);
      } else if (block.type === "toolCall") {
        total += estimateTokens(block.name) + estimateTokens(JSON.stringify(block.arguments));
      } else if (block.type === "thinking") {
        total += estimateTokens(block.thinking);
      } else if (block.type === "image") {
        total += 1000; // rough estimate for images
      }
    }
    return total;
  }
  return 0;
}

function totalTokens(messages: AgentMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += messageTokens(msg);
  }
  return total;
}

// ── Compaction ──────────────────────────────────────────────────────────

/** Minimum length for an assistant text block to be considered "substantial" reasoning. */
const SUBSTANTIAL_TEXT_MIN_LENGTH = 100;

/**
 * Maximum length for the preserved reasoning block.
 * Keeps the cost bounded — even the longest reasoning gets capped.
 */
const REASONING_MAX_LENGTH = 2000;

/**
 * Preview length for tool result text in compaction summaries.
 * Errors get more space since they're critical for debugging.
 */
const TOOL_RESULT_PREVIEW_OK = 200;
const TOOL_RESULT_PREVIEW_ERROR = 300;

/**
 * Maximum fraction of the context window that the accumulated summary may consume.
 * When the accumulated summary exceeds this budget (in characters), the oldest
 * compaction sections are trimmed so the summary doesn't crowd out recent messages.
 *
 * 0.15 means the summary may use at most 15% of the context window.
 * For a 200K context window, that's ~30K tokens (~120K chars) — plenty for
 * summaries but prevents unbounded growth across many compaction rounds.
 */
const SUMMARY_BUDGET_FRACTION = 0.15;

/**
 * Minimum summary budget in characters, regardless of context window size.
 * Ensures summaries have enough space even with tiny context windows (e.g., in tests).
 * 8000 chars ≈ 2000 tokens — enough for several compaction rounds of key info.
 */
const MIN_SUMMARY_BUDGET_CHARS = 8000;

/**
 * Maximum number of exec commands to track in key facts.
 * Keeps the key facts section bounded; oldest commands are dropped when exceeded.
 */
const MAX_EXEC_COMMANDS_IN_FACTS = 15;

/**
 * Maximum display length for an exec command in key facts.
 * Long commands (e.g., with inline scripts) are truncated to this length.
 */
const EXEC_COMMAND_DISPLAY_LENGTH = 120;

/**
 * Maximum length for the original task preserved in compacted context.
 * Tasks longer than this are truncated with an ellipsis marker.
 * 500 chars ≈ 125 tokens — enough for detailed multi-paragraph tasks
 * while keeping the compacted header bounded.
 */
const ORIGINAL_TASK_MAX_LENGTH = 500;

/**
 * Structured key facts extracted from messages.
 * Using structured data allows proper merging across compaction rounds
 * (e.g., unioning file sets instead of duplicating "Files read: ..." lines).
 */
export interface KeyFacts {
  filesRead: Set<string>;
  filesWritten: Set<string>;
  /** Exec commands run, with their outcome. Ordered oldest-first. */
  execCommands: Array<{ command: string; failed: boolean }>;
}

/**
 * Extract key facts from messages: file paths accessed, exec commands run
 * and their outcomes. These survive summary trimming because they help
 * the agent avoid re-reading files or repeating commands after compaction.
 */
export function extractKeyFacts(messages: AgentMessage[]): KeyFacts {
  const filesRead = new Set<string>();
  const filesWritten = new Set<string>();
  const execCommands: Array<{ command: string; failed: boolean }> = [];

  // Build a map from toolCall IDs to exec commands so we can pair with results
  const pendingExecCalls = new Map<string, string>(); // toolCallId → command

  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || block.type !== "toolCall") continue;
        const args = block.arguments as Record<string, any>;

        if (block.name === "read" && args.path) {
          filesRead.add(args.path);
        } else if (block.name === "write" && args.path) {
          filesWritten.add(args.path);
        } else if (block.name === "exec" && args.command) {
          pendingExecCalls.set(block.id, args.command);
        }
      }
    } else if (msg.role === "toolResult") {
      const trMsg = msg as ToolResultMessage;
      if (trMsg.toolName === "exec" && pendingExecCalls.has(trMsg.toolCallId)) {
        const command = pendingExecCalls.get(trMsg.toolCallId)!;
        pendingExecCalls.delete(trMsg.toolCallId);
        execCommands.push({ command, failed: !!trMsg.isError });
      }
    }
  }

  // Any exec calls without a paired result (shouldn't happen normally, but be safe)
  for (const [_id, command] of pendingExecCalls) {
    execCommands.push({ command, failed: false });
  }

  return { filesRead, filesWritten, execCommands };
}

/**
 * Merge new key facts into accumulated facts, deduplicating properly.
 * - File sets are unioned.
 * - Exec commands are appended (deduped by command string), capped at MAX_EXEC_COMMANDS_IN_FACTS.
 */
export function mergeKeyFacts(accumulated: KeyFacts, newFacts: KeyFacts): KeyFacts {
  const filesRead = new Set([...accumulated.filesRead, ...newFacts.filesRead]);
  const filesWritten = new Set([...accumulated.filesWritten, ...newFacts.filesWritten]);

  // Merge exec commands, deduplicating by command string (keep latest outcome)
  const seen = new Map<string, { command: string; failed: boolean }>();
  for (const cmd of accumulated.execCommands) {
    seen.set(cmd.command, cmd);
  }
  for (const cmd of newFacts.execCommands) {
    seen.set(cmd.command, cmd); // newer outcome overwrites older
  }

  // Convert back to array, keeping order (accumulated first, then new), capped
  let execCommands = [...seen.values()];
  if (execCommands.length > MAX_EXEC_COMMANDS_IN_FACTS) {
    // Drop oldest commands (keep the most recent ones)
    execCommands = execCommands.slice(execCommands.length - MAX_EXEC_COMMANDS_IN_FACTS);
  }

  return { filesRead, filesWritten, execCommands };
}

/**
 * Format key facts into display lines for the compacted context header.
 */
export function formatKeyFacts(facts: KeyFacts): string[] {
  const lines: string[] = [];

  if (facts.filesRead.size > 0) {
    lines.push(`Files read: ${[...facts.filesRead].join(", ")}`);
    lines.push(
      `⚠️ File contents from before compaction are SUMMARIZED, not exact. Re-read any file before overwriting it.`,
    );
  }
  if (facts.filesWritten.size > 0) {
    lines.push(`Files written: ${[...facts.filesWritten].join(", ")}`);
  }
  if (facts.execCommands.length > 0) {
    lines.push(`Exec commands run:`);
    for (const cmd of facts.execCommands) {
      const display =
        cmd.command.length > EXEC_COMMAND_DISPLAY_LENGTH
          ? cmd.command.slice(0, EXEC_COMMAND_DISPLAY_LENGTH) + "…"
          : cmd.command;
      const status = cmd.failed ? "FAILED" : "ok";
      lines.push(`  [${status}] ${display}`);
    }
  }

  return lines;
}

/**
 * Create an empty KeyFacts object.
 */
function emptyKeyFacts(): KeyFacts {
  return { filesRead: new Set(), filesWritten: new Set(), execCommands: [] };
}

/**
 * Extract the text content from the first user message in a conversation.
 * This is the original task that was assigned to the agent.
 *
 * Handles both string content and array content formats.
 * Returns null if no user message is found or the message has no text.
 */
export function extractOriginalTask(messages: AgentMessage[]): string | null {
  for (const msg of messages) {
    if (msg.role === "user") {
      if (typeof msg.content === "string") return msg.content.trim() || null;
      if (Array.isArray(msg.content)) {
        const text = msg.content
          .filter((b): b is { type: "text"; text: string } => b?.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
        return text || null;
      }
      return null;
    }
  }
  return null;
}

/**
 * Summarize a block of messages into a compact text summary.
 * This is a structural extraction, not LLM-based — fast and deterministic.
 *
 * In addition to the structural log of tool calls and results, the last
 * substantial assistant text block (reasoning, diagnosis, plan) is preserved
 * verbatim at the end. This keeps the most important context — the model's
 * most recent thinking — across compaction boundaries.
 */
function summarizeMessages(messages: AgentMessage[]): string {
  const parts: string[] = [];
  let lastSubstantialText = "";

  for (const msg of messages) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : (msg.content as Array<{ type: string; text?: string }>)
              .filter((b): b is { type: "text"; text: string } => b?.type === "text")
              .map((b) => b.text)
              .join(" ");
      if (text.trim()) {
        parts.push(`[User] ${text.slice(0, 200)}`);
      }
    } else if (msg.role === "assistant") {
      // Extract text blocks and tool call names
      const texts: string[] = [];
      const tools: string[] = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text.trim()) {
            texts.push(block.text.slice(0, 200));
            // Track the last substantial reasoning block
            if (block.text.trim().length >= SUBSTANTIAL_TEXT_MIN_LENGTH) {
              lastSubstantialText = block.text.trim();
            }
          } else if (block.type === "toolCall") {
            tools.push(block.name);
          }
        }
      }
      if (texts.length > 0 || tools.length > 0) {
        let line = "[Assistant]";
        if (texts.length > 0) line += ` ${texts.join(" | ")}`;
        if (tools.length > 0) line += ` [tools: ${tools.join(", ")}]`;
        parts.push(line);
      }
    } else if (msg.role === "toolResult") {
      const trMsg = msg as ToolResultMessage;
      const text = trMsg.content
        .filter((b): b is { type: "text"; text: string } => b?.type === "text")
        .map((b) => b.text)
        .join(" ");
      // Errors get more preview space — they're critical for debugging
      const previewLen = trMsg.isError ? TOOL_RESULT_PREVIEW_ERROR : TOOL_RESULT_PREVIEW_OK;
      const preview = text.slice(0, previewLen);
      const errMark = trMsg.isError ? " ERROR" : "";
      parts.push(`[${trMsg.toolName}${errMark}] ${preview}`);
    }
  }

  // Append the last substantial reasoning block verbatim.
  // This preserves the model's most recent diagnosis, plan, or decision
  // that would otherwise be truncated to 200 chars in the structural log.
  if (lastSubstantialText) {
    const capped =
      lastSubstantialText.length > REASONING_MAX_LENGTH
        ? lastSubstantialText.slice(0, REASONING_MAX_LENGTH) + "\n\n_(reasoning truncated)_"
        : lastSubstantialText;
    parts.push("");
    parts.push("[Last reasoning before compaction]");
    parts.push(capped);
  }

  return parts.join("\n");
}

/**
 * Find the boundary between "old" and "recent" messages.
 * We keep the most recent N tokens of conversation intact and
 * compact everything before that boundary.
 *
 * Returns the index at which to split: messages[0..splitAt) get compacted,
 * messages[splitAt..] stay intact.
 */
function findSplitPoint(messages: AgentMessage[], keepTokens: number): number {
  // Walk backward from the end, counting tokens until we reach the keep budget
  let tokenBudget = keepTokens;
  let splitAt = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = messageTokens(messages[i]);
    if (tokenBudget - cost < 0 && splitAt < messages.length) break;
    tokenBudget -= cost;
    splitAt = i;
  }

  // Don't split in the middle of a tool call / tool result pair.
  // Walk forward from splitAt until we're at a clean boundary
  // (a user message or the start of an assistant turn).
  while (splitAt < messages.length) {
    const msg = messages[splitAt];
    if (msg.role === "user") break;
    if (msg.role === "assistant") break;
    splitAt++;
  }

  // Must compact at least something — if splitAt is 0 or 1, don't compact
  if (splitAt <= 1) return 0;

  return splitAt;
}

/**
 * Trim the accumulated summary to fit within a character budget.
 *
 * When multiple compaction rounds accumulate, the oldest sections are
 * dropped first (they're least relevant). The key facts section is
 * preserved and merged so the agent always knows which files were
 * accessed across all compaction rounds.
 *
 * Sections are delimited by `--- (compacted) ---` markers.
 *
 * @param summary - The full accumulated summary
 * @param maxChars - Maximum character length for the summary
 * @returns The trimmed summary, or the original if within budget
 */
export function trimAccumulatedSummary(summary: string, maxChars: number): string {
  if (summary.length <= maxChars) return summary;

  // Split into compaction sections (oldest first)
  const sections = summary.split(/\n\n--- \(compacted\) ---\n\n/);

  if (sections.length <= 1) {
    // Single section — can't trim by section, just truncate
    return summary.slice(0, maxChars) + "\n\n_(earlier context trimmed)_";
  }

  // Keep sections from newest to oldest until we exceed budget
  // Newest section is last in the array
  const kept: string[] = [];
  let currentLen = 0;
  const separator = "\n\n--- (compacted) ---\n\n";
  const trimNotice = "_(earlier compaction rounds trimmed — key context preserved below)_";
  const trimNoticeLen = trimNotice.length + separator.length;

  for (let i = sections.length - 1; i >= 0; i--) {
    const sectionLen = sections[i].length + (kept.length > 0 ? separator.length : 0);
    if (currentLen + sectionLen + (i > 0 ? trimNoticeLen : 0) > maxChars && kept.length > 0) {
      // This section would push us over budget — stop here
      break;
    }
    kept.unshift(sections[i]);
    currentLen += sectionLen;
  }

  // If we dropped any sections, prepend a notice
  if (kept.length < sections.length) {
    return `${trimNotice}\n\n--- (compacted) ---\n\n${kept.join(separator)}`;
  }

  // Shouldn't happen, but if somehow all sections fit, return as-is
  return kept.join(separator);
}

export interface CompactionOptions {
  /**
   * Fraction of contextWindow at which compaction triggers.
   * Default: 0.7 (compact when messages exceed 70% of context window).
   */
  threshold?: number;

  /**
   * Fraction of contextWindow to keep as recent messages.
   * Default: 0.4 (keep the most recent 40% of context window intact).
   */
  keepRatio?: number;

  /**
   * Called when compaction occurs, for logging/diagnostics.
   */
  onCompact?: (info: CompactionInfo) => void;
}

export interface CompactionInfo {
  /** Total estimated tokens before compaction. */
  tokensBefore: number;
  /** Total estimated tokens after compaction. */
  tokensAfter: number;
  /** Number of messages compacted into summary. */
  messagesCompacted: number;
  /** Number of messages kept intact. */
  messagesKept: number;
  /** Number of compaction rounds so far in this session. */
  compactionCount: number;
}

/**
 * Create a transformContext function that compacts old messages
 * when the conversation exceeds a fraction of the context window.
 *
 * The transform:
 * 1. Estimates total token usage
 * 2. If above threshold, splits messages into old + recent
 * 3. Summarizes old messages into a compact text block
 * 4. Prepends the summary as a system-injected user message
 * 5. Returns summary + recent messages
 *
 * The original task (first user message) is always preserved prominently
 * in the compacted context header. This prevents the agent from losing
 * track of what it was asked to do after compaction — a critical failure
 * mode where the agent starts working on the wrong thing or asks the
 * user to repeat the task.
 *
 * The accumulated summary is capped at 15% of the context window
 * (with a minimum of 8000 chars). When it exceeds this budget, the
 * oldest compaction sections are trimmed. This prevents "summary bloat"
 * where repeated compactions cause the summary itself to consume
 * an ever-growing fraction of the context window.
 *
 * Key facts (files read/written, exec commands run) are tracked
 * separately and always preserved, so the agent doesn't re-read files
 * or repeat commands after compaction.
 *
 * The original messages on the Agent are NOT modified — transformContext
 * only affects what gets sent to the LLM. The full conversation is
 * still persisted to JSONL.
 */
export function createCompactionTransform(
  model: Model<any>,
  opts?: CompactionOptions,
): (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]> {
  const threshold = opts?.threshold ?? 0.7;
  const keepRatio = opts?.keepRatio ?? 0.4;
  const onCompact = opts?.onCompact;
  const contextWindow = model.contextWindow;

  // Track how many times we've compacted (across calls)
  let compactionCount = 0;
  // Accumulate previous summaries so context isn't lost across multiple compactions
  let accumulatedSummary = "";
  // Accumulate key facts (files read/written, commands run) across all compaction rounds
  let accumulatedKeyFacts: KeyFacts = emptyKeyFacts();
  // Cache the original task from the first user message — persists across compaction rounds
  let cachedOriginalTask: string | null | undefined = undefined; // undefined = not yet extracted

  const triggerTokens = Math.floor(contextWindow * threshold);
  const keepTokens = Math.floor(contextWindow * keepRatio);

  // Budget for accumulated summary: fraction of context window in chars (×3),
  // with a minimum to ensure summaries aren't immediately trimmed in small contexts
  const summaryBudgetChars = Math.max(
    MIN_SUMMARY_BUDGET_CHARS,
    Math.floor(contextWindow * SUMMARY_BUDGET_FRACTION * 3),
  );

  return async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    const currentTokens = totalTokens(messages);

    if (currentTokens < triggerTokens) {
      return messages;
    }

    // Safety ceiling: if after compaction we're still above 85% of context
    // window, compact again with a tighter keepTokens budget. This handles
    // estimation drift where our char-based token estimate underestimates
    // the real LLM token count.
    const safetyCeiling = Math.floor(contextWindow * 0.85);
    let effectiveKeepTokens = keepTokens;
    let result = messages;

    // Allow up to 3 compaction passes to get under the safety ceiling
    for (let pass = 0; pass < 3; pass++) {
      const passTokens = totalTokens(result);
      if (pass > 0 && passTokens < safetyCeiling) break;
      if (pass === 0 && passTokens < triggerTokens) break;

      // Find where to split
      const splitAt = findSplitPoint(result, effectiveKeepTokens);
      if (splitAt <= 0) break; // nothing to compact

      const oldMessages = result.slice(0, splitAt);
      const recentMessages = result.slice(splitAt);

      // Extract original task on first compaction (from full message history).
      // Cache it so it survives across compaction rounds — once compacted,
      // the original first user message is gone from the messages array.
      if (cachedOriginalTask === undefined) {
        cachedOriginalTask = extractOriginalTask(result);
      }

      // Build the summary
      const newSummary = summarizeMessages(oldMessages);

      // Extract and merge key facts
      const newFacts = extractKeyFacts(oldMessages);
      accumulatedKeyFacts = mergeKeyFacts(accumulatedKeyFacts, newFacts);

      // Accumulate with previous summaries
      if (accumulatedSummary) {
        accumulatedSummary = `${accumulatedSummary}\n\n--- (compacted) ---\n\n${newSummary}`;
      } else {
        accumulatedSummary = newSummary;
      }

      // Trim accumulated summary if it exceeds the budget
      // This prevents unbounded growth across many compaction rounds
      if (accumulatedSummary.length > summaryBudgetChars) {
        accumulatedSummary = trimAccumulatedSummary(accumulatedSummary, summaryBudgetChars);
      }

      compactionCount++;

      // Build the original task block (always preserved, never trimmed).
      // This is the single most important piece of context after compaction —
      // without it, agents can lose track of what they were asked to do.
      let originalTaskBlock = "";
      if (cachedOriginalTask) {
        const taskText =
          cachedOriginalTask.length > ORIGINAL_TASK_MAX_LENGTH
            ? cachedOriginalTask.slice(0, ORIGINAL_TASK_MAX_LENGTH) + "…"
            : cachedOriginalTask;
        originalTaskBlock = `[Original task]\n${taskText}\n\n`;
      }

      // Build the key facts header (always preserved, not subject to trimming)
      const keyFactLines = formatKeyFacts(accumulatedKeyFacts);
      const keyFactsBlock =
        keyFactLines.length > 0 ? `[Key facts across compaction rounds]\n${keyFactLines.join("\n")}\n\n` : "";

      // Create a synthetic user message with the compacted context
      const summaryMessage: UserMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `[COMPACTED CONTEXT — earlier conversation summarized to save space]`,
              ``,
              originalTaskBlock + keyFactsBlock + accumulatedSummary,
              ``,
              `[END COMPACTED CONTEXT — conversation continues below]`,
            ].join("\n"),
          },
        ],
        timestamp: oldMessages[0]?.timestamp ?? Date.now(),
      };

      result = [summaryMessage as AgentMessage, ...recentMessages];

      if (onCompact) {
        onCompact({
          tokensBefore: pass === 0 ? currentTokens : passTokens,
          tokensAfter: totalTokens(result),
          messagesCompacted: oldMessages.length,
          messagesKept: recentMessages.length,
          compactionCount,
        });
      }

      // On subsequent passes, keep less to ensure we get under the ceiling
      effectiveKeepTokens = Math.floor(effectiveKeepTokens * 0.6);
    }

    return result;
  };
}
