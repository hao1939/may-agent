/**
 * manager-utils.ts — Pure utility functions, constants, and shared interfaces
 * extracted from manager.ts for maintainability.
 *
 * These have zero coupling to SubagentManager — they are standalone helpers.
 */
import { createHash } from "node:crypto";
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

export function formatMemoryTimestamp(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
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
  if (/exit\s*(code\s*)?\d*[1-9]\d*/i.test(outputText)) return true;
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

/** Maximum characters for task/summary text in the system-prompt memory section.
 *  Full data is preserved in the JSONL — this only affects the prompt injection. */
export const MEMORY_TASK_MAX = 200;
export const MEMORY_SUMMARY_MAX = 500;

/**
 * Set of tool names that count as state-changing operations for P85 operation budgets.
 * read/agents/workflow are free; bash/write/edit/commit mutate state.
 */
export const STATE_CHANGING_TOOLS = new Set(["bash", "write", "edit", "commit"]);

/** Maximum number of automatic retries for transient infrastructure errors
 *  (empty responses, missing tool calls). See P93 Resilience Pattern. */
export const INFRA_RETRY_MAX = 3;

/** Base delay (ms) between infrastructure retries. Multiplied by attempt number. */
export const INFRA_RETRY_BASE_DELAY_MS = 1000;

/** Maximum identical failed tool calls before blocking. */
export const TOOL_PIVOT_LIMIT = 3;

/** Default turn count at which a budget warning is injected. */
export const TURN_BUDGET_WARNING_DEFAULT = 40;

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
  parentSessionId?: string;
  /** Agent name of the parent session (cached at creation for notification after parent may be gone). */
  parentAgentName?: string;
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
  /** Number of infrastructure retries attempted in the current agent loop run. */
  infraRetryCount: number;
  /** Tracks identical failed tool calls for pivot heuristic. Key: "toolName:argsHash", Value: consecutive error count. */
  toolErrorHistory: Map<string, number>;
  /** Total number of tool calls that returned errors in this session (P20 Tainted Handoffs). */
  toolErrorCount: number;
  /** Turn count at which a budget warning is injected. 0 = disabled. */
  turnBudgetWarningAt: number;
  /** Whether the turn budget warning has already been injected (avoids spam). */
  turnBudgetWarned: boolean;
  /** P114: Whether the agent has read its ERROR_LOG.jsonl in this session. */
  hasReadErrorLog: boolean;
}

/** Options for spawning a session with parent/workflow context. */
export interface RunOptions {
  parentSessionId?: string;
  /** Name of the parent agent (for cross-process notification routing). */
  parentAgentName?: string;
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
  /** Runtime override for opBudget (overrides agent definition). */
  opBudget?: number;
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
   *  (empty responses, missing tool calls). Default: INFRA_RETRY_MAX (3).
   *  Set to 0 to disable retries (useful in tests). */
  infraRetryMax?: number;
  /**
   * Called after a task session completes (done/error/interrupted).
   * Fires after archival. Use for post-session tasks like evaluation.
   * NOT called for the chat session transitioning to "idle".
   */
  onSessionComplete?: (info: SessionInfo) => void;
  /**
   * Called when any new session starts (via run()).
   * Use to subscribe to agent events for UI streaming.
   * This is the single point where all session creation is observed.
   */
  onSessionStart?: (agentName: string, sessionId: string) => void;
}
