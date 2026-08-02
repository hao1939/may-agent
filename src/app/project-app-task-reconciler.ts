import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import {
  ensureTaskState,
  isTypedProjectAppConditionSubject,
  MIN_PROJECT_APP_CONDITION_REVIEW_AFTER_MS,
  isLeaf,
  normalizeStringArray,
  projectRuntimePaths,
  readTaskState,
  resolveProjectAppOutputPaths,
  saveTaskState,
  taskState,
  withTaskStateLock,
  type ProjectAppTaskIntent,
  type ProjectAppTaskAction,
  type ProjectAppTaskAcceptanceBasis,
  type ProjectAppCondition,
  type ProjectAppConditionSpec,
  type ProjectAppTaskAttempt,
  type ProjectAppTaskResource,
  type ProjectAppTaskWorkspace,
  type TaskNode,
  type TaskTree,
  type TaskStateConfig,
} from "@may-agent/sdk";
import { applyProjectAppConditionEvent } from "./project-app-condition-tracker.js";

export const PROJECT_APP_TASK_RECOVERY_OWNER = "project-app-task-reconciler";

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
  intent: ProjectAppTaskIntent;
  trigger?: Record<string, unknown>;
  declaredOutputPaths: string[];
  supersededSessionIds?: string[];
  handoff?: {
    reason: "needs-owner";
    summary: string;
    evidence: string[];
  };
};

export type ProjectAppTaskClaimResult =
  | ProjectAppTaskClaim
  | { kind: "busy"; taskId: string; attemptId: string | null }
  | {
      kind: "waiting";
      taskId: string;
      conditionIds: string[];
      dependencyIds?: string[];
      childIds?: string[];
    }
  | { kind: "attention"; taskId: string; generation: number; summary: string }
  | { kind: "completed"; taskId: string; generation: number };

export type ProjectAppTaskObservationResult =
  | {
      kind: "observed";
      taskId: string;
      generation: number;
      changed: boolean;
      supersededSessionIds?: string[];
    }
  | { kind: "completed"; taskId: string; generation: number; supersededSessionIds?: string[] };

export type ProjectAppTaskSessionAssociation = {
  status: "recorded" | "superseded" | "missing";
  taskId: string;
};

export class ProjectAppTaskActionStaleError extends Error {
  readonly taskId: string;
  readonly expectedGeneration: number;
  readonly currentGeneration: number;
  readonly currentPhase?: ProjectAppTaskResource["status"]["phase"];

  constructor(input: {
    taskId: string;
    expectedGeneration: number;
    currentGeneration: number;
    currentPhase?: ProjectAppTaskResource["status"]["phase"];
  }) {
    super(
      input.currentPhase
        ? `Handler action for ${input.taskId} is stale: target phase is now ${input.currentPhase}`
        : `Handler action for ${input.taskId} is stale: expected generation ${input.expectedGeneration}, current ${input.currentGeneration}`,
    );
    this.name = "ProjectAppTaskActionStaleError";
    this.taskId = input.taskId;
    this.expectedGeneration = input.expectedGeneration;
    this.currentGeneration = input.currentGeneration;
    this.currentPhase = input.currentPhase;
  }
}

export function isProjectAppTaskActionStaleError(error: unknown): error is ProjectAppTaskActionStaleError {
  return error instanceof ProjectAppTaskActionStaleError;
}

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
  sessionIds?: string[];
};

const reconcilerRuntimeId = randomUUID();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function triggerOverridesWait(trigger: Record<string, unknown> | undefined): boolean {
  if (!trigger) return false;
  if (trigger.type === "project.comment.created" || trigger.type === "project.owner.requested") return true;
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

function projectIdFromAppDir(appDir: string): string {
  const name = basename(appDir.replace(/\\/g, "/"));
  return name.endsWith(".app") ? name.slice(0, -4) : name;
}

function syntheticAttemptTrigger(
  config: TaskStateConfig,
  taskId: string,
  reason: string | undefined,
): Record<string, unknown> {
  const project = projectIdFromAppDir(config.appDir) || "project-app";
  const normalizedReason = typeof reason === "string" && reason.trim() ? reason.trim() : "task-controller";
  return {
    type: "project.task.tick",
    source: `project-app:${project}:task-controller`,
    target: { project, taskId },
    reason: normalizedReason,
    data: {
      project,
      taskId,
      task_id: taskId,
      reason: normalizedReason,
      synthetic: "controller-recovery-trigger",
    },
  };
}

export function projectAppTaskSpecHash(intent: ProjectAppTaskIntent, effectiveOwner?: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        stableValue({
          outcome: intent.outcome,
          acceptance: intent.acceptance,
          mode: intent.mode,
          owner: effectiveOwner ?? intent.owner ?? null,
          workflow: intent.workflow ?? null,
          input: intent.input ?? {},
          outputs: intent.outputs ?? [],
          dependsOn: intent.dependsOn ?? [],
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
    ...(intent.category?.trim() ? { category: intent.category.trim() } : {}),
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
    ...(resource.spec.category ? { category: resource.spec.category } : {}),
  };
}

type CreateTaskAction = Extract<ProjectAppTaskAction, { kind: "create-task" }>;

function createActionIntent(action: CreateTaskAction): ProjectAppTaskIntent {
  return {
    id: action.id,
    parentId: action.parentId,
    outcome: action.outcome.trim(),
    acceptance: [...action.acceptance],
    mode: action.mode,
    ...(action.owner ? { owner: action.owner } : {}),
    ...(action.workflow ? { workflow: action.workflow } : {}),
    ...(action.input ? { input: structuredClone(action.input) } : {}),
    outputs: [...action.outputs],
    ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
    priority: action.priority,
    ...(action.category ? { category: action.category } : {}),
  };
}

function createActionMatchesLiveTask(tree: TaskTree, action: CreateTaskAction): boolean {
  const task = tree.tasks[action.id];
  const resource = tree.resources?.[action.id];
  if (!task || !resource) return false;
  return JSON.stringify(stableValue(resource.spec)) === JSON.stringify(stableValue(resourceSpec(createActionIntent(action))));
}

function currentResourceAttempt(tree: TaskTree, resource: ProjectAppTaskResource): ProjectAppTaskAttempt | null {
  const attemptId = resource.status.currentAttemptId;
  if (!attemptId) return null;
  const attempt = tree.attempts?.[attemptId];
  return attempt?.state === "running" ? attempt : null;
}

function latestTaskAttempt(tree: TaskTree, taskId: string, generation?: number): ProjectAppTaskAttempt | undefined {
  return Object.values(tree.attempts ?? {})
    .filter(
      (attempt) => attempt.taskId === taskId && (generation === undefined || attempt.taskGeneration === generation),
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
}

function needsOwnerHandoff(tree: TaskTree, resource: ProjectAppTaskResource): boolean {
  if (resource.status.phase !== "attention") return false;
  const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
  return Boolean(attempt?.handler.startsWith("workflow:") && attempt.failureReason === "needs-owner");
}

function touchResource(resource: ProjectAppTaskResource, status: Partial<ProjectAppTaskResource["status"]>): void {
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
    .sort(([, left], [, right]) =>
      String(left.finishedAt ?? left.startedAt).localeCompare(String(right.finishedAt ?? right.startedAt)),
    )
    .slice(0, Math.max(0, entries.length - limit))
    .forEach(([attemptId]) => delete tree.attempts?.[attemptId]);
}

export function taskReconciliationConfig(input: {
  appDir: string;
  projectDir: string;
  owner: string;
  maxConcurrent: number;
}): TaskStateConfig {
  const paths = projectRuntimePaths(input.appDir);
  return {
    appDir: input.appDir,
    projectDir: input.projectDir,
    statePath: ensureTaskState(input.appDir).path,
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

function isOpenCondition(value: unknown): value is ProjectAppCondition {
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

function missedTaskConditionCheckpointIds(tree: TaskTree, taskId: string, nowMs = Date.now()): string[] {
  return taskConditionEntries(tree, taskId).flatMap(([id, condition]) => {
    if (!isOpenCondition(condition)) return [];
    const reviewAfterMs = condition.spec.reviewAfterMs;
    const observedAtMs = Date.parse(String(condition.status.observedAt ?? ""));
    if (
      !Number.isInteger(reviewAfterMs) ||
      Number(reviewAfterMs) < MIN_PROJECT_APP_CONDITION_REVIEW_AFTER_MS ||
      !Number.isFinite(observedAtMs)
    ) {
      return [];
    }
    return nowMs >= observedAtMs + Number(reviewAfterMs) ? [id] : [];
  });
}

function hasSatisfiedTaskCondition(tree: TaskTree, taskId: string): boolean {
  return taskConditionEntries(tree, taskId).some(
    ([, condition]) => isProjectAppCondition(condition) && condition.status.state === "true",
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
      ...(raw.reviewAfterMs !== undefined ? { reviewAfterMs: raw.reviewAfterMs } : {}),
    };
    const current = registry[id];
    const sameSpec = current && JSON.stringify(stableValue(current.spec)) === JSON.stringify(stableValue(spec));
    const linkedToAnotherTask = Object.values(tree.resources ?? {}).some(
      (resource) => resource.metadata.id !== task.id && resource.status.conditionIds?.includes(id),
    );
    if (current && !sameSpec && linkedToAnotherTask) {
      throw new Error(`Condition ${id} is already linked to another task with a different specification`);
    }
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

function syncTaskProjection(task: TaskNode, resource: ProjectAppTaskResource, owner: string): void {
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
  task.kind = intent.category;
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

export function recoverableProjectAppTaskAttempts(config: TaskStateConfig): ProjectAppTaskAttemptRecovery[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const recoveries = Object.values(tree.resources ?? {}).flatMap((resource) => {
      if (resource.status.phase !== "running") return [];
      const attempt = currentResourceAttempt(tree, resource);
      if (!attempt || attempt.runtimeId === reconcilerRuntimeId) return [];
      return [
        {
          taskId: resource.metadata.id,
          intent: resourceIntent(resource),
          ...(attempt.trigger ? { trigger: attempt.trigger } : {}),
        },
      ];
    });
    return recoveries;
  });
}

export function releaseInterruptedProjectAppTaskAttempt(
  config: TaskStateConfig,
  taskId: string,
  summary: string,
): { released: boolean; sessionIds: string[] } {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const task = tree.tasks[taskId];
    if (!task) return { released: false, sessionIds: [] };
    const resource = tree.resources?.[taskId];
    if (!resource || resource.status.phase !== "running") return { released: false, sessionIds: [] };
    const attempt = currentResourceAttempt(tree, resource);
    if (!attempt || attempt.runtimeId === reconcilerRuntimeId) return { released: false, sessionIds: [] };
    const now = new Date().toISOString();
    const recoveredSummary = `${summary}; retrying from current task evidence`;
    const sessionIds = attempt.sessionId ? [attempt.sessionId] : [];
    if (attempt.trigger && !tree.taskTriggers?.[taskId]) {
      tree.taskTriggers = {
        ...(tree.taskTriggers ?? {}),
        [taskId]: {
          taskId,
          taskGeneration: resource.metadata.generation,
          resourceVersion: 1,
          event: structuredClone(attempt.trigger),
          observedAt: now,
        },
      };
    }
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
    saveTaskState(config, tree);
    return { released: true, sessionIds };
  });
}

export function repairPreviousRuntimeRecoveryAttention(config: TaskStateConfig): ProjectAppTaskRecoveryRepair[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
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
      saveTaskState(config, tree);
    }
    return repairs;
  });
}

export function repairRunningProjectAppTasksWithoutAttempt(
  config: TaskStateConfig,
): ProjectAppTaskRecoveryRepair[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const repairs: ProjectAppTaskRecoveryRepair[] = [];
    const now = new Date().toISOString();
    for (const resource of Object.values(tree.resources ?? {})) {
      if (resource.status.phase !== "running") continue;
      const task = tree.tasks[resource.metadata.id];
      if (!task) continue;
      const attemptId = resource.status.currentAttemptId;
      const attempt = attemptId ? tree.attempts?.[attemptId] : undefined;
      if (attempt?.state === "running") continue;

      const owner = resolvedOwner(tree, resourceIntent(resource), config.worker);
      const summary = attemptId
        ? `Running reconciliation ${resource.metadata.id} referenced missing or non-running attempt ${attemptId}; retrying from current task evidence`
        : `Running reconciliation ${resource.metadata.id} had no current attempt; retrying from current task evidence`;
      if (attempt) {
        attempt.metadata.resourceVersion += 1;
        attempt.failureReason = "running-without-current-attempt-requeued";
        attempt.summary = summary;
        attempt.finishedAt ??= now;
      }
      touchResource(resource, {
        phase: "pending",
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, owner);
      repairs.push({
        taskId: resource.metadata.id,
        disposition: "requeued",
        summary,
      });
    }
    if (repairs.length > 0) {
      refreshActiveTaskProjection(tree);
      pruneTaskAttempts(tree);
      saveTaskState(config, tree);
    }
    return repairs;
  });
}

export function pendingProjectAppTaskRecoveryAttention(config: TaskStateConfig): ProjectAppTaskRecoveryAttention[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
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

export function acknowledgeProjectAppTaskRecoveryAttention(config: TaskStateConfig, taskId: string): boolean {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const attempt = Object.values(tree.attempts ?? {})
      .filter((candidate) => candidate.taskId === taskId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (!attempt || attempt.failureReason !== "previous-runtime-attempt-not-recoverable" || attempt.attentionNotifiedAt)
      return false;
    attempt.metadata.resourceVersion += 1;
    attempt.attentionNotifiedAt = new Date().toISOString();
    saveTaskState(config, tree);
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

function validateParentReference(tree: TaskTree, taskId: string, parentId: string): void {
  if (!tree.tasks[parentId]) {
    throw new Error(`Task ${taskId} parent does not exist in the live graph: ${parentId}`);
  }
  if (parentId === taskId) throw new Error(`Task ${taskId} cannot be its own parent`);

  const seen = new Set<string>();
  let cursor: string | undefined = parentId;
  while (cursor && !seen.has(cursor)) {
    if (cursor === taskId) throw new Error(`Task ${taskId} parent would create a containment cycle`);
    seen.add(cursor);
    cursor = tree.tasks[cursor]?.parent_id ?? undefined;
  }
  if (cursor) throw new Error(`Task ${taskId} parent chain already contains a containment cycle at ${cursor}`);
}

function upsertTask(tree: TaskTree, resource: ProjectAppTaskResource, owner: string): TaskNode {
  const intent = resourceIntent(resource);
  const parent = tree.tasks[intent.parentId];
  if (!parent) {
    throw new Error(`Task ${intent.id} parent does not exist in the live graph: ${intent.parentId}`);
  }

  const task = tree.tasks[intent.id] ?? {
    id: intent.id,
    parent_id: intent.parentId,
    children: [],
    state: "backlog",
  };
  const previousParentId = task.parent_id;
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
  if (previousParentId && previousParentId !== intent.parentId) {
    const previousParent = tree.tasks[previousParentId];
    if (previousParent) previousParent.children = (previousParent.children ?? []).filter((id) => id !== task.id);
  }
  parent.children = [...new Set([...(parent.children ?? []), intent.id])];
  return task;
}

export function observeProjectAppTaskIntent(
  config: TaskStateConfig,
  input: {
    intent: ProjectAppTaskIntent;
    appOwner: string;
    trigger?: Record<string, unknown>;
  },
): ProjectAppTaskObservationResult {
  validateIntent(input.intent);
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const supersededSessionIds = new Set<string>();
    validateParentReference(tree, input.intent.id, input.intent.parentId);
    const owner = resolvedOwner(tree, input.intent, input.appOwner);
    const specHash = projectAppTaskSpecHash(input.intent, owner);
    const receipt = tree.receipts?.[input.intent.id];
    if (receipt && receipt.specHash === specHash && input.intent.mode === "achieve") {
      const duplicateTask = tree.tasks[input.intent.id];
      const duplicateResource = tree.resources?.[input.intent.id];
      if (duplicateTask || duplicateResource) {
        const liveChildren = (duplicateTask?.children ?? []).filter((childId) => tree.tasks[childId]);
        if (liveChildren.length > 0) {
          throw new Error(
            `Task ${input.intent.id} has a matching completion receipt but its stale live duplicate cannot be pruned while it has live children: ${liveChildren.slice(0, 8).join(", ")}${
              liveChildren.length > 8 ? ` (+${liveChildren.length - 8} more)` : ""
            }`,
          );
        }
        const now = new Date().toISOString();
        if (duplicateResource?.status.currentAttemptId) {
          const duplicateAttempt = currentResourceAttempt(tree, duplicateResource);
          if (duplicateAttempt?.sessionId) supersededSessionIds.add(duplicateAttempt.sessionId);
          finishAttempt(
            tree,
            duplicateResource,
            "interrupted",
            "Matching completion receipt already exists; pruning stale live duplicate",
            now,
          );
        }
        if (duplicateTask) {
          unlinkTaskConditions(tree, duplicateTask);
          const parent = duplicateTask.parent_id ? tree.tasks[duplicateTask.parent_id] : undefined;
          if (parent) parent.children = (parent.children ?? []).filter((id) => id !== duplicateTask.id);
          delete tree.tasks[duplicateTask.id];
        } else if (duplicateResource?.status.conditionIds?.length) {
          touchResource(duplicateResource, { conditionIds: [] });
          pruneUnlinkedConditions(tree);
        }
        delete tree.resources?.[input.intent.id];
        delete tree.taskTriggers?.[input.intent.id];
        pruneTaskAttempts(tree);
        refreshActiveTaskProjection(tree);
        saveTaskState(config, tree);
      }
      return {
        kind: "completed",
        taskId: input.intent.id,
        generation: receipt.metadata.generation,
        ...(supersededSessionIds.size > 0
          ? { supersededSessionIds: [...supersededSessionIds] }
          : {}),
      };
    }

    const existingResource = tree.resources?.[input.intent.id];
    const previousGeneration = existingResource
      ? existingResource.metadata.generation
      : receipt && Number.isInteger(receipt.metadata.generation)
        ? receipt.metadata.generation
        : 0;
    const existingIntent = existingResource ? resourceIntent(existingResource) : null;
    const existingOwner = existingIntent ? resolvedOwner(tree, existingIntent, input.appOwner) : null;
    const sameSpec = existingIntent
      ? projectAppTaskSpecHash(existingIntent, existingOwner ?? undefined) === specHash
      : false;
    const generation = sameSpec ? previousGeneration : Math.max(1, previousGeneration + 1);
    const nextSpec = resourceSpec(input.intent);
    const desiredStateChanged =
      !existingResource || JSON.stringify(stableValue(existingResource.spec)) !== JSON.stringify(stableValue(nextSpec));
    const changed = !existingResource || generation !== previousGeneration || desiredStateChanged;
    const now = new Date().toISOString();
    let resource: ProjectAppTaskResource;
    if (existingResource && sameSpec) {
      resource = desiredStateChanged
        ? {
            ...existingResource,
            metadata: {
              ...existingResource.metadata,
              resourceVersion: existingResource.metadata.resourceVersion + 1,
            },
            spec: nextSpec,
            status: { ...existingResource.status, updatedAt: now },
          }
        : existingResource;
    } else {
      if (existingResource?.status.currentAttemptId) {
        const existingAttempt = currentResourceAttempt(tree, existingResource);
        if (existingAttempt?.sessionId) supersededSessionIds.add(existingAttempt.sessionId);
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
        spec: nextSpec,
        status: {
          observedGeneration: Math.min(existingResource?.status.observedGeneration ?? 0, generation - 1),
          phase: "pending",
          updatedAt: now,
        },
      };
    }
    tree.resources = { ...(tree.resources ?? {}), [input.intent.id]: resource };
    const task = upsertTask(tree, resource, owner);
    if (generation > previousGeneration) {
      pruneUnlinkedConditions(tree);
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
    }
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
    saveTaskState(config, tree);
    return {
      kind: "observed",
      taskId: task.id,
      generation,
      changed,
      ...(supersededSessionIds.size > 0
        ? { supersededSessionIds: [...supersededSessionIds] }
        : {}),
    };
  });
}

export function readProjectAppTaskIntent(config: TaskStateConfig, taskId: string): ProjectAppTaskIntent | null {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const resource = tree.resources?.[taskId];
    return resource ? resourceIntent(resource) : null;
  });
}

export type ProjectAppTaskChildContext = {
  live: Array<{
    taskId: string;
    generation: number;
    phase: ProjectAppTaskResource["status"]["phase"];
    outcome: string;
    owner?: string;
    workflow?: string;
    summary?: string;
    evidence: string[];
  }>;
  completed: Array<{
    taskId: string;
    generation: number;
    outcome: string;
    owner: string;
    summary: string;
    evidence: string[];
    completedAt: string;
  }>;
};

/** Bounded current child state supplied to an executable parent reconciliation. */
export function readProjectAppTaskChildContext(
  config: TaskStateConfig,
  taskId: string,
): ProjectAppTaskChildContext {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const live = (tree.tasks[taskId]?.children ?? [])
      .map((childId) => tree.resources?.[childId])
      .filter((resource): resource is ProjectAppTaskResource => Boolean(resource))
      .sort((left, right) => left.metadata.id.localeCompare(right.metadata.id))
      .slice(0, 32)
      .map((resource) => ({
        taskId: resource.metadata.id,
        generation: resource.metadata.generation,
        phase: resource.status.phase,
        outcome: resource.spec.outcome,
        ...(resource.spec.owner ? { owner: resource.spec.owner } : {}),
        ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
        ...(resource.status.summary ? { summary: resource.status.summary } : {}),
        evidence: [...(resource.status.evidence ?? [])].slice(0, 8),
      }));
    const completed = Object.values(tree.receipts ?? {})
      .filter((receipt) => receipt.parentId === taskId)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, 32)
      .map((receipt) => ({
        taskId: receipt.metadata.id,
        generation: receipt.metadata.generation,
        outcome: receipt.outcome,
        owner: receipt.owner,
        summary: receipt.summary,
        evidence: [...receipt.evidence].slice(0, 8),
        completedAt: receipt.completedAt,
      }));
    return { live, completed };
  });
}

export function readProjectAppTaskTrigger(
  config: TaskStateConfig,
  taskId: string,
): Record<string, unknown> | undefined {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const pending = tree.taskTriggers?.[taskId];
    if (pending) return pending.event;
    const resource = tree.resources?.[taskId];
    const attempt = resource ? currentResourceAttempt(tree, resource) : null;
    return attempt?.trigger;
  });
}

/** Persist a wake observation for an existing task without resubmitting desired state. */
export function recordProjectAppTaskTrigger(
  config: TaskStateConfig,
  taskId: string,
  event: Record<string, unknown>,
): { kind: "recorded" | "waiting" | "missing" } {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task) return { kind: "missing" };
    if (
      resource.status.phase === "waiting" &&
      openTaskConditionIds(tree, task).length > 0 &&
      !hasSatisfiedTaskCondition(tree, taskId) &&
      !triggerOverridesWait(event)
    ) {
      return { kind: "waiting" };
    }
    const previous = tree.taskTriggers?.[taskId];
    tree.taskTriggers = {
      ...(tree.taskTriggers ?? {}),
      [taskId]: {
        taskId,
        taskGeneration: resource.metadata.generation,
        resourceVersion: (previous?.resourceVersion ?? 0) + 1,
        event: structuredClone(event),
        observedAt: new Date().toISOString(),
      },
    };
    saveTaskState(config, tree);
    return { kind: "recorded" };
  });
}

export function listProjectAppTaskIntents(config: TaskStateConfig): ProjectAppTaskIntent[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
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
  if (!dependenciesSatisfied(tree, intent)) return false;
  if (currentResourceAttempt(tree, resource)) return false;
  const pendingTrigger = tree.taskTriggers?.[task.id]?.event;
  if (pendingTrigger) return true;
  if (resource.metadata.generation > resource.status.observedGeneration) return true;
  if (resource.status.phase === "pending") return true;
  if (resource.status.phase === "waiting") {
    if (hasSatisfiedTaskCondition(tree, task.id)) return true;
    if (missedTaskConditionCheckpointIds(tree, task.id).length > 0) return true;
    return liveChildTaskIds(tree, task).length === 0 && !(resource.status.conditionIds?.length ?? 0);
  }
  if (resource.status.phase === "attention") return needsOwnerHandoff(tree, resource);
  if (resource.status.phase === "running") return true;
  return false;
}

function triggerHasDirectProjectComment(event: Record<string, unknown> | undefined): boolean {
  if (event?.type === "project.comment.created") return true;
  return Array.isArray(event?.ownerIntentRefs)
    ? event.ownerIntentRefs.some(
        (value) => isRecord(value) && value.eventType === "project.comment.created",
      )
    : false;
}

export type ProjectAppTaskQueueEntry = {
  taskId: string;
  options: {
    front: boolean;
    priority: "P0" | "P1" | "P2" | "P3";
  };
};

const projectAppTaskPriorityOrder = ["P0", "P1", "P2", "P3"] as const;
const projectAppTaskPriorityAgingIntervalMs = 5 * 60 * 1_000;

function effectiveProjectAppTaskPriority(
  resource: ProjectAppTaskResource,
  nowMs: number,
  readyAt = resource.status.updatedAt,
): (typeof projectAppTaskPriorityOrder)[number] {
  const declaredPriority = resource.spec.priority ?? "P2";
  const declaredRank = projectAppTaskPriorityOrder.indexOf(declaredPriority);
  const readyAtMs = Date.parse(readyAt ?? "");
  if (!Number.isFinite(readyAtMs)) return declaredPriority;
  const ageMs = Math.max(0, nowMs - readyAtMs);
  const highestAgedRank = declaredRank === 0 ? 0 : 1;
  const promotedRank = Math.max(
    highestAgedRank,
    declaredRank - Math.floor(ageMs / projectAppTaskPriorityAgingIntervalMs),
  );
  return projectAppTaskPriorityOrder[promotedRank] ?? declaredPriority;
}

export function listRunnableProjectAppTaskQueueEntries(config: TaskStateConfig): ProjectAppTaskQueueEntry[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const nowMs = Date.now();
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
    const hasDirectProjectComment = (resource: ProjectAppTaskResource): boolean =>
      triggerHasDirectProjectComment(tree.taskTriggers?.[resource.metadata.id]?.event);
    const hasPersistedTrigger = (resource: ProjectAppTaskResource): boolean =>
      Boolean(tree.taskTriggers?.[resource.metadata.id]?.event);
    const effectivePriority = (resource: ProjectAppTaskResource) =>
      hasDirectProjectComment(resource)
        ? "P0"
        : effectiveProjectAppTaskPriority(
            resource,
            nowMs,
            tree.taskTriggers?.[resource.metadata.id]?.observedAt,
          );
    return Object.values(tree.resources ?? {})
      .filter((resource) => isRunnableOnPassiveResync(tree, resource))
      .sort((left, right) => {
        const commentOrder = Number(hasDirectProjectComment(right)) - Number(hasDirectProjectComment(left));
        const triggerOrder = Number(hasPersistedTrigger(right)) - Number(hasPersistedTrigger(left));
        const leftPriority = priorityOrder[effectivePriority(left)];
        const rightPriority = priorityOrder[effectivePriority(right)];
        const leftUpdatedAt = String(left.status.updatedAt ?? "");
        const rightUpdatedAt = String(right.status.updatedAt ?? "");
        return (
          commentOrder ||
          leftPriority - rightPriority ||
          triggerOrder ||
          leftUpdatedAt.localeCompare(rightUpdatedAt) ||
          left.metadata.id.localeCompare(right.metadata.id)
        );
      })
      .map((resource) => ({
        taskId: resource.metadata.id,
        options: {
          front: hasPersistedTrigger(resource),
          priority: effectivePriority(resource),
        },
      }));
  });
}

export function listRunnableProjectAppTaskIds(config: TaskStateConfig): string[] {
  return listRunnableProjectAppTaskQueueEntries(config).map((entry) => entry.taskId);
}

export function projectAppTaskQueueEntries(
  config: TaskStateConfig,
  taskIds: Iterable<string>,
): ProjectAppTaskQueueEntry[] {
  const requested = new Set(taskIds);
  if (requested.size === 0) return [];
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const nowMs = Date.now();
    return [...requested].flatMap((taskId) => {
      const resource = tree.resources?.[taskId];
      if (!resource) return [];
      const trigger = tree.taskTriggers?.[taskId];
      return [
        {
          taskId,
          options: {
            front: Boolean(trigger?.event),
            priority: triggerHasDirectProjectComment(trigger?.event)
              ? "P0"
              : effectiveProjectAppTaskPriority(resource, nowMs, trigger?.observedAt),
          },
        },
      ];
    });
  });
}

export type ProjectAppTaskHandlerRepairCandidate = {
  taskId: string;
  owner: string;
  workflow: string;
};

export type ProjectAppTaskExecutionRepairCandidate = {
  taskId: string;
  owner: string;
  failedAt: string;
  failureReason: "HandlerExecutionFailed" | "handler-blocked";
  sessionId?: string;
};

export type ProjectAppTaskWorkspaceRepairCandidate = {
  taskId: string;
  generation: number;
  owner: string;
  workflow: string;
  previous?: ProjectAppTaskWorkspace;
};

/** Workspace failures to re-check mechanically when the app/runtime reloads. */
export function listWorkspacePreparationFailedProjectAppTasks(
  config: TaskStateConfig,
  appOwner: string,
): ProjectAppTaskWorkspaceRepairCandidate[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    return Object.values(tree.resources ?? {})
      .flatMap((resource): ProjectAppTaskWorkspaceRepairCandidate[] => {
        if (resource.status.phase !== "attention" || !resource.spec.workflow?.trim()) return [];
        const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
        if (attempt?.failureReason !== "WorkspacePreparationFailed") return [];
        const previous = Object.values(tree.attempts ?? {})
          .filter(
            (candidate) =>
              candidate.taskId === resource.metadata.id &&
              candidate.taskGeneration === resource.metadata.generation &&
              candidate.workspace?.kind === "task-worktree",
          )
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]?.workspace;
        const intent = resourceIntent(resource);
        return [
          {
            taskId: resource.metadata.id,
            generation: resource.metadata.generation,
            owner: resolvedOwner(tree, intent, appOwner),
            workflow: intent.workflow!.trim(),
            ...(previous ? { previous } : {}),
          },
        ];
      })
      .sort((left, right) => left.taskId.localeCompare(right.taskId));
  });
}

/** Release attention after workspace preparation succeeds for this generation. */
export function releaseWorkspacePreparationFailedProjectAppTask(
  config: TaskStateConfig,
  taskId: string,
  generation: number,
): boolean {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task || resource.status.phase !== "attention" || resource.metadata.generation !== generation) {
      return false;
    }
    const attempt = latestTaskAttempt(tree, taskId, generation);
    if (attempt?.failureReason !== "WorkspacePreparationFailed") return false;
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, generation - 1),
      currentAttemptId: undefined,
      summary: "Task workspace preparation succeeded after app reload; retrying current task generation",
      conditionIds: [],
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree);
    return true;
  });
}

/** Bindings to retry once their owning app reload proves the workflow now resolves. */
export function listHandlerUnavailableProjectAppTasks(
  config: TaskStateConfig,
  appOwner: string,
): ProjectAppTaskHandlerRepairCandidate[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    return Object.values(tree.resources ?? {})
      .filter((resource) => {
        if (resource.status.phase !== "attention" || !resource.spec.workflow?.trim()) return false;
        const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
        return attempt?.handler.startsWith("workflow:") && attempt.failureReason === "HandlerUnavailable";
      })
      .map((resource) => {
        const intent = resourceIntent(resource);
        return {
          taskId: resource.metadata.id,
          owner: resolvedOwner(tree, intent, appOwner),
          workflow: intent.workflow!.trim(),
        };
      })
      .sort((left, right) => left.taskId.localeCompare(right.taskId));
  });
}

/** Release attention only after the host has proved the named workflow resolves again. */
export function releaseHandlerUnavailableProjectAppTask(config: TaskStateConfig, taskId: string): boolean {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task || resource.status.phase !== "attention") return false;
    const attempt = latestTaskAttempt(tree, taskId, resource.metadata.generation);
    if (!attempt?.handler.startsWith("workflow:") || attempt.failureReason !== "HandlerUnavailable") return false;
    const summary = `Workflow binding ${attempt.handler} resolved after app reload; retrying current task generation`;
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree);
    return true;
  });
}

/** Executions to retry only after a later successful session proves their owner is runnable again. */
export function listHandlerExecutionFailedProjectAppTasks(
  config: TaskStateConfig,
): ProjectAppTaskExecutionRepairCandidate[] {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    return Object.values(tree.resources ?? {})
      .flatMap((resource): ProjectAppTaskExecutionRepairCandidate[] => {
        if (resource.status.phase !== "attention") return [];
        const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
        if (!attempt?.finishedAt) return [];
        if (attempt.failureReason === "HandlerExecutionFailed") {
          return [
            {
              taskId: resource.metadata.id,
              owner: attempt.owner,
              failedAt: attempt.finishedAt,
              failureReason: "HandlerExecutionFailed",
              ...(attempt.sessionId ? { sessionId: attempt.sessionId } : {}),
            },
          ];
        }
        // Compatibility for direct-owner failures recorded before execution
        // failures received their own structured reason. The loader must prove
        // the referenced session itself ended in error before releasing it.
        if (
          attempt.failureReason === "handler-blocked" &&
          attempt.handler === `owner:${attempt.owner}` &&
          attempt.sessionId
        ) {
          return [
            {
              taskId: resource.metadata.id,
              owner: attempt.owner,
              failedAt: attempt.finishedAt,
              failureReason: "handler-blocked",
              sessionId: attempt.sessionId,
            },
          ];
        }
        return [];
      })
      .sort((left, right) => left.failedAt.localeCompare(right.failedAt) || left.taskId.localeCompare(right.taskId));
  });
}

/** Release one execution failure after structured evidence from a newer successful owner session. */
export function releaseHandlerExecutionFailedProjectAppTask(
  config: TaskStateConfig,
  taskId: string,
  evidence: {
    owner: string;
    sessionId: string;
    observedAt: string;
    allowLegacyHandlerBlocked?: boolean;
  },
): boolean {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task || resource.status.phase !== "attention") return false;
    const attempt = latestTaskAttempt(tree, taskId, resource.metadata.generation);
    if (!attempt?.finishedAt || attempt.owner !== evidence.owner) return false;
    const executionFailed = attempt.failureReason === "HandlerExecutionFailed";
    const legacyExecutionFailed =
      evidence.allowLegacyHandlerBlocked === true &&
      attempt.failureReason === "handler-blocked" &&
      attempt.handler === `owner:${attempt.owner}` &&
      Boolean(attempt.sessionId);
    if (!executionFailed && !legacyExecutionFailed) return false;
    const observedAt = Date.parse(evidence.observedAt);
    const failedAt = Date.parse(attempt.finishedAt);
    if (!Number.isFinite(observedAt) || !Number.isFinite(failedAt) || observedAt <= failedAt) return false;
    const summary = `Owner ${evidence.owner} completed session ${evidence.sessionId} after the failed execution; retrying current task generation`;
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary,
      conditionIds: [],
    });
    if (attempt.trigger) {
      const previous = tree.taskTriggers?.[taskId];
      tree.taskTriggers = {
        ...(tree.taskTriggers ?? {}),
        [taskId]: {
          taskId,
          taskGeneration: resource.metadata.generation,
          resourceVersion: (previous?.resourceVersion ?? 0) + 1,
          event: structuredClone(attempt.trigger),
          observedAt: evidence.observedAt,
        },
      };
    }
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree);
    return true;
  });
}

export function claimObservedProjectAppTask(
  config: TaskStateConfig,
  input: {
    taskId: string;
    appOwner: string;
    handler: string;
    reason?: string;
    isOwnerRunnable?: (owner: string) => boolean;
  },
): ProjectAppTaskClaimResult {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const task = tree.tasks[input.taskId];
    const resource = tree.resources?.[input.taskId];
    if (!task || !resource) {
      return {
        kind: "completed",
        taskId: input.taskId,
        generation: tree.receipts?.[input.taskId]?.metadata.generation ?? 0,
      };
    }
    const intent = resourceIntent(resource);
    const owner = resolvedOwner(tree, intent, input.appOwner);
    let declaredOutputPaths: string[] = [];
    let outputAdmissionError: string | undefined;
    try {
      declaredOutputPaths = resolveProjectAppOutputPaths(intent.outputs ?? [], config);
    } catch (error) {
      outputAdmissionError = `Task output admission failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    const admissionError =
      outputAdmissionError ??
      (input.isOwnerRunnable && !input.isOwnerRunnable(owner)
        ? `Resolved owner ${owner} is not a runnable agent`
        : undefined);
    if (admissionError) {
      const summary = admissionError;
      if (resource.status.currentAttemptId) {
        finishAttempt(tree, resource, "interrupted", summary, new Date().toISOString());
      }
      // This wake was evaluated and produced a durable attention result. Keeping
      // it pending would make passive resync immediately retry the same invalid
      // task forever; a later external wake can record a fresh trigger.
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
      touchResource(resource, {
        phase: "attention",
        observedGeneration: resource.metadata.generation,
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, owner);
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree);
      return {
        kind: "attention",
        taskId: task.id,
        generation: resource.metadata.generation,
        summary,
      };
    }
    const handler =
      input.handler === "auto"
        ? needsOwnerHandoff(tree, resource)
          ? `owner:${owner}`
          : intent.workflow?.trim()
            ? `workflow:${intent.workflow.trim()}`
            : `owner:${owner}`
        : input.handler === "owner"
          ? `owner:${owner}`
          : input.handler;
    const ownerHandoff = needsOwnerHandoff(tree, resource) && handler === `owner:${owner}`;
    const handoffAttempt = ownerHandoff
      ? latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation)
      : undefined;
    const previousAttempt = currentResourceAttempt(tree, resource);
    if (resource.status.phase === "running" && !previousAttempt) {
      const now = new Date().toISOString();
      const attemptId = resource.status.currentAttemptId;
      const summary = attemptId
        ? `Running reconciliation ${task.id} referenced missing or non-running attempt ${attemptId}; retrying from current task evidence`
        : `Running reconciliation ${task.id} had no current attempt; retrying from current task evidence`;
      const staleAttempt = attemptId ? tree.attempts?.[attemptId] : undefined;
      if (staleAttempt) {
        staleAttempt.metadata.resourceVersion += 1;
        staleAttempt.failureReason = "running-without-current-attempt-requeued";
        staleAttempt.summary = summary;
        staleAttempt.finishedAt ??= now;
      }
      touchResource(resource, {
        phase: "pending",
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, owner);
      refreshActiveTaskProjection(tree);
      pruneTaskAttempts(tree);
    }
    const canRecoverPreviousRuntime = Boolean(
      previousAttempt &&
      previousAttempt.runtimeId !== reconcilerRuntimeId &&
      (input.reason === `attempt-recovery:${task.id}` || previousAttempt.trigger),
    );
    const supersededSessionIds = new Set<string>();
    const pendingTrigger = tree.taskTriggers?.[task.id];
    const hasTrigger = Boolean(pendingTrigger?.event ?? previousAttempt?.trigger);
    if (canRecoverPreviousRuntime && previousAttempt && !hasTrigger) {
      const now = new Date().toISOString();
      const summary = "Previous runtime attempt had no persisted trigger; retrying from current task evidence";
      if (previousAttempt.sessionId) supersededSessionIds.add(previousAttempt.sessionId);
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
      resource.status.phase === "converged" &&
      resource.status.observedGeneration >= resource.metadata.generation &&
      !pendingTrigger
    ) {
      return {
        kind: "completed",
        taskId: task.id,
        generation: resource.metadata.generation,
      };
    }
    if (
      resource.status.phase === "attention" &&
      resource.status.observedGeneration >= resource.metadata.generation &&
      !pendingTrigger &&
      !ownerHandoff &&
      input.reason !== "workflow-fallback"
    ) {
      return {
        kind: "attention",
        taskId: task.id,
        generation: resource.metadata.generation,
        summary: resource.status.summary ?? "Task is waiting for owner/reviewer attention",
      };
    }
    const dependencyIds = [...(intent.dependsOn ?? [])].filter((id) => {
      if (tree.receipts?.[id]) return false;
      const dependency = tree.resources?.[id];
      return !(
        dependency?.status.phase === "converged" &&
        dependency.status.observedGeneration === dependency.metadata.generation
      );
    });
    if (dependencyIds.length > 0) {
      return { kind: "waiting", taskId: task.id, conditionIds: [], dependencyIds };
    }

    if (
      resource.metadata.generation > resource.status.observedGeneration &&
      resource.status.conditionIds?.length
    ) {
      unlinkTaskConditions(tree, task);
    }
    const openConditionIds = openTaskConditionIds(tree, task);
    const hasSatisfiedCondition = hasSatisfiedTaskCondition(tree, task.id);
    const missedCheckpointConditionIds = missedTaskConditionCheckpointIds(tree, task.id);
    const childIds = liveChildTaskIds(tree, task);
    if (
      resource.status.phase === "waiting" &&
      childIds.length > 0 &&
      !pendingTrigger &&
      !hasSatisfiedCondition &&
      missedCheckpointConditionIds.length === 0
    ) {
      return { kind: "waiting", taskId: task.id, conditionIds: openConditionIds, childIds };
    }
    if (
      resource.status.phase === "waiting" &&
      openConditionIds.length > 0 &&
      !pendingTrigger &&
      !hasSatisfiedCondition &&
      missedCheckpointConditionIds.length === 0
    ) {
      return { kind: "waiting", taskId: task.id, conditionIds: openConditionIds };
    }

    if (resource.status.phase === "waiting" && hasSatisfiedCondition) {
      unlinkTaskConditions(tree, task);
    }

    const generation = resource.metadata.generation;
    const attemptId = `r_${generation}_${randomUUID()}`;
    const now = new Date().toISOString();
    if (canRecoverPreviousRuntime && previousAttempt) {
      if (previousAttempt.sessionId) supersededSessionIds.add(previousAttempt.sessionId);
      finishAttempt(tree, resource, "interrupted", "Previous runtime attempt was superseded during recovery", now);
    }
    const trigger =
      pendingTrigger?.event ??
      previousAttempt?.trigger ??
      (missedCheckpointConditionIds.length > 0
        ? {
            ...syntheticAttemptTrigger(config, task.id, "condition-review-checkpoint-missed"),
            type: "project.task.condition-review.missed",
            data: {
              project: projectIdFromAppDir(config.appDir) || "project-app",
              taskId: task.id,
              task_id: task.id,
              reason: "condition-review-checkpoint-missed",
              conditionIds: missedCheckpointConditionIds,
              synthetic: "controller-review-trigger",
            },
          }
        : syntheticAttemptTrigger(config, task.id, input.reason));
    const specHash = projectAppTaskSpecHash(intent, owner);
    const attempt: ProjectAppTaskAttempt = {
      metadata: { id: attemptId, resourceVersion: 1 },
      taskId: task.id,
      taskGeneration: generation,
      specHash,
      owner,
      handler,
      runtimeId: reconcilerRuntimeId,
      state: "running",
      reason:
        missedCheckpointConditionIds.length > 0 ? "condition-review-checkpoint-missed" : (input.reason ?? "event"),
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
    saveTaskState(config, tree);
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
      intent: structuredClone(intent),
      ...(trigger ? { trigger: structuredClone(trigger) } : {}),
      declaredOutputPaths,
      ...(supersededSessionIds.size > 0
        ? { supersededSessionIds: [...supersededSessionIds] }
        : {}),
      ...(handoffAttempt && handoffAttempt.failureReason === "needs-owner"
        ? {
            handoff: {
              reason: "needs-owner",
              summary: resource.status.summary ?? handoffAttempt.summary ?? handoffAttempt.failureReason,
              evidence: [...(resource.status.evidence ?? [])],
            },
          }
        : {}),
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
  config: TaskStateConfig,
  claim: ProjectAppTaskClaim,
  summary = "Stale reconciliation result was rejected; retrying from current task evidence",
): { status: "released" | "superseded" | "missing"; taskId: string } {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
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
    saveTaskState(config, tree);
    return { status: "released", taskId: claim.taskId };
  });
}

/** Attach observed workspace lineage to the current attempt without changing desired task state. */
export function recordProjectAppTaskAttemptWorkspace(
  config: TaskStateConfig,
  claim: ProjectAppTaskClaim,
  workspace: ProjectAppTaskWorkspace,
): boolean {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const match = matchingTask(tree, claim);
    if (!match) return false;
    match.attempt.metadata.resourceVersion += 1;
    match.attempt.workspace = structuredClone(workspace);
    saveTaskState(config, tree);
    return true;
  });
}

/** Attach the launched owner-session id to the current attempt for recovery cleanup. */
export function recordProjectAppTaskAttemptSession(
  config: TaskStateConfig,
  claim: ProjectAppTaskClaim,
  sessionId: string,
): boolean {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const match = matchingTask(tree, claim);
    if (!match) return false;
    match.attempt.metadata.resourceVersion += 1;
    match.attempt.sessionId = sessionId;
    saveTaskState(config, tree);
    return true;
  });
}

/**
 * Associate a session launched inside a task workflow with the current
 * reconciliation attempt. The session-start notification can arrive after a
 * task revision, so stale bindings are rejected instead of reviving obsolete
 * work.
 */
export function associateProjectAppTaskSession(
  config: TaskStateConfig,
  binding: { taskId: string; generation: number },
  sessionId: string,
): ProjectAppTaskSessionAssociation {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const task = tree.tasks[binding.taskId];
    const resource = tree.resources?.[binding.taskId];
    if (!task || !resource) return { status: "missing", taskId: binding.taskId };
    if (
      resource.metadata.generation !== binding.generation ||
      resource.status.phase !== "running" ||
      !resource.status.currentAttemptId
    ) {
      return { status: "superseded", taskId: binding.taskId };
    }
    const attempt = tree.attempts?.[resource.status.currentAttemptId];
    if (
      !attempt ||
      attempt.state !== "running" ||
      attempt.taskId !== binding.taskId ||
      attempt.taskGeneration !== binding.generation
    ) {
      return { status: "superseded", taskId: binding.taskId };
    }
    if (attempt.sessionId !== sessionId) {
      attempt.metadata.resourceVersion += 1;
      attempt.sessionId = sessionId;
      saveTaskState(config, tree);
    }
    return { status: "recorded", taskId: binding.taskId };
  });
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

function requireStringList(value: unknown, label: string, allowEmpty = false): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
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
    throw new ProjectAppTaskActionStaleError({
      taskId: action.taskId,
      expectedGeneration: action.expectedGeneration,
      currentGeneration: resource.metadata.generation,
    });
  }
  return { task, resource };
}

function actionTargetAlreadyReceipted(
  tree: TaskTree,
  action: Exclude<ProjectAppTaskAction, { kind: "create-task" }>,
): boolean {
  return Boolean(!tree.tasks[action.taskId] && !tree.resources?.[action.taskId] && tree.receipts?.[action.taskId]);
}

function validateTaskActions(
  tree: TaskTree,
  actions: ProjectAppTaskAction[],
  paths: { appDir: string; projectDir: string },
): void {
  if (actions.length > 16) throw new Error(`Handler result exceeds the 16-action reconciliation budget`);
  const identities = new Set<string>();
  const validationTree = structuredClone(tree);
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
      requireNonEmptyString(action.outcome, `Handler create action ${action.id} outcome`);
      if (!["achieve", "maintain"].includes(String(action.mode))) {
        throw new Error(`Handler create action ${action.id} requires mode achieve or maintain`);
      }
      requireStringList(action.outputs, `Handler create action ${action.id} outputs`, true);
      resolveProjectAppOutputPaths(action.outputs, paths);
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
      if (tree.receipts?.[action.id]) {
        throw new Error(`Handler action task already exists or completed: ${action.id}`);
      }
      if (tree.tasks[action.id] || tree.resources?.[action.id]) {
        if (createActionMatchesLiveTask(tree, action)) continue;
        throw new Error(`Handler action task already exists with a different specification: ${action.id}`);
      }
      validateParentReference(validationTree, action.id, action.parentId);
      const parent = validationTree.tasks[action.parentId];
      validationTree.tasks[action.id] = {
        id: action.id,
        parent_id: action.parentId,
        children: [],
        state: "backlog",
      };
      validationTree.resources = {
        ...(validationTree.resources ?? {}),
        [action.id]: {
          metadata: { id: action.id, generation: 1, resourceVersion: 1 },
          spec: resourceSpec({
            id: action.id,
            parentId: action.parentId,
            outcome: action.outcome.trim(),
            acceptance: [...action.acceptance],
            mode: action.mode,
            outputs: [...action.outputs],
            priority: action.priority,
            ...(action.owner ? { owner: action.owner } : {}),
            ...(action.workflow ? { workflow: action.workflow } : {}),
            ...(action.input ? { input: structuredClone(action.input) } : {}),
            ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
            ...(action.category ? { category: action.category } : {}),
          }),
          status: { observedGeneration: 0, phase: "pending", updatedAt: "" },
        },
      };
      parent.children = [...new Set([...(parent.children ?? []), action.id])];
      continue;
    }

    requireExpectedGeneration(action.expectedGeneration, `Handler ${action.kind} action ${action.taskId}`);
    if (action.kind === "update-task" && action.parentId !== undefined) {
      requireNonEmptyString(action.parentId, `Handler update for ${action.taskId} parentId`);
      validateParentReference(validationTree, action.taskId, action.parentId);
    }
    if (action.kind === "update-task" && action.outcome !== undefined) {
      requireNonEmptyString(action.outcome, `Handler update for ${action.taskId} outcome`);
    }
    if (action.kind === "update-task" && action.mode !== undefined && !["achieve", "maintain"].includes(action.mode)) {
      throw new Error(`Handler update for ${action.taskId} has invalid mode ${String(action.mode)}`);
    }
    if (action.kind === "update-task" && action.outputs !== undefined) {
      requireStringList(action.outputs, `Handler update for ${action.taskId} outputs`, true);
      resolveProjectAppOutputPaths(action.outputs, paths);
    }
    if (action.kind === "update-task" && action.acceptance !== undefined) {
      requireStringList(action.acceptance, `Handler update for ${action.taskId} acceptance`);
    }
    if (
      action.kind === "update-task" &&
      action.priority !== undefined &&
      !["P0", "P1", "P2", "P3"].includes(action.priority)
    ) {
      throw new Error(`Handler update for ${action.taskId} has an invalid priority`);
    }
    if (action.kind === "update-task" && action.owner !== undefined && action.owner !== null) {
      requireNonEmptyString(action.owner, `Handler update for ${action.taskId} owner`);
    }
    if (action.kind === "update-task" && action.workflow !== undefined && action.workflow !== null) {
      requireValidTaskWorkflow(action.workflow, `Handler update for ${action.taskId} workflow`);
    }
    if (action.kind === "update-task" && action.input !== undefined && !isRecord(action.input)) {
      throw new Error(`Handler update for ${action.taskId} input must be an object`);
    }
    if (action.kind === "update-task" && action.dependsOn !== undefined) {
      requireStringList(action.dependsOn, `Handler update for ${action.taskId} dependsOn`, true);
    }
    if (action.kind === "update-task" && action.category !== undefined && action.category !== null) {
      requireNonEmptyString(action.category, `Handler update for ${action.taskId} category`);
    }
    if (action.kind === "close-task") {
      requireNonEmptyString(action.summary, `Handler close for ${action.taskId} summary`);
    }
    if (action.kind === "unblock-task") {
      requireNonEmptyString(action.reason, `Handler unblock for ${action.taskId} reason`);
    }
    if (actionTargetAlreadyReceipted(validationTree, action)) {
      if (action.kind === "close-task") continue;
      throw new Error(
        `Handler ${action.kind} action cannot mutate completed task ${action.taskId}; create a new linked task`,
      );
    }
    const { task, resource } = mutableActionResource(validationTree, action);
    if (action.kind === "close-task") {
      const liveChildren = liveChildTaskIds(validationTree, task);
      if (liveChildren.length > 0) {
        throw new Error(
          `Handler close action cannot absorb ${task.id} while it has live children: ${liveChildren.slice(0, 8).join(", ")}${
            liveChildren.length > 8 ? ` (+${liveChildren.length - 8} more)` : ""
          }`,
        );
      }
    }
    if (
      action.kind === "update-task" &&
      action.parentId === undefined &&
      action.outcome === undefined &&
      action.mode === undefined &&
      action.outputs === undefined &&
      action.acceptance === undefined &&
      action.priority === undefined &&
      action.owner === undefined &&
      action.workflow === undefined &&
      action.input === undefined &&
      action.dependsOn === undefined &&
      action.category === undefined
    ) {
      throw new Error(`Handler update for ${action.taskId} contains no change`);
    }
    if (action.kind === "unblock-task") {
      if (resource.status.phase !== "waiting" && resource.status.phase !== "attention") {
        throw new ProjectAppTaskActionStaleError({
          taskId: action.taskId,
          expectedGeneration: action.expectedGeneration,
          currentGeneration: resource.metadata.generation,
          currentPhase: resource.status.phase,
        });
      }
    }
    if (action.kind === "update-task" && action.parentId !== undefined && action.parentId !== task.parent_id) {
      const previousParent = task.parent_id ? validationTree.tasks[task.parent_id] : undefined;
      if (previousParent) previousParent.children = (previousParent.children ?? []).filter((id) => id !== task.id);
      const nextParent = validationTree.tasks[action.parentId];
      nextParent.children = [...new Set([...(nextParent.children ?? []), task.id])];
      task.parent_id = action.parentId;
      if (resource.spec) resource.spec.parentId = action.parentId;
    }
    if (action.kind === "close-task") {
      const parent = task.parent_id ? validationTree.tasks[task.parent_id] : undefined;
      if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
      delete validationTree.tasks[task.id];
      delete validationTree.resources?.[task.id];
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
    const identity = requireNonEmptyString(condition.id, `Handler result Condition for ${input.taskId} identity`);
    requireNonEmptyString(condition.type, `Handler result Condition ${identity} type`);
    const subject = requireNonEmptyString(condition.subject, `Handler result Condition ${identity} subject`);
    if (!isTypedProjectAppConditionSubject(subject)) {
      throw new Error(`Handler result Condition ${identity} has an invalid subject`);
    }
    if (!("expected" in condition)) {
      throw new Error(`Handler result Condition ${identity} requires an expected value`);
    }
    if (
      condition.reviewAfterMs !== undefined &&
      (!Number.isInteger(condition.reviewAfterMs) ||
        Number(condition.reviewAfterMs) < MIN_PROJECT_APP_CONDITION_REVIEW_AFTER_MS)
    ) {
      throw new Error(
        `Handler result Condition ${identity} reviewAfterMs must be an integer of at least ${MIN_PROJECT_APP_CONDITION_REVIEW_AFTER_MS}`,
      );
    }
  }
}

function validateActionEvidence(taskId: string, evidence: string[] | undefined, actionCount: number): void {
  if (actionCount > 0 && !evidence?.some((entry) => typeof entry === "string" && entry.trim())) {
    throw new Error(`Handler actions for ${taskId} require non-empty evidence`);
  }
}

function defaultTaskAcceptance(claim: ProjectAppTaskClaim, evidence: string[]): ProjectAppTaskAcceptanceBasis {
  return {
    method: claim.handler.startsWith("workflow:") ? "workflow-contract" : "owner-judgment",
    evidence: [...evidence],
  };
}

function applyTaskActions(
  tree: TaskTree,
  claim: ProjectAppTaskClaim,
  actions: ProjectAppTaskAction[],
  evidence: string[],
  config: TaskStateConfig,
  acceptanceBasis: ProjectAppTaskAcceptanceBasis,
): string[] {
  validateTaskActions(tree, actions, config);
  const now = new Date().toISOString();
  const applied: string[] = [];

  for (const action of actions) {
    if (
      action.kind !== "create-task" &&
      action.taskId === claim.taskId &&
      action.kind !== "update-task"
    ) {
      throw new Error(`Handler action cannot mutate its own running task ${claim.taskId}`);
    }
    if (action.kind === "close-task" && actionTargetAlreadyReceipted(tree, action)) {
      applied.push(`already completed ${action.taskId}`);
      continue;
    }

    switch (action.kind) {
      case "create-task": {
        if (createActionMatchesLiveTask(tree, action)) {
          applied.push(`already exists ${action.id}`);
          break;
        }
        const parent = tree.tasks[action.parentId];
        const intent = createActionIntent(action);
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
        const nextIntent: ProjectAppTaskIntent = {
          ...current,
          parentId: action.parentId ?? current.parentId,
          outcome: action.outcome?.trim() ?? current.outcome,
          acceptance: action.acceptance ? [...action.acceptance] : current.acceptance,
          mode: action.mode ?? current.mode,
          outputs: action.outputs ? [...action.outputs] : current.outputs,
          priority: action.priority ?? current.priority,
          ...(action.input ? { input: structuredClone(action.input) } : {}),
          ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
        };
        if (action.owner !== undefined) {
          if (action.owner === null) delete nextIntent.owner;
          else nextIntent.owner = action.owner;
        }
        if (action.workflow !== undefined) {
          if (action.workflow === null) delete nextIntent.workflow;
          else nextIntent.workflow = action.workflow;
        }
        if (action.category !== undefined) {
          if (action.category === null) delete nextIntent.category;
          else nextIntent.category = action.category;
        }
        const currentOwner = resolvedOwner(tree, current, config.worker);
        const nextOwner = resolvedOwner(tree, nextIntent, config.worker);
        const executionChanged =
          projectAppTaskSpecHash(current, currentOwner) !== projectAppTaskSpecHash(nextIntent, nextOwner);
        const generation = executionChanged ? resource.metadata.generation + 1 : resource.metadata.generation;
        if (executionChanged) {
          if (resource.status.currentAttemptId) {
            finishAttempt(
              tree,
              resource,
              action.taskId === claim.taskId ? "completed" : "interrupted",
              action.taskId === claim.taskId
                ? "Current handler revised the task execution intent"
                : "Task execution intent changed by reconciliation action",
              now,
            );
          }
          unlinkTaskConditions(tree, task);
        }
        const previousParentId = task.parent_id;
        const nextResource: ProjectAppTaskResource = {
          metadata: {
            id: resource.metadata.id,
            generation,
            resourceVersion: resource.metadata.resourceVersion + 1,
          },
          spec: resourceSpec(nextIntent),
          status: executionChanged
            ? {
                observedGeneration: Math.min(resource.status.observedGeneration, generation - 1),
                phase: "pending",
                evidence: resource.status.evidence,
                updatedAt: now,
              }
            : { ...resource.status, updatedAt: now },
        };
        tree.resources![task.id] = nextResource;
        syncTaskProjection(task, nextResource, nextOwner);
        if (previousParentId && previousParentId !== nextIntent.parentId) {
          const previousParent = tree.tasks[previousParentId];
          if (previousParent) previousParent.children = (previousParent.children ?? []).filter((id) => id !== task.id);
          const nextParent = tree.tasks[nextIntent.parentId];
          nextParent.children = [...new Set([...(nextParent.children ?? []), task.id])];
        }
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
            specHash: projectAppTaskSpecHash(intent, intent.owner ?? task.owner ?? claim.owner),
            parentId: intent.parentId,
            outcome: intent.outcome,
            acceptance: [...intent.acceptance],
            owner: intent.owner ?? task.owner ?? claim.owner,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            handler: claim.handler,
            summary: action.summary.trim(),
            evidence: [...evidence],
            acceptanceBasis: structuredClone(acceptanceBasis),
            failureFingerprints,
            completedAt: now,
            ...(latestTaskAttempt(tree, task.id, resource.metadata.generation)?.workspace
              ? {
                  workspace: structuredClone(
                    latestTaskAttempt(tree, task.id, resource.metadata.generation)!.workspace!,
                  ),
                }
              : {}),
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

function triggerCarriesOwnerIntent(event: Record<string, unknown> | undefined): boolean {
  if (!event) return false;
  if (event.type === "project.comment.created" || event.type === "project.owner.requested") return true;
  return Array.isArray(event.ownerIntentRefs)
    ? event.ownerIntentRefs.some(
        (value) =>
          isRecord(value) &&
          (value.eventType === "project.comment.created" || value.eventType === "project.owner.requested"),
      )
    : false;
}

function recordExecutableParentTrigger(
  tree: TaskTree,
  child: TaskNode,
  disposition: "converged" | "attention",
  summary: string,
  evidence: string[] | undefined,
  now: string,
): string | undefined {
  const parentTaskId = child.parent_id ?? undefined;
  if (!parentTaskId) return undefined;
  const parent = tree.resources?.[parentTaskId];
  if (!parent) return undefined;
  const previous = tree.taskTriggers?.[parentTaskId];
  // A queued owner intent is a durable commitment. The parent is already
  // runnable, so a child transition must not replace that unresolved input.
  if (triggerCarriesOwnerIntent(previous?.event)) return parentTaskId;
  tree.taskTriggers = {
    ...(tree.taskTriggers ?? {}),
    [parentTaskId]: {
      taskId: parentTaskId,
      taskGeneration: parent.metadata.generation,
      resourceVersion: (previous?.resourceVersion ?? 0) + 1,
      event: {
        type: "project.task.child-transitioned",
        source: PROJECT_APP_TASK_RECOVERY_OWNER,
        target: { taskId: parentTaskId },
        taskId: parentTaskId,
        childTaskId: child.id,
        disposition,
        summary,
        evidence: [...(evidence ?? [])],
      },
      observedAt: now,
    },
  };
  return parentTaskId;
}

export function completeProjectAppTask(
  config: TaskStateConfig,
  claim: ProjectAppTaskClaim,
  input: {
    summary: string;
    evidence?: string[];
    actions?: ProjectAppTaskAction[];
    acceptanceBasis?: ProjectAppTaskAcceptanceBasis;
  },
): {
  status: "applied" | "stale";
  actionsApplied: string[];
  dependentTaskIds: string[];
  taskContinues?: true;
} {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const match = matchingTask(tree, claim);
    if (!match) {
      return {
        status: "stale",
        actionsApplied: [],
        dependentTaskIds: [],
      };
    }
    const { task, resource } = match;
    validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
    const actions = input.actions ?? [];
    const selfUpdates = actions.filter(
      (action): action is Extract<ProjectAppTaskAction, { kind: "update-task" }> =>
        action.kind === "update-task" && action.taskId === claim.taskId,
    );
    if (selfUpdates.length > 0 && actions.length !== 1) {
      throw new Error(
        `Handler self-update for ${claim.taskId} must be the only reconciliation action`,
      );
    }
    const acceptanceBasis = input.acceptanceBasis ?? defaultTaskAcceptance(claim, input.evidence ?? []);
    const actionsApplied = applyTaskActions(tree, claim, actions, input.evidence ?? [], config, acceptanceBasis);
    if (selfUpdates.length === 1) {
      const revised = tree.resources?.[claim.taskId];
      if (!revised || revised.metadata.generation <= claim.generation) {
        throw new Error(
          `Handler self-update for ${claim.taskId} must change task execution intent`,
        );
      }
      pruneTaskAttempts(tree);
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree);
      return {
        status: "applied",
        actionsApplied,
        dependentTaskIds: [claim.taskId],
        taskContinues: true,
      };
    }
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
    const parentTaskId = recordExecutableParentTrigger(tree, task, "converged", input.summary, input.evidence, now);
    const pendingSelfTrigger = Boolean(tree.taskTriggers?.[task.id]?.event);
    const dependentTaskIds = [
      ...new Set([
        ...reconcileActionTaskIds,
        ...(claim.mode === "maintain" && pendingSelfTrigger ? [task.id] : []),
        ...(parentTaskId ? [parentTaskId] : []),
        ...Object.values(tree.resources ?? {})
          .filter((candidate) => candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)))
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
          acceptanceBasis: structuredClone(acceptanceBasis),
          failureFingerprints,
          completedAt: now,
          ...(match.attempt.workspace ? { workspace: structuredClone(match.attempt.workspace) } : {}),
        },
      };
      const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
      if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
      delete tree.tasks[task.id];
      if (tree.resources) delete tree.resources[task.id];
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
    }
    pruneTaskAttempts(tree);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree);
    return {
      status: "applied",
      actionsApplied,
      dependentTaskIds,
    };
  });
}

export function deferProjectAppTask(
  config: TaskStateConfig,
  claim: ProjectAppTaskClaim,
  input: {
    disposition: "waiting";
    summary: string;
    evidence?: string[];
    actions?: ProjectAppTaskAction[];
    conditions?: ProjectAppConditionSpec[];
  },
): { status: "applied" | "stale"; actionsApplied: string[]; reconcileTaskIds: string[] } {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const match = matchingTask(tree, claim);
    if (!match) return { status: "stale", actionsApplied: [], reconcileTaskIds: [] };
    const { task, resource } = match;
    const actions = input.actions ?? [];
    const waitsForChildren =
      liveChildTaskIds(tree, task).length > 0 ||
      actions.some((action) => action.kind === "create-task" && action.parentId === claim.taskId);
    const pendingTrigger = tree.taskTriggers?.[task.id]?.event;
    if (
      input.disposition === "waiting" &&
      !input.conditions?.length &&
      !waitsForChildren &&
      pendingTrigger?.type === "project.task.child-transitioned"
    ) {
      throw new ProjectAppTaskActionStaleError({
        taskId: claim.taskId,
        expectedGeneration: claim.generation,
        currentGeneration: resource.metadata.generation,
        currentPhase: resource.status.phase,
      });
    }
    validateConditions(input.conditions, {
      required: input.disposition === "waiting" && !waitsForChildren,
      taskId: claim.taskId,
    });
    validateActionEvidence(claim.taskId, input.evidence, actions.length);
    const acceptanceBasis = defaultTaskAcceptance(claim, input.evidence ?? []);
    const actionsApplied = applyTaskActions(tree, claim, actions, input.evidence ?? [], config, acceptanceBasis);
    if (!input.conditions?.length && liveChildTaskIds(tree, task).length === 0) {
      throw new Error(`Waiting task ${claim.taskId} requires an exact Condition or live direct child`);
    }
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

    // A trigger can arrive while the attempt is running. Re-evaluate it against
    // the wait the attempt just installed instead of replaying it blindly. A
    // matching semantic observation wakes the task again; an unrelated stale
    // pulse is consumed. Explicit human/override triggers still bypass the wait.
    if (pendingTrigger && !triggerOverridesWait(pendingTrigger)) {
      delete tree.taskTriggers![task.id];
      applyProjectAppConditionEvent(tree, pendingTrigger);
    }
    syncTaskProjection(task, resource, claim.owner);
    refreshActiveTaskProjection(tree);
    pruneTaskAttempts(tree);
    saveTaskState(config, tree);
    const satisfiedTaskIds = actions.filter((action) => action.kind === "close-task").map((action) => action.taskId);
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
          .filter((candidate) => candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)))
          .map((candidate) => candidate.metadata.id),
      ]),
    ];
    return { status: "applied", actionsApplied, reconcileTaskIds };
  });
}

export function markProjectAppTaskAttention(
  config: TaskStateConfig,
  claim: ProjectAppTaskClaim,
  input: { summary: string; reason: string; evidence?: string[]; wakeParent?: boolean },
): { status: "applied" | "stale"; parentTaskId?: string } {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const match = matchingTask(tree, claim);
    if (!match) return { status: "stale" };
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
      evidence: [...(input.evidence ?? [])],
      conditionIds: [],
    });
    const parentTaskId =
      input.wakeParent === false
        ? undefined
        : recordExecutableParentTrigger(tree, task, "attention", input.summary, input.evidence, now);
    syncTaskProjection(task, resource, claim.owner);
    refreshActiveTaskProjection(tree);
    pruneTaskAttempts(tree);
    saveTaskState(config, tree);
    return { status: "applied", ...(parentTaskId ? { parentTaskId } : {}) };
  });
}
