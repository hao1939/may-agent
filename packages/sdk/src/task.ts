import type { AppEvent } from "./event.js";
import type {
  AppInput,
  AppConversationRequestUpdate,
  ConversationTopicDecision,
  AppTaskInput,
  AppConversationRequest,
} from "./app.js";

export type TaskPriority = "P0" | "P1" | "P2" | "P3";
/** Stable executor adapter name selected by durable Task intent. */
export type TaskExecutorName = string;

/** Stable creating context, assigned by the Host; never a session or execution selector. */
export type ResourceCreator = { appId: string; taskId?: string };

/** Revise an exact assignment using the responsible App's ordinary typed input. */
export type TaskRevision = { appId: string; taskId: string; expectedGeneration: number; input: AppInput };

/** Desired durable outcome handed to the task reconciler. */
export type TaskIntent = {
  id: string;
  /** Organization only; grants no change authority, wait or result subscription. */
  parentId: string;
  outcome: string;
  acceptance: string[];
  /** Agent responsible for the outcome across attempts; creator controls requirements.
   * Omit to inherit the parent assignment, then the App's default agent. */
  agent?: string;
  /** @deprecated Use `agent`. Retained temporarily for source compatibility. */
  owner?: string;
  workflow?: string;
  /** Registered bounded executor adapter. Omit or use `agent` for the managed agent. */
  executor?: TaskExecutorName;
  input?: Record<string, unknown>;
  outputs?: string[];
  dependsOn?: string[];
  priority?: TaskPriority;
  category?: string;
};

/** Exact observable fact that can wake durable work. */
export type Condition = {
  id: string;
  type: string;
  subject: string;
  expected: unknown;
  /** Plain-language action shown when this Condition explicitly belongs to a human. */
  requestedAction?: string;
  /** Required on newly admitted waits; optional here so historical Conditions remain readable. */
  owner?: string;
  /** @deprecated Retained for compatibility; use Task reviewAt to request agent reconsideration. */
  reviewAfterMs?: number;
};

/**
 * Attempt judgment, not Task lifetime. `converged` accepts an outcome and leaves
 * the Task open. `incomplete` reports an unsuccessful attempt; unfinished work retries
 * with backoff until progress or owner closure.
 */
export type TaskReconcileState = "converged" | "waiting" | "needs-agent" | "incomplete";

/** Work submitted to another App, independent of whether the caller waits. */
export type TaskAppRequest = {
  /** Stable name within this task generation. */
  id: string;
  appId: string;
  /** Continue this exact Task in the target App instead of creating new work. */
  taskId?: string;
  input: AppInput;
};

/** Caller wait on a new or already admitted request in this Task generation. */
export type TaskRequestCondition = { requestId: string };
export type TaskCondition = Condition | TaskRequestCondition;

/** @deprecated Return requests and caller Conditions instead. */
export type TaskAppDependency = TaskAppRequest;

/** Reconsider an existing wait through a fenced attempt. Revise requirements with TaskAttempt.reviseTask. */
export type TaskAction =
  | {
      kind: "unblock-task";
      taskId: string;
      expectedGeneration: number;
      reason: string;
    }
  | {
      /** Retire one exact wait on the Task currently returning this result. */
      kind: "retire-condition";
      conditionId: string;
      expectedConditionGeneration: number;
      reason: string;
    };

/** One durable input, with optional communication context derived from its admission. */
export type TaskInput = AppTaskInput & {
  key: string;
  communication?: {
    conversationId: string;
    replyTo: string;
    topicId?: string;
    inReplyTo?: string;
    requestIds: string[];
  };
};

/** Scoped communication through an input accepted by this Task. Transport is Host-owned. */
export type TaskCommunication = {
  /** Stable operation name within this Task generation, reused after a lost acknowledgment. */
  id: string;
  /** Saved input whose recipient and reply context should be used. */
  inputId: string;
  message?: string;
  /** Earlier communication operation containing the explanation for these Request updates. */
  replyId?: string;
  requestUpdates?: AppConversationRequestUpdate[];
  topic?: ConversationTopicDecision;
};

export type TaskReconcileResult = {
  summary: string;
  facts: string[];
  /** Exact requests covered by this result. Omit to use the saved assignment, or use [] for none.
   * Converged answers this set; waiting/incomplete report on it and keep it open. */
  inputKeys?: string[];
} & (
  | {
      state: "converged";
      /** Caller-facing answer for the addressed input; does not close the Task. */
      response?: string;
      result?: Record<string, unknown>;
      actions?: TaskAction[];
      conditions?: never;
      dependencies?: never;
      requests?: TaskAppRequest[];
      communication?: TaskCommunication[];
    }
  | ({
      state: "waiting";
      /** Absolute time to reconsider this Task. Elapsed time wakes work; it does not satisfy a Condition. */
      reviewAt?: number;
      /** Queue one bounded pass for useful remaining work; independent waits and reports remain valid. */
      continue?: true;
      response?: never;
      result?: Record<string, unknown>;
      actions?: TaskAction[];
      conditions?: TaskCondition[];
      /** Submit work; add a request Condition only when its answer is needed. */
      requests?: TaskAppRequest[];
      communication?: TaskCommunication[];
      /** @deprecated Use requests and conditions: [{ requestId: id }]. */
      dependencies?: TaskAppDependency[];
    } & (
      | { report?: never }
      | {
          /** Return a new caller-relevant update without answering the input. */
          report: true;
          facts: [string, ...string[]];
        }
    ))
  | {
      state: "incomplete";
      /** Select a new caller-relevant report while the same assignment retries. */
      report?: true;
      /** At least one observation supporting this unsuccessful attempt. */
      facts: [string, ...string[]];
      response?: string;
      result?: Record<string, unknown>;
      actions?: never;
      conditions?: never;
      dependencies?: never;
      requests?: never;
      communication?: never;
    }
  | {
      state: "needs-agent";
      inputKeys?: never;
      response?: never;
      result?: never;
      actions?: never;
      conditions?: never;
      dependencies?: never;
      requests?: never;
      communication?: never;
    }
);

/** Changes admitted while running or as part of the final result; never a Task replacement. */
export type TaskChanges = {
  communication?: TaskCommunication[];
  inputKeys?: string[];
  facts?: string[];
  requests?: TaskAppRequest[];
  conditions?: TaskCondition[];
  actions?: TaskAction[];
};

/** Durable admission, not fulfillment of the receiver or caller's work. */
export type TaskChangeReceipt = {
  requests: Array<{ id: string; requestId: string }>;
  conditionIds: string[];
  actionsApplied: string[];
  communication?: Array<{ id: string; messageId?: string; requests?: AppConversationRequest[] }>;
};

export type TaskAcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "agent-judgment";
  verifier?: string;
  facts: string[];
};

export type TaskVerificationResult = {
  accepted: boolean;
  summary: string;
  facts: string[];
};

export type TaskVerificationContext = {
  appId: string;
  taskId: string;
  generation: number;
  appRoot: string;
  projectRoot: string;
  workspaceDir: string;
  intent: Readonly<TaskIntent>;
  /** A newer durable wake observed while this attempt was running, if any. */
  pendingTrigger?: AppEvent<Record<string, unknown>>;
};

export type TaskVerifier = (
  context: TaskVerificationContext,
  result: TaskReconcileResult,
) => Promise<TaskVerificationResult>;

/** Runtime validation is opt-in so the App declaration entry point stays lightweight. */
export {
  MIN_CONDITION_REVIEW_AFTER_MS,
  admitTaskReconcileResult,
  admitTaskChanges,
  taskChangesSchema,
  admitTaskResultForSchema,
  admitTaskVerificationResult,
  conditionSchema,
  isTypedConditionSubject,
  taskActionSchema,
  taskAgentResultSchema,
  taskOwnerResultSchema,
  taskReconcileResultSchema,
  taskVerificationResultSchema,
} from "./task-contract.js";
export type { TaskReconcileAdmission, TaskReconcileAdmissionOptions } from "./task-contract.js";
