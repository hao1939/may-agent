import type { Condition, TaskAcceptanceBasis, TaskIntent } from "@may-agent/sdk";

export type AppTaskTriggerEvent = {
  event: Record<string, unknown>;
  observedAt: string;
};

/** Return correlation for admitted input; eligibility stays with existing waits and Events. */
export type AppTaskInputWait = {
  taskGeneration: number;
  /** Empty means continue with already pending Task input, without replaying an old event batch. */
  conditions: Array<{ id: string; generation: number }>;
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
    /** Consecutive unsuccessful attempts in this generation, cleared by progress or owner retry. */
    executionFailures?: number;
    /** Earliest next attempt after execution failure; ordinary wakes do not waive it. */
    executionRetryAt?: number;
    /** A new human admission permits one fresh claim; that claim consumes the opportunity. */
    freshHumanInput?: true;
    summary?: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    conditionIds?: string[];
    inputWaits?: Record<string, AppTaskInputWait>;
    updatedAt: string;
  };
};

/** Quick transient retry, then up to 15 minutes between failures; never abandon work. */
export function taskExecutionRetryDelay(failures: number): number {
  return Math.min(15 * 60_000, 250 * 2 ** Math.min(12, Math.max(0, failures - 1)));
}

export function pendingTaskExecutionRetryAt(resource: AppTaskResource, now = Date.now()): number | undefined {
  const at = resource.status.executionRetryAt;
  return typeof at === "number" && Number.isFinite(at) && at > now
    ? at : undefined;
}

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
  /** Earlier admitted inputs brought back by this attempt's exact Condition evidence. */
  continuedInputKeys?: string[];
  /** Accepted evidence from this exact attempt; later cycles do not replace it. */
  acceptedResult?: {
    state: "converged" | "waiting" | "incomplete";
    report?: true;
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence: string[];
    /** Historical maintained outcomes did not retain the acceptance method. */
    acceptanceBasis?: TaskAcceptanceBasis;
    /** Additional durable input actually incorporated after the initial batch. */
    acceptedLiveEventIds?: number[];
  };
  /** Legacy/synthetic trigger retained only when no durable event batch exists. */
  trigger?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
  failureReason?: string;
  sessionId?: string;
  lease?: AppTaskAttemptLease;
  workspace?: AppTaskWorkspace;
  /** Offline import preserves an old worker self-stop as evidence, not closure. */
  retiredCancellation?: AppTaskCancellation;
};

/** Immutable closure evidence; historical records represent cancellation. */
export type AppTaskCancellation = {
  kind?: "closed" | "cancelled";
  /** Optional exact outcome consumed by the App's close-after-result convention. */
  acceptedResultAttemptId?: string;
  appId: string;
  taskId: string;
  generation: number;
  resourceVersion: number;
  outcome: string;
  reason: string;
  summary: string;
  cancelledAt: string;
  decidedBy?: { kind: "human" } | { kind: "app"; agent: string; attemptId: string } | { kind: "app-policy" };
  response?: string;
  result?: Record<string, unknown>;
  evidence?: string[];
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
