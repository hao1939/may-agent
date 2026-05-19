/**
 * EventBus — the single integration point for the may-agent system.
 *
 * Everything flows through here: commands (to core), observations (from core),
 * management (reload/restart), and system events (notifications).
 *
 * System logging (log.ts) is a separate, independent channel — never routed
 * through the bus — to avoid circular dependencies.
 *
 * See: shared/may-agent-docs/events.md
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
      /** @deprecated Use { type: "message", from, to, task, priority: "P0" } instead */
    }
  | { type: "message"; from: string; to: string; task: string; priority?: string; source?: string }
  | { type: "input"; sessionId?: string; text?: string; message?: string; source?: string }
  | { type: "steer"; sessionId?: string; text?: string; message?: string; source?: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "resume"; sessionId: string }
  | { type: "session.cancel.requested"; sessionId: string; source?: string }
  | { type: "project.comment.created"; projectPath: string; comment: string; source?: string; author?: string }
  | { type: "project.comment.created"; source?: string; owner: string; data: { projectPath: string; comment: string; author?: string } };

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
      parentSessionId?: string;
      workflowRunId?: string;
      projectId?: string;
      source?: string;
      kind?: string;
      requestId?: string;
      stepLabel?: string;
    };

/** System events */
export type SystemEvent =
  | { type: "heartbeat"; agent: string; entry: string }
  | { type: "handler.started"; source: "cron"; owner: string; data: { handler: string; agent: string } }
  | { type: "handler.completed"; source: "cron"; owner: string; data: { handler: string; agent: string; durationMs: number } }
  | { type: "handler.failed"; source: "cron"; owner: string; data: { handler: string; agent: string; error: string; durationMs: number } }
  | { type: "session.completed"; source: "runtime"; owner: string; data: { sessionId: string; agent: string; parentSessionId?: string; outcome?: string; status?: string; source?: string; kind?: string } }
  | { type: "session.failed"; source: "runtime"; owner: string; data: { sessionId: string; agent: string; error?: string; task?: string } }
  | { type: "session.escalated"; source: "runtime"; owner: string; data: { sessionId: string; agent: string; finishParams: Record<string, unknown> } }
  | { type: "project.iteration"; project: string; iteration: number }
  | { type: "project.status_changed"; project: string; from: string; to: string }
  | { type: "project.nudge"; source: string; owner: string; data: { projectPath: string; comment?: boolean; commentText?: string } }
  | { type: "telegram.reply"; source: "telegram"; owner: string; data: { enriched: boolean; originalMsgId?: number; projectPath?: string; delivery?: string; hasSessionCtx?: boolean; hasDbCtx?: boolean; fallback?: string; reason?: string } }
  | {
      type: "message.created";
      from: string;
      to: string;
      content: string;
      intent?: string;
      artifact?: string;
      priority?: "P0" | "P1" | "P2" | "P3";
    }
  | {
      type: "message.delivery_failed";
      source: string;
      owner: string;
      urgency?: "low" | "normal" | "high" | "immediate";
      data: {
        from: string;
        to: string;
        reason: string;
        content: string;
        priority?: "P0" | "P1" | "P2" | "P3";
      };
    }
  | {
      type: "agent.config_invalid";
      source: "loader";
      owner: "agent:may";
      urgency?: "low" | "normal" | "high" | "immediate";
      data: {
        agent?: string;
        count?: number;
        errors?: Array<{ agent: string; field: string; message: string }>;
        message: string;
        priority?: "P0" | "P1" | "P2" | "P3";
      };
    }
  | { type: "metric.breach"; source?: string; owner: string; urgency?: "low" | "normal" | "high" | "immediate"; data: { metricId: string; metricName?: string; current?: number | null; threshold?: number | null; target?: number | null; message: string; priority?: "P0" | "P1" | "P2" | "P3" } }
  | { type: "metric.recovered"; source?: string; owner: string; urgency?: "low" | "normal" | "high" | "immediate"; data: { metricId: string; metricName?: string; priority?: "P0" | "P1" | "P2" | "P3" } }
  | { type: "metric.stalled"; source?: string; owner: string; urgency?: "low" | "normal" | "high" | "immediate"; data: { metricId: string; metricName?: string; message: string; priority?: "P0" | "P1" | "P2" | "P3" } }
  | {
      type: "guard.triggered";
      owner: string;
      source: "workflow" | "tool";
      data: {
        workflow?: string;
        workflowRunId?: string;
        projectId?: string;
        parentSessionId?: string;
        sessionId?: string;
        guard: string;
        demandType: "warn" | "block" | "run_step";
        action: "warned" | "blocked" | "injected" | "skipped_duplicate" | "skipped_invalid" | "skipped_limit";
        reason: string;
        sourceEventType: string;
        step?: string;
        injectedStepLabel?: string;
        injectedAgent?: string;
      };
    }
  | {
      type: "session.resume_failed";
      source: "manager";
      owner: string;
      timestamp: number;
      data: {
        sessionId: string;
        agent?: string;
        workflowRunId?: string;
        projectId?: string;
        reason: string;
        category: string;
        recoverable: boolean;
        nextAction?: string;
      };
    }
  | {
      type: "workflow.resume_failed";
      source: "workflow-tool";
      owner: string;
      timestamp: number;
      data: {
        workflowRunId?: string;
        workflow?: string;
        projectId?: string;
        reason: string;
        category: string;
        recoverable: boolean;
        nextAction?: string;
      };
    }
  | {
      type: "workflow.resume_skipped";
      source: "workflow-tool";
      owner: string;
      timestamp: number;
      data: {
        workflowRunId: string;
        workflow: string;
        projectId?: string;
        status: string;
        reason: string;
        nextAction?: string;
      };
    }
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
      type: "subscriber.failed";
      source: "event-bus";
      owner: "agent:may";
      timestamp: number;
      data: {
        originalEventType: string;
        subscriberPriority: "first" | "normal";
        error: string;
      };
    }

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
 * See: shared/may-agent-docs/proposals/v2-architecture.md (Event Persistence as Invariant)
 */
export class EventBus {
  private firstSubscribers: Subscriber[] = [];
  private normalSubscribers: Subscriber[] = [];
  private emitDepth = 0;
  private reportingFailures = false;
  private pendingFailureEvents: AgentEvent[] = [];

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
    this.emitDepth++;
    try {
      for (const fn of this.firstSubscribers) {
        try {
          fn(event);
        } catch (err) {
          this.reportSubscriberFailure(event, "first", err);
        }
      }
      for (const fn of this.normalSubscribers) {
        try {
          fn(event);
        } catch (err) {
          /* subscriber errors never break the bus */
          this.reportSubscriberFailure(event, "normal", err);
        }
      }
    } finally {
      this.emitDepth--;
      if (this.emitDepth === 0) this.flushFailureEvents();
    }
  }

  /** Number of subscribers. */
  get listenerCount(): number {
    return this.firstSubscribers.length + this.normalSubscribers.length;
  }

  private reportSubscriberFailure(event: AgentEvent, priority: "first" | "normal", err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    log("warn", `[event-bus] ${priority}-priority subscriber threw on event '${event.type}': ${msg}`);
    if (event.type === "subscriber.failed") return;

    this.pendingFailureEvents.push({
      type: "subscriber.failed",
      source: "event-bus",
      owner: "agent:may",
      timestamp: Date.now(),
      data: {
        originalEventType: event.type,
        subscriberPriority: priority,
        error: msg,
      },
    });
  }

  private flushFailureEvents(): void {
    if (this.reportingFailures) return;
    this.reportingFailures = true;
    try {
      while (this.pendingFailureEvents.length > 0) {
        const failure = this.pendingFailureEvents.shift();
        if (failure) this.emit(failure);
      }
    } finally {
      this.reportingFailures = false;
    }
  }
}
