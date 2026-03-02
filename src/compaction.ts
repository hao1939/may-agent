import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, AssistantMessage, UserMessage, ToolResultMessage, Model } from "@mariozechner/pi-ai";

// ── Token estimation ───────────────────────────────────────────────────
//
// Rough approximation: 1 token ≈ 4 chars for English text.
// This is intentionally conservative (overestimates) so we compact
// before actually hitting the limit.

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function messageTokens(msg: AgentMessage): number {
  if (typeof msg.content === "string") return estimateTokens(msg.content);
  if (Array.isArray(msg.content)) {
    let total = 0;
    for (const block of msg.content) {
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
 * Extract key facts from messages: file paths accessed, commands run,
 * and critical decisions. These survive summary trimming because they
 * help the agent avoid re-reading files or repeating commands.
 */
function extractKeyFacts(messages: AgentMessage[]): string[] {
  const facts: string[] = [];
  const filesRead = new Set<string>();
  const filesWritten = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type !== "toolCall") continue;
      const args = block.arguments as Record<string, any>;

      if (block.name === "read" && args.path) {
        filesRead.add(args.path);
      } else if (block.name === "write" && args.path) {
        filesWritten.add(args.path);
      }
    }
  }

  if (filesRead.size > 0) {
    facts.push(`Files read: ${[...filesRead].join(", ")}`);
  }
  if (filesWritten.size > 0) {
    facts.push(`Files written: ${[...filesWritten].join(", ")}`);
  }

  return facts;
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
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
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
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
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
    const capped = lastSubstantialText.length > REASONING_MAX_LENGTH
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
 * The accumulated summary is capped at 15% of the context window
 * (with a minimum of 8000 chars). When it exceeds this budget, the
 * oldest compaction sections are trimmed. This prevents "summary bloat"
 * where repeated compactions cause the summary itself to consume
 * an ever-growing fraction of the context window.
 *
 * Key facts (files read/written) are tracked separately and always
 * preserved, so the agent doesn't re-read files after compaction.
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
  // Accumulate key facts (files read/written) across all compaction rounds
  let accumulatedKeyFacts: string[] = [];

  const triggerTokens = Math.floor(contextWindow * threshold);
  const keepTokens = Math.floor(contextWindow * keepRatio);

  // Budget for accumulated summary: fraction of context window in chars (×4),
  // with a minimum to ensure summaries aren't immediately trimmed in small contexts
  const summaryBudgetChars = Math.max(
    MIN_SUMMARY_BUDGET_CHARS,
    Math.floor(contextWindow * SUMMARY_BUDGET_FRACTION * 4),
  );

  return async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    const currentTokens = totalTokens(messages);

    if (currentTokens < triggerTokens) {
      return messages;
    }

    // Find where to split
    const splitAt = findSplitPoint(messages, keepTokens);
    if (splitAt <= 0) return messages; // nothing to compact

    const oldMessages = messages.slice(0, splitAt);
    const recentMessages = messages.slice(splitAt);

    // Build the summary
    const newSummary = summarizeMessages(oldMessages);

    // Extract and accumulate key facts
    const newFacts = extractKeyFacts(oldMessages);
    for (const fact of newFacts) {
      if (!accumulatedKeyFacts.includes(fact)) {
        accumulatedKeyFacts.push(fact);
      }
    }

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

    // Build the key facts header (always preserved, not subject to trimming)
    const keyFactsBlock = accumulatedKeyFacts.length > 0
      ? `[Key facts across compaction rounds]\n${accumulatedKeyFacts.join("\n")}\n\n`
      : "";

    // Create a synthetic user message with the compacted context
    const summaryMessage: UserMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `[COMPACTED CONTEXT — earlier conversation summarized to save space]`,
            ``,
            keyFactsBlock + accumulatedSummary,
            ``,
            `[END COMPACTED CONTEXT — conversation continues below]`,
          ].join("\n"),
        },
      ],
      timestamp: oldMessages[0]?.timestamp ?? Date.now(),
    };

    const result = [summaryMessage as AgentMessage, ...recentMessages];

    if (onCompact) {
      onCompact({
        tokensBefore: currentTokens,
        tokensAfter: totalTokens(result),
        messagesCompacted: oldMessages.length,
        messagesKept: recentMessages.length,
        compactionCount,
      });
    }

    return result;
  };
}
