import { Type, type Static, type TSchema } from "typebox";
import type { AppEvent, EventSelector } from "./event.js";
import type { Condition, TaskAction, TaskIntent } from "./task.js";
import type { MetricDefinition, ObserverContext, ObserverSnapshot, TaskDetail } from "./workflow.js";

export { Type } from "typebox";
export type { Static, TSchema } from "typebox";
export { matchesEventSelector } from "./event.js";
export type { AppEvent, AppEventTarget, EventSelector } from "./event.js";
export type {
  AppRead,
  ExecutionResult,
  CliCallEvidence,
  ExecutionView,
  Logger,
  MetricDefinition,
  MetricRecordOptions,
  MetricView,
  ObserverContext,
  ObserverSnapshot,
  TaskAttempt,
  TaskDetail,
  TaskEventReceipt,
  TaskExecutor,
  TaskView,
  TaskListOptions,
  TaskPage,
  TaskOutcomeProjection,
  TaskOutcomeView,
  TaskOutcomePage,
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
  result?: Record<string, unknown>;
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
  result?: Record<string, unknown>;
  evidence?: string[];
} & Partial<Omit<TaskDetail, "id" | "status" | "summary" | "response" | "result" | "evidence">>;

/** Current canonical state for one exact Task shown in recent human context. */
export type AppRequestTaskObservation = {
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
  activeTurn?: { id: string; revision: number };
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

export type AppConversationRequest = {
  id: string;
  revision: number;
  scope: string;
  status: "open" | "closed";
  topicId?: string;
  taskRefs: Array<{ appId: string; taskId: string }>;
  closure?: { disposition: "fulfilled" | "withdrawn" | "unfulfilled"; reason: string; messageId: string };
};

/** App judgment; expectedRevision=0 accepts a new ask. Closing cannot silently change scope. */
export type AppConversationRequestUpdate = {
  id: string;
  expectedRevision: number;
  scope: string;
  disposition: "open" | "fulfilled" | "withdrawn" | "unfulfilled";
  reason?: string;
  /** Add exact links; omitted/empty lists retain admitted work. At most 32 distinct links in total. */
  taskRefs?: Array<{ appId: string; taskId: string }>;
};

export const conversationRequestUpdatesSchema = Type.Array(
  Type.Object(
    {
      id: Type.String({ minLength: 1, maxLength: 200 }),
      expectedRevision: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 }),
      scope: Type.String({ minLength: 1, maxLength: 2000 }),
      disposition: Type.Union([
        Type.Literal("open"),
        Type.Literal("fulfilled"),
        Type.Literal("withdrawn"),
        Type.Literal("unfulfilled"),
      ]),
      reason: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
      taskRefs: Type.Optional(
        Type.Array(
          Type.Object(
            { appId: Type.String({ minLength: 1 }), taskId: Type.String({ minLength: 1 }) },
            { additionalProperties: false },
          ),
          {
            maxItems: 32,
            description:
              "Add exact Task links. Empty or omitted lists retain existing links; at most 32 distinct links in total.",
          },
        ),
      ),
    },
    { additionalProperties: false },
  ),
  { maxItems: 8 },
);

/** Context for one admitted input, distinct from an accepted conversational Request. */
export type AppInputContext<TData = unknown> = {
  /** Inbox input identity; not an accepted Request ID. Host lifecycle and leases stay private. */
  id: string;
  source: AppInputSource;
  /** True when this input is direct work on behalf of a human Turn. */
  humanRequested?: true;
  parentId?: string;
  input: AppInput<TData>;
  dependency?: AppDependencyObservation;
  /** Exact bounded observation for the human's focused Task, when supplied. */
  focusedTask?: {
    appId: string;
    task: AppDependencyObservation;
  };
  /** Current canonical snapshots for exact Tasks represented by recent command/tool views. */
  referencedTasks?: AppRequestTaskObservation[];
  /** Bounded exact conversation evidence; it never owns or schedules work. */
  conversation?: AppConversationResource;
};

/** @deprecated Use AppInputContext. Retained for existing SDK consumers. */
export type AppRequest<TData = unknown> = AppInputContext<TData>;

/** Pure, durable identity supplied when an admitted App input is resolved to work. */
export type AppTaskInput<TData = unknown> = {
  /** Opaque Host identity for this admitted input; safe for stable free-form task IDs. */
  id: string;
  source: AppInputSource;
  input: AppInput<TData>;
};

export type AppTaskAttachment = { kind: "existing"; taskId: string } | { kind: "desired"; intent: TaskIntent };

export type AppRequestTopicDecision =
  { kind: "none" } | { kind: "new"; title: string } | { kind: "existing"; id: string };

/** A narrow human-authorized operation on an exact Task already present in request context. */
export type AppRequestTaskControl = {
  kind: "cancel";
  appId: string;
  taskId: string;
  reason: string;
};

/** Durable intent handed from a bounded conversational turn to App-owned work. */
export type AppRequestFollowUp = {
  /** Exact accepted ask served by this handoff, when tracking an ask. */
  requestId?: string;
  outcome: string;
  constraints?: string[];
  acceptance: string[];
  /** App selected from the installed catalog; use the current App only when it is the best owner. */
  appId: string;
  /** Typed input accepted by that App. */
  input: AppInput;
  /** Continue this exact unfinished Task when the conversation already resolved it. */
  task?: { appId: string; taskId: string };
};

/** One interactive Turn's answer/effects; background work is an exact Task handoff. */
export type ConversationTurnResult = {
  summary: string;
  /**
   * Plain-language answer shown now. With no effects it completes the turn;
   * it may also accompany exact durable work that continues to a later result.
   */
  response?: string;
  evidence?: string[];
  topic: AppRequestTopicDecision;
  /** Admit one responsible Task directly and link it to the chosen Topic; the request then completes. */
  followUp?: AppRequestFollowUp;
  taskControls?: AppRequestTaskControl[];
  requestUpdates?: AppConversationRequestUpdate[];
};

/** @deprecated Use ConversationTurnResult. Child-result waits are no longer supported. */
export type AppRequestDecision = ConversationTurnResult;

const nonEmptyStringSchema = Type.String({ minLength: 1 });

/** Structured output required from an App's direct conversational agent. */
export const conversationTurnResultSchema = Type.Object(
  {
    summary: nonEmptyStringSchema,
    requestUpdates: Type.Optional(conversationRequestUpdatesSchema),
    response: Type.Optional(nonEmptyStringSchema),
    evidence: Type.Optional(Type.Array(nonEmptyStringSchema, { maxItems: 32 })),
    topic: Type.Union([
      Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
      Type.Object({ kind: Type.Literal("new"), title: nonEmptyStringSchema }, { additionalProperties: false }),
      Type.Object({ kind: Type.Literal("existing"), id: nonEmptyStringSchema }, { additionalProperties: false }),
    ]),
    followUp: Type.Optional(
      Type.Object(
        {
          outcome: nonEmptyStringSchema,
          requestId: Type.Optional(nonEmptyStringSchema),
          constraints: Type.Optional(Type.Array(nonEmptyStringSchema, { maxItems: 32 })),
          acceptance: Type.Array(nonEmptyStringSchema, { minItems: 1, maxItems: 32 }),
          appId: nonEmptyStringSchema,
          input: Type.Object({ kind: nonEmptyStringSchema, data: Type.Unknown() }, { additionalProperties: false }),
          task: Type.Optional(
            Type.Object({ appId: nonEmptyStringSchema, taskId: nonEmptyStringSchema }, { additionalProperties: false }),
          ),
        },
        { additionalProperties: false },
      ),
    ),
    taskControls: Type.Optional(
      Type.Array(
        Type.Object(
          {
            kind: Type.Literal("cancel"),
            appId: nonEmptyStringSchema,
            taskId: nonEmptyStringSchema,
            reason: nonEmptyStringSchema,
          },
          { additionalProperties: false },
        ),
        { maxItems: 8 },
      ),
    ),
  },
  { additionalProperties: false },
);

/** @deprecated Use conversationTurnResultSchema; both names enforce the same contract. */
export const appRequestAgentResultSchema = conversationTurnResultSchema;

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
  /** Return observed facts; the host publishes them after the run succeeds. */
  run(context: ObserverContext): Promise<AppEvent[] | AppObserverResult>;
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
  /** Optional App-specific semantic admission for externally observable waits. */
  validateCondition?: (condition: Condition) => string | null;
  maxConcurrent?: number;
};

/** Direct bounded handling for conversational input; it creates no App Task. */
export type AppRequestPolicy = {
  mode: "agent";
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
  requests?: AppRequestPolicy;
  subscriptions?: AppEventSubscription[];
  /**
   * Reviewed facts that intentionally create no inbox item or task. The host
   * records a terminal no-op only after all actionable routes are evaluated.
   */
  observations?: EventSelector[];
  schedules?: AppSchedule[];
  observers?: AppObserver[];
  /**
   * App-owned metric definitions. Runtime measures declared sources on the
   * shared Host cadence.
   */
  metrics?: MetricDefinition[];
  actions?: Record<string, AppAction>;
  workspace?: AppWorkspace;
  tasks?: AppTaskPolicy;
};

/** The App owns work; `agent` only selects its default bounded executor. */
export type AppDefinition<TInputSchema extends TSchema = TSchema> = AppDefinitionBase<TInputSchema> &
  (
    | {
        agent: string;
        /** @deprecated Use `agent`. Accepted temporarily at the Host definition boundary. */
        owner?: string;
      }
    | {
        /** @deprecated New Apps must use `agent`. */
        owner: string;
        agent?: string;
      }
  );

export function defineApp<TInputSchema extends TSchema>(app: AppDefinition<TInputSchema>): AppDefinition<TInputSchema> {
  return app;
}
