export { MAX_CONVERSATION_REQUESTS_PER_TURN, conversationRequestUpdatesSchema } from "./conversation-contract.js";
export type { AppConversationRequest, AppConversationRequestUpdate } from "./conversation-contract.js";
export { defineObserver, observationCondition } from "./observer.js";
export type { ObservationContract, ObservationInterest, ObserverHealth, ResourceObserver } from "./observer.js";
export { ExecutionDeferredError } from "./workflow.js";
export type { ExecutionDeferral } from "./workflow.js";
import type { Static, TSchema } from "typebox";
import type { AppConversationRequest } from "./conversation-contract.js";
import type { AppEvent, EventSelector } from "./event.js";
import type { ObservationContract, ResourceObserver } from "./observer.js";
import type { Condition, ResourceCreator, TaskAction, TaskIntent, TaskStatus } from "./task.js";
import type { MetricDefinition, ObserverContext, ObserverSnapshot, TaskAttempt, TaskDetail } from "./workflow.js";

export { Type } from "typebox";
export type { Static, TSchema } from "typebox";
export { matchesEventSelector } from "./event.js";
export type { AppEvent, AppEventTarget, EventSelector } from "./event.js";
export type {
  AgentCallOptions,
  AgentContext,
  AppRead,
  CallOptions,
  CliCallFacts,
  ExecutionResult,
  ExecutionView,
  Logger,
  MetricCalculation,
  MetricCalculationOptions,
  MetricDefinition,
  MetricRecordOptions,
  MetricView,
  ObserverContext,
  ObserverSnapshot,
  TaskAcceptedEvidence,
  TaskAcceptedEvidenceNavigation,
  TaskAcceptedEvidenceOptions,
  TaskAcceptedEvidencePage,
  TaskAttempt,
  TaskCurrentObligations,
  TaskCreatedOptions,
  TaskCreatedPage,
  TaskDetail,
  TaskEventReceipt,
  TaskExecutor,
  TaskInputObligation,
  TaskListOptions,
  TaskOutcomePage,
  TaskOutcomeProjection,
  TaskOutcomeView,
  TaskPage,
  TaskReadOptions,
  TaskReconciliationChild,
  TaskReconciliationContext,
  TaskReconciliationEvent,
  TaskReconciliationEvents,
  TaskReconciliationSnapshotTask,
  TaskView,
  TaskWorkload,
  TaskWorkloadOptions,
  WorkflowContext,
  WorkflowInput,
  WorkflowMetricCapability,
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
  result?: Record<string, unknown>;
  facts?: string[];
};

/**
 * Read-only current observation of the exact dependency linked by the host.
 * It gives a reawakened owner enough facts to review the dependency without
 * exposing inbox leases, task storage, or runtime query capabilities.
 */
export type AppDependencyObservation = {
  kind: "app" | "task" | "session" | "analysis";
  id: string;
  status: TaskStatus | "error" | "interrupted" | "unknown";
  summary?: string;
  response?: string;
  result?: Record<string, unknown>;
  facts?: string[];
} & Partial<Omit<TaskDetail, "id" | "status" | "summary" | "response" | "result" | "facts">>;

/** Current canonical state for one exact Task shown in recent human context. */
export type TaskObservation = {
  appId: string;
  ref?: string;
  task: AppDependencyObservation;
};

export type AppConversationTopic = {
  id: string;
  title: string;
  openedBy: string;
  originMessageId: string;
  taskRefs: Array<{ appId: string; taskId: string; ref?: string }>;
};

export type AppConversationTopicPage = {
  items: AppConversationTopic[];
  nextCursor?: string;
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
    /** Accepted Task communication operation; may be cited as replyId in its owning Task generation. */
    communicationId?: string;
    command?: string;
    /** Human-facing context that links this turn to exact App work. */
    topicId?: string;
    /** Ordered canonical Tasks represented by this rendered command/tool view. */
    taskRefs?: Array<{ appId: string; taskId: string; ref?: string }>;
    /** Exact unfinished owner Task an adapter may follow automatically. */
    followTask?: { appId: string; taskId: string; ref?: string };
  };
  createdAt: number;
};

/** May/App-owned aggregate derived from durable messages, requests, and accepted results. */
export type AppConversationResource = {
  id: string;
  owner: string;
  /** Latest durable message sequence represented by this view. */
  version: number;
  /** Exact observed turn for human control; a stale revision cannot stop its replacement. */
  activeTurn?: {
    id: string;
    revision: number;
    /** Source coordinates for honest presentation, not additional control authority. */
    channel?: string;
    channelTargetId?: string;
    channelThreadId?: string;
    channelMessageId?: number;
  };
  /** Bounded accepted asks, independent of input handling and Task completion. */
  requests?: AppConversationRequest[];
  /** Exact incoming message currently being reconciled, when authoring an App request. */
  current?: {
    messageId: string;
    replyTo?: string;
    topicId?: string;
  };
  /** Recent lightweight contexts. Their Task state remains authoritative elsewhere. */
  topics?: AppConversationTopic[];
  /** Opaque cursor for the next older Topic page. */
  nextTopicCursor?: string;
  /** Durable messages only, in the order shared by every human surface. */
  messages: AppConversationMessage[];
};

/** Context for one admitted input, distinct from an accepted conversational Request. */
export type AppInputContext<TData = unknown> = {
  /** Inbox input identity; not an accepted Request ID. Host lifecycle and leases stay private. */
  id: string;
  source: AppInputSource;
  /** True when this input is direct work on behalf of a human Turn. */
  humanRequested?: true;
  parentId?: string;
  input: AppInput<TData>;
  /** Ordered inputs considered together in this Turn; Request updates decide which asks are resolved. */
  inputs?: ReadonlyArray<AppTaskInput>;
  /** Accepted intentions assigned through the current inputs; each needs an explicit final requestUpdate. */
  assignedRequests?: Array<
    Pick<AppConversationRequest, "id" | "revision" | "scope" | "status"> & { inputIds: string[] }
  >;
  /** Facts from this Conversation Task's earlier attempt, including an interrupted or failed Turn. */
  previousAttempt?: TaskAttempt["previousAttempt"];
  dependency?: AppDependencyObservation;
  /** Current identity, phase, outcome and summary for explicit focus. Read exact Task detail before acting. */
  focusedTask?: {
    appId: string;
    task: AppDependencyObservation;
  };
  /** Navigation from recent views. Detail and current state are read explicitly, not expanded from history. */
  referencedTasks?: Array<{ appId: string; taskId: string; ref?: string }>;
  /** Bounded exact conversation facts; it never owns or schedules work. */
  conversation?: AppConversationResource;
};

/** Pure, durable identity supplied when an admitted App input is resolved to work. */
export type AppTaskInput<TData = unknown> = {
  /** Opaque Host identity for this admitted input; safe for stable free-form task IDs. */
  id: string;
  source: AppInputSource;
  input: AppInput<TData>;
};

export type AppTaskAttachment =
  | { kind: "existing"; taskId: string }
  | {
      kind: "desired";
      intent: TaskIntent;
      /** Revise this exact existing App-owned Task only if the caller observed this generation. */
      expectedGeneration?: number;
    };

export type ConversationTopicDecision =
  { kind: "none" } | { kind: "new"; title: string } | { kind: "existing"; id: string };

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
        /** `latest` publishes the newest missed inbox slot after downtime (default).
         * A retained slot publication keeps its original input across reload/restart;
         * changed instructions apply to the next unpublished slot. Delivery may repeat. */
        catchUp?: "none" | "latest";
      }
    | {
        event: AppEvent;
        input?: never;
        /** Event schedules resume from the shared scheduler; they do not replay missed facts. */
        catchUp?: never;
      }
  );

/** Observation memory is small discovery metadata, not logs or retained provider history. */
export const MAX_OBSERVER_SNAPSHOT_BYTES = 64 * 1024;

export type AppObserverResult = {
  events: AppEvent[];
  /** Plain JSON, at most 64 KiB UTF-8 and 32 levels deep (no cycles/nonfinite numbers).
   * Installed after every event is durably published, not after Task handling.
   * A partial append retains the old snapshot and can replay the prefix.
   * Reset on reload/restart. An empty batch may also advance memory. */
  nextObservation: ObserverSnapshot;
};

export type AppObserver = {
  id: string;
  intervalMs: number;
  /** Return observed facts; the Host persists them even when no consumer needs
   * work. Declared subscriptions and Conditions still own their delivery. */
  run(context: ObserverContext): Promise<AppEvent[] | AppObserverResult>;
};

export type AppContract = {
  appId: string;
  /** App owner agent; receives work without a more specific assignment and coordinates its scope. */
  agent: string;
  inputSchema: TSchema;
  observations: ObservationContract[];
  /** Presence confirms that the loaded Host exposes this App's result-ending policy. */
  taskPolicy?: { closeOnResult?: true; coordination?: { taskId: string; workflow: string; maxAttemptMs: number } };
  /** Presence confirms the loaded Host's scoped workload read contract. */
  taskReads?: { workload: 1 };
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
  validateAction?: (action: TaskAction) => string | null;
  /** Optional App-specific semantic admission for externally observable waits. */
  validateCondition?: (condition: Condition) => string | null;
  /** Pure, opt-in App decision after a converged result is accepted. Only applies
   * to this App's own App-created assignments, never Task-created/delegated work.
   * Return a nonblank reason to end responsibility, or null to retain it. Inspect
   * the owner's explicit disposition and standing purpose; convergence alone is
   * not fulfillment. New input, waits or a reconsideration deadline prevent closing.
   * Result, caller answer and closure commit atomically; this is not a worker tool.
   */
  closeOnResult?: (context: AppTaskResultContext) => { reason: string } | null;
  /** Background limit; humans and declared coordination share one additional place within the Host limit. */
  maxConcurrent?: number;
  /** Trusted installed, bounded management workflow sharing the human reserve.
   * App pause still applies. The exact App-created Task must use this workflow
   * and the App's responsible agent. This grants no portfolio-control authority. */
  coordination?: { taskId: string; workflow: string; maxAttemptMs: number };
  /** Per-attempt execution deadline in ms (1..2147483647), or "unlimited" for executors that
   * support ongoing native goals (such as codex-goal). Omit or return undefined for the executor's default. */
  maxAttemptMs?:
    | number
    | "unlimited"
    | ((task: Readonly<TaskIntent>) => number | "unlimited" | undefined);
  /** Total consecutive unsuccessful attempts before owner attention (initial attempt included).
   * Defaults to 3 (initial attempt + 2 retries), spaced 30s then 60s.
   * Higher allowances keep doubling the delay up to one hour.
   * Use "unlimited" explicitly for paced retries without a count limit.
   * Cheap admission checks do not count.
   * Explicit owner retry renews the allowance; ordinary Events and spec saves do not.
   */
  maxConsecutiveFailures?: number | "unlimited";
};

export type AppTaskResultContext = {
  task: Readonly<TaskIntent>;
  creator: Readonly<ResourceCreator>;
  acceptedResult: Readonly<{
    state: "converged";
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    facts: string[];
    inputKeys?: string[];
  }>;
};

/** Conversation input executes through one stable Task per Conversation. */
export type AppConversationPolicy = {
  /** Conversation uses the common Task attempt contract. */
  mode: "task";
  /** Input kinds handled as bounded conversation. Omit for legacy all-input behavior. */
  inputKinds?: string[];
  /** Conversation used for event/API requests that do not arrive through a conversation adapter. */
  conversationId?: string;
};

/** Minimal declaration used by the App host. Domain payloads remain App-owned. */
type AppDefinitionBase<TInputSchema extends TSchema> = {
  id: string;
  version: 1;
  description?: string;
  inputSchema: TInputSchema;
  /** Pure mapping from admitted input to the one existing or desired Task that owns it. */
  task?: (input: Readonly<AppTaskInput>) => AppTaskAttachment;
  conversation?: AppConversationPolicy;
  subscriptions?: AppEventSubscription[];
  /**
   * Reviewed facts that intentionally create no inbox item or task. The host
   * records a terminal no-op only after all actionable routes are evaluated.
   */
  observations?: EventSelector[];
  schedules?: AppSchedule[];
  observers?: Array<AppObserver | ResourceObserver>;
  /**
   * App-owned metric definitions. Runtime measures declared sources on the
   * shared Host cadence.
   */
  metrics?: MetricDefinition[];
  actions?: Record<string, AppAction>;
  workspace?: AppWorkspace;
  tasks?: AppTaskPolicy;
};

/** An App extends its owner agent with scoped policy and capabilities; `agent` is its default Task owner. */
export type AppDefinition<TInputSchema extends TSchema = TSchema> = AppDefinitionBase<TInputSchema> & {
  agent: string;
};

export function defineApp<TInputSchema extends TSchema>(app: AppDefinition<TInputSchema>): AppDefinition<TInputSchema> {
  return app;
}
