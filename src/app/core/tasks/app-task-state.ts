import type { Condition, ResourceCreator, TaskAcceptanceBasis, TaskAttempt, TaskIntent } from "@may-agent/sdk";

export type AppTaskTriggerEvent = {
  event: Record<string, unknown>;
  observedAt: string;
};

/** Return correlation for admitted input; eligibility stays with existing waits and Events. */
export type AppTaskInputWait = {
  taskGeneration: number;
  /** Empty means continue with already pending Task input, without replaying an old event batch. */
  conditions: Array<{ id: string; generation: number }>;
  /** Exact input reconsideration deadline; elapsed time does not answer the input. */
  reviewAt?: number;
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
    facts?: string[];
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
    /** Absent only on historical resources; no worker gains authority from missing provenance. */
    creator?: ResourceCreator;
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
    /** Absolute Task reconsideration deadline; elapsed time only makes another attempt eligible. */
    reviewAt?: number;
    /** A new human admission permits one fresh claim; that claim consumes the opportunity. */
    freshHumanInput?: true;
    summary?: string;
    response?: string;
    result?: Record<string, unknown>;
    facts?: string[];
    conditionIds?: string[];
    inputWaits?: Record<string, AppTaskInputWait>;
    updatedAt: string;
  };
};

/** Quick transient retry, then up to one hour between failures; never abandon work. */
export function taskExecutionRetryDelay(failures: number): number {
  return Math.min(60 * 60_000, 250 * 2 ** Math.min(14, Math.max(0, failures - 1)));
}

export function pendingTaskExecutionRetryAt(resource: AppTaskResource, now = Date.now()): number | undefined {
  const at = resource.status.executionRetryAt;
  return typeof at === "number" && Number.isFinite(at) && at > now ? at : undefined;
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
  /** Earlier admitted inputs brought back by this attempt's exact Condition facts. */
  continuedInputKeys?: string[];
  /** Accepted facts from this exact attempt; later cycles do not replace it. */
  acceptedResult?: {
    state: "converged" | "waiting" | "incomplete";
    /** Absolute reconsideration deadline for a waiting result; not an external fact. */
    reviewAt?: number;
    continue?: true;
    report?: true;
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    facts: string[];
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
  /** Retained separately from acceptance so recovery can reuse execution evidence. */
  unacceptedResult?: NonNullable<TaskAttempt["previousAttempt"]>["unacceptedResult"];
  sessionId?: string;
  lease?: AppTaskAttemptLease;
  workspace?: AppTaskWorkspace;
  /** Offline import preserves an old worker self-stop as facts, not closure. */
  retiredCancellation?: AppTaskCancellation;
};

/** Immutable closure facts; historical records represent cancellation. */
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
  decidedBy?:
    | { kind: "human" }
    | { kind: "app"; agent: string; attemptId: string }
    | { kind: "app-policy" }
    | { kind: "creator"; creator: ResourceCreator };
  response?: string;
  result?: Record<string, unknown>;
  facts?: string[];
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
