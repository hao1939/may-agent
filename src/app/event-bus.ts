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
        conversationId?: string;
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
  | {
      type: "app.input.requested";
      source?: string;
      owner: string;
      data: {
        appId: string;
        input: { kind: string; data: unknown };
        source?: { kind: "human" | "app" | "system"; id: string };
        parentId?: string;
        conversationId?: string;
        conversationSequence?: number;
        channel?: string;
        channelThreadId?: string;
        channelMessageId?: number;
        idempotencyKey?: string;
      };
    }
  | {
      type: "app.dependency.completed";
      source?: string;
      owner: string;
      data: { kind: "app" | "task" | "session"; id: string };
    }
  | {
      type: "app.response.delivery.requested";
      source: "app-inbox";
      owner: string;
      target: { human: true } | { agent: string };
      data: {
        appId: string;
        operationId: string;
        appInboxItemId: string;
        appInboxRequestId: string;
        sessionId: string;
        channel: string;
        channelThreadId?: string;
        channelMessageId?: number;
        conversationId?: string;
        text: string;
      };
    }
  | {
      type: "channel.delivery.completed" | "channel.delivery.failed";
      source: string;
      owner: string;
      target: { human: true } | { agent: string };
      data: {
        channel: string;
        sessionId?: string;
        resultEventType?: string;
        operationId?: string;
        appInboxItemId?: string;
        appInboxRequestId?: string;
        externalMessageId?: string | number;
        certainty?: "not-delivered" | "uncertain";
        reason?: string;
        [key: string]: unknown;
      };
    }
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
        sourceSessionId?: string;
        sourceAppId?: string;
        appResponseFor?: string;
        appDeliveryOperationId?: string;
        idempotencyKey?: string;
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
        activation: "explicit" | "model" | "rule";
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
      type: "evaluation.recorded";
      source?: string;
      owner: string;
      timestamp?: number;
      data: {
        source?: string;
        idempotencyKey?: string;
        evaluation: {
          sessionId: string;
          agent: string;
          quality: number;
          efficiency: number;
          verdict: string;
          issues: string[];
          productiveCalls?: number;
          wastedCalls?: number;
          lane?: string;
          reason?: string;
          signals?: string[];
          overall?: Record<string, unknown>;
          createdAt?: number;
        };
      };
      target?: {
        appId?: string;
        project?: string;
        sessionId?: string;
      };
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

export type DeliveryRoute = "direct" | "noop";
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
export const EVENT_DEDUPLICATED = Symbol.for("may-agent.eventDeduplicated");
export const EVENT_REDELIVERY_REQUIRED = Symbol.for("may-agent.eventRedeliveryRequired");
export const EVENT_INGRESS_SOURCE = Symbol.for("may-agent.eventIngressSource");
/** Marks events admitted through the semantic EventInput boundary. */
export const EVENT_INTERFACE_INPUT = Symbol.for("may-agent.eventInterfaceInput");
export const EVENT_RECORD_ONLY = Symbol.for("may-agent.eventRecordOnly");
export const EVENT_SUBSCRIBER_WARN_MS = 25;

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
  private durableRouteSubscribers: Subscriber[] = [];
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
   * Register an idempotent admission route that must also run when retrying an
   * event persisted before its delivery acceptance was recorded.
   */
  subscribeDurableRoute(fn: Subscriber): () => void {
    this.durableRouteSubscribers.push(fn);
    return () => {
      this.durableRouteSubscribers = this.durableRouteSubscribers.filter((subscriber) => subscriber !== fn);
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
   *  For an ordinary emission, all subscribers run regardless of which one records
   *  delivery acceptance. A retry of an already-persisted pending event is different:
   *  it uses only the built-in idempotent recovery routes because an ordinary
   *  subscriber may already have performed its effect before the earlier process
   *  stopped. */
  emit(input: AgentEvent): AgentEvent & { [EVENT_ROW_ID]?: number } {
    const tracedEvent = inheritedEventTrace(input, eventContext.getStore());
    // DbWriter attaches the durable row id to the routed envelope. Frozen
    // producer input must not silently lose delivery and child-trace metadata.
    const event = Object.isExtensible(tracedEvent) ? tracedEvent : ({ ...tracedEvent } as AgentEvent);
    this.emitDepth++;
    let delivery: DeliveryResult | undefined;
    let durableRouteFailed = false;
    try {
      // Required durability is deliberately outside subscriber error
      // isolation. If persistence fails, no side-effect handler may run.
      if (this.persistenceSubscriber) {
        delivery = normalizeDeliveryResult(this.runSubscriber(event, "persistence", this.persistenceSubscriber));
      }
      // Retry-safe ingress may resolve to an already-persisted event. Return
      // that receipt without delivering the same intent or effect again.
      const retry = event as AgentEvent & {
        [EVENT_DEDUPLICATED]?: boolean;
        [EVENT_REDELIVERY_REQUIRED]?: boolean;
      };
      if (retry[EVENT_DEDUPLICATED] && !retry[EVENT_REDELIVERY_REQUIRED]) {
        return event as AgentEvent & { [EVENT_ROW_ID]?: number };
      }
      for (const fn of this.durableRouteSubscribers) {
        try {
          const result = normalizeDeliveryResult(this.runSubscriber(event, "first", fn));
          delivery ??= result;
        } catch (err) {
          durableRouteFailed = true;
          this.reportSubscriberFailure(event, "first", err);
        }
      }
      // Pending retry recovery deliberately uses only the built-in idempotent
      // pair/evidence/owner routes below. Ordinary fan-out subscribers may
      // already have performed an effect before the original process stopped.
      if (!retry[EVENT_REDELIVERY_REQUIRED]) {
        for (const fn of this.firstSubscribers) {
          try {
            const result = normalizeDeliveryResult(this.runSubscriber(event, "first", fn));
            delivery ??= result;
          } catch (err) {
            this.reportSubscriberFailure(event, "first", err);
          }
        }
        for (const fn of this.normalSubscribers) {
          try {
            const result = normalizeDeliveryResult(this.runSubscriber(event, "normal", fn));
            delivery ??= result;
          } catch (err) {
            /* subscriber errors never break the bus */
            this.reportSubscriberFailure(event, "normal", err);
          }
        }
      }
      if (!durableRouteFailed) {
        delivery ??= pairTrackerFallback(event);
        if (!delivery && (event as AgentEvent & { [EVENT_RECORD_ONLY]?: boolean })[EVENT_RECORD_ONLY]) {
          delivery = {
            accepted: true,
            by: "event-interface:record",
            route: "noop",
            note: "record-only event persisted; no responsible consumer required",
          };
        }
        if (delivery) this.deliveryRecorder?.(event, delivery);
      }
    } finally {
      this.emitDepth--;
      if (this.emitDepth === 0) this.flushFailureEvents();
    }
    return event as AgentEvent & { [EVENT_ROW_ID]?: number };
  }

  /** Number of subscribers. */
  get listenerCount(): number {
    return (
      this.durableRouteSubscribers.length +
      this.firstSubscribers.length +
      this.normalSubscribers.length +
      (this.persistenceSubscriber ? 1 : 0)
    );
  }

  private runSubscriber(
    event: AgentEvent,
    priority: "persistence" | "first" | "normal",
    fn: Subscriber,
  ): SubscriberResult {
    const startedAt = performance.now();
    try {
      return eventContext.run(event, () => fn(event));
    } finally {
      const durationMs = performance.now() - startedAt;
      if (durationMs >= EVENT_SUBSCRIBER_WARN_MS) {
        log("warn", `[event-bus] ${priority} subscriber took ${durationMs.toFixed(1)}ms on event '${event.type}'`);
      }
    }
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

function isPairTrackedEvent(eventType: string): boolean {
  return new Set([
    "session.start",
    "session.end",
    "session.idle",
    "workflow.started",
    "workflow.completed",
    "workflow.failed",
    "workflow.blocked",
    "workflow.interrupted",
    "handler.started",
    "handler.completed",
    "handler.failed",
    "cli.task.requested",
    "cli.task.started",
    "cli.task.completed",
    "cli.task.failed",
    "cli.task.orphaned",
  ]).has(eventType);
}

function hasPairCorrelationKey(event: AgentEvent): boolean {
  const data = eventData(event);
  if (event.type.startsWith("session.")) return hasKey(data.sessionId);
  if (event.type.startsWith("workflow.")) return hasKey(data.workflowRunId);
  if (event.type.startsWith("handler."))
    return hasKey(data.handlerRunId) || hasKey(data.workflowRunId) || hasKey(data.handler);
  if (event.type.startsWith("cli.task.")) return hasKey(data.taskId);
  return false;
}

function hasKey(value: unknown): boolean {
  return (typeof value === "string" && !!value.trim()) || (typeof value === "number" && Number.isFinite(value));
}
