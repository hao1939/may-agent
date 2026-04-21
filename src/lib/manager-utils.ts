/**
 * manager-utils.ts — Pure utility functions, constants, and shared interfaces
 * extracted from manager.ts for maintainability.
 *
 * These have zero coupling to SubagentManager — they are standalone helpers.
 */
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import type { AgentMessage, Agent } from "@mariozechner/pi-agent-core";
import type { SubagentDefinition, SessionInfo } from "./types.js";
import type { CompactionOptions } from "./compaction.js";
import type { SessionKind } from "./persistence.js";

// ── ID Generation ──────────────────────────────────────────────────────

let nextId = 0;
/**
 * Generate a unique session ID.
 *
 * Format: `{prefix}_{timestamp}_{counter}` — e.g. `s_1700000000000_0`.
 *
 * @param prefix - String prefix for the ID (default: `"s"`).
 * @returns A unique ID string.
 */
export function generateId(prefix = "s"): string {
  return `${prefix}_${Date.now()}_${nextId++}`;
}

// ── Formatting Helpers ─────────────────────────────────────────────────

/**
 * Converts a duration in milliseconds to a human-readable string.
 *
 * Returns seconds only for durations under a minute (e.g. `"42s"`),
 * or minutes and seconds for longer durations (e.g. `"2m30s"`).
 *
 * @param ms - Duration in milliseconds.
 * @returns A formatted duration string such as `"42s"` or `"2m30s"`.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m${remaining}s`;
}

/**
 * Derive the agent's root directory from its definition.
 * Convention: agentDir = dirname(knowledgeDir ?? workspace).
 * Returns undefined if neither knowledgeDir nor workspace is set.
 */
export function getAgentDir(def: Pick<SubagentDefinition, "knowledgeDir" | "workspace">): string | undefined {
  const base = def.knowledgeDir ?? def.workspace;
  return base ? dirname(base) : undefined;
}

export function extractLastAssistantText(messages: AgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block?.type === "text" && block.text?.trim()) {
          return block.text;
        }
      }
    }
  }
  return null;
}

/** Truncate text to maxLen chars for prompt injection.
 *  Strips newlines (compact single-line) and appends "…" if truncated. */
export function truncateForPrompt(text: string, maxLen: number): string {
  // Collapse newlines to spaces for compact single-line display
  const oneLine = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "…";
}

// ── Process Helpers ────────────────────────────────────────────────────

/** Check if a process with the given PID is still running. */
export function isProcessAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0); // signal 0: existence check, no actual signal
    return true;
  } catch {
    return false;
  }
}

// ── Tool Error Detection ───────────────────────────────────────────────

/**
 * Detect whether tool output text indicates an error.
 * Used by the pivot heuristic to track consecutive failures.
 */
export function isToolError(outputText: string): boolean {
  // Non-zero exit code patterns (bash tools)
  // Anchored to the specific format bash.ts appends: "Command exited with code N"
  // This avoids false positives when grep/read output contains "exit code 1" in content
  if (/Command exited with code \d*[1-9]\d*/.test(outputText)) return true;
  // Common error markers
  if (outputText.startsWith("❌")) return true;
  if (/\bENOENT\b/.test(outputText)) return true;
  if (/\bEACCES\b/.test(outputText)) return true;
  if (/\bPermission denied\b/i.test(outputText)) return true;
  if (/\bcommand not found\b/i.test(outputText)) return true;
  if (/\bNo such file or directory\b/.test(outputText)) return true;
  if (/\bCould not find the exact text\b/.test(outputText)) return true;
  if (/\bFile not found\b/.test(outputText)) return true;
  if (/\bOpBudgetExceeded\b/.test(outputText)) return true;
  if (/\bE_RETRY_LIMIT\b/.test(outputText)) return true;
  // Edit tool: multiple occurrences
  if (/\bFound \d+ occurrences\b/.test(outputText)) return true;
  // Validation errors (empty args, missing required params)
  if (/\bValidation failed for tool\b/.test(outputText)) return true;
  // Write blocked by cross-edit guard
  if (/\bWRITE BLOCKED\b/.test(outputText)) return true;
  return false;
}

/**
 * Compute a stable key for a tool+args combination.
 * Used to track identical consecutive tool calls.
 */
export function computeToolArgsKey(toolName: string, params: any): string {
  const argsHash = createHash("sha256")
    .update(JSON.stringify(params ?? {}))
    .digest("hex")
    .slice(0, 16);
  return `${toolName}:${argsHash}`;
}

// ── Constants ──────────────────────────────────────────────────────────

/**
 * Set of tool names that count as state-changing operations for P85 operation budgets.
 * read/agents/workflow are free; bash/write/edit/commit mutate state.
 */
export const STATE_CHANGING_TOOLS = new Set(["bash", "write", "edit", "commit"]);

/** Maximum number of automatic retries for transient infrastructure errors
 *  (empty responses, missing tool calls). See P93 Resilience Pattern.
 *  Increased from 3→5 per error-rate-reduction-plan: 3 retries recovered 80%,
 *  5 retries should recover 95%+ of transient failures. */
export const INFRA_RETRY_MAX = 5;

/** Base delay (ms) between infrastructure retries. Multiplied by attempt number. */
export const INFRA_RETRY_BASE_DELAY_MS = 1000;

/** Maximum identical failed tool calls before blocking. */
export const TOOL_PIVOT_LIMIT = 3;

/** @deprecated Turn limits removed — always 0 (unlimited). Watchdog handles runaway sessions. */
export const RESTORED_MAX_TURNS_FALLBACK = 0;

/** Consecutive error turns before injecting a stuck warning. */
export const STUCK_WARNING_THRESHOLD = 3;

/** Consecutive error turns after warning before auto-termination. */
export const STUCK_TERMINATE_THRESHOLD = 5;

// ── Interfaces ─────────────────────────────────────────────────────────

export interface RegisteredAgent {
  definition: SubagentDefinition;
}

export interface ActiveSession {
  sessionId: string;
  agentName: string;
  agent: Agent;
  promise: Promise<void>;
  task: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "interrupted" | "idle";
  error?: string;
  outputDir: string;
  unsubscribe?: () => void;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  /** Session-level abort controller. Used to cancel API gate waits and other
   *  pre-agent operations that aren't covered by agent.abort(). */
  abortController: AbortController;
  parentSessionId?: string;
  /** Agent name of the parent session (cached at creation for notification after parent may be gone). */
  parentAgentName?: string;
  /** Session ID of the originating session (set by fork — the session that triggered this independent tree). */
  originSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  turnCount: number;
  /** Compaction transform for the interface session (rolling compaction). */
  compactionTransform?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
  /** Set by close() — prevents handleCompletion from acting on an already-archived session. */
  closed: boolean;
  /** Session lifecycle policy. "never" = chat session (stays idle), "immediate" = task session (archives on completion). */
  autoClose: "immediate" | "never";
  /** Session kind: chat (human-owned), job (fire-and-forget, auto-resumed), call (parent-owned). */
  kind: SessionKind;
  /** Terminal status for archive/result reporting. Set before archival so the promise chain can read it after the session is removed from activeSessions. */
  archiveStatus?: "done" | "error" | "interrupted";
  /** Operation budget: max state-changing tool calls allowed. 0 = unlimited. */
  opBudget: number;
  /** Number of state-changing tool calls executed so far. */
  opCount: number;
  /** Total tool calls (including read-only). Used for shallow heartbeat detection. */
  totalToolCalls: number;
  /** Number of infrastructure retries attempted in the current agent loop run. */
  infraRetryCount: number;
  /** Tracks identical failed tool calls for pivot heuristic. Key: "toolName:argsHash", Value: consecutive error count. */
  toolErrorHistory: Map<string, number>;
  /** Total number of tool calls that returned errors in this session (P20 Tainted Handoffs). */
  toolErrorCount: number;
  /** File paths modified (write/edit) during this session, for activity tracking. */
  filesModified: Set<string>;
  /** Order ID linking this session to a persisted human order (P209). */
  orderId?: string;
  /** Request ID linking this session to the unified request tracker. */
  requestId?: string;
  /** Project ID for session tracking. */
  projectId?: string;
  /** Structured finish() data extracted from the agent's completion. */
  finishResult?: import("./types.js").FinishResult;
  /** Number of consecutive turns where every tool call errored (Stuck Detection). */
  consecutiveErrorTurns: number;
  /** Whether a stuck warning has been injected (avoids duplicate warnings). */
  stuckWarningInjected: boolean;
  /** Tool errors in the current turn (reset each assistant message). */
  currentTurnErrors: number;
  /** Tool successes in the current turn (reset each assistant message). */
  currentTurnSuccesses: number;
  /** @deprecated Turn budget removed. Field kept for type compat. */
  guardRedirectCount: number;
}

/** Options for spawning a session with parent/workflow context. */
export interface RunOptions {
  parentSessionId?: string;
  /** Name of the parent agent (for cross-process notification routing). */
  parentAgentName?: string;
  /** Session ID of the originating session (set by fork — links back to the caller's tree). */
  originSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  /** Runtime override: enable compaction for this session. */
  compaction?: boolean | CompactionOptions;
  /** Message source tag for the initial task message. */
  source?: string;
  /** Pre-assigned session ID (used by detached sub-agents). If set, skips generateId(). */
  sessionId?: string;
  /** Session lifecycle policy. Default: "immediate" (task sessions).
   *  - "immediate": archive on completion (task sessions)
   *  - "never": stay idle on completion (interface/chat session) */
  autoClose?: "immediate" | "never";
  /** Session kind. Default: "job".
   *  - "chat": human-owned, not auto-resumed
   *  - "job": fire-and-forget, auto-resumed on restart
   *  - "call": parent-owned, not resumed independently */
  kind?: SessionKind;
  /** @deprecated opBudget removed — always 0 (unlimited). Field kept for type compat. */
  opBudget?: number;
  /** Order ID linking this session to a persisted human order (P209). */
  orderId?: string;
  /** Request ID linking this session to the unified request tracker. */
  requestId?: string;
  /** Skip few-shot example injection for this session.
   *  Useful for gym baselines and A/B testing. */
  skipFewShot?: boolean;
  /** Project ID for session tracking. */
  projectId?: string;
}

export interface SubagentManagerOptions {
  persistDir: string;
  /** Root of the project. Used for detached agent spawning.
   *  Falls back to resolve(persistDir, "..") if not set. */
  projectRoot?: string;
  /** Maximum call depth for nested callAgent chains (default: 10).
   *  Prevents infinite loops like A→B→A→B→... */
  maxCallDepth?: number;
  /** Maximum automatic retries for transient infrastructure errors
   *  (empty responses, missing tool calls). Default: INFRA_RETRY_MAX (5).
   *  Set to 0 to disable retries (useful in tests). */
  infraRetryMax?: number;

  /**
   * Optional API concurrency gate. Limits concurrent streaming sessions
   * per API endpoint to prevent rate limit aborts.
   */
  apiGate?: import("./api-gate.js").ApiGate;
  /**
   * EventBus for session lifecycle events. When set, the manager emits
   * session_start, session_end, and agent streaming events directly
   * instead of going through callbacks.
   */
  bus?: ManagerEventBus;
}

/**
 * Minimal event bus interface — the manager only needs emit().
 * Avoids coupling the library to the app's EventBus class.
 */
export interface ManagerEventBus {
  emit(event: Record<string, unknown>): void;
}
