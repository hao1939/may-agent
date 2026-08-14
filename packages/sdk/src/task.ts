export type TaskMode = "achieve" | "maintain";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";

/** Desired durable outcome handed to the task reconciler. */
export type TaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: TaskMode;
  owner?: string;
  workflow?: string;
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
  owner?: string;
  reviewAfterMs?: number;
};

export type TaskReconcileState = "converged" | "waiting" | "needs-owner";

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
      owner?: string;
      workflow?: string;
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
      owner?: string | null;
      workflow?: string | null;
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
  evidence: string[];
  actions?: TaskAction[];
  conditions?: Condition[];
};

export type TaskAcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "owner-judgment";
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
  workspaceDir: string;
  intent: Readonly<TaskIntent>;
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
  taskOwnerResultSchema,
  taskReconcileResultSchema,
  taskVerificationResultSchema,
} from "./project-task-handler-contract.js";
export type { TaskReconcileAdmission, TaskReconcileAdmissionOptions } from "./project-task-handler-contract.js";
