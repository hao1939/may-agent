/**
 * Infrastructure retry logic — extracted from manager.ts for maintainability.
 *
 * Implements P93 Resilience Pattern: automatic retry on transient infrastructure
 * errors (empty responses, missing tool calls).
 *
 * All functions are standalone and take their dependencies as parameters.
 * The SubagentManager delegates isRetryableInfraError / runAgentWithRetry here.
 */

import { isOverflowError } from "./overflow.js";
import { INFRA_RETRY_BASE_DELAY_MS } from "./manager-utils.js";
import type { ActiveSession } from "./manager-utils.js";

/** Case-insensitive rate limit / throttle detection. */
const RATE_LIMIT_RE = /rate.?limit|throttl/i;

/** Check whether an error string indicates a rate limit or throttling issue. */
export function isRateLimitError(error: string): boolean {
  return error.includes("429") || RATE_LIMIT_RE.test(error);
}

/**
 * Detect whether a session's last exchange indicates a transient infra error
 * that is safe to retry (vs. a real agent failure or context overflow).
 *
 * Returns a reason string if retryable, null otherwise.
 *
 * Detection patterns:
 *   - "empty_response": last message is user (silent stream error) or
 *     assistant with no text/toolCall content (0 output tokens).
 *   - "tool_use_missing": stopReason=toolUse but no tool calls in content.
 */
export function isRetryableInfraError(session: ActiveSession): string | null {
  if (session.closed) return null;
  if (session.status !== "running") return null;

  const messages = session.agent.state.messages;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  if (!lastMsg) return null;

  // Check if error was an abort — never retry aborts
  const agentError = session.agent.state.error ?? session.error;
  if (agentError?.includes("aborted")) return null;

  // Check for context overflow — never retry, won't help
  if (agentError && isOverflowError(agentError)) return null;

  // Pattern 4: JSON parse / stream corruption errors — transient proxy/network issues
  if (agentError) {
    const isJsonStreamError =
      agentError.includes("Unexpected end of JSON") ||
      agentError.includes("JSON Parse error") ||
      agentError.includes("Unexpected non-whitespace character after JSON") ||
      agentError.includes("Unexpected event order");
    if (isJsonStreamError) {
      return "json_stream_error";
    }
  }

  // Pattern 5: HTTP/rate limit errors — transient server or throttling issues
  // 429 rate limits are the #1 error source (~53% of all session errors).
  // Also catch 502/503/500 gateway errors, connection resets, and timeouts.
  if (agentError) {
    const isHttpRetryable =
      isRateLimitError(agentError) ||
      agentError.includes("502") ||
      agentError.includes("503") ||
      agentError.includes("500 ") ||
      agentError.includes("ECONNRESET") ||
      agentError.includes("ETIMEDOUT") ||
      agentError.includes("socket hang up");
    if (isHttpRetryable) {
      return "http_retryable";
    }
  }

  // Pattern 1: Silent stream error — last message is user (no assistant reply at all)
  if (!agentError && lastMsg.role === "user") {
    return "empty_response";
  }

  // Pattern 2: Empty assistant response (0 output tokens)
  if (lastMsg.role === "assistant") {
    const content = Array.isArray(lastMsg.content) ? lastMsg.content : [];
    const hasSubstance = content.some(
      (block: any) =>
        (block?.type === "text" && block.text?.trim()) ||
        block?.type === "toolCall",
    );
    if (!hasSubstance) {
      return "empty_response";
    }

    // Pattern 3: stopReason toolUse but no tool calls
    if ((lastMsg as any).stopReason === "toolUse") {
      const toolCalls = content.filter((b: any) => b?.type === "toolCall");
      if (toolCalls.length === 0) {
        return "tool_use_missing";
      }
    }
  }

  return null;
}

/**
 * Maximum delay (ms) for any single retry. Caps exponential growth.
 * Without this, attempt 10 would be 512s (~8.5 minutes).
 */
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Run an agent call (prompt or continue) with automatic retry on transient
 * infrastructure errors (P93 Resilience Pattern).
 *
 * On retryable failure: removes the bad assistant message (if any), clears
 * error state, waits with exponential backoff + jitter, and calls agent.continue().
 * Rate limit errors (429) use longer base delays (15s vs 1s).
 * After infraRetryMax failures, falls through to onComplete().
 */
export async function runAgentWithRetry(
  session: ActiveSession,
  initialCall: Promise<void>,
  infraRetryMax: number,
  onComplete: (session: ActiveSession) => void,
): Promise<void> {
  // Run the initial call
  try {
    await initialCall;
  } catch (err) {
    session.error = (err as Error)?.message ?? String(err);
  }

  // Retry loop for transient infrastructure errors
  while (session.infraRetryCount < infraRetryMax) {
    const retryReason = isRetryableInfraError(session);
    if (!retryReason) break;

    session.infraRetryCount++;
    const attempt = session.infraRetryCount;

    // Log the retry
    console.warn(
      `[manager] Infrastructure retry ${attempt}/${infraRetryMax} for session ${session.sessionId} (${retryReason})`,
    );

    // Clean up bad state: remove empty/malformed assistant message
    const messages = session.agent.state.messages;
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastMsg?.role === "assistant") {
      messages.pop();
      session.agent.replaceMessages(messages);
    }

    // Guard: after popping, ensure we don't end on an assistant message
    // (would cause "Cannot continue from message role: assistant" error).
    // If the list is empty or still ends with assistant, inject a retry prompt.
    const lastAfterPop = messages.length > 0 ? messages[messages.length - 1] : null;
    if (!lastAfterPop || lastAfterPop.role === "assistant") {
      session.agent.appendMessage({
        role: "user",
        content: [{ type: "text", text: "Please continue." }],
        timestamp: Date.now(),
      });
    }

    // Rate-limit errors (429) need much longer backoff than stream errors.
    // Capture error text BEFORE clearing it for the rate-limit check.
    // Rate limit: 15s, 30s, 30s, 30s, 30s (capped at MAX_RETRY_DELAY_MS)
    // Stream errors: 1s, 2s, 4s, 8s, 16s
    const errorText = session.error ?? session.agent.state.error ?? "";
    const rateLimit = retryReason === "http_retryable" && isRateLimitError(errorText);

    // Clear error state for the retry
    session.error = undefined;
    session.agent.state.error = undefined;

    const baseDelay = rateLimit ? 15_000 : INFRA_RETRY_BASE_DELAY_MS;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
    const jitter = Math.floor(Math.random() * (rateLimit ? 5000 : 500));
    const delayMs = exponentialDelay + jitter;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Guard: session may have been closed/aborted during the delay
    if (session.closed) return;

    // Retry via agent.continue()
    try {
      await session.agent.continue();
    } catch (err) {
      session.error = (err as Error)?.message ?? String(err);
    }
  }

  // All retries exhausted (or no retry needed) — run normal completion
  onComplete(session);
}
