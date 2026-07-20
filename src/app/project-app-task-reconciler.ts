import { createHash, randomUUID } from "node:crypto";
import {
  ensureTaskTreeState,
  isLeaf,
  normalizeStringArray,
  projectRuntimePaths,
  readTaskTree,
  saveTaskTree,
  taskState,
  withTreeLock,
  type ProjectAppTaskIntent,
  type ProjectAppTaskAction,
  type ProjectAppCondition,
  type ProjectAppConditionSpec,
  type ProjectAppTaskAttempt,
  type ProjectAppTaskResource,
  type TaskNode,
  type TaskTree,
  type TaskTreeConfig,
} from "@may-agent/sdk";

export const PROJECT_APP_TASK_RECOVERY_OWNER = "project-app-task-reconciler";
import { isTypedProjectAppConditionSubject } from "./project-app-condition-tracker.js";

export type ProjectAppTaskClaim = {
  kind: "claimed";
  taskId: string;
  generation: number;
  resourceVersion: number;
  specHash: string;
  attemptId: string;
  owner: string;
  handler: string;
  mode: "achieve" | "maintain";
};

export type ProjectAppTaskClaimResult =
  | ProjectAppTaskClaim
  | { kind: "busy"; taskId: string; attemptId: string | null }
  | {
      kind: "waiting";
      taskId: string;
      conditionIds: string[];
      dependencyIds?: string[];
    }
  | { kind: "attention"; taskId: string; generation: number; summary: string }
  | { kind: "completed"; taskId: string; generation: number };

export type ProjectAppTaskObservationResult =
  | { kind: "observed"; taskId: string; generation: number; changed: boolean }
  | { kind: "completed"; taskId: string; generation: number };

export type ProjectAppTaskAttemptRecovery = {
  taskId: string;
  intent: ProjectAppTaskIntent;
  trigger?: Record<string, unknown>;
};

export type ProjectAppTaskRecoveryAttention = {
  taskId: string;
  summary: string;
};

export type ProjectAppTaskRecoveryRepair = {
  taskId: string;
  disposition: "requeued" | "retired";
  summary: string;
};

const reconcilerRuntimeId = randomUUID();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function triggerOverridesWait(trigger: Record<string, unknown> | undefined): boolean {
  if (!trigger) return false;
  const data = isRecord(trigger.data) ? trigger.data : {};
  return trigger.overrideWait === true || data.overrideWait === true;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

export function projectAppTaskSpecHash(intent: ProjectAppTaskIntent): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        stableValue({
          outcome: intent.outcome,
          acceptance: intent.acceptance,
          mode: intent.mode,
          owner: intent.owner ?? null,
          workflow: intent.workflow ?? null,
          input: intent.input ?? {},
          outputs: intent.outputs ?? [],
          dependsOn: intent.dependsOn ?? [],
          parentId: intent.parentId,
        }),
      ),
    )
    .digest("hex");
}

function resourceSpec(intent: ProjectAppTaskIntent): ProjectAppTaskResource["spec"] {
  return {
    parentId: intent.parentId,
    outcome: intent.outcome,
    acceptance: [...intent.acceptance],
    mode: intent.mode,
    ...(intent.owner?.trim() ? { owner: intent.owner.trim() } : {}),
    ...(intent.workflow?.trim() ? { workflow: intent.workflow.trim() } : {}),
    ...(intent.input ? { input: stableValue(intent.input) as Record<string, unknown> } : {}),
    ...(intent.outputs ? { outputs: [...intent.outputs] } : {}),
    ...(intent.dependsOn ? { dependsOn: [...intent.dependsOn] } : {}),
    ...(intent.priority ? { priority: intent.priority } : {}),
  };
}

function resourceIntent(resource: ProjectAppTaskResource): ProjectAppTaskIntent {
  return {
    id: resource.metadata.id,
    parentId: resource.spec.parentId,
    outcome: resource.spec.outcome,
    acceptance: [...resource.spec.acceptance],
    mode: resource.spec.mode,
    ...(resource.spec.owner ? { owner: resource.spec.owner } : {}),
    ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
    ...(resource.spec.input ? { input: { ...resource.spec.input } } : {}),
    ...(resource.spec.outputs ? { outputs: [...resource.spec.outputs] } : {}),
    ...(resource.spec.dependsOn ? { dependsOn: [...resource.spec.dependsOn] } : {}),
    ...(resource.spec.priority ? { priority: resource.spec.priority } : {}),
  };
}

function currentResourceAttempt(
  tree: TaskTree,
  resource: ProjectAppTaskResource,
): ProjectAppTaskAttempt | null {
  const attemptId = resource.status.currentAttemptId;
  if (!attemptId) return null;
  const attempt = tree.attempts?.[attemptId];
  return attempt?.state === "running" ? attempt : null;
}

function touchResource(
  resource: ProjectAppTaskResource,
  status: Partial<ProjectAppTaskResource["status"]>,
): void {
  resource.metadata.resourceVersion += 1;
  resource.status = {
    ...resource.status,
    ...status,
    updatedAt: new Date().toISOString(),
  };
}

function finishAttempt(
  tree: TaskTree,
  resource: ProjectAppTaskResource,
  state: "completed" | "failed" | "interrupted",
  summary: string,
  now: string,
): void {
  const attemptId = resource.status.currentAttemptId;
  const attempt = attemptId ? tree.attempts?.[attemptId] : undefined;
  if (attempt) {
    attempt.metadata.resourceVersion += 1;
    attempt.state = state;
    attempt.finishedAt = now;
    attempt.summary = summary;
  }
  resource.status.currentAttemptId = undefined;
}

function pruneTaskAttempts(tree: TaskTree, limit = 1_000): void {
  const entries = Object.entries(tree.attempts ?? {});
  if (entries.length <= limit) return;
  entries
    .filter(([, attempt]) => attempt.state !== "running")
    .sort(([, left], [, right]) => String(left.finishedAt ?? left.startedAt).localeCompare(String(right.finishedAt ?? right.startedAt)))
    .slice(0, Math.max(0, entries.length - limit))
    .forEach(([attemptId]) => delete tree.attempts?.[attemptId]);
}

export function taskReconciliationConfig(input: {
  appDir: string;
  projectDir: string;
  owner: string;
  maxConcurrent: number;
}): TaskTreeConfig {
  const paths = projectRuntimePaths(input.appDir);
  return {
    appDir: input.appDir,
    projectDir: input.projectDir,
    treePath: ensureTaskTreeState(input.appDir).path,
    journalPath: paths.journalPath,
    worker: input.owner,
    maxConcurrent: input.maxConcurrent,
  };
}

function activeTaskIds(tree: TaskTree): string[] {
  return Object.values(tree.resources ?? {})
    .filter((resource) => resource.status.phase === "running")
    .map((resource) => resource.metadata.id)
    .sort();
}

function refreshActiveTaskProjection(tree: TaskTree): void {
  tree.active_task_ids = activeTaskIds(tree);
  tree.active_task_id = tree.active_task_ids[0] ?? null;
}

function resolvedOwner(tree: TaskTree, intent: ProjectAppTaskIntent, appOwner: string): string {
  if (intent.owner?.trim()) return intent.owner.trim();
  let parentId: string | null | undefined = intent.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent: TaskNode | undefined = tree.tasks[parentId];
    if (!parent) break;
    if (parent.owner?.trim()) return parent.owner.trim();
    parentId = parent.parent_id;
  }
  return appOwner;
}

function isProjectAppCondition(value: unknown): value is ProjectAppCondition {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.spec) || !isRecord(value.status)) {
    return false;
  }
  return (
    typeof value.metadata.id === "string" &&
    Number.isInteger(value.metadata.generation) &&
    Number.isInteger(value.metadata.resourceVersion) &&
    typeof value.spec.type === "string" &&
    typeof value.spec.subject === "string" &&
    ["unknown", "false", "true"].includes(String(value.status.state))
  );
}

function isOpenCondition(value: Record<string, unknown>): boolean {
  return isProjectAppCondition(value) && value.status.state !== "true";
}

function conditionRegistry(tree: TaskTree): Record<string, ProjectAppCondition> {
  tree.conditions = tree.conditions ?? {};
  return tree.conditions;
}

function taskConditionIds(tree: TaskTree, taskId: string): string[] {
  return [...(tree.resources?.[taskId]?.status.conditionIds ?? [])];
}

function taskConditionEntries(tree: TaskTree, taskId: string): Array<[string, Record<string, unknown>]> {
  const linked = new Set(taskConditionIds(tree, taskId));
  const entries: Array<[string, Record<string, unknown>]> = [];
  for (const [id, value] of Object.entries(tree.conditions ?? {})) {
    const raw = value as unknown;
    if (!isRecord(raw)) continue;
    if (linked.has(id)) entries.push([id, raw]);
  }
  return entries;
}

function openTaskConditionIds(tree: TaskTree, task: TaskNode): string[] {
  const ids = taskConditionEntries(tree, task.id)
    .filter(([, condition]) => isOpenCondition(condition))
    .map(([id]) => id);
  return [...new Set(ids)];
}

function hasSatisfiedTaskCondition(tree: TaskTree, taskId: string): boolean {
  return taskConditionEntries(tree, taskId).some(([, condition]) =>
    isProjectAppCondition(condition) && condition.status.state === "true",
  );
}

function pruneUnlinkedConditions(tree: TaskTree): void {
  const linked = new Set<string>();
  for (const resource of Object.values(tree.resources ?? {})) {
    for (const id of resource.status.conditionIds ?? []) linked.add(id);
  }
  for (const [id, value] of Object.entries(tree.conditions ?? {})) {
    if (isProjectAppCondition(value) && !linked.has(id)) delete tree.conditions![id];
  }
}

function unlinkTaskConditions(tree: TaskTree, task: TaskNode): void {
  const resource = tree.resources?.[task.id];
  if (resource?.status.conditionIds?.length) touchResource(resource, { conditionIds: [] });
  pruneUnlinkedConditions(tree);
}

function materializeWaitingConditions(
  tree: TaskTree,
  task: TaskNode,
  conditions: ProjectAppConditionSpec[],
  now: string,
): void {
  const registry = conditionRegistry(tree);
  const ids: string[] = [];
  const previousIds = new Set(taskConditionIds(tree, task.id));
  for (const raw of conditions) {
    const id = raw.id.trim();
    ids.push(id);
    const spec = {
      type: raw.type.trim(),
      subject: raw.subject.trim(),
      expected: raw.expected,
      ...(raw.owner?.trim() ? { owner: raw.owner.trim() } : {}),
    };
    const current = registry[id];
    const sameSpec = current && JSON.stringify(stableValue(current.spec)) === JSON.stringify(stableValue(spec));
    registry[id] = sameSpec
      ? previousIds.has(id) && current.status.state !== "true"
        ? {
            ...current,
            metadata: {
              ...current.metadata,
              resourceVersion: current.metadata.resourceVersion + 1,
            },
            status: { ...current.status, observedAt: now },
          }
        : current
      : {
          metadata: {
            id,
            generation: (current?.metadata.generation ?? 0) + 1,
            resourceVersion: (current?.metadata.resourceVersion ?? 0) + 1,
          },
          spec,
          status: {
            observedGeneration: 0,
            state: "unknown",
            observedAt: now,
          },
        };
  }
  const resource = tree.resources?.[task.id];
  if (resource) touchResource(resource, { conditionIds: ids });
  pruneUnlinkedConditions(tree);
}

function syncTaskProjection(
  task: TaskNode,
  resource: ProjectAppTaskResource,
  owner: string,
): void {
  const intent = resourceIntent(resource);
  task.revision = resource.metadata.generation;
  task.parent_id = intent.parentId;
  task.goal = intent.outcome;
  task.acceptance = [...intent.acceptance];
  task.outputs = [...(intent.outputs ?? [])];
  task.depends_on = [...(intent.dependsOn ?? [])];
  task.priority = intent.priority ?? task.priority ?? "P2";
  task.owner = owner;
  task.workflow = intent.workflow;
  task.reconcile_mode = intent.mode;
  task.summary = resource.status.summary;
  task.state =
    resource.status.phase === "running"
      ? "active"
      : resource.status.phase === "waiting"
        ? "blocked"
        : resource.status.phase === "attention"
          ? "review"
          : "backlog";
}

export function recoverableProjectAppTaskAttempts(config: TaskTreeConfig): ProjectAppTaskAttemptRecovery[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const recoveries = Object.values(tree.resources ?? {}).flatMap((resource) => {
      if (resource.status.phase !== "running") return [];
      const attempt = currentResourceAttempt(tree, resource);
      if (!attempt || attempt.runtimeId === reconcilerRuntimeId) return [];
      return [{
        taskId: resource.metadata.id,
        intent: resourceIntent(resource),
        ...(attempt.trigger ? { trigger: attempt.trigger } : {}),
      }];
    });
    return recoveries;
  });
}

export function releaseInterruptedProjectAppTaskAttempt(
  config: TaskTreeConfig,
  taskId: string,
  summary: string,
): boolean {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[taskId];
    if (!task) return false;
    const resource = tree.resources?.[taskId];
    if (!resource || resource.status.phase !== "running") return false;
    const attempt = currentResourceAttempt(tree, resource);
    if (!attempt || attempt.runtimeId === reconcilerRuntimeId) return false;
    const now = new Date().toISOString();
    const recoveredSummary = `${summary}; retrying from current task evidence`;
    finishAttempt(tree, resource, "interrupted", recoveredSummary, now);
    attempt.metadata.resourceVersion += 1;
    attempt.failureReason = "previous-runtime-attempt-requeued";
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary: recoveredSummary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    pruneTaskAttempts(tree);
    saveTaskTree(config, tree);
    return true;
  });
}

export function repairPreviousRuntimeRecoveryAttention(config: TaskTreeConfig): ProjectAppTaskRecoveryRepair[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const repairs: ProjectAppTaskRecoveryRepair[] = [];
    for (const resource of Object.values(tree.resources ?? {})) {
      if (resource.status.phase !== "attention") continue;
      const task = tree.tasks[resource.metadata.id];
      if (!task) continue;
      const attempt = Object.values(tree.attempts ?? {})
        .filter((candidate) => candidate.taskId === resource.metadata.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
      if (attempt?.failureReason !== "previous-runtime-attempt-not-recoverable") continue;

      const baseSummary =
        resource.status.summary?.trim() ||
        `Interrupted reconciliation ${resource.metadata.id} cannot resume because its previous runtime did not persist the trigger packet`;
      const summary = `${baseSummary}; retrying from current task evidence`;
      attempt.metadata.resourceVersion += 1;
      attempt.failureReason = "previous-runtime-attempt-requeued";
      touchResource(resource, {
        phase: "pending",
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, attempt.owner);
      repairs.push({
        taskId: resource.metadata.id,
        disposition: "requeued",
        summary,
      });
    }
    if (repairs.length > 0) {
      refreshActiveTaskProjection(tree);
      pruneTaskAttempts(tree);
      saveTaskTree(config, tree);
    }
    return repairs;
  });
}

export function pendingProjectAppTaskRecoveryAttention(config: TaskTreeConfig): ProjectAppTaskRecoveryAttention[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return Object.values(tree.resources ?? {}).flatMap((resource) => {
      const attempts = Object.values(tree.attempts ?? {})
        .filter((attempt) => attempt.taskId === resource.metadata.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      const attempt = attempts[0];
      if (
        resource.status.phase !== "attention" ||
        attempt?.failureReason !== "previous-runtime-attempt-not-recoverable" ||
        attempt.attentionNotifiedAt
      ) {
        return [];
      }
      return [
        {
          taskId: resource.metadata.id,
          summary:
            resource.status.summary?.trim() ||
            `Interrupted reconciliation ${resource.metadata.id} requires owner attention`,
        },
      ];
    });
  });
}

export function acknowledgeProjectAppTaskRecoveryAttention(config: TaskTreeConfig, taskId: string): boolean {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const attempt = Object.values(tree.attempts ?? {})
      .filter((candidate) => candidate.taskId === taskId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (
      !attempt ||
      attempt.failureReason !== "previous-runtime-attempt-not-recoverable" ||
      attempt.attentionNotifiedAt
    ) return false;
    attempt.metadata.resourceVersion += 1;
    attempt.attentionNotifiedAt = new Date().toISOString();
    saveTaskTree(config, tree);
    return true;
  });
}

function validateIntent(intent: ProjectAppTaskIntent): void {
  if (!intent.id.trim()) throw new Error("Task reconciliation requires a non-empty task id");
  if (!intent.parentId.trim()) throw new Error(`Task ${intent.id} requires a parentId`);
  if (!intent.outcome.trim()) throw new Error(`Task ${intent.id} requires an outcome`);
  if (intent.acceptance.length === 0) throw new Error(`Task ${intent.id} requires acceptance criteria`);
  if (intent.workflow !== undefined) {
    const workflow = intent.workflow.trim();
    if (!workflow) throw new Error(`Task ${intent.id} workflow must be a non-empty string when present`);
    if (workflow === "project") {
      throw new Error(
        `Task ${intent.id} workflow must name a real workflow; omit workflow for owner-handled project work`,
      );
    }
  }
}

function upsertTask(
  tree: TaskTree,
  resource: ProjectAppTaskResource,
  owner: string,
): TaskNode {
  const intent = resourceIntent(resource);
  const parent = tree.tasks[intent.parentId];
  if (!parent) {
    // If the task already exists (parent was pruned after task creation), return it as-is
    const existing = tree.tasks[intent.id];
    if (existing) return existing;
    // Parent was pruned/removed — create an orphan node rather than throwing,
    // which would cause infinite handler retries (handler.failed-count alert).
    console.warn(`[project-app-task-reconciler] Task ${intent.id} parent does not exist: ${intent.parentId}; creating as orphan under root`);
    const rootId = Object.values(tree.tasks).find(t => t.parent_id === null)?.id;
    const fallbackParent = rootId ? tree.tasks[rootId] : undefined;
    if (!fallbackParent) {
      throw new Error(`Task ${intent.id} parent does not exist: ${intent.parentId}`);
    }
    const task: TaskNode = {
      id: intent.id,
      parent_id: fallbackParent.id,
      children: [],
      state: "backlog",
    };
    syncTaskProjection(task, resource, owner);
    if (task.context) delete task.context.reconciliation;
    tree.tasks[intent.id] = task;
    fallbackParent.children = [
      ...new Set([...(fallbackParent.children ?? []), intent.id]),
    ];
    return task;
  }

  const task = tree.tasks[intent.id] ?? {
    id: intent.id,
    parent_id: intent.parentId,
    children: [],
    state: "backlog",
  };
  syncTaskProjection(task, resource, owner);
  if (task.context) delete task.context.reconciliation;
  task.trace = {
    ...(task.trace ?? {}),
    reconciliation: undefined,
    current_attempt_id: undefined,
    current_task_revision: undefined,
    assigned_at: undefined,
    assigned_by: undefined,
    assigned_worker: undefined,
    worker_started_attempt_id: undefined,
    worker_started_at: undefined,
  };
  tree.tasks[intent.id] = task;
  parent.children = [...new Set([...(parent.children ?? []), intent.id])];
  return task;
}

export function claimProjectAppTask(
  config: TaskTreeConfig,
  input: {
    intent: ProjectAppTaskIntent;
    appOwner: string;
    handler: string;
    reason?: string;
    trigger?: Record<string, unknown>;
  },
): ProjectAppTaskClaimResult {
  const observation = observeProjectAppTaskIntent(config, {
    intent: input.intent,
    appOwner: input.appOwner,
    trigger: input.trigger,
  });
  if (observation.kind === "completed") return observation;
  return claimObservedProjectAppTask(config, {
    taskId: observation.taskId,
    appOwner: input.appOwner,
    handler: input.handler,
    reason: input.reason,
  });
}

export function observeProjectAppTaskIntent(
  config: TaskTreeConfig,
  input: {
    intent: ProjectAppTaskIntent;
    appOwner: string;
    trigger?: Record<string, unknown>;
  },
): ProjectAppTaskObservationResult {
  validateIntent(input.intent);
  const specHash = projectAppTaskSpecHash(input.intent);
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const receipt = tree.receipts?.[input.intent.id];
    if (receipt && receipt.specHash === specHash && input.intent.mode === "achieve") {
      return {
        kind: "completed",
        taskId: input.intent.id,
        generation: receipt.metadata.generation,
      };
    }

    const existingResource = tree.resources?.[input.intent.id];
    const previousGeneration = existingResource
      ? existingResource.metadata.generation
      : receipt && Number.isInteger(receipt.metadata.generation)
        ? receipt.metadata.generation
        : 0;
    const sameSpec = existingResource
      ? projectAppTaskSpecHash(resourceIntent(existingResource)) === specHash
      : false;
    const generation = sameSpec
      ? previousGeneration
      : Math.max(1, previousGeneration + 1);
    const owner = resolvedOwner(tree, input.intent, input.appOwner);
    const changed = !existingResource || generation !== previousGeneration;
    const now = new Date().toISOString();
    let resource: ProjectAppTaskResource;
    if (existingResource && sameSpec) {
      resource = existingResource;
    } else {
      if (existingResource?.status.currentAttemptId) {
        finishAttempt(
          tree,
          existingResource,
          "interrupted",
          "Task specification changed while the attempt was active",
          now,
        );
      }
      resource = {
        metadata: {
          id: input.intent.id,
          generation,
          resourceVersion: (existingResource?.metadata.resourceVersion ?? 0) + 1,
        },
        spec: resourceSpec(input.intent),
        status: {
          observedGeneration: Math.min(
            existingResource?.status.observedGeneration ?? 0,
            generation - 1,
          ),
          phase: "pending",
          updatedAt: now,
        },
      };
    }
    tree.resources = { ...(tree.resources ?? {}), [input.intent.id]: resource };
    const task = upsertTask(tree, resource, owner);
    const suppressTrigger =
      input.trigger &&
      resource.status.phase === "waiting" &&
      openTaskConditionIds(tree, task).length > 0 &&
      !hasSatisfiedTaskCondition(tree, task.id) &&
      !triggerOverridesWait(input.trigger);
    if (input.trigger && !suppressTrigger) {
      const previousTrigger = tree.taskTriggers?.[task.id];
      tree.taskTriggers = {
        ...(tree.taskTriggers ?? {}),
        [task.id]: {
          taskId: task.id,
          taskGeneration: generation,
          resourceVersion: (previousTrigger?.resourceVersion ?? 0) + 1,
          event: input.trigger,
          observedAt: now,
        },
      };
    }
    syncTaskProjection(task, resource, owner);
    pruneTaskAttempts(tree);
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return { kind: "observed", taskId: task.id, generation, changed };
  });
}

export function readProjectAppTaskIntent(config: TaskTreeConfig, taskId: string): ProjectAppTaskIntent | null {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const resource = tree.resources?.[taskId];
    return resource ? resourceIntent(resource) : null;
  });
}

export function readProjectAppTaskTrigger(config: TaskTreeConfig, taskId: string): Record<string, unknown> | undefined {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const pending = tree.taskTriggers?.[taskId];
    if (pending) return pending.event;
    const resource = tree.resources?.[taskId];
    const attempt = resource ? currentResourceAttempt(tree, resource) : null;
    return attempt?.trigger;
  });
}

export function listProjectAppTaskIntents(config: TaskTreeConfig): ProjectAppTaskIntent[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return Object.values(tree.resources ?? {}).map(resourceIntent);
  });
}

function dependenciesSatisfied(tree: TaskTree, intent: ProjectAppTaskIntent): boolean {
  return [...(intent.dependsOn ?? [])].every((id) => {
    if (tree.receipts?.[id]) return true;
    const dependency = tree.resources?.[id];
    return Boolean(
      dependency?.status.phase === "converged" &&
        dependency.status.observedGeneration === dependency.metadata.generation,
    );
  });
}

function isRunnableOnPassiveResync(tree: TaskTree, resource: ProjectAppTaskResource): boolean {
  const task = tree.tasks[resource.metadata.id];
  if (!task) return false;
  const intent = resourceIntent(resource);
  const pendingTrigger = tree.taskTriggers?.[task.id]?.event;
  if (pendingTrigger) return true;
  if (!dependenciesSatisfied(tree, intent)) return false;
  if (resource.status.phase === "pending") return true;
  if (resource.status.phase === "waiting") return hasSatisfiedTaskCondition(tree, task.id);
  if (resource.status.phase === "attention") return false;
  if (resource.status.phase === "running") return false;
  return resource.metadata.generation > resource.status.observedGeneration;
}

export function listRunnableProjectAppTaskIds(config: TaskTreeConfig): string[] {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const runnable = new Set(
      Object.values(tree.resources ?? {})
        .filter((resource) => isRunnableOnPassiveResync(tree, resource))
        .map((resource) => resource.metadata.id),
    );
    const ordered: string[] = [];
    const visited = new Set<string>();
    const visit = (taskId: string): void => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      if (runnable.has(taskId)) ordered.push(taskId);
      for (const childId of tree.tasks[taskId]?.children ?? []) visit(childId);
    };
    const rootId = typeof tree.root_task_id === "string" ? tree.root_task_id : "";
    if (rootId && tree.tasks[rootId]) visit(rootId);
    for (const taskId of Object.keys(tree.tasks).sort()) {
      const parentId = tree.tasks[taskId]?.parent_id;
      if (!parentId || !tree.tasks[parentId]) visit(taskId);
    }
    for (const taskId of [...runnable].sort()) {
      if (!visited.has(taskId)) ordered.push(taskId);
    }
    return ordered;
  });
}

export function claimObservedProjectAppTask(
  config: TaskTreeConfig,
  input: {
    taskId: string;
    appOwner: string;
    handler: string;
    reason?: string;
  },
): ProjectAppTaskClaimResult {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) throw new Error(`Observed reconciliation task not found: ${input.taskId}`);
    const resource = tree.resources?.[input.taskId];
    if (!resource) throw new Error(`Observed reconciliation task has no valid resource: ${input.taskId}`);
    const intent = resourceIntent(resource);
    const previousAttempt = currentResourceAttempt(tree, resource);
    const canRecoverPreviousRuntime = Boolean(
      previousAttempt && previousAttempt.runtimeId !== reconcilerRuntimeId,
    );
    const pendingTrigger = tree.taskTriggers?.[task.id];
    const hasTrigger = Boolean(pendingTrigger?.event ?? previousAttempt?.trigger);
    if (canRecoverPreviousRuntime && previousAttempt && !hasTrigger) {
      const now = new Date().toISOString();
      const summary = "Previous runtime attempt had no persisted trigger; retrying from current task evidence";
      finishAttempt(tree, resource, "interrupted", summary, now);
      previousAttempt.metadata.resourceVersion += 1;
      previousAttempt.failureReason = "previous-runtime-attempt-requeued";
      touchResource(resource, {
        phase: "pending",
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, resolvedOwner(tree, intent, input.appOwner));
      refreshActiveTaskProjection(tree);
      pruneTaskAttempts(tree);
    }
    if (resource.status.phase === "running" && previousAttempt && !canRecoverPreviousRuntime) {
      return { kind: "busy", taskId: task.id, attemptId: previousAttempt.metadata.id };
    }
    if (
      resource.status.phase === "attention" &&
      resource.status.observedGeneration >= resource.metadata.generation &&
      !pendingTrigger &&
      input.reason !== "workflow-fallback"
    ) {
      return {
        kind: "attention",
        taskId: task.id,
        generation: resource.metadata.generation,
        summary: resource.status.summary ?? "Task is waiting for owner/reviewer attention",
      };
    }
    const openConditionIds = openTaskConditionIds(tree, task);
    if (
      resource.status.phase === "waiting" &&
      openConditionIds.length > 0 &&
      !pendingTrigger &&
      !hasSatisfiedTaskCondition(tree, task.id)
    ) {
      return { kind: "waiting", taskId: task.id, conditionIds: openConditionIds };
    }
    const dependencyIds = [...(intent.dependsOn ?? [])].filter(
      (id) => {
        if (tree.receipts?.[id]) return false;
        const dependency = tree.resources?.[id];
        return !(
          dependency?.status.phase === "converged" &&
          dependency.status.observedGeneration === dependency.metadata.generation
        );
      },
    );
    if (dependencyIds.length > 0) {
      return { kind: "waiting", taskId: task.id, conditionIds: [], dependencyIds };
    }

    const generation = resource.metadata.generation;
    const owner = resolvedOwner(tree, intent, input.appOwner);
    const handler = input.handler === "owner" ? `owner:${owner}` : input.handler;
    const attemptId = `r_${generation}_${randomUUID()}`;
    const now = new Date().toISOString();
    if (canRecoverPreviousRuntime && previousAttempt) {
      finishAttempt(
        tree,
        resource,
        "interrupted",
        "Previous runtime attempt was superseded during recovery",
        now,
      );
    }
    const trigger = pendingTrigger?.event ?? previousAttempt?.trigger;
    const specHash = projectAppTaskSpecHash(intent);
    const attempt: ProjectAppTaskAttempt = {
      metadata: { id: attemptId, resourceVersion: 1 },
      taskId: task.id,
      taskGeneration: generation,
      specHash,
      owner,
      handler,
      runtimeId: reconcilerRuntimeId,
      state: "running",
      reason: input.reason ?? "event",
      ...(trigger ? { trigger } : {}),
      startedAt: now,
    };
    tree.attempts = { ...(tree.attempts ?? {}), [attemptId]: attempt };
    if (tree.taskTriggers) delete tree.taskTriggers[task.id];
    touchResource(resource, {
      phase: "running",
      observedGeneration: generation - 1,
      currentAttemptId: attemptId,
    });
    syncTaskProjection(task, resource, owner);
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return {
      kind: "claimed",
      taskId: task.id,
      generation,
      resourceVersion: resource.metadata.resourceVersion,
      specHash,
      attemptId,
      owner,
      handler,
      mode: intent.mode,
    };
  });
}

function matchingTask(
  tree: TaskTree,
  claim: ProjectAppTaskClaim,
): { task: TaskNode; resource: ProjectAppTaskResource; attempt: ProjectAppTaskAttempt } | null {
  const task = tree.tasks[claim.taskId];
  if (!task) return null;
  const resource = tree.resources?.[claim.taskId];
  if (!resource || resource.metadata.generation !== claim.generation) return null;
  if (resource.metadata.resourceVersion !== claim.resourceVersion) return null;
  if (resource.status.currentAttemptId !== claim.attemptId) return null;
  const attempt = tree.attempts?.[claim.attemptId];
  if (
    !attempt ||
    attempt.state !== "running" ||
    attempt.taskGeneration !== claim.generation ||
    attempt.handler !== claim.handler ||
    attempt.specHash !== claim.specHash
  ) {
    return null;
  }
  return { task, resource, attempt };
}

export function releaseStaleProjectAppTaskResult(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  summary = "Stale reconciliation result was rejected; retrying from current task evidence",
): { status: "released" | "superseded" | "missing"; taskId: string } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[claim.taskId];
    const resource = tree.resources?.[claim.taskId];
    if (!task || !resource) return { status: "missing", taskId: claim.taskId };
    if (resource.status.currentAttemptId !== claim.attemptId) {
      return { status: "superseded", taskId: claim.taskId };
    }
    const attempt = tree.attempts?.[claim.attemptId];
    if (!attempt || attempt.state !== "running") {
      return { status: "superseded", taskId: claim.taskId };
    }

    const now = new Date().toISOString();
    finishAttempt(tree, resource, "interrupted", summary, now);
    attempt.metadata.resourceVersion += 1;
    attempt.failureReason = "stale-reconciliation-result";
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, claim.owner);
    refreshActiveTaskProjection(tree);
    pruneTaskAttempts(tree);
    saveTaskTree(config, tree);
    return { status: "released", taskId: claim.taskId };
  });
}

function pruneCompletionReceipts(tree: TaskTree, limit = 1_000): void {
  const entries = Object.entries(tree.receipts ?? {});
  if (entries.length <= limit) return;
  entries
    .sort(([, left], [, right]) => left.completedAt.localeCompare(right.completedAt))
    .slice(0, entries.length - limit)
    .forEach(([taskId]) => delete tree.receipts?.[taskId]);
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} requires a non-empty string`);
  return value.trim();
}

function requireValidTaskWorkflow(value: unknown, label: string): string {
  const workflow = requireNonEmptyString(value, label);
  if (workflow === "project") {
    throw new Error(`${label} must name a real workflow; omit workflow for owner-handled project work`);
  }
  return workflow;
}

function requireStringList(value: unknown, label: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((entry) => typeof entry === "string" && entry.trim())
  ) {
    throw new Error(`${label} requires one or more non-empty strings`);
  }
}

function requireExpectedGeneration(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} requires a non-negative expectedGeneration`);
  }
}

function mutableActionResource(
  tree: TaskTree,
  action: Exclude<ProjectAppTaskAction, { kind: "create-task" }>,
): { task: TaskNode; resource: ProjectAppTaskResource } {
  if (action.taskId.startsWith("runtime/")) {
    throw new Error(`Handler actions cannot mutate reconciler-owned task ${action.taskId}`);
  }
  const task = tree.tasks[action.taskId];
  if (!task) throw new Error(`Handler action task not found: ${action.taskId}`);
  const resource = tree.resources?.[action.taskId];
  if (!resource) throw new Error(`Handler action resource not found: ${action.taskId}`);
  if (resource.metadata.generation !== action.expectedGeneration) {
    throw new Error(
      `Handler action for ${action.taskId} is stale: expected generation ${action.expectedGeneration}, current ${resource.metadata.generation}`,
    );
  }
  return { task, resource };
}

function actionTargetAlreadyReceipted(
  tree: TaskTree,
  action: Exclude<ProjectAppTaskAction, { kind: "create-task" }>,
): boolean {
  return Boolean(!tree.tasks[action.taskId] && !tree.resources?.[action.taskId] && tree.receipts?.[action.taskId]);
}

function validateTaskActions(tree: TaskTree, actions: ProjectAppTaskAction[]): void {
  if (actions.length > 16) throw new Error(`Handler result exceeds the 16-action reconciliation budget`);
  const identities = new Set<string>();
  for (const rawAction of actions as unknown[]) {
    if (!isRecord(rawAction)) throw new Error("Handler result contains a non-object action");
    const kind = rawAction.kind;
    if (!["create-task", "update-task", "close-task", "unblock-task"].includes(String(kind))) {
      throw new Error(`Handler result contains an unsupported action kind: ${String(kind)}`);
    }

    const action = rawAction as unknown as ProjectAppTaskAction;
    const identity = requireNonEmptyString(
      action.kind === "create-task" ? action.id : action.taskId,
      `Handler ${action.kind} action identity`,
    );
    if (identities.has(identity)) throw new Error(`Handler result contains multiple actions for ${identity}`);
    identities.add(identity);

    if (action.kind === "create-task") {
      requireNonEmptyString(action.parentId, `Handler create action ${action.id} parentId`);
      requireNonEmptyString(action.goal, `Handler create action ${action.id} goal`);
      if (!["achieve", "maintain"].includes(String(action.mode))) {
        throw new Error(`Handler create action ${action.id} requires mode achieve or maintain`);
      }
      requireStringList(action.outputs, `Handler create action ${action.id} outputs`);
      requireStringList(action.acceptance, `Handler create action ${action.id} acceptance`);
      if (action.priority !== undefined && !["P0", "P1", "P2", "P3"].includes(action.priority)) {
        throw new Error(`Handler create action ${action.id} has an invalid priority`);
      }
      if (action.owner !== undefined) requireNonEmptyString(action.owner, `Handler create action ${action.id} owner`);
      if (action.workflow !== undefined) {
        requireValidTaskWorkflow(action.workflow, `Handler create action ${action.id} workflow`);
      }
      if (action.input !== undefined && !isRecord(action.input)) {
        throw new Error(`Handler create action ${action.id} input must be an object`);
      }
      if (
        action.dependsOn !== undefined &&
        (!Array.isArray(action.dependsOn) ||
          !action.dependsOn.every((entry) => typeof entry === "string" && entry.trim()))
      ) {
        throw new Error(`Handler create action ${action.id} dependsOn must contain non-empty strings`);
      }
      if (action.id.startsWith("runtime/")) {
        throw new Error("Handler actions cannot create reconciler-owned runtime tasks");
      }
      if (tree.tasks[action.id] || tree.resources?.[action.id]) {
        throw new Error(`Handler action task already exists: ${action.id}`);
      }
      if (!tree.tasks[action.parentId]) throw new Error(`Handler action parent not found: ${action.parentId}`);
      continue;
    }

    requireExpectedGeneration(action.expectedGeneration, `Handler ${action.kind} action ${action.taskId}`);
    if (action.kind === "update-task" && action.goal !== undefined) {
      requireNonEmptyString(action.goal, `Handler update for ${action.taskId} goal`);
    }
    if (action.kind === "update-task" && action.mode !== undefined && !["achieve", "maintain"].includes(action.mode)) {
      throw new Error(`Handler update for ${action.taskId} has invalid mode ${String(action.mode)}`);
    }
    if (action.kind === "update-task" && action.outputs !== undefined) {
      requireStringList(action.outputs, `Handler update for ${action.taskId} outputs`);
    }
    if (action.kind === "update-task" && action.acceptance !== undefined) {
      requireStringList(action.acceptance, `Handler update for ${action.taskId} acceptance`);
    }
    if (action.kind === "close-task") {
      requireNonEmptyString(action.summary, `Handler close for ${action.taskId} summary`);
    }
    if (action.kind === "unblock-task") {
      requireNonEmptyString(action.reason, `Handler unblock for ${action.taskId} reason`);
    }
    if (actionTargetAlreadyReceipted(tree, action)) continue;
    const { resource } = mutableActionResource(tree, action);
    if (
      action.kind === "update-task" &&
      action.goal === undefined &&
      action.mode === undefined &&
      action.outputs === undefined &&
      action.acceptance === undefined
    ) {
      throw new Error(`Handler update for ${action.taskId} contains no change`);
    }
    if (action.kind === "unblock-task") {
      if (resource.status.phase !== "waiting") {
        throw new Error(`Handler action task ${action.taskId} is not blocked`);
      }
    }
  }
}

function validateConditions(
  conditions: ProjectAppConditionSpec[] | undefined,
  input: { required: boolean; taskId: string },
): void {
  if (input.required && !conditions?.length) {
    throw new Error(`Waiting result for ${input.taskId} requires at least one exact Condition`);
  }
  for (const condition of (conditions ?? []) as unknown[]) {
    if (!isRecord(condition)) {
      throw new Error(`Handler result for ${input.taskId} contains a non-object Condition`);
    }
    const identity = requireNonEmptyString(
      condition.id,
      `Handler result Condition for ${input.taskId} identity`,
    );
    requireNonEmptyString(condition.type, `Handler result Condition ${identity} type`);
    const subject = requireNonEmptyString(
      condition.subject,
      `Handler result Condition ${identity} subject`,
    );
    if (!isTypedProjectAppConditionSubject(subject)) {
      throw new Error(`Handler result Condition ${identity} has an invalid subject`);
    }
    if (!("expected" in condition)) {
      throw new Error(`Handler result Condition ${identity} requires an expected value`);
    }
  }
}

function validateActionEvidence(taskId: string, evidence: string[] | undefined, actionCount: number): void {
  if (actionCount > 0 && !evidence?.some((entry) => typeof entry === "string" && entry.trim())) {
    throw new Error(`Handler actions for ${taskId} require non-empty evidence`);
  }
}

function applyTaskActions(
  tree: TaskTree,
  claim: ProjectAppTaskClaim,
  actions: ProjectAppTaskAction[],
  evidence: string[],
): string[] {
  validateTaskActions(tree, actions);
  const now = new Date().toISOString();
  const applied: string[] = [];

  for (const action of actions) {
    if (action.kind !== "create-task" && action.taskId === claim.taskId) {
      throw new Error(`Handler action cannot mutate its own running task ${claim.taskId}`);
    }
    if (action.kind !== "create-task" && actionTargetAlreadyReceipted(tree, action)) {
      applied.push(`already completed ${action.taskId}`);
      continue;
    }

    switch (action.kind) {
      case "create-task": {
        const parent = tree.tasks[action.parentId];
        const intent: ProjectAppTaskIntent = {
          id: action.id,
          parentId: action.parentId,
          outcome: action.goal.trim(),
          acceptance: [...action.acceptance],
          mode: action.mode,
          ...(action.owner ? { owner: action.owner } : {}),
          ...(action.workflow ? { workflow: action.workflow } : {}),
          ...(action.input ? { input: structuredClone(action.input) } : {}),
          outputs: [...action.outputs],
          ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
          priority: action.priority ?? "P2",
        };
        const resource: ProjectAppTaskResource = {
          metadata: { id: action.id, generation: 1, resourceVersion: 1 },
          spec: resourceSpec(intent),
          status: {
            observedGeneration: 0,
            phase: "pending",
            updatedAt: now,
          },
        };
        const task: TaskNode = {
          id: action.id,
          parent_id: action.parentId,
          children: [],
          state: "backlog",
        };
        tree.resources = { ...(tree.resources ?? {}), [action.id]: resource };
        tree.tasks[action.id] = task;
        parent.children = [...new Set([...(parent.children ?? []), action.id])];
        syncTaskProjection(task, resource, action.owner ?? claim.owner);
        applied.push(`created ${task.id}`);
        break;
      }
      case "update-task": {
        const { task, resource } = mutableActionResource(tree, action);
        const current = resourceIntent(resource);
        if (resource.status.currentAttemptId) {
          finishAttempt(tree, resource, "interrupted", "Task specification changed by reconciliation action", now);
        }
        unlinkTaskConditions(tree, task);
        const generation = resource.metadata.generation + 1;
        const nextIntent: ProjectAppTaskIntent = {
          ...current,
          outcome: action.goal?.trim() ?? current.outcome,
          acceptance: action.acceptance ? [...action.acceptance] : current.acceptance,
          mode: action.mode ?? current.mode,
          outputs: action.outputs ? [...action.outputs] : current.outputs,
        };
        const nextResource: ProjectAppTaskResource = {
          metadata: {
            id: resource.metadata.id,
            generation,
            resourceVersion: resource.metadata.resourceVersion + 1,
          },
          spec: resourceSpec(nextIntent),
          status: {
            observedGeneration: Math.min(resource.status.observedGeneration, generation - 1),
            phase: "pending",
            evidence: resource.status.evidence,
            updatedAt: now,
          },
        };
        tree.resources![task.id] = nextResource;
        syncTaskProjection(task, nextResource, nextIntent.owner ?? task.owner ?? claim.owner);
        applied.push(`updated ${task.id}`);
        break;
      }
      case "close-task": {
        const { task, resource } = mutableActionResource(tree, action);
        const intent = resourceIntent(resource);
        unlinkTaskConditions(tree, task);
        if (resource.status.currentAttemptId) {
          finishAttempt(tree, resource, "interrupted", action.summary.trim(), now);
        }
        const failureFingerprints = [
          ...new Set(
            Object.values(tree.attempts ?? {})
              .filter((attempt) => attempt.taskId === task.id && attempt.failureReason)
              .map((attempt) => String(attempt.failureReason)),
          ),
        ];
        tree.receipts = {
          ...(tree.receipts ?? {}),
          [task.id]: {
            metadata: {
              id: task.id,
              generation: resource.metadata.generation,
              resourceVersion: 1,
            },
            specHash: projectAppTaskSpecHash(intent),
            parentId: intent.parentId,
            outcome: intent.outcome,
            acceptance: [...intent.acceptance],
            owner: intent.owner ?? task.owner ?? claim.owner,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            handler: claim.handler,
            summary: action.summary.trim(),
            evidence: [...evidence],
            failureFingerprints,
            completedAt: now,
          },
        };
        const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
        if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
        delete tree.tasks[task.id];
        delete tree.resources?.[task.id];
        delete tree.taskTriggers?.[task.id];
        applied.push(`closed ${task.id}`);
        break;
      }
      case "unblock-task": {
        const { task, resource } = mutableActionResource(tree, action);
        unlinkTaskConditions(tree, task);
        touchResource(resource, {
          phase: "pending",
          observedGeneration: Math.max(0, resource.metadata.generation - 1),
          currentAttemptId: undefined,
          summary: action.reason.trim(),
          conditionIds: [],
        });
        syncTaskProjection(task, resource, resource.spec.owner ?? task.owner ?? claim.owner);
        applied.push(`unblocked ${task.id}`);
        break;
      }
    }
  }
  return applied;
}

function liveChildTaskIds(tree: TaskTree, task: TaskNode): string[] {
  return (task.children ?? []).filter((childId) => Boolean(tree.tasks[childId]));
}

export function completeProjectAppTask(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: { summary: string; evidence?: string[]; actions?: ProjectAppTaskAction[] },
): { status: "applied" | "stale"; actionsApplied: string[]; dependentTaskIds: string[] } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const match = matchingTask(tree, claim);
    if (!match) return { status: "stale", actionsApplied: [], dependentTaskIds: [] };
    const { task, resource } = match;
    validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
    const actions = input.actions ?? [];
    const actionsApplied = applyTaskActions(tree, claim, actions, input.evidence ?? []);
    const liveChildren = liveChildTaskIds(tree, task);
    if (claim.mode === "achieve" && liveChildren.length > 0) {
      throw new Error(
        `Task ${task.id} cannot converge while it has live children: ${liveChildren.slice(0, 8).join(", ")}${
          liveChildren.length > 8 ? ` (+${liveChildren.length - 8} more)` : ""
        }`,
      );
    }
    const now = new Date().toISOString();
    unlinkTaskConditions(tree, task);
    finishAttempt(tree, resource, "completed", input.summary, now);
    const reconcileActionTaskIds = actions.flatMap((action) =>
      action.kind === "create-task"
        ? [action.id]
        : action.kind === "update-task" || action.kind === "unblock-task"
          ? [action.taskId]
          : [],
    );
    const satisfiedTaskIds = [
      ...(claim.mode === "achieve" ? [task.id] : []),
      ...actions.filter((action) => action.kind === "close-task").map((action) => action.taskId),
    ];
    const dependentTaskIds = [
      ...new Set([
        ...reconcileActionTaskIds,
        ...Object.values(tree.resources ?? {})
          .filter((candidate) =>
            candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)),
          )
          .map((candidate) => candidate.metadata.id),
      ]),
    ];
    if (claim.mode === "maintain") {
      touchResource(resource, {
        phase: "converged",
        observedGeneration: claim.generation,
        currentAttemptId: undefined,
        summary: input.summary,
        evidence: [...(input.evidence ?? [])],
        conditionIds: [],
      });
      syncTaskProjection(task, resource, claim.owner);
    } else {
      const intent = resourceIntent(resource);
      const failureFingerprints = [
        ...new Set(
          Object.values(tree.attempts ?? {})
            .filter((attempt) => attempt.taskId === task.id && attempt.failureReason)
            .map((attempt) => String(attempt.failureReason)),
        ),
      ];
      tree.receipts = {
        ...(tree.receipts ?? {}),
        [task.id]: {
          metadata: {
            id: task.id,
            generation: claim.generation,
            resourceVersion: 1,
          },
          specHash: claim.specHash,
          parentId: intent.parentId,
          outcome: intent.outcome,
          acceptance: [...intent.acceptance],
          owner: claim.owner,
          ...(intent.workflow ? { workflow: intent.workflow } : {}),
          handler: claim.handler,
          summary: input.summary,
          evidence: [...(input.evidence ?? [])],
          failureFingerprints,
          completedAt: now,
        },
      };
      const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
      if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
      delete tree.tasks[task.id];
      if (tree.resources) delete tree.resources[task.id];
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
      pruneCompletionReceipts(tree);
    }
    pruneTaskAttempts(tree);
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return { status: "applied", actionsApplied, dependentTaskIds };
  });
}

export function deferProjectAppTask(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: {
    disposition: "waiting";
    summary: string;
    evidence?: string[];
    actions?: ProjectAppTaskAction[];
    conditions?: ProjectAppConditionSpec[];
  },
): { status: "applied" | "stale"; actionsApplied: string[]; reconcileTaskIds: string[] } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const match = matchingTask(tree, claim);
    if (!match) return { status: "stale", actionsApplied: [], reconcileTaskIds: [] };
    const { task, resource } = match;
    validateConditions(input.conditions, { required: input.disposition === "waiting", taskId: claim.taskId });
    validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
    const actions = input.actions ?? [];
    const actionsApplied = applyTaskActions(tree, claim, actions, input.evidence ?? []);
    const now = new Date().toISOString();
    finishAttempt(tree, resource, "completed", input.summary, now);
    if (input.conditions?.length) {
      materializeWaitingConditions(tree, task, input.conditions!, now);
    } else {
      unlinkTaskConditions(tree, task);
    }
    touchResource(resource, {
      phase: input.disposition,
      observedGeneration: claim.generation,
      currentAttemptId: undefined,
      summary: input.summary,
      evidence: [...(input.evidence ?? [])],
      ...(!input.conditions?.length ? { conditionIds: [] } : {}),
    });
    syncTaskProjection(task, resource, claim.owner);
    refreshActiveTaskProjection(tree);
    pruneTaskAttempts(tree);
    saveTaskTree(config, tree);
    const satisfiedTaskIds = actions
      .filter((action) => action.kind === "close-task")
      .map((action) => action.taskId);
    const reconcileTaskIds = [
      ...new Set([
        ...actions.flatMap((action) =>
          action.kind === "create-task"
            ? [action.id]
            : action.kind === "update-task" || action.kind === "unblock-task"
              ? [action.taskId]
              : [],
        ),
        ...Object.values(tree.resources ?? {})
          .filter((candidate) =>
            candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)),
          )
          .map((candidate) => candidate.metadata.id),
      ]),
    ];
    return { status: "applied", actionsApplied, reconcileTaskIds };
  });
}

export function markProjectAppTaskAttention(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: { summary: string; reason: string },
): "applied" | "stale" {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const match = matchingTask(tree, claim);
    if (!match) return "stale";
    const { task, resource, attempt } = match;
    const now = new Date().toISOString();
    finishAttempt(tree, resource, "failed", input.summary, now);
    attempt.metadata.resourceVersion += 1;
    attempt.failureReason = input.reason;
    unlinkTaskConditions(tree, task);
    touchResource(resource, {
      phase: "attention",
      observedGeneration: claim.generation,
      currentAttemptId: undefined,
      summary: input.summary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, claim.owner);
    refreshActiveTaskProjection(tree);
    pruneTaskAttempts(tree);
    saveTaskTree(config, tree);
    return "applied";
  });
}
