/**
 * EventBus — the single integration point for the may-agent system.
 *
 * Everything flows through here: commands (to core), observations (from core),
 * management (reload/restart), and system events (notifications).
 *
 * System logging (log.ts) is a separate, independent channel — never routed
 * through the bus — to avoid circular dependencies.
 *
 * See: agents/shared/may-agent-docs/events.md
 */

import { log } from "../lib/log.js";

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
  | { type: "message"; from: string; to: string; task: string; priority?: string; source?: string }
  | { type: "input"; sessionId?: string; text?: string; message?: string; source?: string }
  | { type: "steer"; sessionId?: string; text?: string; message?: string; source?: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "resume"; sessionId: string };

/** Management commands (to core / supervisord) */
export type ManagementCommand = { type: "reload" } | { type: "restart" } | { type: "shutdown" };

/** Observation events (from core) */
export type SessionEvent =
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number; turnCount?: number; errorCount?: number }
  | {
      type: "session.start";
      sessionId: string;
      agent: string;
      task: string;
      trigger: string;
      scheduledAt?: number;
      firedAt: number;
      // Optional fields previously carried only on legacy session.start:
      parentSessionId?: string;
      workspacePath?: string;
      workflowRunId?: string;
      projectId?: string;
      source?: string;
      kind?: string;
      requestId?: string;
    }
  | {
      type: "session.end";
      sessionId: string;
      agent: string;
      outcome: string;
      summary: string;
      durationMs: number;
      // Optional fields previously carried only on legacy session.end:
      status?: string;
      task?: string;
      duration?: string;
      error?: string;
      opCount?: number;
      turnCount?: number;
      /** Structured finish() data — context_updates, completed_items, new_items, etc. */
      finishParams?: Record<string, unknown>;
      /** Files modified during the session. */
      filesModified?: string[];
      /** Workspace path for agent-specific file writes. */
      workspacePath?: string;
    };

/** System events */
export type SystemEvent =
  | { type: "handler.started"; handler: string; agent: string }
  | { type: "handler.completed"; handler: string; agent: string; durationMs: number }
  | { type: "handler.failed"; handler: string; agent: string; error: string; durationMs: number }
  | { type: "project.iteration"; project: string; iteration: number }
  | { type: "project.status_changed"; project: string; from: string; to: string }
  | { type: "notification"; agent: string; text: string }
  | {
      type: "message.created";
      from: string;
      to: string;
      content: string;
      intent?: string;
      artifact?: string;
      priority?: "P0" | "P1" | "P2" | "P3";
    }
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

/** All typed event types — commands + observations + system */
export type AgentEvent =
  | AgentCommand
  | ManagementCommand
  | SessionEvent
  | SystemEvent
  | { type: "info"; message: string; channel?: string }
  | { type: "prompt"; message: string; channel?: string };



// ── Helpers ────────────────────────────────────────────────────────────

/** Check if an event is session-scoped (has sessionId). */
export function isSessionEvent(event: AgentEvent): event is SessionEvent {
  return "sessionId" in event && typeof (event as SessionEvent).sessionId === "string";
}

// ── EventBus ───────────────────────────────────────────────────────────

export type Subscriber = (event: AgentEvent) => void;
export type SubscribeOptions = { priority?: "first" | "normal" };

/**
 * EventBus — typed pub/sub.
 *
 * Subscriber priority semantics:
 *   - "first" subscribers always run before "normal" subscribers, in registration order.
 *   - Persistence (DB writer) MUST be registered with priority "first" so events become
 *     durable before any side-effect handler runs. This is a v2 invariant: if a handler
 *     triggers work, the originating event is already on disk.
 *
 * See: agents/shared/may-agent-docs/proposals/v2-architecture.md (Event Persistence as Invariant)
 */
export class EventBus {
  private firstSubscribers: Subscriber[] = [];
  private normalSubscribers: Subscriber[] = [];

  /** Subscribe to all events. Returns unsubscribe function. */
  subscribe(fn: Subscriber, opts?: SubscribeOptions): () => void {
    const list = opts?.priority === "first" ? this.firstSubscribers : this.normalSubscribers;
    list.push(fn);
    return () => {
      this.firstSubscribers = this.firstSubscribers.filter((s) => s !== fn);
      this.normalSubscribers = this.normalSubscribers.filter((s) => s !== fn);
    };
  }

  /** Emit an event. Runs "first" subscribers (persistence) before "normal" (handlers/UI). */
  emit(event: AgentEvent): void {
    for (const fn of this.firstSubscribers) {
      try {
        fn(event);
      } catch (err) {
        log("warn", `[event-bus] first-priority subscriber threw on event '${event.type}': ${err}`);
      }
    }
    for (const fn of this.normalSubscribers) {
      try {
        fn(event);
      } catch (err) {
        /* subscriber errors never break the bus */
        log("warn", `[event-bus] subscriber threw on event '${event.type}': ${err}`);
      }
    }
  }

  /** Number of subscribers. */
  get listenerCount(): number {
    return this.firstSubscribers.length + this.normalSubscribers.length;
  }
}
