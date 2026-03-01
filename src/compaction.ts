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

/**
 * Summarize a block of messages into a compact text summary.
 * This is a structural extraction, not LLM-based — fast and deterministic.
 */
function summarizeMessages(messages: AgentMessage[]): string {
  const parts: string[] = [];

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
      const preview = text.slice(0, 150);
      const errMark = trMsg.isError ? " ERROR" : "";
      parts.push(`[${trMsg.toolName}${errMark}] ${preview}`);
    }
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

  const triggerTokens = Math.floor(contextWindow * threshold);
  const keepTokens = Math.floor(contextWindow * keepRatio);

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

    // Accumulate with previous summaries
    if (accumulatedSummary) {
      accumulatedSummary = `${accumulatedSummary}\n\n--- (compacted) ---\n\n${newSummary}`;
    } else {
      accumulatedSummary = newSummary;
    }

    compactionCount++;

    // Create a synthetic user message with the compacted context
    const summaryMessage: UserMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `[COMPACTED CONTEXT — earlier conversation summarized to save space]`,
            ``,
            accumulatedSummary,
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
