/** Host-private persisted task-state types retained for state migration only. */
export type ProjectAppTaskMode = "achieve" | "maintain";

export type ProjectAppTaskHandlerState = "converged" | "waiting" | "needs-owner";

export type ProjectAppConditionSpec = {
  id: string;
  type: string;
  subject: string;
  expected: unknown;
  owner?: string;
  /** Wake the same task owner for review if this Condition stays open this long. */
  reviewAfterMs?: number;
};

export type ProjectAppCondition = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  spec: Omit<ProjectAppConditionSpec, "id">;
  status: {
    observedGeneration: number;
    state: "unknown" | "false" | "true";
    observed?: unknown;
    observedAt?: string;
    evidence?: string[];
  };
};

export type ProjectAppTaskAction =
  | {
      kind: "create-task";
      id: string;
      parentId: string;
      outcome: string;
      mode: ProjectAppTaskMode;
      outputs: string[];
      acceptance: string[];
      priority: "P0" | "P1" | "P2" | "P3";
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
      mode?: ProjectAppTaskMode;
      outputs?: string[];
      acceptance?: string[];
      priority?: "P0" | "P1" | "P2" | "P3";
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

export type ProjectAppTaskHandlerResult = {
  state: ProjectAppTaskHandlerState;
  summary: string;
  evidence: string[];
  actions?: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
};

export type ProjectAppTaskAcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "owner-judgment";
  verifier?: string;
  evidence: string[];
};

/** Observed Git workspace lineage for one task attempt; never desired task spec. */
export type ProjectAppTaskWorkspace = {
  kind: "task-worktree";
  path: string;
  baseRef: string;
  baseCommit: string;
  branch: string;
  headCommit: string;
  disposition: "active" | "retained-for-recovery" | "branch-retained" | "removed";
};

export type ProjectAppTaskVerificationResult = {
  accepted: boolean;
  summary: string;
  evidence: string[];
};

export type ProjectAppTaskVerificationContext = {
  appId: string;
  taskId: string;
  generation: number;
  appDir: string;
  projectDir: string;
  workspaceDir: string;
  intent: Readonly<ProjectAppTaskIntent>;
};

export type ProjectAppTaskVerifier = (
  context: ProjectAppTaskVerificationContext,
  result: ProjectAppTaskHandlerResult,
) => Promise<ProjectAppTaskVerificationResult>;

/** Model/authoring input before task-action convention defaults are applied. */
export type ProjectAppTaskHandlerInput = {
  state: ProjectAppTaskHandlerState;
  summary: string;
  evidence: string[];
  actions?: unknown[];
  conditions?: ProjectAppConditionSpec[];
};

export type ProjectAppTaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: ProjectAppTaskMode;
  owner?: string;
  workflow?: string;
  input?: Record<string, unknown>;
  outputs?: string[];
  dependsOn?: string[];
  priority?: "P0" | "P1" | "P2" | "P3";
  /** Domain classification for views; distinct from reconciliation mode. */
  category?: string;
};

export type ProjectAppTaskResource = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  spec: Omit<ProjectAppTaskIntent, "id">;
  status: {
    observedGeneration: number;
    phase: "pending" | "running" | "converged" | "waiting" | "attention";
    currentAttemptId?: string;
    summary?: string;
    evidence?: string[];
    conditionIds?: string[];
    updatedAt: string;
  };
};

export type ProjectAppTaskAttemptLease = {
  /** Stable identity for one session-owned lease. */
  id: string;
  /** Monotonic compare-and-swap fence, incremented on every refresh. */
  version: number;
  lastActivityAt: string;
  expiresAt: string;
  runtimeId: string;
  sessionId: string;
};

export type ProjectAppTaskAttempt = {
  metadata: {
    id: string;
    resourceVersion: number;
  };
  taskId: string;
  taskGeneration: number;
  specHash: string;
  owner: string;
  handler: string;
  runtimeId: string;
  state: "running" | "completed" | "failed" | "interrupted";
  reason: string;
  trigger?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  failureReason?: string;
  attentionNotifiedAt?: string;
  sessionId?: string;
  /** Optional for conservative dual-read compatibility with pre-lease attempts. */
  lease?: ProjectAppTaskAttemptLease;
  workspace?: ProjectAppTaskWorkspace;
};

export type ProjectAppTaskTrigger = {
  taskId: string;
  taskGeneration: number;
  resourceVersion: number;
  event: Record<string, unknown>;
  observedAt: string;
};
