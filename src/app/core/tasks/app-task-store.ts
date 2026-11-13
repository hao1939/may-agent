import type { AppTaskPolicy, TaskExecutorName } from "@may-agent/sdk";
import { inStateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskResourceMutation, AppTaskResourceStore } from "../state/app-task-resource-store.js";
import type {
  AppTaskAcceptanceBasis,
  AppTaskAttempt,
  AppTaskCancellation,
  AppTaskCondition,
  AppTaskResource,
  AppTaskTrigger,
  AppTaskWorkspace,
} from "./app-task-state.js";
import {
  pendingTaskWorkspaceConstraint,
  taskExecutionRetryExhausted,
  taskReviewAt,
} from "./app-task-state.js";

/** A structural container. It never carries executable Task lifecycle state. */
export type TaskGroup = {
  id: string;
  parent_id?: string | null;
  owner?: string;
};

export type AppTaskPhase = AppTaskResource["status"]["phase"];

export type AppTaskReadiness = {
  state:
    | "ready"
    | "dependency-blocked"
    | "condition-blocked"
    | "funding-blocked"
    | "capacity-blocked"
    | "resource-blocked"
    | "paused"
    | "not-applicable";
  reason: string;
  related_ids: string[];
};

export type TaskCompletionReceipt = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };
  specHash: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  owner: string;
  workflow?: string;
  executor?: TaskExecutorName;
  input?: Record<string, unknown>;
  priority?: "P0" | "P1" | "P2" | "P3";
  handler: string;
  summary: string;
  response?: string;
  result?: Record<string, unknown>;
  facts: string[];
  acceptanceBasis: AppTaskAcceptanceBasis;
  failureFingerprints: string[];
  completedAt: string;
  workspace?: AppTaskWorkspace;
  /** Digest of acceptance/facts/workspace detail removed from old bounded history. */
  compactedDetailSha256?: string;
  /** Digest of unbounded outcome/summary/response/input detail removed from old bounded history. */
  compactedPayloadSha256?: string;
};

export type AppTaskAdmission = {
  taskId: string;
  taskGeneration: number;
  specHash: string;
  admittedAt: string;
  /** Original desired work before resolving inherited/default execution ownership. */
  requestHash?: string;
  /** Original ask supplied again when its saved wait returns facts. */
  inputEvent?: Record<string, unknown>;
  /** Exact accepted answer for this input; later Task outcomes do not replace it. */
  resultAttemptId?: string;
  /** Independent selected feedback. Progress cannot replace an undelivered failure. */
  feedback?: Partial<Record<"progress" | "failure", { attemptId: string; revision: number }>>;
};

export type TaskTree = {
  version?: number;
  project?: string;
  updated_at?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  conditions?: Record<string, AppTaskCondition>;
  resources?: Record<string, AppTaskResource>;
  attempts?: Record<string, AppTaskAttempt>;
  taskTriggers?: Record<string, AppTaskTrigger>;
  /** Retry fence for canonical App inbox attachments. Host-private state. */
  appTaskAdmissions?: Record<string, AppTaskAdmission>;
  receipts?: Record<string, TaskCompletionReceipt>;
  /** Read projection of the existing terminal cancellation records. */
  cancellations?: Record<string, AppTaskCancellation>;
  /** Structural labels/containers only. Executable task nodes are projected from resources. */
  groups?: Record<string, TaskGroup>;
};

export type AppTaskContext = {
  /** Loaded App selects the common reader; absent retains the legacy admission guard. */
  appDir: string;
  projectDir: string;
  agent: string;
  maxConcurrent: number;
  maxConsecutiveFailures?: AppTaskPolicy["maxConsecutiveFailures"];
  closeOnResult?: AppTaskPolicy["closeOnResult"];
  resourceStore: AppTaskResourceStore;
};

type TaskSnapshotCache = {
  tree?: TaskTree;
  resourceRevision?: number;
};

const taskSnapshotCaches = new WeakMap<AppTaskContext, TaskSnapshotCache>();
const scopedTaskSnapshots = new WeakSet<TaskTree>();

/** Reuse one snapshot for a short-lived context dedicated to a sequential pass. */
export function cacheTaskSnapshots(context: AppTaskContext): void {
  taskSnapshotCaches.set(context, {});
}

export function readTaskSnapshot(
  context: AppTaskContext,
  scope?: { taskIds: Iterable<string>; admissionIds?: Iterable<string>; conditionIds?: Iterable<string> },
): TaskTree {
  if (scope) {
    const tree = context.resourceStore.readTaskContext(scope);
    scopedTaskSnapshots.add(tree);
    return tree;
  }
  const cache = taskSnapshotCaches.get(context);
  const revision = context.resourceStore.revision();
  if (cache?.tree && cache.resourceRevision === revision) return cache.tree;
  const tree = context.resourceStore.readSnapshot();
  if (cache) {
    cache.tree = tree;
    cache.resourceRevision = revision;
  }
  return tree;
}

export type CommitTaskMutationOptions = {
  /** Exact resource rows changed by this transition. Required by resource authority. */
  resourceMutation: AppTaskResourceMutation;
};

export class ResourceTaskMutationStaleError extends Error {
  constructor() {
    super("Resource-backed task mutation was rejected by a stale fence");
    this.name = "ResourceTaskMutationStaleError";
  }
}

/** The resource commit owns serialization and fencing; callers supply the exact write set. */
export function commitTaskMutation(context: AppTaskContext, tree: TaskTree, options: CommitTaskMutationOptions): void {
  if (!options?.resourceMutation) {
    throw new Error("Task state mutation requires an exact resourceMutation");
  }
  if (!context.resourceStore.commit(options.resourceMutation)) {
    throw new ResourceTaskMutationStaleError();
  }
  tree.updated_at = new Date().toISOString();
  const resourceCache = taskSnapshotCaches.get(context);
  if (resourceCache) {
    if (scopedTaskSnapshots.has(tree) || inStateTransaction(context.resourceStore.db)) {
      resourceCache.tree = undefined;
      resourceCache.resourceRevision = undefined;
    } else {
      resourceCache.tree = tree;
      resourceCache.resourceRevision = context.resourceStore.revision();
    }
  }
}

export function normalizeTaskStateInPlace(tree: TaskTree): TaskTree {
  const groups: Record<string, TaskGroup> = Object.fromEntries(
    Object.entries(tree.groups ?? {}).map(([id, group]) => [id, normalizeTaskGroup(id, group)]),
  );
  tree.groups = groups;
  tree.root_task_id ??= Object.values(groups).find((group) => group.parent_id === null)?.id;
  return tree;
}

/** Keep legacy group input structural before it enters canonical state. */
export function normalizeTaskGroup(id: string, group: TaskGroup): TaskGroup {
  return {
    id,
    ...(typeof group.parent_id === "string" || group.parent_id === null ? { parent_id: group.parent_id } : {}),
    ...(typeof group.owner === "string" && group.owner.trim() ? { owner: group.owner.trim() } : {}),
  };
}

function satisfiedDependencyIds(tree: TaskTree): string[] {
  return [
    ...new Set(
      Object.values(tree.resources ?? {})
        .flatMap((resource) => resource.spec.dependsOn ?? [])
        .filter((dependencyId) => {
          const dependency = tree.resources?.[dependencyId];
          return Boolean(
            dependency &&
            dependency.status.phase === "converged" &&
            dependency.status.observedGeneration === dependency.metadata.generation,
          );
        }),
    ),
  ].sort();
}

function appTaskReadiness(
  tree: TaskTree,
  resource: AppTaskResource,
  satisfied: Set<string>,
  maxConcurrent: number,
  activeCount: number,
  phase = resource.status.phase,
  now = Date.now(),
): AppTaskReadiness {
  const workspace = pendingTaskWorkspaceConstraint(resource);
  if (workspace) return { state: "resource-blocked", reason: `Task prerequisite: ${workspace.reason}`, related_ids: [] };
  const conditionIds = [...(resource.status.conditionIds ?? [])];
  const satisfiedConditionIds = conditionIds.filter((id) => tree.conditions?.[id]?.status.state === "true");
  const conditionWokeTask = phase === "waiting" && satisfiedConditionIds.length > 0;
  const reviewAt = taskReviewAt(resource);
  const reviewDue = reviewAt !== null && reviewAt <= now;
  const changed = resource.metadata.generation > resource.status.observedGeneration || Boolean(tree.taskTriggers?.[resource.metadata.id]);
  const waitingWokeTask = phase === "waiting" && (conditionWokeTask || reviewDue || changed);
  const attentionWokeTask = phase === "attention" && changed && !taskExecutionRetryExhausted(resource);
  if (phase === "waiting" && !waitingWokeTask) {
    return {
      state: "condition-blocked",
      reason: conditionIds.length ? `Waiting for ${conditionIds.join(", ")}` : "Waiting without a linked Condition",
      related_ids: conditionIds,
    };
  }
  if (phase !== "pending" && !waitingWokeTask && !attentionWokeTask) {
    return {
      state: "not-applicable",
      reason: `Task phase is ${phase}`,
      related_ids: [],
    };
  }
  if (tree.project_lifecycle === "paused") {
    return { state: "paused", reason: "Project task reconciliation is paused", related_ids: [] };
  }
  const unmet = (resource.spec.dependsOn ?? []).filter((id) => !satisfied.has(id));
  if (unmet.length) {
    return {
      state: "dependency-blocked",
      reason: `Waiting for ${unmet.join(", ")}`,
      related_ids: unmet,
    };
  }
  if (activeCount >= maxConcurrent) {
    return {
      state: "capacity-blocked",
      reason: `Concurrency ${activeCount}/${maxConcurrent} is full`,
      related_ids: [],
    };
  }
  return conditionWokeTask
    ? {
        state: "ready",
        reason: `Condition satisfied: ${satisfiedConditionIds.join(", ")}`,
        related_ids: satisfiedConditionIds,
      }
    : { state: "ready", reason: "Dependencies and capacity allow claim", related_ids: [] };
}

export function appTaskReadinessById(
  tree: TaskTree,
  configuredMaxConcurrent: number,
  viewPhases: Readonly<Record<string, AppTaskPhase>> = {},
  now = Date.now(),
): Record<string, AppTaskReadiness> {
  const maxConcurrent =
    Number.isInteger(configuredMaxConcurrent) && configuredMaxConcurrent > 0 ? configuredMaxConcurrent : 1;
  const satisfied = new Set(satisfiedDependencyIds(tree));
  const activeCount = Object.values(tree.resources ?? {}).filter(
    (resource) => resource.status.phase === "running",
  ).length;
  return Object.fromEntries(
    Object.values(tree.resources ?? {}).map((resource) => [
      resource.metadata.id,
      appTaskReadiness(tree, resource, satisfied, maxConcurrent, activeCount, viewPhases[resource.metadata.id], now),
    ]),
  );
}

