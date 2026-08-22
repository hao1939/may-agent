import type { Static, TSchema } from "typebox";
import type { AppEvent, EventSelector } from "./event.js";
import type { TaskAction, TaskIntent } from "./task.js";
import type { ObserverContext } from "./workflow.js";

export { Type } from "typebox";
export type { Static, TSchema } from "typebox";
export { matchesEventSelector } from "./event.js";
export type { AppEvent, AppEventTarget, EventSelector } from "./event.js";
export type {
  AppRead,
  ExecutionResult,
  ExecutionView,
  Logger,
  MetricDefinition,
  MetricRecordOptions,
  MetricView,
  ObserverContext,
  TaskAttempt,
  TaskDetail,
  TaskEventReceipt,
  TaskExecutor,
  TaskView,
  TaskListOptions,
  TaskPage,
  TaskReconciliationChild,
  TaskReconciliationContext,
  TaskReconciliationEvent,
  TaskReconciliationEvents,
  TaskReconciliationSnapshotTask,
  WorkflowContext,
  WorkflowInput,
  WorkflowMetricCapability,
  AgentCallOptions,
} from "./workflow.js";

/** Canonical envelope for durable input addressed to an App. */
export type AppInput<TData = unknown> = {
  kind: string;
  data: TData;
};

export type AppInputSource = {
  kind: "human" | "app" | "system";
  id: string;
};

export type AppResult = {
  summary: string;
  response?: string;
  evidence?: string[];
};

/**
 * Read-only current observation of the exact dependency linked by the host.
 * It gives a reawakened owner enough evidence to review the dependency without
 * exposing inbox leases, task storage, or runtime query capabilities.
 */
export type AppDependencyObservation = {
  kind: "app" | "task" | "session" | "analysis";
  id: string;
  status: "pending" | "running" | "waiting" | "attention" | "done" | "error" | "interrupted" | "unknown";
  summary?: string;
  response?: string;
  evidence?: string[];
};

/** Stable identity of a resource currently involved in fulfilling human work. */
export type AppResourceRef = {
  kind: "request" | "task" | "session" | "analysis";
  id: string;
};

/** Human-facing projection of one durable human request; it never owns work. */
export type AppWorkView = {
  requestId: string;
  conversationId?: string;
  message: string;
  state: "queued" | "working" | "analyzing" | "waiting" | "ready" | "done";
  progress?: string;
  /** Semantic result when available. Ordinary views are bounded; an exact work read returns it in full. */
  result?: AppResult;
  /** Most recent execution attempt, when one is known. */
  executor?: AppResourceRef;
  /** Exact request or resource this work is waiting for, when suspended. */
  dependency?: AppResourceRef;
  createdAt: number;
  /** First time the request was claimed for processing. */
  startedAt?: number;
  /** Last user-visible state, progress, link, or result change; lease heartbeats never advance it. */
  changedAt: number;
};

export type AppConversationMessage = {
  id: string;
  sequence: number;
  author: {
    kind: "human" | "agent" | "tool" | "command";
    id: string;
  };
  text: string;
  replyTo?: string;
  metadata?: {
    channel?: string;
    channelTargetId?: string;
    channelThreadId?: string;
    channelMessageId?: number;
    requestId?: string;
    command?: string;
    /** Ordered work identities represented by this rendered command/tool view. */
    requestIds?: string[];
    /** Ordered canonical Tasks represented by this rendered command/tool view. */
    taskRefs?: Array<{ appId: string; taskId: string }>;
  };
  createdAt: number;
};

/** May/App-owned aggregate derived from durable messages, requests, and accepted results. */
export type AppConversationResource = {
  id: string;
  owner: string;
  /** Latest durable message sequence represented by this view. */
  version: number;
  /** Exact incoming message currently being reconciled, when authoring an App request. */
  current?: {
    messageId: string;
    replyTo?: string;
  };
  /** Derived human work for this read; ordinary owner reads contain only other active requests. */
  work?: AppWorkView[];
  /** Durable messages only, in the order shared by every human surface. */
  messages: AppConversationMessage[];
};

/** Author-visible request. Host lifecycle and lease fields stay private. */
export type AppRequest<TData = unknown> = {
  id: string;
  source: AppInputSource;
  parentId?: string;
  input: AppInput<TData>;
  dependency?: AppDependencyObservation;
  /** Bounded exact conversation evidence; it never owns or schedules work. */
  conversation?: AppConversationResource;
};

/** Pure, durable identity supplied when an admitted App input is resolved to work. */
export type AppTaskInput<TData = unknown> = {
  /** Opaque Host identity for this admitted input; safe for stable free-form task IDs. */
  id: string;
  source: AppInputSource;
  input: AppInput<TData>;
};

export type AppTaskAttachment = { kind: "existing"; taskId: string } | { kind: "desired"; intent: TaskIntent };

export type AppInboxBatchMode = "single" | "coalesce-compatible";

export type AppEventSubscription = {
  /** Stable identity combined with the source event id for idempotency. */
  id: string;
  event: EventSelector;
  /** Pure translation only. The host validates the result before persistence. */
  toInput(event: AppEvent<Record<string, unknown>>): AppInput | null;
};

type AppScheduleBase = {
  id: string;
  enabled?: boolean;
  intervalMs: number;
};

/** A timer may address the App inbox or publish a fact for task reconciliation. */
export type AppSchedule = AppScheduleBase &
  (
    | {
        input: AppInput;
        event?: never;
        /** `latest` admits at most the newest missed inbox slot after downtime. */
        catchUp?: "none" | "latest";
      }
    | {
        event: AppEvent;
        input?: never;
        /** Event schedules resume from the shared scheduler; they do not replay missed facts. */
        catchUp?: never;
      }
  );

export type AppObserver = {
  id: string;
  intervalMs: number;
  /** Return observed facts; the host publishes them after the run succeeds. */
  run(context: ObserverContext): Promise<AppEvent[]>;
};

export type AppAction<TInputSchema extends TSchema = TSchema> = {
  description: string;
  inputSchema: TInputSchema;
  toInput(input: Static<TInputSchema>): AppInput;
};

export type AppWorkspace = {
  kind: "git" | "local";
  localPath: string;
  branch?: string;
};

/** Optional durable-task policy. Mechanics and storage remain host-private. */
export type AppTaskPolicy = {
  subscriptions?: EventSelector[];
  resolve?: (event: AppEvent<Record<string, unknown>>) => TaskIntent | null;
  validateAction?: (action: TaskAction) => string | null;
  maxConcurrent?: number;
  resyncIntervalMs?: number;
};

/** Minimal declaration used by the App host. Domain payloads remain App-owned. */
export type AppDefinition<TInputSchema extends TSchema = TSchema> = {
  id: string;
  version: 1;
  owner: string;
  description?: string;
  inputSchema: TInputSchema;
  /** Pure mapping from admitted input to the one existing or desired Task that owns it. */
  task?: (input: Readonly<AppTaskInput>) => AppTaskAttachment;
  subscriptions?: AppEventSubscription[];
  /**
   * Reviewed facts that intentionally create no inbox item or task. The host
   * records a terminal no-op only after all actionable routes are evaluated.
   */
  observations?: EventSelector[];
  inbox?: { batch?: AppInboxBatchMode; maxConcurrent?: number };
  schedules?: AppSchedule[];
  observers?: AppObserver[];
  actions?: Record<string, AppAction>;
  workspace?: AppWorkspace;
  tasks?: AppTaskPolicy;
};

export function defineApp<TInputSchema extends TSchema>(app: AppDefinition<TInputSchema>): AppDefinition<TInputSchema> {
  return app;
}
