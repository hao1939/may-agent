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
 * Run an agent call (prompt or continue) with automatic retry on transient
 * infrastructure errors (P93 Resilience Pattern).
 *
 * On retryable failure: removes the bad assistant message (if any), clears
 * error state, waits with linear backoff, and calls agent.continue().
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

    // Clear error state for the retry
    session.error = undefined;
    session.agent.state.error = undefined;

    // Backoff: attempt * base delay (1s, 2s, 3s)
    const delayMs = attempt * INFRA_RETRY_BASE_DELAY_MS;
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
