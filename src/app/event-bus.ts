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
    }
  | { type: "input"; sessionId?: string; message: string; source?: string }
  | { type: "steer"; sessionId?: string; message: string; source?: string }
  | { type: "chat.start.requested"; source: string; owner: string; data: { agent?: string; message: string; channel?: string; channelThreadId?: string; channelMessageId?: number; forceNew?: boolean; requestId?: string } }
  | { type: "session.steer.requested"; source: string; owner: string; data: { sessionId: string; message: string } }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "resume"; sessionId: string }
  | { type: "session.cancel.requested"; sessionId: string; source?: string }
  | { type: "session.cancel.requested"; source: string; owner: string; urgency?: string; data: { sessionId: string; reason?: string } }
  | { type: "session.cancel_all.requested"; source: string; owner: string; urgency?: string; data: { reason?: string } }
  | { type: "project.comment.created"; source?: string; owner: string; data: { projectPath: string; comment: string; author?: string } };

/** Management commands (to core / supervisord) */
export type ManagementCommand =
  | { type: "reload" }
  | { type: "restart" }
  | { type: "shutdown" }
  | { type: "runtime.reload.requested"; source: string; owner: string; data: { reason?: string } }
  | { type: "runtime.restart.requested"; source: string; owner: string; urgency?: string; data: { reason?: string } }
  | { type: "runtime.shutdown.requested"; source: string; owner: string; urgency?: string; data: { reason?: string } };

/** Observation events (from core) */
export type SessionEvent =
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number; turnCount?: number; errorCount?: number }
  | {
      type: "session.start";
      source?: string;
      owner: string;
      timestamp?: number;
      data: {
        sessionId: string;
        agent: string;
        task: string;
        trigger: string;
        scheduledAt?: number;
        firedAt: number;
        parentSessionId?: string;
        workspacePath?: string;
        workflowRunId?: string;
        projectId?: string;
        kind?: string;
        requestId?: string;
        stepLabel?: string;
      };
    }
  | {
      type: "session.end";
      source?: string;
      owner: string;
      timestamp?: number;
      data: {
        sessionId: string;
        agent: string;
        outcome: string;
        summary: string;
        durationMs: number;
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
        kind?: string;
        requestId?: string;
        stepLabel?: string;
      };
    };

type EventUrgency = "low" | "normal" | "high" | "immediate";
type MetricPriority = "P0" | "P1" | "P2" | "P3";
type MetricTrendPoint = {
  ts?: number;
  value?: number | null;
};
type MetricEventData = {
  metricId: string;
  metricName?: string;
  project?: string;
  alertId?: string | number | null;
  alertType?: string;
  alertOp?: string | null;
  current?: number | null;
  threshold?: number | null;
  target?: number | null;
  direction?: string;
  measuredAt?: number;
  trend?: MetricTrendPoint[];
  message?: string;
  priority?: MetricPriority;
};

/** System events */
export type SystemEvent =
  | { type: "heartbeat"; agent: string; entry: string }
  | { type: "heartbeat.trigger"; source?: string; owner: string; data: { agent: string } }
  | { type: "heartbeat.skipped"; source?: string; owner: string; data: { agent: string; gate: string; reason?: string; attempts?: number } }
  | { type: "heartbeat.step_started"; source?: string; owner: string; data: { agent?: string; workflow: string; step: string } }
  | { type: "heartbeat.diagnostics_started"; source?: string; owner: string; data: { agent: string; step: string } }
  | { type: "heartbeat.diagnostics_completed"; source?: string; owner: string; data: { agent: string; step: string; summary: string } }
  | { type: "handler.started"; source: "cron"; owner: string; data: { handler: string; agent: string } }
  | { type: "handler.completed"; source: "cron"; owner: string; data: { handler: string; agent: string; durationMs: number } }
  | { type: "handler.failed"; source: "cron"; owner: string; data: { handler: string; agent: string; error: string; durationMs: number } }
  | { type: "handler.load-failed"; source: "handler-loader"; owner: string; data: { handler: string; agent: string; path: string; error: string } }
  | { type: "handler.skipped"; source?: string; owner: string; data: { handler: string; reason: string; eventType?: string | null; [key: string]: unknown } }
  | { type: "handler.workflow_dispatched"; source?: string; owner: string; data: { handler: string; workflow: string; source?: string | null; projectId?: string | null; workflowRunId?: string | null; status: string; [key: string]: unknown } }
  | { type: "session.completed"; source: "runtime"; owner: string; data: { sessionId: string; agent: string; parentSessionId?: string; outcome?: string; status?: string; source?: string; kind?: string; error?: string; task?: string } }
  | { type: "project.iteration"; source?: string; owner: string; data: { iteration: number; project?: string; projectId?: string; projectPath?: string } }
  | { type: "project.status_changed"; source?: string; owner: string; data: { from: string; to: string; project?: string; projectId?: string; projectPath?: string } }
  | { type: "project.nudge"; source: string; owner: string; data: { projectPath: string; comment?: boolean; commentText?: string } }
  | { type: "telegram.reply"; source: "telegram"; owner: string; data: { enriched: boolean; originalMsgId?: number; projectPath?: string; delivery?: string; hasSessionCtx?: boolean; hasDbCtx?: boolean; fallback?: string; reason?: string } }
  | {
      type: "escalation.created";
      source: string;
      owner: string;
      urgency?: EventUrgency;
      ttl_ms?: number;
      data: {
        escalationId: string;
        sourceAgent: string;
        reason: string;
        requestedAction: string;
        severity?: "P0" | "P1" | "P2" | "P3";
        sourceSessionId?: string;
        projectId?: string;
        projectPath?: string;
        parentEscalationId?: string;
        blockedOn?: string;
        evidence?: Record<string, unknown>;
        resume?: Record<string, unknown>;
        dedupKey?: string;
      };
    }
  | {
      type: "escalation.routed";
      source: string;
      owner: string;
      data: {
        escalationId: string;
        route: string;
        reason?: string;
      };
    }
  | {
      type: "escalation.resolved";
      source: string;
      owner: string;
      data: {
        escalationId: string;
        resolverAgent?: string;
        outcome: "fixed" | "answered" | "dismissed" | "needs_human" | "expired" | string;
        summary: string;
        evidence?: Record<string, unknown>;
        resumeInstruction?: string;
        childEscalationId?: string;
      };
    }
  | {
      type: "escalation.dismissed";
      source: string;
      owner: string;
      data: {
        escalationId: string;
        reason: string;
        resolverAgent?: string;
      };
    }
  | {
      type: "escalation.resume_attempted";
      source: "escalation-lifecycle";
      owner: string;
      data: {
        escalationId: string;
        resolvedEscalationId?: string;
        parentEscalationId?: string;
        outcome: string;
        sourceKind: "session";
        sourceRef: string;
        sourceSessionId: string;
        resumeInstruction: string;
      };
    }
  | {
      type: "escalation.resume_started";
      source: "escalation-lifecycle";
      owner: string;
      data: {
        escalationId: string;
        resolvedEscalationId?: string;
        parentEscalationId?: string;
        outcome: string;
        sourceKind: "session";
        sourceRef: string;
        sourceSessionId: string;
        resumedSessionId: string;
        summary: string;
      };
    }
  | {
      type: "escalation.resume_failed";
      source: "escalation-lifecycle";
      owner: string;
      data: {
        escalationId?: string;
        resolvedEscalationId?: string;
        parentEscalationId?: string;
        outcome?: string;
        sourceKind?: "session" | "workflow" | "unknown";
        sourceRef?: string;
        sourceSessionId?: string;
        workflowRunId?: string;
        reason: string;
        category: string;
        recoverable: boolean;
      };
    }
  | {
      type: "message.created";
      source: string;
      owner: string;
      urgency?: EventUrgency;
      data: {
        from: string;
        to: string;
        content: string;
        intent?: string;
        artifact?: string;
        priority?: "P0" | "P1" | "P2" | "P3";
      };
    }
  | {
      type: "message.delivery_failed";
      source: string;
      owner: string;
      urgency?: EventUrgency;
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
  | { type: "metric.breach"; source?: string; owner: string; urgency?: EventUrgency; data: MetricEventData & { message: string } }
  | { type: "metric.recovered"; source?: string; owner: string; urgency?: EventUrgency; data: MetricEventData }
  | { type: "metric.stalled"; source?: string; owner: string; urgency?: EventUrgency; data: MetricEventData & { message: string } }
  | {
      type: "metric.feedback.routed";
      source?: string;
      owner: string;
      timestamp?: number;
      data: {
        metricId: string;
        alertId?: string | number | null;
        project?: string | null;
        appId: string;
        appPath?: string;
        route: "owner-app";
        eventType?: string;
      };
    }
  | { type: "metric.threshold_changed"; source?: string; owner: string; data: { metricId: string; from?: number | null; to: number } }
  | { type: "metric.alert_resolved"; source?: string; owner: string; data: { metricId: string; alertId: number; reason?: string | null } }
  | { type: "metric.alert_judged"; source?: string; owner: string; data: { metricId: string; alertId: string | number; verdict?: string; reason?: string; evidence?: Record<string, unknown> } }
  | { type: "agent.decision"; source?: string; owner: string; data: { agent: string; sessionId?: string; decision: string; evidence?: Record<string, unknown> } }
  | { type: "context.read"; source?: string; owner: string; data: { agent?: string; sessionId?: string; [key: string]: unknown } }
  | { type: "learning.feedback"; source?: string; owner: string; urgency?: "low" | "normal" | "high" | "immediate"; data: { [key: string]: unknown } }
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
  return typeof eventData(event).sessionId === "string";
}

/** Return an event's domain payload. Canonical envelopes use data; flat stream events are their own payload. */
export function eventData(event: unknown): Record<string, unknown> {
  const record = event && typeof event === "object" && !Array.isArray(event) ? event as Record<string, unknown> : {};
  return record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : record;
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
