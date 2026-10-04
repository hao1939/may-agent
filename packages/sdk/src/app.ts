import {
  conversationRequestUpdatesSchema,
  type AppConversationRequest,
  type AppConversationRequestUpdate,
} from "./conversation-contract.js";
export { conversationRequestUpdatesSchema, MAX_CONVERSATION_REQUESTS_PER_TURN } from "./conversation-contract.js";
export type { AppConversationRequest, AppConversationRequestUpdate } from "./conversation-contract.js";
import { Type, type Static, type TSchema } from "typebox";
import { appInputSchema } from "./app-input.js";
import type { ResourceObserver, ObservationContract } from "./observer.js";
export { defineObserver, observationCondition } from "./observer.js";
export type { ResourceObserver, ObservationContract, ObservationInterest, ObserverHealth } from "./observer.js";
import type { AppEvent, EventSelector } from "./event.js";
import type { Condition, TaskAction, TaskIntent } from "./task.js";
import type { MetricDefinition, ObserverContext, ObserverSnapshot, TaskAttempt, TaskDetail } from "./workflow.js";

export { Type } from "typebox";
export type { Static, TSchema } from "typebox";
export { matchesEventSelector } from "./event.js";
export type { AppEvent, AppEventTarget, EventSelector } from "./event.js";
export type {
  AppRead,
  ExecutionResult,
  CliCallFacts,
  ExecutionView,
  Logger,
  MetricDefinition,
  MetricCalculation,
  MetricCalculationOptions,
  MetricRecordOptions,
  MetricView,
  ObserverContext,
  ObserverSnapshot,
  TaskAttempt,
  TaskAcceptedEvidence,
  TaskAcceptedEvidenceOptions,
  TaskAcceptedEvidencePage,
  TaskAcceptedEvidenceNavigation,
  TaskReadOptions,
  TaskInputObligation,
  TaskCurrentObligations,
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
  status: "pending" | "running" | "waiting" | "attention" | "done" | "error" | "interrupted" | "unknown";
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

/** Exact cancellation; requirement revisions use the common tasks.update capability. */
export type ConversationTaskControl = {
  kind: "cancel";
  appId: string;
  taskId: string;
  reason: string;
};

/** Durable intent handed from a bounded conversational turn to App-owned work. */
export type ConversationDelegation = {
  /** Exact accepted ask served by this handoff, when tracking an ask. */
  requestId?: string;
  /** App selected from the installed catalog; use the current App only when it is the best owner. */
  appId: string;
  /** Complete handoff under the App's contract, including its fixed semantics and any governing references. */
  input: AppInput;
  /** Reuse an exact ordinary work Task when its assignment fits; Conversation Tasks use Conversation input. */
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
  facts?: string[];
  /** Optional Conversation organization. Omit to retain the input's association; work and result delivery need no Topic. */
  topic?: ConversationTopicDecision;
  /** Admit one responsible Task with its caller input retained for result delivery. The accepted ask may remain open. */
  followUp?: ConversationDelegation;
  taskControls?: ConversationTaskControl[];
  requestUpdates?: AppConversationRequestUpdate[];
};

const nonEmptyStringSchema = Type.String({ minLength: 1 });

/** Structured output required from an App's direct conversational agent. */
export const conversationTurnResultSchema = Type.Object(
  {
    summary: nonEmptyStringSchema,
    requestUpdates: Type.Optional({
      ...conversationRequestUpdatesSchema,
      items: {
        ...conversationRequestUpdatesSchema.items,
        required: [...conversationRequestUpdatesSchema.items.required!, "reason"],
        properties: {
          ...conversationRequestUpdatesSchema.items.properties,
          reason: {
            ...conversationRequestUpdatesSchema.items.properties.reason,
            description:
              "Required for every legacy Conversation final update, including open Requests. Explain the outcome or the continuing work or remaining gap and wait.",
          },
        },
      },
    }),
    response: Type.Optional(
      Type.String({
        minLength: 1,
        description:
          "Human-facing answer or useful update. Required for human input, Request closure and Task controls. Background observations, delegation and open Request bookkeeping may stay quiet; retain internal findings in summary and facts.",
        pattern: "\\S",
      }),
    ),
    facts: Type.Optional(Type.Array(nonEmptyStringSchema, { maxItems: 32 })),
    topic: Type.Optional(
      Type.Union(
        [
          Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
          Type.Object({ kind: Type.Literal("new"), title: nonEmptyStringSchema }, { additionalProperties: false }),
          Type.Object({ kind: Type.Literal("existing"), id: nonEmptyStringSchema }, { additionalProperties: false }),
        ],
        {
          description:
            "Optional grouping for this Conversation's discussion and Requests. Omit to retain the input's Topic, if any. Choose new, existing or none only to change that grouping. Delegation and result delivery do not require a Topic.",
        },
      ),
    ),
    followUp: Type.Optional(
      Type.Object(
        {
          requestId: Type.Optional(
            Type.String({ minLength: 1, description: "The accepted ask served by this handoff, when applicable." }),
          ),
          appId: nonEmptyStringSchema,
          input: appInputSchema,
          task: Type.Optional(
            Type.Object({ appId: nonEmptyStringSchema, taskId: nonEmptyStringSchema }, { additionalProperties: false }),
          ),
        },
        {
          additionalProperties: false,
          description:
            "Submit this input as durable Task work to the selected App. The Host retains the originating Conversation input and returns the selected result automatically. Reuse an exact ordinary work Task only when its outcome, acceptance, input and execution method fit. Conversation Tasks receive input through Conversation admission; a completed review can return summary and facts without a follow-up. The Host admits the handoff when this Turn's result is accepted. Task admission alone does not fulfill a Request.",
        },
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
        {
          maxItems: 8,
          description:
            "Cancel an exact Task within granted authority, after checking its identity and current state. Ending this Turn or leaving a view does not cancel background work.",
        },
      ),
    ),
  },
  {
    additionalProperties: false,
    // A quiet turn can retain observations, open asks and delegate work, but
    // cannot silently close an accepted ask or cancel a Task. Tool validation and
    // transactional settlement use this same rule.
    anyOf: [
      { required: ["response"] },
      {
        properties: {
          taskControls: { maxItems: 0 },
          requestUpdates: { items: { properties: { disposition: { const: "open" } } } },
        },
      },
    ],
    not: {
      required: ["followUp", "taskControls"],
      properties: { taskControls: { minItems: 1 } },
    },
    description:
      "Decide one bounded Conversation Turn from its admitted input, current Requests and Task observations. Return through finish().result. previousAttempt.unacceptedResult is unaccepted settlement evidence: inspect current state before repeating tools whose effects may already have completed. A tool's success does not by itself establish fulfillment of the human's ask.",
  },
);

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

export type AppContract = {
  appId: string;
  /** App owner agent; receives work without a more specific assignment and coordinates its scope. */
  agent: string;
  inputSchema: TSchema;
  observations: ObservationContract[];
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
  /** Background attempt limit; one human Conversation turn may also run within the Host limit. */
  maxConcurrent?: number;
};

/** Conversation input executes through one stable Task per Conversation. */
export type AppConversationPolicy = {
  /** Task is the common execution contract. Agent retains the legacy Conversation adapter during migration. */
  mode: "task" | "agent";
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
