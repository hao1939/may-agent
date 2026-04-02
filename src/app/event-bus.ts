/**
 * EventBus — the single integration point for the may-agent system.
 *
 * Everything flows through here: commands (to core), observations (from core),
 * management (reload/restart), and system events (notifications, logs).
 *
 * Components subscribe to events they care about and emit events they produce.
 * No component calls another directly — they only know the bus.
 *
 * See: agents/shared/may-agent-docs/design/architecture-redesign.md
 */

// ── Event Types ────────────────────────────────────────────────────────

/** Agent commands (to core) */
export type AgentCommand =
  | {
      type: "fork";
      agent: string;
      task: string;
      originSessionId?: string;
      opts?: { kind?: string; requestId?: string; source?: string };
    }
  | { type: "message"; from: string; to: string; task: string; priority?: string }
  | { type: "input"; sessionId?: string; text?: string; message?: string; source?: string }
  | { type: "steer"; sessionId?: string; text?: string; message?: string; source?: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" };

/** Management commands (to core / launcher) */
export type ManagementCommand = { type: "reload" } | { type: "restart" } | { type: "shutdown" };

/** Observation events (from core) */
export type SessionEvent =
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | {
      type: "session_end";
      sessionId: string;
      agent: string;
      status: string;
      duration?: string;
      error?: string;
      outcome?: string;
      opCount?: number;
    };

/** System events */
export type SystemEvent =
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "message_created"; from: string; to: string; task: string; requestId: string }
  | { type: "cron_fired"; job: string; agent?: string; timestamp: number }
  | { type: "context-learn"; agentName: string; sessionId: string; persistDir: string }
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

/** All event types — commands + observations + system */
export type AgentEvent =
  | AgentCommand
  | ManagementCommand
  | SessionEvent
  | SystemEvent
  // Deprecated — kept for backward compat during migration
  | { type: "info"; message: string; channel?: string }
  | { type: "prompt"; message: string; channel?: string };

// ── Helpers ────────────────────────────────────────────────────────────

/** Check if an event is session-scoped (has sessionId). */
export function isSessionEvent(event: AgentEvent): event is SessionEvent {
  return "sessionId" in event && typeof (event as SessionEvent).sessionId === "string";
}

// ── EventBus ───────────────────────────────────────────────────────────

export type Subscriber = (event: AgentEvent) => void;

export class EventBus {
  private subscribers: Subscriber[] = [];

  /** Subscribe to all events. Returns unsubscribe function. */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }

  /** Emit an event to all subscribers. */
  emit(event: AgentEvent): void {
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        /* subscriber errors never break the bus */
      }
    }
  }

  /** Number of subscribers. */
  get listenerCount(): number {
    return this.subscribers.length;
  }
}
