import type { TaskNode } from "@may-agent/sdk";
import type { FeatureCompactLoopState } from "./feature-compact-loop-store.ts";
import { compactWaitOwner } from "./feature-compact-wait-owner.ts";

type RuntimeProjectionTaskRepair = {
  taskId: string;
  featureKey: string;
  field:
    | "blocker.waiting_for"
    | "task.owner"
    | "task.projection"
    | "task.replacement";
  before: unknown;
  after: unknown;
  reason?: string;
};

type RuntimeProjectionStateRepair = {
  featureKey: string;
  field: "waitingFor" | "taskId" | "frontierTaskIds";
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

function lowerText(...values: unknown[]): string {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactWaitFeatureKey(task: TaskNode | undefined): string {
  const context = taskContext(task);
  return stringValue(context.featureKey);
}

function exactWaitTarget(task: TaskNode | undefined): string {
  const context = taskContext(task);
  return stringValue(context.target) || "staging";
}

function exactWaitErrorClass(task: TaskNode | undefined): string {
  const context = taskContext(task);
  return stringValue(context.errorClass) || "compact-error";
}

function blockerCondition(task: TaskNode | undefined): string {
  const blocker = recordValue(task?.blocker);
  return stringValue(blocker?.condition);
}

function blockerWaitingFor(task: TaskNode | undefined): Record<string, unknown> | null {
  const blocker = recordValue(task?.blocker);
  return recordValue(blocker?.waiting_for);
}

function taskOwner(task: TaskNode | undefined): string {
  return stringValue(task?.owner);
}

function taskBlocker(task: TaskNode | undefined): Record<string, unknown> | null {
  return recordValue(task?.blocker);
}

function featureWaitingForType(
  feature: FeatureCompactLoopState["features"][string],
): string {
  const waitingFor = recordValue(feature.waitingFor);
  if (waitingFor) return stringValue(waitingFor.type);
  const text = lowerText(
    feature.blockedReason,
    feature.resumeCondition,
    feature.waitingCondition,
    feature.ownerReason,
    feature.summary,
    feature.lastSummary,
  );
  return compactWaitingForProjection({
    featureKey: feature.featureKey,
    target: "staging",
    errorClass: feature.errorClass ?? "compact-error",
    reason: text,
  }).type as string;
}

function isExactBlockedWaitTask(task: TaskNode | undefined): task is TaskNode {
  if (!task) return false;
  if (taskStatus(task) !== "blocked") return false;
  return taskContext(task).featureCompactExactWait === true;
}

function isGenericFeaturePackageWaitTask(task: TaskNode | undefined): boolean {
  const goal = stringValue(task?.goal);
  return /^Hold compact feature .+ on exact .+ wait until the named condition changes\.?$/i.test(
    goal,
  );
}

function sharedWaitReplacement(task: TaskNode | undefined): boolean {
  if (!task || taskStatus(task) !== "done") return false;
  const resolution = stringValue((task as TaskNode & { resolution?: unknown }).resolution);
  if (resolution !== "replaced") return false;
  const text = lowerText(
    taskContext(task).acceptance_note,
    taskTrace(task).review_summary,
    taskTrace(task).last_worker_summary,
    (task as TaskNode & { result?: unknown }).result,
  );
  return text.includes("shared") && text.includes("wait");
}

export function compactWaitingForProjection(input: {
  featureKey: string;
  target: string;
  errorClass: string;
  reason: string;
}): Record<string, unknown> {
  const text = input.reason.toLowerCase();
  const base = {
    featureKey: input.featureKey,
    target: input.target,
    errorClass: input.errorClass,
    scope: "feature-compact",
  };

  if (
    /(kubeconfig|underlay|runtime[-_\s]?input|aks_rp_e2e_underlay_kubeconfig)/i.test(
      text,
    )
  ) {
    return { ...base, type: "environment.prerequisite.ready" };
  }

  if (
    /(pipeline|artifact|reviewable artifacts|terminal azure devops pipeline|terminal github wait|workflow run|run \d+)/i.test(
      text,
    )
  ) {
    return { ...base, type: "pipeline.result.or.artifact.available" };
  }

  if (
    /(managed-cluster|managed cluster|headroom|quota|capacity preflight|create-slot|capacity frontier|westus2)/i.test(
      text,
    )
  ) {
    return {
      ...base,
      type: "azure.capacity.available",
      resource: "managedClusters",
    };
  }

  if (
    /(owner|product|source|reclassif|promotion|authoritative|authority|rehome)/i.test(
      text,
    )
  ) {
    return { ...base, type: "owner.decision" };
  }

  if (/(\bauth\b|authentication|credential|publish)/i.test(text)) {
    return { ...base, type: "publish.auth.ready" };
  }

  return { ...base, type: "compact.frontier.changed" };
}

function boundedServerlessUnderlayProjection(task: TaskNode | undefined): boolean {
  return (
    exactWaitFeatureKey(task) === "serverless-schedulerctrl" &&
    /underlay|kubeconfig|runtime[-_\s]?input/i.test(blockerCondition(task))
  );
}

function sharedWaitText(task: TaskNode | undefined): string {
  return lowerText(
    task?.goal,
    blockerCondition(task),
    JSON.stringify(task?.conflict_scope ?? []),
    JSON.stringify(taskContext(task)),
    taskContext(task).acceptance_note,
    taskTrace(task).review_summary,
    (task as TaskNode & { result?: unknown } | undefined)?.result,
  );
}

function taskConflictScopes(task: TaskNode | undefined): string[] {
  return Array.isArray(task?.conflict_scope)
    ? task.conflict_scope.filter(
        (scope): scope is string => typeof scope === "string",
      )
    : [];
}

function sameSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function crossLoopExactFrontierTaskIds(input: {
  featureKey: string;
  tasks: Record<string, TaskNode>;
}): string[] {
  const featureScope = `feature:${input.featureKey}`;
  const featureCompactScope = `feature-compact:${input.featureKey}`;
  const specPrefix = `spec:spec.${input.featureKey}.`;
  const matches = Object.values(input.tasks)
    .filter((task) => taskStatus(task) === "blocked")
    .filter((task) => task.parent_id !== "aks-feature-compact-loop")
    .filter((task) => {
      const scopes = taskConflictScopes(task);
      if (
        scopes.includes(featureScope) ||
        scopes.includes(featureCompactScope) ||
        scopes.some((scope) => scope.startsWith(specPrefix))
      ) {
        return true;
      }
      const text = lowerText(
        task?.goal,
        blockerCondition(task),
        JSON.stringify(task?.conflict_scope ?? []),
        JSON.stringify(taskContext(task)),
      );
      return text.includes(input.featureKey.toLowerCase());
    })
    .map((task) => task.id);
  return uniqueSorted(matches);
}

function exactWaitText(task: TaskNode | undefined): string {
  return lowerText(
    task?.goal,
    blockerCondition(task),
    taskContext(task).featureKey,
    taskContext(task).errorClass,
    JSON.stringify(task?.conflict_scope ?? []),
  );
}

function genericProjectionPlaceholder(type: string): boolean {
  return (
    type === "environment.available" ||
    type === "evidence.available" ||
    type === "publish.auth.ready"
  );
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
  const text = exactWaitText(input.exactTask);
  if (!text) return genericProjectionPlaceholder(exactType);
  if (
    text.includes("promotion") ||
    text.includes("execute-ready") ||
    text.includes("owner wait") ||
    text.includes("underlay") ||
    text.includes("kubeconfig") ||
    text.includes("runtime-input")
  ) {
    return true;
  }
  return genericProjectionPlaceholder(exactType);
}

function featureStillNeedsSharperProjection(input: {
  featureKey: string;
  feature: FeatureCompactLoopState["features"][string];
  exactTask: TaskNode;
}): boolean {
  const desiredType = featureWaitingForType(input.feature);
  const exactType = stringValue(blockerWaitingFor(input.exactTask)?.type);
  if (
    desiredType === exactType &&
    exactType === "compact.frontier.changed"
  ) {
    return false;
  }
  const text = exactWaitText(input.exactTask);
  if (!text) return false;
  if (text.includes("same-spec") || text.includes("run review") || text.includes("queued run") || text.includes("review-ready")) {
    return true;
  }
  if (
    text.includes("trusted-ca") ||
    text.includes("owner-decision") ||
    text.includes("shared fixture") ||
    text.includes("mixed-frontier") ||
    text.includes("split frontier") ||
    text.includes("split-frontier") ||
    text.includes("compact-facing")
  ) {
    return true;
  }
  if (text.includes("reviewed-exception") || text.includes("live-ready filter") || text.includes("runtime-input quarantine")) {
    return true;
  }
  return false;
}

function projectedCrossLoopCompactTaskId(input: {
  featureKey: string;
  tasks: Record<string, TaskNode>;
}): string | null {
  const featureCompactScope = `feature-compact:${input.featureKey}`;
  const candidates = Object.values(input.tasks)
    .filter((task) => taskStatus(task) === "blocked")
    .filter((task) => task.parent_id !== "aks-feature-compact-loop")
    .filter((task) => {
      const scopes = taskConflictScopes(task);
      if (scopes.includes(featureCompactScope)) return true;
      const text = lowerText(
        task?.goal,
        blockerCondition(task),
        JSON.stringify(task?.conflict_scope ?? []),
        JSON.stringify(taskContext(task)),
      );
      return (
        text.includes(input.featureKey.toLowerCase()) &&
        (text.includes("compact-facing") ||
          text.includes("compact feature") ||
          text.includes("feature compact"))
      );
    })
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
  const desiredType = stringValue(waitingFor?.type) || featureWaitingForType(input.feature);
  const desiredResource = stringValue(waitingFor?.resource);
  const genericDesiredType = desiredType === "compact.frontier.changed";
  const candidates = Object.values(input.tasks)
    .filter((task) => task.id !== input.excludeTaskId)
    .filter((task) => taskStatus(task) === "blocked")
    .map((task) => ({ task, text: sharedWaitText(task) }))
    .filter(({ text }) => text.includes(input.featureKey.toLowerCase()))
    .filter(({ text }) => text.includes("shared") && text.includes("wait"))
    .filter(({ task, text }) => {
      const candidateWaitingFor = blockerWaitingFor(task);
      const candidateType = stringValue(candidateWaitingFor?.type);
      const candidateResource = stringValue(candidateWaitingFor?.resource);
      const reviewedExceptionFamily =
        text.includes("reviewed-exception") &&
        text.includes("live-ready");
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
    .sort((left, right) => left.task.id.localeCompare(right.task.id));
  return candidates[0]?.task.id ?? null;
}

export function reconcileFeatureCompactRuntimeProjection(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: FeatureCompactLoopState;
}): FeatureCompactRuntimeProjectionRepair {
  const taskRepairs: RuntimeProjectionTaskRepair[] = [];
  const stateRepairs: RuntimeProjectionStateRepair[] = [];
  if (!input.loopTask) return { taskRepairs, stateRepairs };

  const liveExactWaitTaskIds = new Map<string, string>();
  const fallbackGenericExactWaitTaskIds = new Map<string, string>();
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isExactBlockedWaitTask(child)) continue;
    const featureKey = exactWaitFeatureKey(child);
    if (featureKey) {
      if (isGenericFeaturePackageWaitTask(child)) {
        if (!fallbackGenericExactWaitTaskIds.has(featureKey)) {
          fallbackGenericExactWaitTaskIds.set(featureKey, child.id);
        }
      } else if (!liveExactWaitTaskIds.has(featureKey)) {
        liveExactWaitTaskIds.set(featureKey, child.id);
      }
    }

    const blocker = taskBlocker(child);
    if (blocker) {
      const desiredOwner = compactWaitOwner(blockerCondition(child));
      const existingOwner = taskOwner(child);
      if (!existingOwner && desiredOwner) {
        child.owner = desiredOwner;
        taskRepairs.push({
          taskId: child.id,
          featureKey,
          field: "task.owner",
          before: existingOwner,
          after: desiredOwner,
          reason: `Backfilled blank surviving exact compact wait owner on ${child.id}.`,
        });
      }

      const desiredWaitingFor = compactWaitingForProjection({
        featureKey,
        target: exactWaitTarget(child),
        errorClass: exactWaitErrorClass(child),
        reason: blockerCondition(child),
      });
      const existingWaitingFor = blockerWaitingFor(child);
      if (
        boundedServerlessUnderlayProjection(child) &&
        !jsonEqual(existingWaitingFor, desiredWaitingFor)
      ) {
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

    const crossLoopTaskIds = crossLoopExactFrontierTaskIds({
      featureKey,
      tasks: input.tasks,
    });
    if (crossLoopTaskIds.length > 0) {
      const previousFrontierTaskIds = uniqueSorted(
        Array.isArray(feature.frontierTaskIds)
          ? feature.frontierTaskIds.filter(
              (taskId): taskId is string => typeof taskId === "string",
            )
          : [],
      );
      if (!sameSet(previousFrontierTaskIds, crossLoopTaskIds)) {
        stateRepairs.push({
          featureKey,
          field: "frontierTaskIds",
          before: previousFrontierTaskIds,
          after: crossLoopTaskIds,
          reason: `Reprojected ${featureKey} to exact cross-loop frontier holders ${crossLoopTaskIds.join(", ")}.`,
        });
        feature.frontierTaskIds = crossLoopTaskIds;
      }
    }

    const liveExactWaitTaskId =
      liveExactWaitTaskIds.get(featureKey) ??
      fallbackGenericExactWaitTaskIds.get(featureKey) ??
      projectedCrossLoopCompactTaskId({ featureKey, tasks: input.tasks }) ??
      null;
    if (featureKey === "serverless-schedulerctrl" && liveExactWaitTaskId) {
      const liveTask = input.tasks[liveExactWaitTaskId];
      if (boundedServerlessUnderlayProjection(liveTask)) {
        const desiredWaitingFor = compactWaitingForProjection({
          featureKey,
          target: exactWaitTarget(liveTask),
          errorClass: exactWaitErrorClass(liveTask),
          reason: blockerCondition(liveTask),
        });
        if (!jsonEqual(feature.waitingFor ?? null, desiredWaitingFor)) {
          stateRepairs.push({
            featureKey,
            field: "waitingFor",
            before: feature.waitingFor ?? null,
            after: desiredWaitingFor,
            reason: `Reprojected ${featureKey} waitingFor from live exact wait ${liveExactWaitTaskId}.`,
          });
          feature.waitingFor = desiredWaitingFor;
        }
      }
    }

    if (liveExactWaitTaskId) {
      const liveTask = input.tasks[liveExactWaitTaskId];
      if (
        liveTask &&
        feature.taskId !== liveExactWaitTaskId &&
        featureStillNeedsSharperProjection({ featureKey, feature, exactTask: liveTask })
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
        if (blocker && isExactBlockedWaitTask(liveTask)) {
          const desiredWaitingFor = compactWaitingForProjection({
            featureKey,
            target: exactWaitTarget(liveTask),
            errorClass: exactWaitErrorClass(liveTask),
            reason: blockerCondition(liveTask),
          });
          const existingWaitingFor = blockerWaitingFor(liveTask);
          if (!jsonEqual(existingWaitingFor, desiredWaitingFor)) {
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
        const desiredWaitingFor = compactWaitingForProjection({
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
    }

    const referencedTaskId = stringValue(feature.taskId);
    const referencedTask = referencedTaskId ? input.tasks[referencedTaskId] : undefined;
    const sharedReplacementTaskId = compatibleSharedReplacementTaskId({
      featureKey,
      feature,
      tasks: input.tasks,
      excludeTaskId: referencedTaskId,
    });
    if (
      sharedReplacementTaskId &&
      sharedReplacementTaskId !== referencedTaskId &&
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

    const replacementTaskId = compatibleSharedReplacementTaskId({
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

  return { taskRepairs, stateRepairs };
}
