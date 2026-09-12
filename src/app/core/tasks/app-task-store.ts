import type {
  AppTaskCancellation,
  AppTaskCondition as AppTaskCondition,
  AppTaskAcceptanceBasis as AppTaskAcceptanceBasis,
  AppTaskAttempt as AppTaskAttempt,
  AppTaskResource as AppTaskResource,
  AppTaskTrigger as AppTaskTrigger,
  AppTaskWorkspace as AppTaskWorkspace,
} from "./app-task-state.js";
import type { AppTaskResourceMutation, AppTaskResourceStore } from "../state/app-task-resource-store.js";
import type { TaskExecutorName } from "@may-agent/sdk";
import { inStateTransaction } from "../../../lib/db/transaction.js";

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
    | "child-blocked"
    | "capacity-blocked"
    | "paused"
    | "not-applicable";
  reason: string;
  related_ids: string[];
};

export type AppTaskProjectionItem = {
  item_type: "group" | "task";
  id: string;
  parent_id?: string | null;
  children: string[];
  outcome?: string;
  category?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  executor?: TaskExecutorName;
  mode?: "achieve" | "maintain";
  generation?: number;
  resource_version?: number;
  phase?: AppTaskPhase;
  observed_generation?: number;
  synchronized?: boolean;
  readiness?: AppTaskReadiness;
  depends_on?: string[];
  outputs?: string[];
  acceptance?: string[];
  input?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  summary?: string;
  evidence?: string[];
  condition_ids?: string[];
  status_updated_at?: string;
  attempt_count?: number;
  active_attempt?: {
    id: string;
    handler: string;
    state: AppTaskAttempt["state"];
    reason: string;
    started_at: string;
  };
  context?: Record<string, unknown>;
  strategy_context?: string;
  progress?: Record<string, unknown>;
  tags?: string[];
};

export type AppTaskIntegrityFinding = {
  code:
    | "missing-parent"
    | "missing-dependency"
    | "missing-condition"
    | "waiting-without-condition-or-child"
    | "running-without-attempt"
    | "generation-inversion";
  task_id: string;
  related_ids: string[];
  message: string;
};

export type AppTaskTreeProjection = {
  schema_version: 2;
  project?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  updated_at?: string;
  max_concurrent: number;
  active_task_ids: string[];
  conditions: Record<string, AppTaskCondition>;
  satisfied_dependency_ids: string[];
  integrity: AppTaskIntegrityFinding[];
  tasks: Record<string, AppTaskProjectionItem>;
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
  evidence: string[];
  acceptanceBasis: AppTaskAcceptanceBasis;
  failureFingerprints: string[];
  completedAt: string;
  workspace?: AppTaskWorkspace;
  /** Digest of acceptance/evidence/workspace detail removed from old bounded history. */
  compactedDetailSha256?: string;
  /** Digest of unbounded outcome/summary/response/input detail removed from old bounded history. */
  compactedPayloadSha256?: string;
};

export type AppTaskAdmission = {
  taskId: string;
  taskGeneration: number;
  specHash: string;
  admittedAt: string;
  /** Original ask supplied again when its saved wait returns evidence. */
  inputEvent?: Record<string, unknown>;
  /** Exact accepted answer for this input; later Task outcomes do not replace it. */
  resultAttemptId?: string;
  /** First accepted failure for this input; reporting it does not answer the input. */
  reportAttemptId?: string;
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
  appDir: string;
  projectDir: string;
  agent: string;
  maxConcurrent: number;
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
  const legacy = tree as TaskTree & {
    active_task_id?: unknown;
    active_task_ids?: unknown;
    tasks?: unknown;
  };
  delete legacy.tasks;
  delete legacy.active_task_ids;
  delete legacy.active_task_id;
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

function projectedTaskOwner(
  resource: AppTaskResource,
  groups: Record<string, TaskGroup>,
  resources: Record<string, AppTaskResource>,
): string | undefined {
  if (resource.spec.owner?.trim()) return resource.spec.owner.trim();
  let parentId: string | undefined = resource.spec.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parentResource: AppTaskResource | undefined = resources[parentId];
    if (parentResource?.spec.owner?.trim()) return parentResource.spec.owner.trim();
    if (parentResource) {
      parentId = parentResource.spec.parentId;
      continue;
    }
    const group: TaskGroup | undefined = groups[parentId];
    if (group?.owner?.trim()) return group.owner.trim();
    parentId = group?.parent_id ?? undefined;
  }
  return undefined;
}

function projectedTaskChildren(
  groups: Record<string, TaskGroup>,
  resources: Record<string, AppTaskResource>,
): Record<string, string[]> {
  const childSetsById: Record<string, Set<string>> = {};
  const add = (parentId: string | null | undefined, childId: string): void => {
    if (!parentId) return;
    (childSetsById[parentId] ??= new Set()).add(childId);
  };
  for (const [id, group] of Object.entries(groups)) add(group.parent_id, id);
  for (const [id, resource] of Object.entries(resources)) add(resource.spec.parentId, id);
  return Object.fromEntries(
    Object.entries(childSetsById).map(([parentId, children]) => [parentId, [...children].sort()]),
  );
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
): AppTaskReadiness {
  const conditionIds = [...(resource.status.conditionIds ?? [])];
  const satisfiedConditionIds = conditionIds.filter((id) => tree.conditions?.[id]?.status.state === "true");
  const conditionWokeTask = resource.status.phase === "waiting" && satisfiedConditionIds.length > 0;
  if (resource.status.phase === "waiting" && !conditionWokeTask) {
    const childIds = Object.values(tree.resources ?? {})
      .filter((child) => child.spec.parentId === resource.metadata.id && !tree.cancellations?.[child.metadata.id])
      .map((child) => child.metadata.id)
      .sort();
    if (!conditionIds.length && childIds.length) {
      return {
        state: "child-blocked",
        reason: `Waiting for child work: ${childIds.join(", ")}`,
        related_ids: childIds,
      };
    }
    return {
      state: "condition-blocked",
      reason: conditionIds.length ? `Waiting for ${conditionIds.join(", ")}` : "Waiting without a linked Condition",
      related_ids: conditionIds,
    };
  }
  if (resource.status.phase !== "pending" && !conditionWokeTask) {
    return {
      state: "not-applicable",
      reason: `Task phase is ${resource.status.phase}`,
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
      appTaskReadiness(tree, resource, satisfied, maxConcurrent, activeCount),
    ]),
  );
}

export function buildAppTaskTreeProjection(tree: TaskTree, configuredMaxConcurrent: number): AppTaskTreeProjection {
  const maxConcurrent =
    Number.isInteger(configuredMaxConcurrent) && configuredMaxConcurrent > 0 ? configuredMaxConcurrent : 1;
  const satisfiedIds = satisfiedDependencyIds(tree);
  const satisfied = new Set(satisfiedIds);
  const activeTaskIds = Object.values(tree.resources ?? {})
    .filter((resource) => resource.status.phase === "running")
    .map((resource) => resource.metadata.id)
    .sort();
  const readinessById = appTaskReadinessById(tree, maxConcurrent);
  const attempts = Object.values(tree.attempts ?? {});
  const attemptsByTask = new Map<string, AppTaskAttempt[]>();
  for (const attempt of attempts) {
    const current = attemptsByTask.get(attempt.taskId) ?? [];
    current.push(attempt);
    attemptsByTask.set(attempt.taskId, current);
  }
  const groups = tree.groups ?? {};
  const resources = tree.resources ?? {};
  const childrenById = projectedTaskChildren(groups, resources);

  const tasks: Record<string, AppTaskProjectionItem> = {};
  for (const [id, group] of Object.entries(groups)) {
    tasks[id] = {
      item_type: "group",
      id,
      parent_id: group.parent_id ?? null,
      children: childrenById[id] ?? [],
      ...(group.owner ? { owner: group.owner } : {}),
    };
  }

  for (const [taskId, resource] of Object.entries(resources)) {
    const { metadata, spec, status } = resource;
    const owner = projectedTaskOwner(resource, groups, resources);
    const activeAttempt = resource.status.currentAttemptId
      ? tree.attempts?.[resource.status.currentAttemptId]
      : undefined;
    tasks[taskId] = {
      item_type: "task",
      id: taskId,
      parent_id: spec.parentId,
      children: childrenById[taskId] ?? [],
      outcome: spec.outcome,
      ...(spec.category ? { category: spec.category } : {}),
      priority: spec.priority ?? "P2",
      ...(owner ? { owner } : {}),
      ...(spec.workflow ? { workflow: spec.workflow } : {}),
      ...(spec.executor ? { executor: spec.executor } : {}),
      mode: spec.mode,
      generation: metadata.generation,
      resource_version: metadata.resourceVersion,
      phase: status.phase,
      observed_generation: status.observedGeneration,
      synchronized: status.observedGeneration === metadata.generation,
      readiness: readinessById[taskId],
      depends_on: [...(spec.dependsOn ?? [])],
      outputs: [...(spec.outputs ?? [])],
      acceptance: [...spec.acceptance],
      ...(spec.input ? { input: structuredClone(spec.input) } : {}),
      ...(tree.taskTriggers?.[taskId]?.event ? { trigger: structuredClone(tree.taskTriggers[taskId].event) } : {}),
      ...(status.summary ? { summary: status.summary } : {}),
      ...(status.evidence ? { evidence: [...status.evidence] } : {}),
      condition_ids: [...(status.conditionIds ?? [])],
      status_updated_at: status.updatedAt,
      // A receipt import is accepted historical evidence, not another execution.
      attempt_count:
        attemptsByTask.get(taskId)?.filter((attempt) => attempt.runtimeId !== "retired:task-receipt").length ?? 0,
      ...(activeAttempt
        ? {
            active_attempt: {
              id: activeAttempt.metadata.id,
              handler: activeAttempt.handler,
              state: activeAttempt.state,
              reason: activeAttempt.reason,
              started_at: activeAttempt.startedAt,
            },
          }
        : {}),
    };
  }

  const integrity: AppTaskIntegrityFinding[] = [];
  for (const task of Object.values(tasks)) {
    if (task.parent_id && !tasks[task.parent_id]) {
      integrity.push({
        code: "missing-parent",
        task_id: task.id,
        related_ids: [task.parent_id],
        message: `Parent ${task.parent_id} is missing`,
      });
    }
    if (task.item_type !== "task") continue;
    if ((task.observed_generation ?? 0) > (task.generation ?? 0)) {
      integrity.push({
        code: "generation-inversion",
        task_id: task.id,
        related_ids: [],
        message: `Observed generation ${task.observed_generation} exceeds desired generation ${task.generation}`,
      });
    }
    const missingDependencies = (task.depends_on ?? []).filter((id) => !tasks[id] && !satisfied.has(id));
    if (missingDependencies.length) {
      integrity.push({
        code: "missing-dependency",
        task_id: task.id,
        related_ids: missingDependencies,
        message: `Dependencies are missing: ${missingDependencies.join(", ")}`,
      });
    }
    if (task.phase === "running" && !task.active_attempt) {
      integrity.push({
        code: "running-without-attempt",
        task_id: task.id,
        related_ids: [],
        message: "Running task has no current attempt",
      });
    }
    if (
      task.phase === "waiting" &&
      !(task.condition_ids ?? []).length &&
      !(task.children ?? []).some((childId) => tasks[childId]?.item_type === "task")
    ) {
      integrity.push({
        code: "waiting-without-condition-or-child",
        task_id: task.id,
        related_ids: [],
        message: "Waiting task has neither a linked Condition nor live child work",
      });
    }
    const missingConditions = (task.condition_ids ?? []).filter((id) => !tree.conditions?.[id]);
    if (missingConditions.length) {
      integrity.push({
        code: "missing-condition",
        task_id: task.id,
        related_ids: missingConditions,
        message: `Conditions are missing: ${missingConditions.join(", ")}`,
      });
    }
  }

  return {
    schema_version: 2,
    ...(tree.project ? { project: tree.project } : {}),
    ...(tree.project_lifecycle ? { project_lifecycle: tree.project_lifecycle } : {}),
    ...(tree.root_task_id ? { root_task_id: tree.root_task_id } : {}),
    updated_at: tree.updated_at,
    max_concurrent: maxConcurrent,
    active_task_ids: activeTaskIds,
    conditions: JSON.parse(JSON.stringify(tree.conditions ?? {})) as Record<string, AppTaskCondition>,
    satisfied_dependency_ids: satisfiedIds,
    integrity,
    tasks,
  };
}
