import type { AppEvent } from "./event.js";
import type { AppInput } from "./app.js";

export type TaskMode = "achieve" | "maintain";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
/** Stable executor adapter name selected by durable Task intent. */
export type TaskExecutorName = string;

/** Desired durable outcome handed to the task reconciler. */
export type TaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: TaskMode;
  /** Managed agent selected for bounded attempts. The App remains the durable Task owner. */
  agent?: string;
  /** @deprecated Use `agent`. Retained temporarily for source compatibility. */
  owner?: string;
  workflow?: string;
  /** Bounded executor adapter. Omit or use `agent` for the managed agent; `codex` and `claude` are built in. */
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
  owner?: string;
  reviewAfterMs?: number;
};

export type TaskReconcileState = "converged" | "waiting" | "needs-agent";

/** One child App outcome required by the current task. */
export type TaskAppDependency = {
  /** Stable name within this task generation. */
  id: string;
  appId: string;
  /** Continue this exact Task in the target App instead of creating new work. */
  taskId?: string;
  input: AppInput;
};

/** Desired task-tree mutations returned by one fenced reconciliation attempt. */
export type TaskAction =
  | {
      kind: "create-task";
      id: string;
      parentId: string;
      outcome: string;
      mode: TaskMode;
      outputs: string[];
      acceptance: string[];
      priority: TaskPriority;
      /** Managed agent selected for bounded attempts. The App remains the durable Task owner. */
      agent?: string;
      /** @deprecated Use `agent`. */
      owner?: string;
      workflow?: string;
      executor?: TaskExecutorName;
      input?: Record<string, unknown>;
      dependsOn?: string[];
      category?: string;
    }
  | {
      kind: "update-task";
      taskId: string;
      expectedGeneration: number;
      parentId?: string;
      outcome?: string;
      mode?: TaskMode;
      outputs?: string[];
      acceptance?: string[];
      priority?: TaskPriority;
      /** Managed agent selected for bounded attempts. The App remains the durable Task owner. */
      agent?: string | null;
      /** @deprecated Use `agent`. */
      owner?: string | null;
      workflow?: string | null;
      executor?: TaskExecutorName | null;
      input?: Record<string, unknown>;
      dependsOn?: string[];
      category?: string | null;
    }
  | {
      kind: "close-task";
      taskId: string;
      expectedGeneration: number;
      summary: string;
    }
  | {
      kind: "unblock-task";
      taskId: string;
      expectedGeneration: number;
      reason: string;
    };

export type TaskReconcileResult = {
  state: TaskReconcileState;
  summary: string;
  /** Caller-facing semantic answer, when this task fulfills an addressed request. */
  response?: string;
  evidence: string[];
  actions?: TaskAction[];
  conditions?: Condition[];
  /** Runtime-admitted child App requests. Valid only while waiting. */
  dependencies?: TaskAppDependency[];
};

export type TaskAcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "agent-judgment";
  verifier?: string;
  evidence: string[];
};

export type TaskVerificationResult = {
  accepted: boolean;
  summary: string;
  evidence: string[];
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
