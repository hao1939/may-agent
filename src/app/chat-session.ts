/**
 * ChatSession — persistent chat session for the human-facing agent.
 *
 * Uses a single persistent session (autoClose: "never") that stays idle
 * between messages. Subsequent messages wake the session via manager.input().
 *
 * Session state is persisted to JSONL automatically by the manager's
 * subscribeForPersistence(). On restart, the user can resume an old
 * session or start fresh.
 *
 * Design: docs/session-model.md
 */

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../lib/manager.js";

import { trackRequest } from "../lib/requests.js";

import type { EventBus } from "./event-bus.js";

export interface ChatSessionOptions {
  manager: SubagentManager;
  bus: EventBus;
  /** The agent to run for human messages (default: "may"). */
  agentName: string;
  /** Directory for persistent state (JSONL logs, etc.). Optional — logging is skipped when unset. */
  persistDir?: string;
  /** Callback when the agent finishes responding (for prompt display). */
  onDone?: () => void;
  /** Handle "reload" command. */
  onReload?: () => void;
  /** Handle "close" command. */
  onClose?: () => void;
  /** Handle "restart" command. */
  onRestart?: () => void;
}

/**
 * Manages the human↔agent conversation via a single persistent session.
 *
 * First message creates the session. Subsequent messages wake it from idle.
 * Built-in commands (status, cancel, reload, etc.) are handled directly.
 * @agent prefix routes to ephemeral direct agent sessions.
 */
export class ChatSession {
  private manager: SubagentManager;
  private bus: EventBus;
  private agentName: string;
  private persistDir?: string;
  private sessionId: string | null = null;
  private onDone?: () => void;
  private onReload?: () => void;
  private onClose?: () => void;
  private onRestart?: () => void;
  /** Recursion guard for sendMessage retry (session-gone → create fresh). */
  private sendRetryDepth = 0;

  constructor(opts: ChatSessionOptions) {
    this.manager = opts.manager;
    this.bus = opts.bus;
    this.agentName = opts.agentName;
    this.persistDir = opts.persistDir;
    this.onDone = opts.onDone;
    this.onReload = opts.onReload;
    this.onClose = opts.onClose;
    this.onRestart = opts.onRestart;

    // Resume existing idle chat session from previous process (preserves conversation)
    this.resumeExistingSession();
  }

  /**
   * Re-check for idle chat sessions after resumeStaleSessions loads them.
   * Called from may.ts after stale sessions are loaded into memory.
   */
  resumeAfterLoad(): void {
    if (!this.sessionId) {
      this.resumeExistingSession();
    }
  }

  private resumeExistingSession(): void {
    const sessions = this.manager.status();
    const existing = sessions.find((s) => s.agent === this.agentName && s.kind === "chat");
    if (existing) {
      this.sessionId = existing.sessionId;
      this.trackCompletion(this.sessionId);
    }
  }

  /**
   * Handle human input. Returns immediately.
   *
   * Built-in commands are handled directly (no LLM call).
   * @agent prefixes route to direct agent invocation.
   * Everything else goes to the persistent session.
   */
  handleInput(message: string, source?: string): void {
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
    if (lower === "/new") {
      this.handleNew();
      return;
    }

    // ── @agent prefix — direct agent invocation (ephemeral) ──────────
    const [targetAgent, agentMessage] = parseAgentPrefix(trimmed);
    if (targetAgent) {
      this.logHumanInput(trimmed, source, targetAgent);
      this.startDirectSession(targetAgent, agentMessage, source);
      return;
    }

    // ── Normal message → persistent session ──────────────────────────
    this.logHumanInput(trimmed, source, this.agentName);
    this.sendRetryDepth = 0;
    this.sendMessage(trimmed, source);
  }

  /**
   * Send a message to the persistent chat session.
   * Creates the session on first call, wakes from idle on subsequent calls.
   */
  private sendMessage(message: string, source?: string): void {
    if (!this.sessionId) {
      // Track request in SQLite
      let requestId: string | undefined;
      if (this.persistDir) {
        try {
          requestId = trackRequest(this.persistDir, {
            fromEntity: "human",
            toAgent: this.agentName,
            task: message,
            method: "chat",
            source: source ?? "console",
          });
        } catch {
          /* non-fatal — don't break chat over tracking */
        }
      }

      // First message: create the persistent session
      this.sessionId = this.manager.run(this.agentName, message, {
        kind: "chat",
        autoClose: "never",
        compaction: true,
        source: source ?? "chat",
        requestId,
      });
      this.trackCompletion(this.sessionId);
      return;
    }

    // Subsequent messages: wake the idle session or steer the running one
    this.manager
      .input(this.sessionId, message)
      .then(() => {
        // Surface session errors on subsequent messages too
        const session = this.manager.status().find((s) => s.sessionId === this.sessionId);
        if (session?.error) {
          this.bus.emit({ type: "info", message: `[${this.agentName}] ⚠️ ${session.error}` });
        }
        this.onDone?.();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        // Session gone (closed, archived, etc.) — create a fresh one
        if (msg.includes("not found") || msg.includes("terminal state")) {
          // Guard against infinite recursion (e.g., persistent "not found" error)
          if (this.sendRetryDepth >= 2) {
            this.bus.emit({ type: "info", message: `[chat] Session lost after retries: ${msg}` });
            this.onDone?.();
            return;
          }
          this.sendRetryDepth++;
          this.sessionId = null;
          this.sendMessage(message, source);
          return;
        }
        this.bus.emit({ type: "info", message: `[chat] Error: ${msg}` });
        this.onDone?.();
      });
  }

  /**
   * Track session completion for the onDone callback.
   * For autoClose: "never", the session goes idle (not archived).
   * Surfaces any errors (empty responses, API failures, etc.) to the user.
   */
  private trackCompletion(sessionId: string): void {
    this.manager
      .waitForIdle(sessionId)
      .then(() => {
        // Surface session errors that would otherwise be silent
        // (e.g., empty model response, stream errors on idle sessions)
        const session = this.manager.status().find((s) => s.sessionId === sessionId);
        if (session?.error) {
          this.bus.emit({ type: "info", message: `[${this.agentName}] ⚠️ ${session.error}` });
        }
        this.onDone?.();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.bus.emit({ type: "info", message: `[chat] Session error: ${msg}` });
        this.onDone?.();
      });
  }

  /**
   * Append a human input entry to the JSONL log.
   *
   * One line per message: { ts, source, sessionId, agent, text }.
   * SessionId provides full conversation context — the session JSONL
   * has the complete message history for deeper analysis.
   */
  private logHumanInput(text: string, source?: string, agent?: string): void {
    if (!this.persistDir) return;
    try {
      const entry = {
        ts: Date.now(),
        source: source ?? "unknown",
        sessionId: this.sessionId,
        agent: agent ?? this.agentName,
        text,
      };
      appendFileSync(join(this.persistDir, "human-inputs.jsonl"), JSON.stringify(entry) + "\n");
    } catch {
      /* best-effort — don't break chat over logging */
    }
  }

  /** List running sessions. */
  private handleStatus(): void {
    const sessions = this.manager.status();
    if (sessions.length === 0) {
      this.bus.emit({ type: "info", message: "[status] No active sessions" });
    } else {
      const lines = sessions.map(
        (s) => `  ${s.agent} (${s.sessionId}): ${s.status} — "${s.task.slice(0, 80)}" [${s.runtime}]`,
      );
      this.bus.emit({ type: "info", message: `[status] ${sessions.length} session(s):\n${lines.join("\n")}` });
    }
  }

  /** Cancel the current chat session's run (if running). */
  private handleCancel(): void {
    if (this.sessionId) {
      const session = this.manager.status().find((s) => s.sessionId === this.sessionId);
      if (session?.status === "running") {
        this.bus.emit({ type: "info", message: `[cancel] Cancelling ${this.sessionId}` });
        this.manager.cancel(this.sessionId);
        return;
      }
    }
    // Fall back to cancelling the most recent running session
    const running = this.manager.status().filter((s) => s.status === "running");
    if (running.length > 0) {
      const latest = running.sort((a, b) => b.startedAt - a.startedAt)[0];
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

  /** Start a fresh chat session. Archives the current one. */
  private handleNew(): void {
    if (this.sessionId) {
      this.manager.close(this.sessionId);
      this.bus.emit({ type: "info", message: `[chat] Closed session ${this.sessionId}` });
    }
    this.sessionId = null;
    this.bus.emit({ type: "info", message: "[chat] Ready for new conversation. Type your message." });
    this.onDone?.();
  }

  /** Start an ephemeral direct agent session (from @agent prefix). */
  private startDirectSession(agentName: string, task: string, source?: string): void {
    this.bus.emit({ type: "info", message: `[direct] Running ${agentName}...` });

    // Track request in SQLite
    let requestId: string | undefined;
    if (this.persistDir) {
      try {
        requestId = trackRequest(this.persistDir, {
          fromEntity: "human",
          toAgent: agentName,
          task,
          method: "chat",
          source: source ?? "console",
        });
      } catch {
        /* non-fatal — don't break chat over tracking */
      }
    }

    const sessionId = this.manager.run(agentName, task, {
      kind: "job",
      source: source ?? "chat",
      requestId,
    });
    this.manager
      .waitFor(sessionId)
      .then(() => {
        this.onDone?.();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.bus.emit({ type: "info", message: `[direct] Session ${sessionId} error: ${msg}` });
        this.onDone?.();
      });
  }

  /** Cancel the chat session and all running sessions (for shutdown). */
  cancelAll(): void {
    for (const s of this.manager.status()) {
      if (s.status === "running") {
        try {
          this.manager.cancel(s.sessionId);
        } catch {
          /* may already be done */
        }
      }
    }
  }

  /** Get the active chat session ID. */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /** Check if the chat session is currently processing. */
  isRunning(): boolean {
    if (!this.sessionId) return false;
    const session = this.manager.status().find((s) => s.sessionId === this.sessionId);
    return session?.status === "running";
  }
}

/** Parse @agent prefix from input. Returns [agentName, message] or [null, original]. */
function parseAgentPrefix(input: string): [string | null, string] {
  const match = input.match(/^@(\w+)\s+([\s\S]+)/);
  if (match) return [match[1], match[2]];
  return [null, input];
}
