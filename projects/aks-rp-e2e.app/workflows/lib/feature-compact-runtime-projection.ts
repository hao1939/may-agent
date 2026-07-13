import type { TaskNode } from "@may-agent/sdk";
import type { FeatureCompactLoopState } from "./feature-compact-loop-store.ts";
import { compactWaitOwner } from "./feature-compact-wait-owner.ts";

type RuntimeProjectionTaskRepair = {
  taskId: string;
  featureKey: string;
  field:
    | "blocker.condition"
    | "blocker.resume_condition"
    | "blocker.waiting_for"
    | "task.owner"
    | "task.projection"
    | "task.reopen"
    | "task.replacement";
  before: unknown;
  after: unknown;
  reason?: string;
};

type RuntimeProjectionStateRepair = {
  featureKey: string;
  field:
    "waitingFor" | "taskId" | "frontierTaskIds" | "nextCheckAt" | "fallbackAt";
  before: unknown;
  after: unknown;
  reason: string;
};

export type FeatureCompactRuntimeProjectionRepair = {
  taskRepairs: RuntimeProjectionTaskRepair[];
  stateRepairs: RuntimeProjectionStateRepair[];
};

function taskStatus(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog").trim();
}

function taskContext(task: TaskNode | undefined): Record<string, unknown> {
  const value = task?.context;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function taskTrace(task: TaskNode | undefined): Record<string, unknown> {
  const value = task?.trace;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];
}

const durableLoopTaskIds = new Set([
  "aks-spec-verification-loop",
  "aks-feature-reference-loop",
  "aks-feature-compact-loop",
]);

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactWaitFeatureKey(task: TaskNode | undefined): string {
  const context = taskContext(task);
  const contextFeatureKey = stringValue(context.featureKey);
  if (contextFeatureKey) return contextFeatureKey;
  for (const scope of taskConflictScopes(task)) {
    const match = scope.match(/^feature-compact:(.+)$/);
    if (match?.[1]) return match[1];
  }
  return "";
}

function featureKeyAliases(
  featureKey: string,
  state: FeatureCompactLoopState,
): string[] {
  const aliases = [featureKey];
  const parentKey = featureKey.includes(":")
    ? featureKey.slice(0, featureKey.indexOf(":"))
    : "";
  if (parentKey && state.features[parentKey]) aliases.push(parentKey);
  return uniqueSorted(aliases);
}

function exactWaitTarget(task: TaskNode | undefined): string {
  const context = taskContext(task);
  const waitingFor = blockerWaitingFor(task);
  return (
    stringValue(context.target) || stringValue(waitingFor?.target) || "staging"
  );
}

function exactWaitErrorClass(task: TaskNode | undefined): string {
  const context = taskContext(task);
  const contextErrorClass = stringValue(context.errorClass);
  if (contextErrorClass) return contextErrorClass;
  for (const scope of taskConflictScopes(task)) {
    const match = scope.match(/^feature-compact-wait:(.+)$/);
    if (match?.[1]) return match[1];
  }
  return "compact-error";
}

function blockerCondition(task: TaskNode | undefined): string {
  const blocker = recordValue(task?.blocker);
  return stringValue(blocker?.condition);
}

function blockerWaitingFor(
  task: TaskNode | undefined,
): Record<string, unknown> | null {
  const blocker = recordValue(task?.blocker);
  return recordValue(blocker?.waiting_for);
}

function blockerResumeCondition(task: TaskNode | undefined): string {
  const blocker = recordValue(task?.blocker);
  return stringValue(blocker?.resume_condition);
}

function blockerOwner(task: TaskNode | undefined): string {
  const blocker = recordValue(task?.blocker);
  return stringValue(blocker?.owner);
}

function taskOwner(task: TaskNode | undefined): string {
  return stringValue(task?.owner);
}

function taskBlocker(
  task: TaskNode | undefined,
): Record<string, unknown> | null {
  return recordValue(task?.blocker);
}

function featureWaitingForType(
  feature: FeatureCompactLoopState["features"][string],
): string {
  const waitingFor = structuredFeatureWaitingFor(feature);
  if (waitingFor) return stringValue(waitingFor.type);
  return compactWaitingForProjection({
    featureKey: feature.featureKey,
    target: "staging",
    errorClass: feature.errorClass ?? "compact-error",
    reason: "",
  }).type as string;
}

function structuredFeatureWaitingFor(
  feature: FeatureCompactLoopState["features"][string],
): Record<string, unknown> | null {
  const waitingFor = recordValue(feature.waitingFor);
  return stringValue(waitingFor?.type) ? waitingFor : null;
}

function compactHolderWatchFields(task: TaskNode | undefined): {
  nextCheckAt: string;
  fallbackAt: string;
} {
  const blocker = recordValue(task?.blocker);
  return {
    nextCheckAt: stringValue(blocker?.next_check_at),
    fallbackAt: stringValue(blocker?.fallback_at),
  };
}

function futureIsoOrDefault(
  value: unknown,
  nowMs: number,
  defaultOffsetMs: number,
  afterMs?: number,
): string {
  const existing = stringValue(value);
  const parsed = Date.parse(existing);
  const minimumMs = Math.max(nowMs, afterMs ?? nowMs);
  if (Number.isFinite(parsed) && parsed > minimumMs) {
    return existing;
  }
  return new Date(nowMs + defaultOffsetMs).toISOString();
}

function compactHolderProjectedWatchFields(
  feature: FeatureCompactLoopState["features"][string],
): {
  nextCheckAt: string;
  fallbackAt: string;
} {
  const nowMs = Date.now();
  const nextCheckAt = futureIsoOrDefault(
    feature.nextCheckAt,
    nowMs,
    10 * 60_000,
  );
  const fallbackAt = futureIsoOrDefault(
    feature.fallbackAt,
    nowMs,
    24 * 60 * 60_000,
    Date.parse(nextCheckAt),
  );
  return { nextCheckAt, fallbackAt };
}

function taskIdSet(values: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(values)) return ids;
  for (const value of values) {
    const id = stringValue(value);
    if (id) ids.add(id);
  }
  return ids;
}

function ownerDecisionWatchSourceTask(input: {
  feature: FeatureCompactLoopState["features"][string];
  liveTask: TaskNode;
  tasks: Record<string, TaskNode>;
}): TaskNode | null {
  const desiredType = featureWaitingForType(input.feature);
  if (desiredType !== "owner.decision") return null;

  for (const taskId of taskIdSet(input.feature.frontierTaskIds)) {
    const task = input.tasks[taskId];
    if (!task || taskStatus(task) !== "blocked") continue;
    const waitingForType = stringValue(blockerWaitingFor(task)?.type);
    if (waitingForType === "owner.decision") return task;
  }

  if (
    taskStatus(input.liveTask) === "blocked" &&
    stringValue(blockerWaitingFor(input.liveTask)?.type) === "owner.decision"
  ) {
    return input.liveTask;
  }
  return null;
}

function isFeatureCompactExactWaitHolder(
  task: TaskNode | undefined,
): task is TaskNode {
  if (!task) return false;
  if (taskContext(task).featureCompactExactWait === true) return true;
  const scopes = taskConflictScopes(task);
  const waitingForType = stringValue(blockerWaitingFor(task)?.type);
  if (
    scopes.some((scope) => scope.startsWith("feature-compact:")) &&
    (waitingForType === "ado.pipeline_run.completed" ||
      waitingForType === "pipeline.result.or.artifact.available")
  ) {
    return true;
  }
  return (
    Boolean(exactWaitFeatureKey(task)) &&
    (scopes.some((scope) => scope.startsWith("feature-compact-wait:")) ||
      isGenericFeaturePackageWaitTask(task))
  );
}

function isPipelineRunCompactWait(task: TaskNode | undefined): boolean {
  if (!task) return false;
  const waitingForType = stringValue(blockerWaitingFor(task)?.type);
  return (
    waitingForType === "ado.pipeline_run.completed" ||
    waitingForType === "pipeline.result.or.artifact.available"
  );
}

function exactWaitRepresentsFeature(input: {
  task: TaskNode | undefined;
  featureKey: string;
  state: FeatureCompactLoopState;
}): boolean {
  if (!isExactBlockedWaitTask(input.task)) return false;
  const exactFeatureKey = exactWaitFeatureKey(input.task);
  return featureKeyAliases(exactFeatureKey, input.state).includes(
    input.featureKey,
  );
}

function alternativeLiveExactWaitTaskId(input: {
  featureKey: string;
  state: FeatureCompactLoopState;
  tasks: Record<string, TaskNode>;
  excludeTaskId?: string;
}): string | null {
  const candidates = Object.values(input.tasks)
    .filter((task) => task.id !== input.excludeTaskId)
    .filter((task) =>
      exactWaitRepresentsFeature({
        task,
        featureKey: input.featureKey,
        state: input.state,
      }),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  return candidates[0]?.id ?? null;
}

function isExactBlockedWaitTask(task: TaskNode | undefined): task is TaskNode {
  return (
    taskStatus(task) === "blocked" && isFeatureCompactExactWaitHolder(task)
  );
}

function isGenericFeaturePackageWaitTask(task: TaskNode | undefined): boolean {
  const goal = stringValue(task?.goal);
  return /^Hold compact feature .+ on exact .+ wait until the named condition changes\.?$/i.test(
    goal,
  );
}

function isCompactHolderProjectionTask(task: TaskNode | undefined): boolean {
  if (!task) return false;
  if (taskContext(task).featureCompactExactWait === true) return true;
  if (!task.id.startsWith("hold-compact-")) return false;
  const featureKey = exactWaitFeatureKey(task);
  if (!featureKey) return false;
  const scopes = taskConflictScopes(task);
  return (
    scopes.includes(`feature-compact:${featureKey}`) ||
    scopes.includes(`feature:${featureKey}`)
  );
}

function sharedWaitReplacement(task: TaskNode | undefined): boolean {
  if (!task || taskStatus(task) !== "done") return false;
  const resolution = stringValue(
    (task as TaskNode & { resolution?: unknown }).resolution,
  );
  if (resolution !== "replaced") return false;
  return Boolean(exactWaitFeatureKey(task));
}

export function compactWaitingForProjection(input: {
  featureKey: string;
  target: string;
  errorClass: string;
  reason: string;
}): Record<string, unknown> {
  const base = {
    featureKey: input.featureKey,
    target: input.target,
    errorClass: input.errorClass,
    scope: "feature-compact",
  };
  if (input.errorClass === "runtime-product-lineage") {
    return { ...base, type: "owner.decision" };
  }
  if (input.errorClass === "staging-capacity") {
    return {
      ...base,
      type: "azure.capacity.available",
      resource: "managedClusters",
    };
  }

  return { ...base, type: "compact.frontier.changed" };
}

function taskConflictScopes(task: TaskNode | undefined): string[] {
  const scopes = task?.conflict_scope;
  return Array.isArray(scopes)
    ? scopes
        .map((scope) => (typeof scope === "string" ? scope.trim() : ""))
        .filter(Boolean)
    : [];
}

function sameSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function featureRelatedBlockedTasks(input: {
  featureKey: string;
  tasks: Record<string, TaskNode>;
  includeLoopChildren?: boolean;
}): TaskNode[] {
  const featureScope = `feature:${input.featureKey}`;
  const featureCompactScope = `feature-compact:${input.featureKey}`;
  const specPrefix = `spec:spec.${input.featureKey}.`;
  return Object.values(input.tasks)
    .filter((task) => taskStatus(task) === "blocked")
    .filter((task) =>
      input.includeLoopChildren
        ? true
        : task.parent_id !== "aks-feature-compact-loop",
    )
    .filter((task) => {
      const scopes = taskConflictScopes(task);
      if (
        scopes.includes(featureScope) ||
        scopes.includes(featureCompactScope) ||
        scopes.some((scope) => scope.startsWith(specPrefix))
      ) {
        return true;
      }
      const context = taskContext(task);
      return (
        stringValue(context.featureKey) === input.featureKey ||
        stringValue(context.compactFeatureKey) === input.featureKey
      );
    })
    .filter((task) => !durableLoopTaskIds.has(task.id));
}

function crossLoopExactFrontierTaskIds(input: {
  featureKey: string;
  tasks: Record<string, TaskNode>;
}): string[] {
  return uniqueSorted(featureRelatedBlockedTasks(input).map((task) => task.id));
}

function explicitNamedFrontierTaskIds(input: {
  featureKey: string;
  sourceTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
}): string[] {
  const context = taskContext(input.sourceTask);
  const explicitTaskIds = uniqueSorted([
    ...stringArrayValue(context.frontierTaskIds),
    ...stringArrayValue(context.replacementTaskIds),
    ...stringArrayValue(context.compactFrontierTaskIds),
  ]);
  if (explicitTaskIds.length === 0) return [];
  const sourceTaskId = stringValue(input.sourceTask?.id);
  return uniqueSorted(
    explicitTaskIds.filter((taskId) => {
      if (taskId === sourceTaskId || durableLoopTaskIds.has(taskId))
        return false;
      const task = input.tasks[taskId];
      return Boolean(task) && taskStatus(task) === "blocked";
    }),
  );
}

function genericProjectionPlaceholder(type: string): boolean {
  return type === "environment.available" || type === "evidence.available";
}

function preciseFeatureBlockedReason(
  feature: FeatureCompactLoopState["features"][string],
): string {
  return stringValue(feature.blockedReason);
}

function preciseFeatureResumeCondition(
  feature: FeatureCompactLoopState["features"][string],
): string {
  return (
    stringValue(feature.resumeCondition) ||
    stringValue(feature.waitingCondition) ||
    stringValue(feature.retryReason)
  );
}

function staleMissingCompactHolderText(text: string): boolean {
  return /restore the missing compact blocked holder/i.test(text);
}

function shouldRefreshExistingExactProjection(input: {
  feature: FeatureCompactLoopState["features"][string];
  exactTask: TaskNode;
}): boolean {
  const desiredType = featureWaitingForType(input.feature);
  const exactType = stringValue(blockerWaitingFor(input.exactTask)?.type);
  if (!exactType) return true;
  if (desiredType === exactType && !genericProjectionPlaceholder(exactType)) {
    return false;
  }
  return Boolean(desiredType && desiredType !== exactType);
}

function featureStillNeedsSharperProjection(input: {
  featureKey: string;
  feature: FeatureCompactLoopState["features"][string];
  exactTask: TaskNode;
}): boolean {
  const desiredType = featureWaitingForType(input.feature);
  const exactType = stringValue(blockerWaitingFor(input.exactTask)?.type);
  if (desiredType === exactType && exactType === "compact.frontier.changed") {
    return false;
  }
  return Boolean(exactType && !genericProjectionPlaceholder(exactType));
}

function projectedCrossLoopCompactTaskId(input: {
  featureKey: string;
  tasks: Record<string, TaskNode>;
}): string | null {
  const featureCompactScope = `feature-compact:${input.featureKey}`;
  const candidates = Object.values(input.tasks)
    .filter((task) => taskStatus(task) === "blocked")
    .filter((task) => task.parent_id !== "aks-feature-compact-loop")
    .filter((task) => !durableLoopTaskIds.has(task.id))
    .filter((task) => taskConflictScopes(task).includes(featureCompactScope))
    .sort((left, right) => left.id.localeCompare(right.id));
  return candidates[0]?.id ?? null;
}

function compatibleSharedReplacementTaskId(input: {
  featureKey: string;
  feature: FeatureCompactLoopState["features"][string];
  tasks: Record<string, TaskNode>;
  excludeTaskId: string;
}): string | null {
  const waitingFor = recordValue(input.feature.waitingFor);
  const desiredType =
    stringValue(waitingFor?.type) || featureWaitingForType(input.feature);
  const desiredResource = stringValue(waitingFor?.resource);
  const genericDesiredType = desiredType === "compact.frontier.changed";
  const candidates = Object.values(input.tasks)
    .filter((task) => task.id !== input.excludeTaskId)
    .filter((task) => taskStatus(task) === "blocked")
    .filter((task) => !durableLoopTaskIds.has(task.id))
    .filter((task) =>
      featureRelatedBlockedTasks({
        featureKey: input.featureKey,
        tasks: { [task.id]: task },
        includeLoopChildren: true,
      }).some((candidate) => candidate.id === task.id),
    )
    .filter((task) => {
      const candidateWaitingFor = blockerWaitingFor(task);
      const candidateType = stringValue(candidateWaitingFor?.type);
      const candidateResource = stringValue(candidateWaitingFor?.resource);
      const scopes = taskConflictScopes(task);
      const reviewedExceptionFamily = scopes.includes(
        "feature-compact-wait:reviewed-exception",
      );
      if (
        desiredType &&
        candidateType &&
        desiredType !== candidateType &&
        !genericDesiredType &&
        !reviewedExceptionFamily
      ) {
        return false;
      }
      if (
        desiredResource &&
        candidateResource &&
        desiredResource !== candidateResource &&
        !reviewedExceptionFamily
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  return candidates[0]?.id ?? null;
}

export function reconcileFeatureCompactRuntimeProjection(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: FeatureCompactLoopState;
}): FeatureCompactRuntimeProjectionRepair {
  const taskRepairs: RuntimeProjectionTaskRepair[] = [];
  const stateRepairs: RuntimeProjectionStateRepair[] = [];
  if (!input.loopTask) return { taskRepairs, stateRepairs };

  const replacedOrphanHolderIds = new Set<string>();

  for (const [featureKey, feature] of Object.entries(input.state.features)) {
    if (feature.status !== "blocked") continue;
    const taskId = stringValue(feature.taskId);
    if (!taskId || input.tasks[taskId]) continue;
    if (!taskId.startsWith("hold-compact-")) continue;
    if (
      alternativeLiveExactWaitTaskId({
        featureKey,
        state: input.state,
        tasks: input.tasks,
        excludeTaskId: taskId,
      })
    ) {
      continue;
    }

    const errorClass = feature.errorClass ?? "compact-error";
    const condition =
      preciseFeatureBlockedReason(feature) ||
      preciseFeatureResumeCondition(feature) ||
      `Feature compact ${featureKey} remains blocked by its exact compact holder.`;
    const waitingFor =
      structuredFeatureWaitingFor(feature) ??
      compactWaitingForProjection({
        featureKey,
        target: "staging",
        errorClass,
        reason: condition,
      });
    const projectedWatch = compactHolderProjectedWatchFields(feature);
    const owner = stringValue(feature.blockerOwner) || "aks-explorer";
    input.tasks[taskId] = {
      id: taskId,
      parent_id: input.loopTask.id,
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner,
      children: [],
      goal: `Hold compact feature ${featureKey} on exact ${errorClass} wait until the named condition changes.`,
      inputs: [],
      outputs: [],
      acceptance: [
        `The feature remains blocked only while the exact ${errorClass} condition is still true.`,
        `Resume by resetting this feature to runnable compact work only after the named ${errorClass} frontier materially changes.`,
        "Do not broad-rerun the feature or family while the same input and compact fingerprint remain unchanged.",
      ],
      conflict_scope: [
        `feature-compact:${featureKey}`,
        `feature:${featureKey}`,
        `feature-compact-wait:${errorClass}`,
      ],
      context: {
        featureCompactExactWait: true,
        featureKey,
        errorClass,
        target: stringValue(waitingFor.target) || "staging",
      },
      blocker: {
        condition,
        category: "external-wait",
        owner,
        blocked_at: stringValue(feature.blockedAt) || new Date().toISOString(),
        waiting_for: waitingFor,
        observed_by: recordValue(feature.observedBy) ?? {
          workflow: "feature-compact-loop-controller",
          trigger: "project.task.tick",
        },
        observation_method:
          stringValue(feature.observationMethod) ||
          "On each compact-loop tick, verify the linked blocked holder still represents this feature.",
        next_check_at: projectedWatch.nextCheckAt,
        resume_condition: preciseFeatureResumeCondition(feature) || condition,
        fallback_at: projectedWatch.fallbackAt,
        fallback_action:
          stringValue(feature.fallbackAction) ||
          "If the same wait remains true, refresh evidence or replace the holder with a narrower exact wait.",
      },
      trace: {
        created_at: new Date().toISOString(),
        created_by: "feature-compact-loop-controller",
        missing_exact_compact_holder_recreated_at: new Date().toISOString(),
      },
    } as TaskNode;
    if (!input.loopTask.children?.includes(taskId)) {
      input.loopTask.children = [...(input.loopTask.children ?? []), taskId];
    }
    taskRepairs.push({
      taskId,
      featureKey,
      field: "task.reopen",
      before: null,
      after: { state: "blocked", status: "blocked" },
      reason: `Recreated missing exact compact holder ${taskId} because ${featureKey} remains blocked in compact state.`,
    });
  }

  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isFeatureCompactExactWaitHolder(child)) continue;
    if (taskStatus(child) !== "done") continue;
    const resolution = (child as TaskNode & { resolution?: unknown })
      .resolution;
    if (resolution === "replaced") continue;
    const featureKey = exactWaitFeatureKey(child);
    const feature = featureKey ? input.state.features[featureKey] : undefined;
    if (feature?.status !== "blocked") continue;
    if (
      alternativeLiveExactWaitTaskId({
        featureKey,
        state: input.state,
        tasks: input.tasks,
        excludeTaskId: child.id,
      })
    ) {
      continue;
    }

    const before = {
      state: child.state ?? null,
      status: child.status ?? null,
      resolution: resolution ?? null,
    };
    const condition =
      preciseFeatureBlockedReason(feature) ||
      preciseFeatureResumeCondition(feature) ||
      `Feature compact ${featureKey} remains blocked by its exact compact holder.`;
    const waitingFor =
      structuredFeatureWaitingFor(feature) ??
      compactWaitingForProjection({
        featureKey,
        target: exactWaitTarget(child),
        errorClass: exactWaitErrorClass(child),
        reason: condition,
      });
    const projectedWatch = compactHolderProjectedWatchFields(feature);
    child.state = "blocked";
    child.status = "blocked";
    delete (child as Record<string, unknown>).done_at;
    delete (child as Record<string, unknown>).done_by;
    delete (child as Record<string, unknown>).resolution;
    child.blocker = {
      condition,
      category: "external-wait",
      owner:
        stringValue(feature.blockerOwner) ||
        blockerOwner(child) ||
        taskOwner(child),
      blocked_at: stringValue(feature.blockedAt) || new Date().toISOString(),
      waiting_for: waitingFor,
      observed_by: recordValue(feature.observedBy) ?? {
        workflow: "feature-compact-loop-controller",
        trigger: "project.task.tick",
      },
      observation_method:
        stringValue(feature.observationMethod) ||
        "On each compact-loop tick, verify the linked blocked holder still represents this feature.",
      next_check_at: projectedWatch.nextCheckAt,
      resume_condition: preciseFeatureResumeCondition(feature) || condition,
      fallback_at: projectedWatch.fallbackAt,
      fallback_action:
        stringValue(feature.fallbackAction) ||
        "If the same wait remains true, refresh evidence or replace the holder with a narrower exact wait.",
    };
    child.trace = {
      ...(child.trace ?? {}),
      exact_compact_holder_reopened_at: new Date().toISOString(),
      exact_compact_holder_reopened_by: "feature-compact-loop-controller",
      exact_compact_holder_reopen_reason:
        "feature compact state still blocks this feature; prior done state was stale cleanup",
    };
    taskRepairs.push({
      taskId: child.id,
      featureKey,
      field: "task.reopen",
      before,
      after: { state: "blocked", status: "blocked" },
      reason: `Reopened exact compact holder ${child.id} because ${featureKey} remains blocked in compact state.`,
    });
  }

  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isCompactHolderProjectionTask(child)) continue;
    if (taskStatus(child) !== "blocked") continue;
    const featureKey = exactWaitFeatureKey(child);
    const feature = input.state.features[featureKey];
    if (
      !feature ||
      (feature.status !== "blocked" && feature.status !== "error")
    ) {
      continue;
    }
    const featureTaskId = stringValue(feature.taskId);
    const featureFrontierTaskIds = uniqueSorted(
      Array.isArray(feature.frontierTaskIds)
        ? feature.frontierTaskIds.map((value) => stringValue(value))
        : [],
    );
    if (
      featureTaskId === child.id ||
      featureFrontierTaskIds.includes(child.id)
    ) {
      continue;
    }
    if (!featureTaskId && isGenericFeaturePackageWaitTask(child)) continue;
    const replacementTaskIds = uniqueSorted([
      featureTaskId,
      ...featureFrontierTaskIds,
    ]).filter((taskId) => {
      if (!taskId || taskId === child.id) return false;
      const replacement = input.tasks[taskId];
      return Boolean(replacement) && taskStatus(replacement) === "blocked";
    });
    if (replacementTaskIds.length === 0) continue;

    child.state = "done";
    child.status = "done";
    (child as TaskNode & { resolution?: string }).resolution = "replaced";
    (child as TaskNode & { done_at?: string }).done_at =
      new Date().toISOString();
    (child as TaskNode & { done_by?: string }).done_by =
      "feature-compact-loop-controller";
    (child as TaskNode & { result?: string }).result =
      `Closed stale compact holder projection because ${featureKey} is now represented by ${replacementTaskIds.join(", ")}.`;
    delete (child as Record<string, unknown>).blocker;
    child.trace = {
      ...(child.trace ?? {}),
      compact_holder_projection_replaced_at: new Date().toISOString(),
      compact_holder_projection_replaced_by: "feature-compact-loop-controller",
      compact_holder_projection_replacement_task_ids: replacementTaskIds,
    };
    replacedOrphanHolderIds.add(child.id);
    taskRepairs.push({
      taskId: child.id,
      featureKey,
      field: "task.replacement",
      before: { state: "blocked", status: "blocked" },
      after: { state: "done", status: "done", resolution: "replaced" },
      reason: `Closed stale compact holder projection ${child.id}; ${featureKey} is represented by ${replacementTaskIds.join(", ")}.`,
    });
  }

  const liveExactWaitTaskIds = new Map<string, string>();
  const fallbackGenericExactWaitTaskIds = new Map<string, string>();
  for (const childId of input.loopTask.children ?? []) {
    if (replacedOrphanHolderIds.has(childId)) continue;
    const child = input.tasks[childId];
    if (!isExactBlockedWaitTask(child)) continue;
    const featureKey = exactWaitFeatureKey(child);
    for (const representedFeatureKey of featureKey
      ? featureKeyAliases(featureKey, input.state)
      : []) {
      if (isGenericFeaturePackageWaitTask(child)) {
        if (!fallbackGenericExactWaitTaskIds.has(representedFeatureKey)) {
          fallbackGenericExactWaitTaskIds.set(representedFeatureKey, child.id);
        }
      } else if (!liveExactWaitTaskIds.has(representedFeatureKey)) {
        liveExactWaitTaskIds.set(representedFeatureKey, child.id);
      }
    }

    const blocker = taskBlocker(child);
    if (blocker) {
      const existingOwner = taskOwner(child);
      const existingBlockerOwner = blockerOwner(child);
      const desiredOwner = compactWaitOwner({
        owner: existingBlockerOwner || existingOwner,
        waitingFor: blockerWaitingFor(child),
      });
      if (desiredOwner && existingOwner !== desiredOwner) {
        child.owner = desiredOwner;
        taskRepairs.push({
          taskId: child.id,
          featureKey,
          field: "task.owner",
          before: existingOwner,
          after: desiredOwner,
          reason: existingOwner
            ? `Aligned surviving exact compact wait owner on ${child.id}.`
            : `Backfilled blank surviving exact compact wait owner on ${child.id}.`,
        });
      }
      if (desiredOwner && existingBlockerOwner !== desiredOwner) {
        blocker.owner = desiredOwner;
        taskRepairs.push({
          taskId: child.id,
          featureKey,
          field: "task.projection",
          before: existingBlockerOwner,
          after: desiredOwner,
          reason: existingBlockerOwner
            ? `Aligned blocker owner on ${child.id} with the exact compact frontier.`
            : `Backfilled blocker owner on ${child.id} from the exact compact frontier.`,
        });
      }

      const featureForChild =
        featureKey && input.state.features[featureKey]
          ? input.state.features[featureKey]
          : null;
      const desiredWaitingFor =
        (featureForChild
          ? structuredFeatureWaitingFor(featureForChild)
          : null) ??
        blockerWaitingFor(child) ??
        compactWaitingForProjection({
          featureKey,
          target: exactWaitTarget(child),
          errorClass: exactWaitErrorClass(child),
          reason: blockerCondition(child),
        });
      const existingWaitingFor = blockerWaitingFor(child);
      if (!jsonEqual(existingWaitingFor, desiredWaitingFor)) {
        blocker.waiting_for = desiredWaitingFor;
        taskRepairs.push({
          taskId: child.id,
          featureKey,
          field: "blocker.waiting_for",
          before: existingWaitingFor,
          after: desiredWaitingFor,
        });
      }
    }
  }

  for (const [featureKey, feature] of Object.entries(input.state.features)) {
    if (feature.status !== "blocked" && feature.status !== "error") continue;

    const liveExactWaitTaskId =
      liveExactWaitTaskIds.get(featureKey) ??
      fallbackGenericExactWaitTaskIds.get(featureKey) ??
      projectedCrossLoopCompactTaskId({ featureKey, tasks: input.tasks }) ??
      null;
    const namedFrontierTaskIds = explicitNamedFrontierTaskIds({
      featureKey,
      sourceTask: liveExactWaitTaskId
        ? input.tasks[liveExactWaitTaskId]
        : undefined,
      tasks: input.tasks,
    });
    const crossLoopTaskIds = crossLoopExactFrontierTaskIds({
      featureKey,
      tasks: input.tasks,
    });
    const projectedFrontierTaskIds =
      namedFrontierTaskIds.length > 0 ? namedFrontierTaskIds : crossLoopTaskIds;
    const previousFrontierTaskIds = uniqueSorted(
      Array.isArray(feature.frontierTaskIds)
        ? feature.frontierTaskIds.filter(
            (taskId): taskId is string => typeof taskId === "string",
          )
        : [],
    );
    if (!sameSet(previousFrontierTaskIds, projectedFrontierTaskIds)) {
      stateRepairs.push({
        featureKey,
        field: "frontierTaskIds",
        before: previousFrontierTaskIds,
        after: projectedFrontierTaskIds,
        reason:
          namedFrontierTaskIds.length > 0
            ? `Reprojected ${featureKey} to the exact downstream carrier(s) named by ${liveExactWaitTaskId}: ${projectedFrontierTaskIds.join(", ")}.`
            : `Reprojected ${featureKey} to exact cross-loop frontier holders ${projectedFrontierTaskIds.join(", ")}.`,
      });
      feature.frontierTaskIds = projectedFrontierTaskIds;
    }
    if (liveExactWaitTaskId) {
      const liveTask = input.tasks[liveExactWaitTaskId];
      if (
        liveTask &&
        feature.taskId !== liveExactWaitTaskId &&
        (!feature.taskId ||
          isPipelineRunCompactWait(liveTask) ||
          featureStillNeedsSharperProjection({
            featureKey,
            feature,
            exactTask: liveTask,
          }))
      ) {
        stateRepairs.push({
          featureKey,
          field: "taskId",
          before: feature.taskId ?? null,
          after: liveExactWaitTaskId,
          reason: `Reprojected ${featureKey} from stale generic holder to sharper exact wait ${liveExactWaitTaskId}.`,
        });
        feature.taskId = liveExactWaitTaskId;

        const blocker = taskBlocker(liveTask);
        if (
          blocker &&
          isExactBlockedWaitTask(liveTask) &&
          !isPipelineRunCompactWait(liveTask)
        ) {
          const desiredWaitingFor =
            structuredFeatureWaitingFor(feature) ?? blockerWaitingFor(liveTask);
          const existingWaitingFor = blockerWaitingFor(liveTask);
          if (
            desiredWaitingFor &&
            !jsonEqual(existingWaitingFor, desiredWaitingFor)
          ) {
            blocker.waiting_for = desiredWaitingFor;
            taskRepairs.push({
              taskId: liveTask.id,
              featureKey,
              field: "blocker.waiting_for",
              before: existingWaitingFor,
              after: desiredWaitingFor,
              reason: `Updated ${liveTask.id} waiting_for to match the exact compact frontier for ${featureKey}.`,
            });
          }
        }
      } else if (
        liveTask &&
        isExactBlockedWaitTask(liveTask) &&
        shouldRefreshExistingExactProjection({ feature, exactTask: liveTask })
      ) {
        const blocker = taskBlocker(liveTask);
        const existingCondition = blockerCondition(liveTask);
        const desiredCondition = preciseFeatureBlockedReason(feature);
        if (
          blocker &&
          desiredCondition &&
          existingCondition !== desiredCondition &&
          staleMissingCompactHolderText(existingCondition) &&
          !staleMissingCompactHolderText(desiredCondition)
        ) {
          blocker.condition = desiredCondition;
          taskRepairs.push({
            taskId: liveTask.id,
            featureKey,
            field: "blocker.condition",
            before: existingCondition,
            after: desiredCondition,
            reason: `Refreshed stale compact holder condition on ${liveTask.id} from current compact state for ${featureKey}.`,
          });
        }
        const existingResumeCondition = blockerResumeCondition(liveTask);
        const desiredResumeCondition = preciseFeatureResumeCondition(feature);
        if (
          blocker &&
          desiredResumeCondition &&
          existingResumeCondition !== desiredResumeCondition &&
          staleMissingCompactHolderText(existingCondition)
        ) {
          blocker.resume_condition = desiredResumeCondition;
          taskRepairs.push({
            taskId: liveTask.id,
            featureKey,
            field: "blocker.resume_condition",
            before: existingResumeCondition,
            after: desiredResumeCondition,
            reason: `Refreshed stale compact holder resume condition on ${liveTask.id} from current compact state for ${featureKey}.`,
          });
        }
        const desiredWaitingFor =
          structuredFeatureWaitingFor(feature) ??
          compactWaitingForProjection({
            featureKey,
            target: exactWaitTarget(liveTask),
            errorClass: exactWaitErrorClass(liveTask),
            reason: blockerCondition(liveTask),
          });
        const existingWaitingFor = blockerWaitingFor(liveTask);
        if (blocker && !jsonEqual(existingWaitingFor, desiredWaitingFor)) {
          blocker.waiting_for = desiredWaitingFor;
          taskRepairs.push({
            taskId: liveTask.id,
            featureKey,
            field: "blocker.waiting_for",
            before: existingWaitingFor,
            after: desiredWaitingFor,
            reason: `Refreshed ${liveTask.id} waiting_for to match the exact compact frontier for ${featureKey}.`,
          });
        }
      }

      if (liveTask && isExactBlockedWaitTask(liveTask)) {
        const holderWatch = compactHolderWatchFields(liveTask);
        if (
          holderWatch.nextCheckAt &&
          feature.nextCheckAt !== holderWatch.nextCheckAt
        ) {
          stateRepairs.push({
            featureKey,
            field: "nextCheckAt",
            before: feature.nextCheckAt ?? null,
            after: holderWatch.nextCheckAt,
            reason: `Aligned ${featureKey} compact holder nextCheckAt to live exact holder ${liveTask.id}.`,
          });
          feature.nextCheckAt = holderWatch.nextCheckAt;
        }
        if (
          holderWatch.fallbackAt &&
          feature.fallbackAt !== holderWatch.fallbackAt
        ) {
          stateRepairs.push({
            featureKey,
            field: "fallbackAt",
            before: feature.fallbackAt ?? null,
            after: holderWatch.fallbackAt,
            reason: `Aligned ${featureKey} compact holder fallbackAt to live exact holder ${liveTask.id}.`,
          });
          feature.fallbackAt = holderWatch.fallbackAt;
        }

        const watchSourceTask = ownerDecisionWatchSourceTask({
          feature,
          liveTask,
          tasks: input.tasks,
        });
        if (watchSourceTask) {
          const inheritedWatch = compactHolderWatchFields(watchSourceTask);
          if (
            inheritedWatch.nextCheckAt &&
            feature.nextCheckAt !== inheritedWatch.nextCheckAt
          ) {
            stateRepairs.push({
              featureKey,
              field: "nextCheckAt",
              before: feature.nextCheckAt ?? null,
              after: inheritedWatch.nextCheckAt,
              reason: `Aligned ${featureKey} compact holder nextCheckAt to represented downstream owner-decision frontier ${watchSourceTask.id}.`,
            });
            feature.nextCheckAt = inheritedWatch.nextCheckAt;
          }
          if (
            inheritedWatch.fallbackAt &&
            feature.fallbackAt !== inheritedWatch.fallbackAt
          ) {
            stateRepairs.push({
              featureKey,
              field: "fallbackAt",
              before: feature.fallbackAt ?? null,
              after: inheritedWatch.fallbackAt,
              reason: `Aligned ${featureKey} compact holder fallbackAt to represented downstream owner-decision frontier ${watchSourceTask.id}.`,
            });
            feature.fallbackAt = inheritedWatch.fallbackAt;
          }
        }
      }
    }

    const referencedTaskId = stringValue(feature.taskId);
    const referencedTask = referencedTaskId
      ? input.tasks[referencedTaskId]
      : undefined;
    const referencedIsLiveBlocked =
      Boolean(referencedTask) && taskStatus(referencedTask) === "blocked";
    const sharedReplacementTaskId = compatibleSharedReplacementTaskId({
      featureKey,
      feature,
      tasks: input.tasks,
      excludeTaskId: referencedTaskId,
    });
    if (
      sharedReplacementTaskId &&
      sharedReplacementTaskId !== referencedTaskId &&
      !referencedIsLiveBlocked &&
      previousFrontierTaskIds.length === 0 &&
      (!liveExactWaitTaskId || feature.taskId !== liveExactWaitTaskId)
    ) {
      stateRepairs.push({
        featureKey,
        field: "taskId",
        before: feature.taskId ?? null,
        after: sharedReplacementTaskId,
        reason: `Retargeted ${featureKey} to sharper shared wait ${sharedReplacementTaskId}.`,
      });
      feature.taskId = sharedReplacementTaskId;
      continue;
    }

    if (!referencedTaskId) continue;
    const staleReferencedTask =
      !referencedTask || taskStatus(referencedTask) === "done";
    if (!staleReferencedTask) continue;
    if (!sharedWaitReplacement(referencedTask)) continue;

    const replacementTaskId =
      previousFrontierTaskIds.length > 0
        ? null
        : compatibleSharedReplacementTaskId({
            featureKey,
            feature,
            tasks: input.tasks,
            excludeTaskId: referencedTaskId,
          });
    if (replacementTaskId === referencedTaskId) continue;
    stateRepairs.push({
      featureKey,
      field: "taskId",
      before: referencedTaskId,
      after: replacementTaskId,
      reason: replacementTaskId
        ? `Retargeted ${featureKey} to live shared wait ${replacementTaskId}.`
        : `Cleared stale replaced shared-wait pointer ${referencedTaskId}.`,
    });
    feature.taskId = replacementTaskId;
  }

  if (stateRepairs.length > 0) {
    const now = new Date().toISOString();
    for (const featureKey of new Set(
      stateRepairs.map((repair) => repair.featureKey),
    )) {
      const feature = input.state.features[featureKey];
      if (feature) feature.updatedAt = now;
    }
  }

  return { taskRepairs, stateRepairs };
}
