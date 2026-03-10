/**
 * V2 Chat Loop — code-level UI loop for the human-facing agent.
 *
 * Each human message starts a new May session. Sessions run concurrently.
 * Built-in commands (status, cancel, reload) are handled directly — no LLM.
 *
 * Conversation context is maintained via a rolling transcript passed to
 * each new session as part of the task description.
 *
 * Design: docs/v2-design.md § "The Chat Loop"
 */

import type { SubagentManager } from "../lib/manager.js";
import type { EventBus } from "./event-bus.js";

export interface ChatLoopOptions {
  manager: SubagentManager;
  bus: EventBus;
  /** The agent to run for each human message (default: "may"). */
  agentName: string;
  /** Max transcript entries to include as context (default: 10). */
  maxTranscript?: number;
  /** Callback when a session finishes (for prompt display). */
  onSessionDone?: (sessionId: string) => void;
  /** Event routing: subscribe to session for UI streaming. */
  onSessionStart?: (agentName: string, sessionId: string) => void;
  /** Handle "reload" command. Called by ChatLoop, implemented by may.ts. */
  onReload?: () => void;
  /** Handle "close" command. Called by ChatLoop, implemented by may.ts. */
  onClose?: () => void;
  /** Handle "restart" command. Called by ChatLoop, implemented by may.ts. */
  onRestart?: () => void;
}

interface TranscriptEntry {
  role: "human" | "agent";
  text: string;
  timestamp: number;
}

/**
 * Manages the conversation between human and agent.
 * Each human message starts a new agent session.
 * Status queries, cancellations, etc. are handled as built-in commands.
 */
export class ChatLoop {
  private manager: SubagentManager;
  private bus: EventBus;
  private agentName: string;
  private transcript: TranscriptEntry[] = [];
  private maxTranscript: number;
  private activeSessions = new Map<string, { agent: string; task: string; startedAt: number }>();
  private onSessionDone?: (sessionId: string) => void;
  private onSessionStart?: (agentName: string, sessionId: string) => void;
  private onReload?: () => void;
  private onClose?: () => void;
  private onRestart?: () => void;

  constructor(opts: ChatLoopOptions) {
    this.manager = opts.manager;
    this.bus = opts.bus;
    this.agentName = opts.agentName;
    this.maxTranscript = opts.maxTranscript ?? 10;
    this.onSessionDone = opts.onSessionDone;
    this.onSessionStart = opts.onSessionStart;
    this.onReload = opts.onReload;
    this.onClose = opts.onClose;
    this.onRestart = opts.onRestart;
  }

  /**
   * Handle a human input message. Returns immediately.
   *
   * Built-in commands are handled directly (no LLM call).
   * @agent prefixes route to direct agent invocation.
   * Everything else starts a new agent session with transcript context.
   */
  handleInput(message: string): void {
    const trimmed = message.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();

    // ── Built-in commands (no LLM) ───────────────────────────────────
    if (lower === "status") {
      this.handleStatus();
      return;
    }
    if (lower === "cancel all") {
      this.handleCancelAll();
      return;
    }
    if (lower === "cancel") {
      this.handleCancel();
      return;
    }
    if (lower === "reload") {
      this.onReload?.();
      return;
    }
    if (lower === "close") {
      this.onClose?.();
      return;
    }
    if (lower === "restart") {
      this.onRestart?.();
      return;
    }

    // ── @agent prefix — direct agent invocation ──────────────────────
    const [targetAgent, agentMessage] = parseAgentPrefix(trimmed);
    if (targetAgent) {
      this.startDirectSession(targetAgent, agentMessage);
      return;
    }

    // ── Start a new agent session ────────────────────────────────────
    this.startSession(trimmed);
  }

  /** List running sessions. */
  private handleStatus(): void {
    const sessions = this.manager.status();
    if (sessions.length === 0) {
      this.bus.emit({ type: "info", message: "[status] No active sessions" });
    } else {
      const lines = sessions.map((s) =>
        `  ${s.agent} (${s.sessionId}): ${s.status} — "${s.task.slice(0, 80)}" [${s.runtime}]`
      );
      this.bus.emit({ type: "info", message: `[status] ${sessions.length} session(s):\n${lines.join("\n")}` });
    }
  }

  /** Cancel the most recent session. */
  private handleCancel(): void {
    let latest: { sessionId: string; startedAt: number } | null = null;
    for (const [sid, info] of this.activeSessions) {
      if (!latest || info.startedAt > latest.startedAt) {
        latest = { sessionId: sid, startedAt: info.startedAt };
      }
    }
    if (latest) {
      this.bus.emit({ type: "info", message: `[cancel] Cancelling ${latest.sessionId}` });
      this.manager.cancel(latest.sessionId);
    } else {
      this.bus.emit({ type: "info", message: "[cancel] No active sessions to cancel" });
    }
  }

  /** Cancel all active sessions. */
  private handleCancelAll(): void {
    const sessions = this.manager.status();
    let cancelled = 0;
    for (const s of sessions) {
      if (s.status === "running") {
        this.manager.cancel(s.sessionId);
        cancelled++;
      }
    }
    this.bus.emit({ type: "info", message: `[cancel] Cancelled ${cancelled} session(s)` });
  }

  /**
   * Start a new agent session for a human message.
   * Includes rolling transcript as context.
   */
  private startSession(message: string): void {
    this.transcript.push({ role: "human", text: message, timestamp: Date.now() });

    // Build context from recent transcript
    const recentTranscript = this.transcript.slice(-this.maxTranscript);
    const contextBlock = recentTranscript.length > 1
      ? `## Recent conversation\n${recentTranscript.slice(0, -1).map((e) => `${e.role}: ${e.text}`).join("\n")}\n\n## Current request\n${message}`
      : message;

    this.launchSession(this.agentName, contextBlock, message);
  }

  /**
   * Start a direct agent session (from @agent prefix).
   * No transcript context — the task is the full message.
   */
  private startDirectSession(agentName: string, task: string): void {
    this.bus.emit({ type: "info", message: `[direct] Running ${agentName}...` });
    this.launchSession(agentName, task, task);
  }

  /**
   * Launch an agent session and track it until completion.
   */
  private launchSession(agentName: string, contextBlock: string, displayTask: string): void {
    const sessionId = this.manager.run(agentName, contextBlock, {
      source: "chat",
    });

    this.activeSessions.set(sessionId, {
      agent: agentName,
      task: displayTask,
      startedAt: Date.now(),
    });

    this.onSessionStart?.(agentName, sessionId);

    // Wait for completion in background
    this.manager.waitFor(sessionId)
      .then((result) => {
        if (result.lastAssistantText) {
          const truncated = result.lastAssistantText.length > 500
            ? result.lastAssistantText.slice(0, 500) + "..."
            : result.lastAssistantText;
          this.transcript.push({ role: "agent", text: truncated, timestamp: Date.now() });
        }
        this.activeSessions.delete(sessionId);
        this.onSessionDone?.(sessionId);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.bus.emit({ type: "info", message: `[chat] Session ${sessionId} error: ${msg}` });
        this.activeSessions.delete(sessionId);
        this.onSessionDone?.(sessionId);
      });
  }

  /** Cancel all tracked sessions (for shutdown). */
  cancelAll(): void {
    for (const [sid] of this.activeSessions) {
      try { this.manager.cancel(sid); } catch { /* may already be done */ }
    }
  }

  /** Get the current transcript (for debugging/display). */
  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  /** Get active session count. */
  getActiveCount(): number {
    return this.activeSessions.size;
  }
}

/** Parse @agent prefix from input. Returns [agentName, message] or [null, original]. */
function parseAgentPrefix(input: string): [string | null, string] {
  const match = input.match(/^@(\w+)\s+([\s\S]+)/);
  if (match) return [match[1], match[2]];
  return [null, input];
}
