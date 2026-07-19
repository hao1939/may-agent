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

import { AsyncLocalStorage } from "node:async_hooks";
import { log } from "../lib/log.js";
import { DEFAULT_OWNER_DELIVERY_NOTE } from "../lib/event-delivery.js";

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
  | {
      type: "human.input.received";
      source: string;
      owner: string;
      data: {
        inputId?: string;
        actor?: string;
        text: string;
        conversation?: {
          id?: string;
          channel?: string;
          channelThreadId?: string;
          channelMessageId?: number;
          replyToInputId?: string;
        };
        target?: {
          owner?: string;
          agent?: string;
          sessionId?: string;
          projectPath?: string;
          taskId?: string;
        };
        context?: Record<string, unknown>;
      };
    }
  | {
      type: "chat.start.requested";
      source: string;
      owner: string;
      data: {
        agent?: string;
        message: string;
        channel?: string;
        channelThreadId?: string;
        channelMessageId?: number;
        forceNew?: boolean;
        requestId?: string;
        context?: Record<string, unknown>;
      };
    }
  | {
      type: "session.steer.requested";
      source: string;
      owner: string;
      data: { sessionId: string; message: string; context?: Record<string, unknown> };
    }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "resume"; sessionId: string }
  | { type: "session.cancel.requested"; sessionId: string; source?: string }
  | {
      type: "session.cancel.requested";
      source: string;
      owner: string;
      urgency?: string;
      data: { sessionId: string; reason?: string };
    }
  | { type: "session.cancel_all.requested"; source: string; owner: string; urgency?: string; data: { reason?: string } }
  | {
      type: "project.comment.created";
      source?: string;
      owner: string;
      data: { projectPath: string; comment: string; author?: string };
    };

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
  | {
      type: "turn_end";
      sessionId: string;
      agent: string;
      toolCalls: number;
      durationMs: number;
      turnCount?: number;
      errorCount?: number;
    }
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
    }
  | {
      type: "session.idle";
      source?: string;
      owner: string;
      timestamp?: number;
      data: {
        sessionId: string;
        agent: string;
        summary: string;
        durationMs: number;
        status: "idle";
        error?: string;
        task?: string;
        opCount?: number;
        turnCount?: number;
        retry?: { reason?: string; attempts: number; recovered: boolean };
        finishParams?: Record<string, unknown>;
        parentSessionId?: string;
        workflowRunId?: string;
        projectId?: string;
        kind?: string;
        requestId?: string;
        stepLabel?: string;
      };
    };

type EventUrgency = "low" | "normal" | "high" | "immediate";
export type EventTraceLink = {
  eventId: number;
  type?: "reference" | "closure";
  label?: string;
};
export type EventTrace = {
  traceId: string;
  parentEventId?: number;
  links?: EventTraceLink[];
};
export type EventTraceMetadata = {
  visibility?: "default" | "detail";
  trace?: EventTrace;
};
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
  | {
      type: "heartbeat.skipped";
      source?: string;
      owner: string;
      data: { agent: string; gate: string; reason?: string; attempts?: number };
    }
  | {
      type: "heartbeat.step_started";
      source?: string;
      owner: string;
      data: { agent?: string; workflow: string; step: string };
    }
  | { type: "heartbeat.diagnostics_started"; source?: string; owner: string; data: { agent: string; step: string } }
  | {
      type: "heartbeat.diagnostics_completed";
      source?: string;
      owner: string;
      data: { agent: string; step: string; summary: string };
    }
  | {
      type: "runtime.daemon.heartbeat";
      source: "daemon";
      owner: "agent:may";
      data: { pid: number; interfaceAgent: string; socketEnabled: boolean };
    }
  | {
      type: "handler.started";
      source: "cron";
      owner: string;
      data: { handler: string; handlerRunId?: string; agent: string };
    }
  | {
      type: "handler.completed";
      source: "cron";
      owner: string;
      data: { handler: string; handlerRunId?: string; agent: string; durationMs: number };
    }
  | {
      type: "handler.failed";
      source: "cron";
      owner: string;
      data: { handler: string; handlerRunId?: string; agent: string; error: string; durationMs: number };
    }
  | {
      type: "handler.load-failed";
      source: "handler-loader";
      owner: string;
      data: { handler: string; agent: string; path: string; error: string };
    }
  | {
      type: "handler.skipped";
      source?: string;
      owner: string;
      data: { handler: string; reason: string; eventType?: string | null; [key: string]: unknown };
    }
  | {
      type: "handler.workflow_dispatched";
      source?: string;
      owner: string;
      data: {
        handler: string;
        workflow: string;
        source?: string | null;
        projectId?: string | null;
        workflowRunId?: string | null;
        status: string;
        [key: string]: unknown;
      };
    }
  | {
      type: "project.status_changed";
      source?: string;
      owner: string;
      data: { from: string; to: string; project?: string; projectId?: string; projectPath?: string };
    }
  | {
      type: "project.owner.requested";
      source?: string;
      owner: string;
      data: {
        project?: string;
        projectId?: string;
        projectPath?: string;
        reason: string;
        [key: string]: unknown;
      };
    }
  | {
      type: "project.owner.reviewed";
      source?: string;
      owner: string;
      data: { project?: string; projectId?: string; projectPath?: string; summary?: string };
    }
  | {
      type: "project.nudge";
      source: string;
      owner: string;
      data: { projectPath: string; comment?: boolean; commentText?: string };
    }
  | {
      type: "telegram.reply";
      source: "telegram";
      owner: string;
      data: {
        enriched: boolean;
        originalMsgId?: number;
        projectPath?: string;
        delivery?: string;
        hasSessionCtx?: boolean;
        hasDbCtx?: boolean;
        fallback?: string;
        reason?: string;
      };
    }
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
        resumeCondition?: string;
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
        openEventId?: number;
        escalationId?: string;
        route: string;
        reason?: string;
      };
    }
  | {
      type: "escalation.resolved";
      source: string;
      owner: string;
      data: {
        openEventId?: number;
        escalationId?: string;
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
        openEventId?: number;
        escalationId?: string;
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
        sourceKind: "session" | "project" | "workflow" | "unknown";
        sourceRef?: string;
        sourceSessionId?: string;
        workflowRunId?: string;
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
        sourceKind: "session" | "project" | "workflow";
        sourceRef: string;
        sourceSessionId?: string;
        resumedSessionId?: string;
        workflowRunId?: string;
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
      type: "cli.task.requested";
      source: string;
      owner: string;
      urgency?: EventUrgency;
      data: {
        taskId: string;
        tool: "claude" | "codex";
        mode: "investigate" | "review" | "patch";
        cwd: string;
        promptPath: string;
        resultPath: string;
        structuredResultPath?: string;
        eventsPath?: string;
        sandbox?: "read-only" | "workspace-write" | "danger-full-access";
        effectiveSandbox?: "read-only" | "workspace-write" | "danger-full-access";
        sandboxFallbackReason?: string;
        timeoutMs?: number;
        sourceOwner: string;
        sourceSessionId?: string;
        resumeSessionId?: string;
        reuseSession?: boolean;
        files?: string[];
        worktree?: string;
      };
    }
  | {
      type: "cli.task.started";
      source: "cli-task-runner";
      owner: string;
      data: {
        taskId: string;
        tool: "claude" | "codex";
        mode: "investigate" | "review" | "patch";
        cwd: string;
        promptPath: string;
        resultPath: string;
        structuredResultPath?: string;
        eventsPath?: string;
        sourceSessionId?: string;
        pid?: number;
        attempt?: number;
        effectiveSandbox?: "read-only" | "workspace-write" | "danger-full-access";
        sandboxFallbackReason?: string;
        reuseSession?: boolean;
      };
    }
  | {
      type: "cli.task.completed";
      source: "cli-task-runner";
      owner: string;
      data: {
        taskId: string;
        tool: "claude" | "codex";
        resultPath: string;
        eventsPath?: string;
        structuredResultPath?: string;
        exitCode: number;
        summary: string;
        sourceSessionId?: string;
        cliSessionId?: string;
        resumeCommand?: string[];
        effectiveSandbox?: "read-only" | "workspace-write" | "danger-full-access";
        sandboxFallbackReason?: string;
        reuseSession?: boolean;
      };
    }
  | {
      type: "cli.task.failed";
      source: "cli-task-runner";
      owner: string;
      data: {
        taskId: string;
        tool: "claude" | "codex";
        resultPath?: string;
        structuredResultPath?: string;
        eventsPath?: string;
        error: string;
        exitCode?: number;
        sourceSessionId?: string;
        cliSessionId?: string;
        resumeCommand?: string[];
        effectiveSandbox?: "read-only" | "workspace-write" | "danger-full-access";
        sandboxFallbackReason?: string;
        reuseSession?: boolean;
      };
    }
  | {
      type: "cli.task.orphaned";
      source: "cli-task-runner";
      owner: string;
      data: {
        taskId: string;
        tool?: "claude" | "codex";
        pid?: number;
        reason: string;
        structuredResultPath?: string;
        sourceSessionId?: string;
        cliSessionId?: string;
        resumeCommand?: string[];
        effectiveSandbox?: "read-only" | "workspace-write" | "danger-full-access";
        sandboxFallbackReason?: string;
        reuseSession?: boolean;
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
  | {
      type: "metric.breach";
      source?: string;
      owner: string;
      urgency?: EventUrgency;
      data: MetricEventData & { message: string };
    }
  | { type: "metric.recovered"; source?: string; owner: string; urgency?: EventUrgency; data: MetricEventData }
  | {
      type: "metric.stalled";
      source?: string;
      owner: string;
      urgency?: EventUrgency;
      data: MetricEventData & { message: string };
    }
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
  | {
      type: "metric.threshold_changed";
      source?: string;
      owner: string;
      timestamp?: number;
      data: { metricId: string; from?: number | null; to: number };
    }
  | {
      type: "metric.alert_resolved";
      source?: string;
      owner: string;
      timestamp?: number;
      data: { metricId: string; alertId: number; reason?: string | null };
    }
  | {
      type: "metric.alert_judged";
      source?: string;
      owner: string;
      data: {
        metricId: string;
        alertId: string | number;
        verdict?: string;
        reason?: string;
        evidence?: Record<string, unknown>;
      };
    }
  | {
      type: "agent.decision";
      source?: string;
      owner: string;
      data: { agent: string; sessionId?: string; decision: string; evidence?: Record<string, unknown> };
    }
  | {
      type: "context.read";
      source?: string;
      owner: string;
      data: { agent?: string; sessionId?: string; [key: string]: unknown };
    }
  | {
      type: "learning.feedback";
      source?: string;
      owner: string;
      urgency?: "low" | "normal" | "high" | "immediate";
      data: { [key: string]: unknown };
    }
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
      type: "skill.loaded";
      source: string;
      owner: string;
      data: {
        name: string;
        agent: string;
        sessionId: string;
        activation: "explicit" | "model";
        scope: string;
        filePath: string;
        contentHash: string;
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
      type: "workflow.owner.requested";
      source: string;
      owner: string;
      timestamp?: number;
      data: {
        reason: string;
        workflowRunId: string;
        workflow?: string;
        workflowOwner?: string;
        projectId?: string;
        parentSessionId?: string;
        parentWorkflowRunId?: string;
        task?: string;
        blockerReason?: string;
        resumeInstruction?: string;
        context?: unknown;
        [key: string]: unknown;
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
    };

/** All typed event types — commands + observations + system */
export type AgentEvent = (
  | AgentCommand
  | ManagementCommand
  | SessionEvent
  | SystemEvent
  | { type: "info"; message: string; channel?: string }
  | { type: "prompt"; message: string; channel?: string }
) &
  EventTraceMetadata;

// ── Helpers ────────────────────────────────────────────────────────────

/** Check if an event is session-scoped (has sessionId). */
export function isSessionEvent(event: AgentEvent): event is SessionEvent {
  return typeof eventData(event).sessionId === "string";
}

/** Return an event's domain payload. Canonical envelopes use data; flat stream events are their own payload. */
export function eventData(event: unknown): Record<string, unknown> {
  const record = event && typeof event === "object" && !Array.isArray(event) ? (event as Record<string, unknown>) : {};
  return record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? (record.data as Record<string, unknown>)
    : record;
}

// ── EventBus ───────────────────────────────────────────────────────────

export type DeliveryRoute = "direct" | "owner_inbox" | "noop";
export type DeliveryResult = {
  accepted: true;
  by: string;
  route?: DeliveryRoute;
  note?: string;
};
export type SubscriberResult = DeliveryResult | void;
export type Subscriber = (event: AgentEvent) => SubscriberResult;
export type SubscribeOptions = { priority?: "first" | "normal" };
export type DeliveryRecorder = (event: AgentEvent, result: DeliveryResult) => void;

export const EVENT_ROW_ID = Symbol.for("may-agent.eventRowId");

const eventContext = new AsyncLocalStorage<AgentEvent>();

export function childEventTrace(parent: unknown): EventTrace | undefined {
  if (!parent || typeof parent !== "object" || Array.isArray(parent)) return undefined;
  const event = parent as AgentEvent & { [EVENT_ROW_ID]?: number };
  const parentEventId = event[EVENT_ROW_ID];
  if (!Number.isInteger(parentEventId) || Number(parentEventId) <= 0) return event.trace;
  return {
    traceId: event.trace?.traceId ?? `event:${parentEventId}`,
    parentEventId,
  };
}

function inheritedEventTrace(event: AgentEvent, parent: AgentEvent | undefined): AgentEvent {
  if (event.trace || !parent) return event;
  const trace = childEventTrace(parent);
  if (!trace) return event;
  if (Object.isExtensible(event)) {
    event.trace = trace;
    return event;
  }
  return { ...event, trace } as AgentEvent;
}

/**
 * EventBus — typed pub/sub.
 *
 * Subscriber priority semantics:
 *   - The required persistence subscriber runs first and fails closed.
 *   - "first" subscribers then run before "normal" subscribers, in registration order.
 * This guarantees that if a handler triggers work, the originating event is already on disk.
 *
 * See: shared/may-agent-docs/proposals/v2-architecture.md (Event Persistence as Invariant)
 */
export class EventBus {
  private persistenceSubscriber: Subscriber | undefined;
  private firstSubscribers: Subscriber[] = [];
  private normalSubscribers: Subscriber[] = [];
  private deliveryRecorder: DeliveryRecorder | undefined;
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

  /**
   * Install the single required durability boundary.
   *
   * Unlike ordinary subscribers, an exception from this handler aborts the
   * emission before any side-effect subscriber runs. Replacing the handler is
   * intentional so daemon reload/bootstrap code can reattach persistence
   * without accumulating duplicate writers.
   */
  setPersistenceSubscriber(fn: Subscriber): void {
    this.persistenceSubscriber = fn;
  }

  setDeliveryRecorder(fn: DeliveryRecorder): void {
    this.deliveryRecorder = fn;
  }

  /** Emit an event. Persists first, then runs "first" and "normal" subscribers.
   *
   *  IMPORTANT: All subscribers are always invoked regardless of delivery status.
   *  The delivery result records which subscriber "claimed" the event for persistence
   *  tracking, but does NOT gate execution of subsequent subscribers. Multiple cron
   *  instances (e.g. May's session-recovery + evaluator's evaluation-aftermath) must
   *  all see bus events even when one claims delivery first. */
  emit(input: AgentEvent): AgentEvent & { [EVENT_ROW_ID]?: number } {
    const tracedEvent = inheritedEventTrace(input, eventContext.getStore());
    // DbWriter attaches the durable row id to the routed envelope. Frozen
    // producer input must not silently lose delivery and child-trace metadata.
    const event = Object.isExtensible(tracedEvent) ? tracedEvent : ({ ...tracedEvent } as AgentEvent);
    this.emitDepth++;
    let delivery: DeliveryResult | undefined;
    try {
      // Required durability is deliberately outside subscriber error
      // isolation. If persistence fails, no side-effect handler may run.
      if (this.persistenceSubscriber) {
        delivery = normalizeDeliveryResult(eventContext.run(event, () => this.persistenceSubscriber!(event)));
      }
      for (const fn of this.firstSubscribers) {
        try {
          const result = normalizeDeliveryResult(eventContext.run(event, () => fn(event)));
          delivery ??= result;
        } catch (err) {
          this.reportSubscriberFailure(event, "first", err);
        }
      }
      for (const fn of this.normalSubscribers) {
        try {
          const result = normalizeDeliveryResult(eventContext.run(event, () => fn(event)));
          delivery ??= result;
        } catch (err) {
          /* subscriber errors never break the bus */
          this.reportSubscriberFailure(event, "normal", err);
        }
      }
      delivery ??= ownerInboxFallback(event);
      delivery ??= pairTrackerFallback(event);
      delivery ??= evidenceProjectionFallback(event);
      delivery ??= defaultOwnerFallback(event);
      if (delivery) this.deliveryRecorder?.(event, delivery);
    } finally {
      this.emitDepth--;
      if (this.emitDepth === 0) this.flushFailureEvents();
    }
    return event as AgentEvent & { [EVENT_ROW_ID]?: number };
  }

  /** Number of subscribers. */
  get listenerCount(): number {
    return this.firstSubscribers.length + this.normalSubscribers.length + (this.persistenceSubscriber ? 1 : 0);
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

function normalizeDeliveryResult(result: SubscriberResult): DeliveryResult | undefined {
  if (!result || result.accepted !== true || typeof result.by !== "string" || !result.by.trim()) return undefined;
  return {
    accepted: true,
    by: result.by.trim(),
    ...(result.route ? { route: result.route } : {}),
    ...(result.note ? { note: result.note } : {}),
  };
}

function ownerInboxFallback(event: AgentEvent): DeliveryResult | undefined {
  if (!isOwnerInboxCandidate(event.type)) return undefined;
  const record = event as Record<string, unknown>;
  const owner = typeof record.owner === "string" ? record.owner.trim() : "";
  if (!owner) return undefined;
  return {
    accepted: true,
    by: `owner-inbox:${owner}`,
    route: "owner_inbox",
    note: "owner-addressed event accepted by owner inbox fallback",
  };
}

function pairTrackerFallback(event: AgentEvent): DeliveryResult | undefined {
  if (!isPairTrackedEvent(event.type)) return undefined;
  if (!hasPairCorrelationKey(event)) return undefined;
  return {
    accepted: true,
    by: "event-pair-tracker",
    route: "direct",
    note: "lifecycle event accepted by pair tracker",
  };
}

function defaultOwnerFallback(event: AgentEvent): DeliveryResult | undefined {
  const record = event as Record<string, unknown>;
  const owner = typeof record.owner === "string" ? record.owner.trim() : "";
  if (!owner) return undefined;
  return {
    accepted: true,
    by: `owner-inbox:${owner}`,
    route: "owner_inbox",
    note: `${DEFAULT_OWNER_DELIVERY_NOTE}; persisted in queryable owner inbox`,
  };
}

const EVIDENCE_PROJECTION_EVENT_TYPES = new Set([
  "runtime.daemon.heartbeat",
  "handler.workflow_dispatched",
  "handler.skipped",
  "metric.feedback.routed",
  "metric.alert_judged",
  "project.knowledge.maintained",
]);

function evidenceProjectionFallback(event: AgentEvent): DeliveryResult | undefined {
  const isEvidence =
    event.type.startsWith("evaluation.") ||
    EVIDENCE_PROJECTION_EVENT_TYPES.has(event.type) ||
    event.type.startsWith("channel.delivery.") ||
    event.type === "project.owner.reviewed" ||
    event.type === "guard.triggered" ||
    event.type === "skill.loaded";
  if (!isEvidence) return undefined;
  return {
    accepted: true,
    by: "event-store:evidence-projection",
    route: "direct",
    note: "terminal evidence persisted for trace projection",
  };
}

function isPairTrackedEvent(eventType: string): boolean {
  return new Set([
    "session.start",
    "session.end",
    "session.idle",
    "workflow.started",
    "workflow.completed",
    "workflow.failed",
    "workflow.blocked",
    "handler.started",
    "handler.completed",
    "handler.failed",
    "cli.task.requested",
    "cli.task.started",
    "cli.task.completed",
    "cli.task.failed",
    "cli.task.orphaned",
    "message.reviewed",
    "message.expired",
    "project.feedback.reviewed",
    "owner.inbox.reviewed",
    "owner.inbox.expired",
  ]).has(eventType);
}

function hasPairCorrelationKey(event: AgentEvent): boolean {
  const data = eventData(event);
  const eventType = String(event.type);
  if (event.type.startsWith("session.")) return hasKey(data.sessionId);
  if (event.type.startsWith("workflow.")) return hasKey(data.workflowRunId);
  if (event.type.startsWith("handler."))
    return hasKey(data.handlerRunId) || hasKey(data.workflowRunId) || hasKey(data.handler);
  if (event.type.startsWith("escalation.")) return hasKey(data.openEventId) || hasKey(data.escalationId);
  if (event.type.startsWith("cli.task.")) return hasKey(data.taskId);
  if (event.type.startsWith("project.task.")) return hasKey(data.taskId);
  if (
    eventType === "message.reviewed" ||
    eventType === "message.expired" ||
    eventType === "project.feedback.reviewed" ||
    eventType === "project.owner.reviewed" ||
    eventType === "owner.inbox.reviewed" ||
    eventType === "owner.inbox.expired"
  )
    return hasKey(data.openEventId);
  return false;
}

function hasKey(value: unknown): boolean {
  return (typeof value === "string" && !!value.trim()) || (typeof value === "number" && Number.isFinite(value));
}

function isOwnerInboxCandidate(eventType: string): boolean {
  if (eventType === "message.created" || eventType === "learning.feedback") return true;
  if (eventType === "metric.breach" || eventType === "metric.recovered" || eventType === "metric.stalled") return true;
  if (eventType === "escalation.created") return true;
  if (eventType === "cli.task.completed" || eventType === "cli.task.failed" || eventType === "cli.task.orphaned")
    return true;
  if (eventType === "project.feedback.created" || eventType === "project.comment.created") return true;
  if (eventType === "project.owner.requested") return true;
  return eventType === "workflow.owner.requested" || eventType === "evaluation.session.requested";
}
