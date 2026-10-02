import type { AppEvent } from "./event.js";
import type { AppInput } from "./app.js";

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
  /** Managed executor. The App is responsible for achievement; creator controls requirements. */
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
  /** Required on newly admitted waits; elapsed time never makes the Condition true. */
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

/** @deprecated Return TaskDecisionResult with an explicit decision. */
export type LegacyTaskReconcileResult = {
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
    }
);

/** Changes admitted while running or as part of the final result; never a Task replacement. */
export type TaskChanges = {
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
};

export type TaskDecision = "continue" | "wait" | "converged" | "incomplete";
type DecisionEvidence = {
  summary: string;
  facts: string[];
  inputKeys?: string[];
  result?: Record<string, unknown>;
  state?: never;
  continue?: never;
  dependencies?: never;
};

/** One attempt's judgment about its Task; only Host maintains current Task state. */
export type TaskDecisionResult =
  | (DecisionEvidence &
      TaskChanges & {
        decision: "continue";
        facts: [string, ...string[]];
        reviewAt?: number;
        report?: true;
        response?: never;
      })
  | (DecisionEvidence &
      TaskChanges & {
        decision: "wait";
        reviewAt?: number;
        response?: never;
      } & ({ report?: never } | { report: true; facts: [string, ...string[]] }))
  | (DecisionEvidence & {
      decision: "converged";
      response?: string;
      requests?: TaskAppRequest[];
      actions?: TaskAction[];
      conditions?: never;
      reviewAt?: never;
      report?: never;
    })
  | (DecisionEvidence & {
      decision: "incomplete";
      facts: [string, ...string[]];
      response?: string;
      report?: true;
      requests?: never;
      conditions?: never;
      actions?: never;
      reviewAt?: never;
    })
  | {
      decision: "needs-agent";
      summary: string;
      facts: string[];
      state?: never;
      continue?: never;
      inputKeys?: never;
      result?: never;
      response?: never;
      report?: never;
      requests?: never;
      conditions?: never;
      actions?: never;
      dependencies?: never;
      reviewAt?: never;
    };

/** New producers use decision; legacy workflow results normalize once at admission. */
export type TaskReconcileResult = TaskDecisionResult | (LegacyTaskReconcileResult & { decision?: never });

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
  result: TaskDecisionResult,
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
