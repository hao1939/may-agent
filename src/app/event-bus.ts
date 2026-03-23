/**
 * Unified event system for the runner.
 *
 * All agent activity flows through RunnerEvents. UI layers (console, socket,
 * web) subscribe and render however they want. Commands flow back through
 * RunnerCommands.
 *
 * Every session event carries `sessionId` so UIs can filter by session
 * interest (e.g. show only the human's conversation + delegations).
 */

// ── Events (runner → UI) ──────────────────────────────────────────────

// Session-scoped events: every event belongs to a session.
// UIs filter by sessionId to decide what to show.

export type SessionEvent =
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; duration?: string; error?: string; outcome?: string };

// System events: not session-scoped.

export type SystemEvent =
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | {
      type: "workflow";
      agent: string;
      workflow: string;
      sessionId?: string;
      event: "start" | "step_start" | "step_done" | "done" | "escalated";
      step?: string;
      status?: string;
      duration?: string;
      reason?: string;
      task?: string;
    }
  | {
      type: "eval";
      verdict: string;
      efficiency: number;
      quality: number;
      tokens?: number;
      cost?: number;
      turns?: number;
      failureChains?: number;
      wastedCalls?: number;
    };

export type RunnerEvent = SessionEvent | SystemEvent
  // Deprecated — migrate to log/notification. Kept for backward compat during migration.
  | { type: "info"; message: string; channel?: EventChannel }
  | { type: "prompt"; message: string; channel?: EventChannel };

/** Check if an event is session-scoped. */
export function isSessionEvent(event: RunnerEvent): event is SessionEvent {
  return "sessionId" in event && typeof (event as SessionEvent).sessionId === "string";
}

// ── Backward compat ───────────────────────────────────────────────────
// Old code may still reference these. Remove after migration is complete.

/** @deprecated Use isSessionEvent + sessionId filtering instead. */
export type EventChannel = "chat" | "activity";

/** @deprecated Use isSessionEvent + sessionId filtering instead. */
export function eventChannel(event: RunnerEvent): EventChannel {
  // During migration: events with channel field still work
  const ch = (event as { channel?: EventChannel }).channel;
  if (ch) return ch;
  return "activity";
}

// ── Commands (UI → runner) ─────────────────────────────────────────────

export type RunnerCommand =
  | { type: "steer"; message: string; sessionId?: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "cancel_task" }
  | { type: "close" }
  | { type: "status" }
  | { type: "input"; message: string; source?: string }
  | { type: "run"; agent: string; message: string }
  | { type: "reload_agents" }
  | { type: "restart" }
  | { type: "subscribe"; sessions: string[]; notifications?: boolean };

/** Result returned by command handlers to the socket server. */
export interface CommandResult {
  ok: boolean;
  message?: string;
}

// ── Event Bus ──────────────────────────────────────────────────────────

export type EventListener = (event: RunnerEvent) => void;
export type CommandHandler = (command: RunnerCommand) => CommandResult | void;

export class EventBus {
  private listeners = new Set<EventListener>();
  private commandHandler: CommandHandler | null = null;

  /** Subscribe to all runner events. Returns unsubscribe function. */
  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Emit an event to all subscribers. */
  emit(event: RunnerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* UI errors shouldn't crash the runner */
      }
    }
  }

  /** Register the command handler (runner-side). */
  onCommand(handler: CommandHandler): void {
    this.commandHandler = handler;
  }

  /** Send a command to the runner (UI-side). Returns handler result if available. */
  command(cmd: RunnerCommand): CommandResult | void {
    return this.commandHandler?.(cmd);
  }

  /** Number of listeners. */
  get listenerCount(): number {
    return this.listeners.size;
  }
}
