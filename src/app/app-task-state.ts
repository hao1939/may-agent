import type { Condition, TaskAcceptanceBasis, TaskIntent } from "@may-agent/sdk";

export type AppTaskTriggerEvent = {
  event: Record<string, unknown>;
  observedAt: string;
};

/** Host-private persisted Condition state. */
export type AppTaskCondition = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  /** Historical rows may predate required owner and recovery-checkpoint admission. */
  spec: Omit<Condition, "id">;
  status: {
    observedGeneration: number;
    state: "unknown" | "false" | "true";
    /** When the current Condition specification first began waiting. */
    createdAt?: string;
    observed?: unknown;
    observedAt?: string;
    evidence?: string[];
  };
};

/** Observed Git workspace lineage for one task attempt; never desired spec. */
export type AppTaskWorkspace = {
  kind: "task-worktree";
  path: string;
  baseRef: string;
  baseCommit: string;
  branch: string;
  headCommit: string;
  disposition: "active" | "retained-for-recovery" | "branch-retained" | "removed";
};

export type AppTaskResource = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  spec: Omit<TaskIntent, "id">;
  status: {
    observedGeneration: number;
    phase: "pending" | "running" | "converged" | "waiting" | "attention";
    /** Trusted Host origin used only for capacity scheduling. */
    lane?: "human" | "normal";
    currentAttemptId?: string;
    /** Exact attempt that produced the accepted summary/result observation. */
    observedAttemptId?: string;
    summary?: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    conditionIds?: string[];
    updatedAt: string;
  };
};

export type AppTaskAttemptLease = {
  id: string;
  version: number;
  lastActivityAt: string;
  expiresAt: string;
  runtimeId: string;
  /** Present after the attempt starts its first child Agent session. */
  sessionId?: string;
};

export type AppTaskAttempt = {
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
  /** Ordered event batch presented to this attempt. */
  events?: AppTaskTriggerEvent[];
  /** More linked events remained pending when this attempt was claimed. */
  eventsTruncated?: boolean;
  /** Legacy/synthetic trigger retained only when no durable event batch exists. */
  trigger?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  failureReason?: string;
  attentionNotifiedAt?: string;
  sessionId?: string;
  lease?: AppTaskAttemptLease;
  workspace?: AppTaskWorkspace;
};

/** Immutable terminal evidence that an operator cancelled one exact Task generation. */
export type AppTaskCancellation = {
  appId: string;
  taskId: string;
  generation: number;
  resourceVersion: number;
  outcome: string;
  reason: string;
  summary: string;
  cancelledAt: string;
};

export type AppTaskTrigger = {
  taskId: string;
  taskGeneration: number;
  resourceVersion: number;
  /** Ordered events not yet included in an accepted reconciliation result. */
  events?: AppTaskTriggerEvent[];
  /** Compatibility projection for state written before event batches. */
  event: Record<string, unknown>;
  observedAt: string;
};

export type AppTaskAcceptanceBasis = TaskAcceptanceBasis;
