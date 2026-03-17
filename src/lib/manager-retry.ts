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
 * Check if the `finish` tool was called successfully in the session.
 * After `finish`, empty responses are normal — the model has nothing left to say.
 */
export function hasFinishToolCall(messages: any[]): boolean {
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "toolCall" && block.name === "finish") {
          return true;
        }
      }
    }
  }
  return false;
}

/** Extract the params from the last finish() tool call, if any. */
export function extractFinishParams(messages: any[]): { status: string; summary: string; blockers?: { reason: string; context: string }[]; deliverables?: { path: string; description: string }[]; next_steps?: string; completed_items?: string[]; new_items?: string[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type === "toolCall" && block.name === "finish" && block.args) {
          try {
            const args = typeof block.args === "string" ? JSON.parse(block.args) : block.args;
            return { status: args.status, summary: args.summary, blockers: args.blockers, deliverables: args.deliverables, next_steps: args.next_steps, completed_items: args.completed_items, new_items: args.new_items };
          } catch { return null; }
        }
      }
    }
  }
  return null;
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
 *   - "json_stream_error": JSON parse/EOF/stream corruption.
 *   - "http_retryable": 429/502/503/500/ECONNRESET/ETIMEDOUT/socket hang up.
 *   - "empty_response" (5b): error text contains "empty response" / "0 output tokens"
 *     (thrown exception variant — complements Pattern 2's structural detection).
 *   - "unhandled_stop_reason": pi-ai provider got unexpected stop reason from model.
 */
export function isRetryableInfraError(session: ActiveSession): string | null {
  if (session.closed) return null;
  if (session.status !== "running") return null;

  const messages = session.agent.state.messages;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  if (!lastMsg) return null;

  // If the agent already called the `finish` tool successfully, empty responses
  // afterward are normal (the model has nothing left to say). Don't retry.
  if (hasFinishToolCall(messages)) return null;

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

  // Pattern 5b: Empty response thrown as error — the model or proxy returned
  // an empty response (0 output tokens) and the provider threw it as an exception
  // rather than returning an empty assistant message. This bypasses the structural
  // detection in Pattern 2 below because no assistant message is added to the context.
  // Transient and safe to retry — the model typically responds on the next attempt.
  if (agentError) {
    const isEmptyResponseError =
      agentError.includes("empty response") ||
      agentError.includes("0 output tokens") ||
      agentError.includes("without producing a response");
    if (isEmptyResponseError) {
      return "empty_response";
    }
  }

  // Pattern 6: Unhandled stop reason from pi-ai provider — the model returned
  // a stop reason the provider doesn't recognize (e.g. "unexpected_state" from Kimi).
  // Transient and safe to retry — the model may respond normally on next attempt.
  if (agentError?.includes("Unhandled stop reason")) {
    return "unhandled_stop_reason";
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

  // ── Post-loop empty-response catch ─────────────────────────────────
  // Defense-in-depth: detect empty responses that slipped through the
  // retry loop (e.g., agent-core completed normally with stopReason="stop"
  // but 0 output tokens). If we still have retries left, retry here
  // before falling through to onComplete which would mark it as error.
  if (!session.closed && session.infraRetryCount < infraRetryMax) {
    const messages = session.agent.state.messages;
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const agentError = session.agent.state.error ?? session.error;

    // Check for empty assistant response (no text, no tool calls)
    const isEmptyAssistant = !agentError && lastMsg?.role === "assistant" && (() => {
      const content = Array.isArray(lastMsg.content) ? lastMsg.content : [];
      return !content.some(
        (block: any) =>
          (block?.type === "text" && block.text?.trim()) ||
          block?.type === "toolCall",
      );
    })();

    // Check for silent stream error (last message is user = no assistant reply)
    const isSilentStream = !agentError && lastMsg?.role === "user";

    // Skip retry if the agent already called `finish` — empty responses
    // after finish are normal (model has nothing left to say).
    if ((isEmptyAssistant || isSilentStream) && !hasFinishToolCall(messages)) {
      const reason = isEmptyAssistant ? "empty_response" : "silent_stream";
      session.infraRetryCount++;
      const attempt = session.infraRetryCount;
      console.warn(
        `[manager] Post-loop retry ${attempt}/${infraRetryMax} for session ${session.sessionId} (${reason})`,
      );

      // Clean up: remove empty assistant message if present
      if (isEmptyAssistant && lastMsg?.role === "assistant") {
        messages.pop();
        session.agent.replaceMessages(messages);
      }

      // Ensure we end on a user message for agent.continue()
      const lastAfterClean = messages.length > 0 ? messages[messages.length - 1] : null;
      if (!lastAfterClean || lastAfterClean.role === "assistant") {
        session.agent.appendMessage({
          role: "user",
          content: [{ type: "text", text: "Please continue." }],
          timestamp: Date.now(),
        });
      }

      session.error = undefined;
      session.agent.state.error = undefined;

      const delayMs = Math.min(INFRA_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS)
        + Math.floor(Math.random() * 500);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      if (!session.closed) {
        try {
          await session.agent.continue();
        } catch (err) {
          session.error = (err as Error)?.message ?? String(err);
        }

        // After retry, re-enter the main retry loop for any further issues
        return runAgentWithRetry(
          session,
          Promise.resolve(), // initialCall already done
          infraRetryMax,
          onComplete,
        );
      }
    }
  }

  // All retries exhausted (or no retry needed) — run normal completion
  onComplete(session);
}
