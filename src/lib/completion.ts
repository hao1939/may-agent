/**
 * completion.ts — Session completion pipeline.
 *
 * Pure functions that handle the transition from "agent loop finished" to
 * "session archived with correct status". Extracted from handleCompletion()
 * in manager.ts to make the critical path testable and readable.
 *
 * Pipeline: detectErrors → clearPostFinishErrors → detectShallowHeartbeat → determineOutcome
 */

import type { SessionInfo } from "./types.js";
import type { ActiveSession } from "./manager-utils.js";
import { formatDuration } from "./manager-utils.js";
import { extractFinishParams, lastTurnCalledFinish } from "./manager-retry.js";

// ── Error patterns that are post-finish artifacts (not real failures) ──

const POST_FINISH_ERROR_PATTERNS = [
  "empty response",
  "0 output tokens",
  "Unhandled stop reason",
  "OpBudgetExceeded",
  "aborted",
];

function isPostFinishArtifact(error: string): boolean {
  return POST_FINISH_ERROR_PATTERNS.some((p) => error.includes(p));
}

// ── Step 1: Detect errors the agent-core layer missed ─────────────────

/**
 * Detect silent stream errors and empty responses that agent-core doesn't flag.
 * Mutates session.error and session.agent.state.errorMessage when issues are found.
 */
export function detectErrors(session: ActiveSession): void {
  const messages = session.agent.state.messages;
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

  // Silent stream: LLM stream threw before yielding any events.
  // agent.state.errorMessage is never set, but the last message is still the user's.
  if (!session.agent.state.errorMessage && !session.error && lastMsg?.role === "user") {
    const err = "Agent completed without producing a response (possible stream/API error)";
    session.error = err;
    (session.agent.state as any).errorMessage = err;
    return;
  }

  // Empty assistant response: stopReason="stop" with no content (0 output tokens).
  // Exception: if finish() was already called, the empty trailing response is normal.
  if (!session.agent.state.errorMessage && !session.error && lastMsg?.role === "assistant") {
    const content = Array.isArray(lastMsg.content) ? lastMsg.content : [];
    const hasSubstance = content.some(
      (block: any) => (block?.type === "text" && block.text?.trim()) || block?.type === "toolCall",
    );
    if (!hasSubstance && !lastTurnCalledFinish(messages)) {
      const err =
        "Model returned an empty response (0 output tokens). This usually indicates a model/API issue — try again or switch models.";
      session.error = err;
      (session.agent.state as any).errorMessage = err;
    }
  }
}

// ── Step 2: Clear errors that are post-finish artifacts ───────────────

/**
 * If the agent successfully called finish() in the current turn, certain
 * errors are artifacts of the post-finish cleanup (deliberate abort, empty
 * trailing response, etc.) and should not be treated as session failures.
 *
 * Only checks the last assistant turn — not the full history. This prevents
 * persistent/chat sessions from silently swallowing empty responses on
 * subsequent turns just because finish() was called in a prior turn.
 */
export function clearPostFinishErrors(session: ActiveSession): void {
  const messages = session.agent.state.messages;
  if (!lastTurnCalledFinish(messages)) return;

  // Merge: prefer session.error (set by MAX_TURNS, STUCK_TERMINATE) over
  // the generic "Request was aborted." from AbortController.
  const error = session.error ?? session.agent.state.errorMessage;
  if (!error) return;

  if (isPostFinishArtifact(error)) {
    session.error = undefined;
    (session.agent.state as any).errorMessage = undefined;
  }
}

// ── Step 3: Detect shallow heartbeats ─────────────────────────────────

/**
 * Heartbeat sessions MUST use tools (read heartbeat.md, etc.).
 * If a heartbeat completes with zero turns, the agent responded from
 * compacted context without checking anything — flag it as an error.
 */
export function detectShallowHeartbeat(session: ActiveSession): void {
  const wasAborted = session.error?.includes("aborted") ?? false;
  if (!wasAborted && !session.error && session.turnCount === 0 && session.task.startsWith("[heartbeat]")) {
    const err =
      "Shallow heartbeat: completed with zero turns. " +
      "Heartbeat sessions MUST use tools (read heartbeat.md, check health, etc.).";
    session.error = err;
    (session.agent.state as any).errorMessage = err;
  }
}

// ── Step 4: Determine final session outcome ───────────────────────────

export interface SessionOutcome {
  /** Terminal status for archiving. */
  archiveStatus: "done" | "error" | "interrupted";
  /** Last assistant text, truncated. */
  outcome: string | undefined;
  /** Structured finish() data. */
  finishParams: ReturnType<typeof extractFinishParams>;
  /** Structured finish result for TaskResult. */
  finishResult: import("./types.js").FinishResult | undefined;
}

/**
 * Determine the final session status, outcome text, and structured finish data.
 * Must be called after detectErrors + clearPostFinishErrors.
 */
export function determineOutcome(session: ActiveSession): SessionOutcome {
  const messages = session.agent.state.messages;
  const finishParams = extractFinishParams(messages);

  // Merge agent error into session (prefer pre-set session.error)
  if (!session.error && session.agent.state.errorMessage) {
    session.error = session.agent.state.errorMessage;
  }

  const wasAborted = session.error?.includes("aborted") ?? false;
  const archiveStatus: "done" | "error" | "interrupted" =
    wasAborted && session.error ? "interrupted" : session.error ? "error" : "done";

  // Extract last assistant text as outcome
  let outcome: string | undefined;
  const msgs = session.agent.state.messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant") {
      const textParts = (msgs[i].content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!);
      if (textParts.length > 0) {
        outcome = textParts.join(" ").slice(0, 500);
        break;
      }
    }
  }

  // Structured finish result
  let finishResult: import("./types.js").FinishResult | undefined;
  if (finishParams) {
    finishResult = {
      status: finishParams.status as "success" | "failure" | "blocked" | "partial",
      summary: finishParams.summary,
      deliverables: finishParams.deliverables,
      blockers: finishParams.blockers,
      next_steps: finishParams.next_steps,
    };
  }

  return { archiveStatus, outcome, finishParams, finishResult };
}

// ── Step 5: Build SessionInfo for the session_end bus event ──────

export function buildSessionInfo(
  session: ActiveSession,
  outcome: SessionOutcome,
  getWorkspacePath: (name: string) => string | undefined,
): SessionInfo {
  return {
    sessionId: session.sessionId,
    agent: session.agentName,
    task: session.task,
    status: outcome.archiveStatus,
    startedAt: session.startedAt,
    endedAt: session.endedAt!,
    runtime: formatDuration(session.endedAt! - session.startedAt),
    outputDir: session.outputDir,
    error: session.error,
    outcome: outcome.outcome,
    parentSessionId: session.parentSessionId,
    workflowRunId: session.workflowRunId,
    stepLabel: session.stepLabel,
    opCount: session.opCount,
    opBudget: session.opBudget,
    turnCount: session.turnCount,
    finishParams: outcome.finishParams ?? undefined,
    filesModified: [...session.filesModified],
    workspacePath: getWorkspacePath(session.agentName),
  };
}
