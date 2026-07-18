import { createHash, randomUUID } from "node:crypto";
import {
  ensureTaskTreeState,
  projectRuntimePaths,
  readTaskTree,
  saveTaskTree,
  setTaskState,
  taskRevision,
  taskState,
  withTreeLock,
  type ProjectAppTaskIntent,
  type ProjectAppTaskAction,
  type TaskNode,
  type TaskTree,
  type TaskTreeConfig,
} from "@may-agent/sdk";

export type ProjectAppTaskClaim = {
  kind: "claimed";
  taskId: string;
  generation: number;
  specHash: string;
  attemptId: string;
  owner: string;
  handler: string;
  mode: "achieve" | "maintain";
};

export type ProjectAppTaskClaimResult =
  | ProjectAppTaskClaim
  | { kind: "busy"; taskId: string; attemptId: string | null }
  | { kind: "completed"; taskId: string; generation: number };

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
    mirrorLegacyTree: false,
  };
}

function activeTaskIds(tree: TaskTree): string[] {
  return Object.values(tree.tasks)
    .filter((task) => taskState(task) === "active")
    .map((task) => task.id)
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

function reconciliationTrace(task: TaskNode): Record<string, unknown> {
  const value = task.trace?.reconciliation;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function currentAttempt(task: TaskNode): string | null {
  const value = reconciliationTrace(task).attemptId;
  return typeof value === "string" && value ? value : null;
}

function currentSpecHash(task: TaskNode): string {
  const value = reconciliationTrace(task).specHash;
  return typeof value === "string" ? value : "";
}

function validateIntent(intent: ProjectAppTaskIntent): void {
  if (!intent.id.trim()) throw new Error("Task reconciliation requires a non-empty task id");
  if (!intent.parentId.trim()) throw new Error(`Task ${intent.id} requires a parentId`);
  if (!intent.outcome.trim()) throw new Error(`Task ${intent.id} requires an outcome`);
  if (intent.acceptance.length === 0) throw new Error(`Task ${intent.id} requires acceptance criteria`);
}

function upsertTask(
  tree: TaskTree,
  intent: ProjectAppTaskIntent,
  generation: number,
  owner: string,
  specHash: string,
): TaskNode {
  const parent = tree.tasks[intent.parentId];
  if (!parent) throw new Error(`Task ${intent.id} parent does not exist: ${intent.parentId}`);

  const task = tree.tasks[intent.id] ?? {
    id: intent.id,
    parent_id: intent.parentId,
    children: [],
    state: "backlog",
  };
  task.revision = generation;
  task.parent_id = intent.parentId;
  task.goal = intent.outcome;
  task.acceptance = [...intent.acceptance];
  task.outputs = [...(intent.outputs ?? [])];
  task.depends_on = [...(intent.dependsOn ?? [])];
  task.priority = intent.priority ?? task.priority ?? "P2";
  task.owner = owner;
  task.workflow = intent.workflow;
  task.reconcile_mode = intent.mode;
  task.context = {
    ...(task.context ?? {}),
    reconciliation: {
      ...reconciliationTrace(task),
      specHash,
      input: intent.input ?? {},
      mode: intent.mode,
    },
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
  },
): ProjectAppTaskClaimResult {
  validateIntent(input.intent);
  const specHash = projectAppTaskSpecHash(input.intent);
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const tombstone = tree.completions?.[input.intent.id];
    if (tombstone && input.intent.mode === "achieve") {
      return { kind: "completed", taskId: input.intent.id, generation: tombstone.generation };
    }

    const existing = tree.tasks[input.intent.id];
    const existingAttempt = existing ? currentAttempt(existing) : null;
    if (existing && taskState(existing) === "active" && existingAttempt) {
      return { kind: "busy", taskId: existing.id, attemptId: existingAttempt };
    }

    const previousGeneration = existing
      ? taskRevision(existing)
      : tombstone && Number.isInteger(tombstone.generation)
        ? tombstone.generation
        : 0;
    const generation =
      existing && currentSpecHash(existing) === specHash ? previousGeneration : Math.max(1, previousGeneration + 1);
    const owner = resolvedOwner(tree, input.intent, input.appOwner);
    const handler = input.handler === "owner" ? `owner:${owner}` : input.handler;
    const task = upsertTask(tree, input.intent, generation, owner, specHash);
    const attemptId = `r_${generation}_${randomUUID()}`;
    const now = new Date().toISOString();
    setTaskState(task, "active");
    task.trace = {
      ...(task.trace ?? {}),
      reconciliation: {
        ...reconciliationTrace(task),
        specHash,
        input: input.intent.input ?? {},
        mode: input.intent.mode,
        phase: "running",
        observedGeneration: generation - 1,
        attemptId,
        handler,
        startedAt: now,
        reason: input.reason ?? "event",
      },
    };
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return {
      kind: "claimed",
      taskId: task.id,
      generation,
      specHash,
      attemptId,
      owner,
      handler,
      mode: input.intent.mode,
    };
  });
}

function matchingTask(tree: TaskTree, claim: ProjectAppTaskClaim): TaskNode | null {
  const task = tree.tasks[claim.taskId];
  if (!task) return null;
  const trace = reconciliationTrace(task);
  if (taskRevision(task) !== claim.generation) return null;
  if (trace.attemptId !== claim.attemptId) return null;
  if (trace.handler !== claim.handler) return null;
  return task;
}

function pruneCompletionTombstones(tree: TaskTree, limit = 1_000): void {
  const entries = Object.entries(tree.completions ?? {});
  if (entries.length <= limit) return;
  entries
    .sort(([, left], [, right]) => left.completedAt.localeCompare(right.completedAt))
    .slice(0, entries.length - limit)
    .forEach(([taskId]) => delete tree.completions?.[taskId]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} requires a non-empty string`);
  return value.trim();
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

function requireExpectedRevision(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} requires a non-negative expectedRevision`);
  }
}

function mutableActionTask(tree: TaskTree, action: Exclude<ProjectAppTaskAction, { kind: "create-task" }>): TaskNode {
  if (action.taskId.startsWith("runtime/")) {
    throw new Error(`Handler actions cannot mutate reconciler-owned task ${action.taskId}`);
  }
  const task = tree.tasks[action.taskId];
  if (!task) throw new Error(`Handler action task not found: ${action.taskId}`);
  const revision = taskRevision(task);
  if (revision !== action.expectedRevision) {
    throw new Error(
      `Handler action for ${action.taskId} is stale: expected revision ${action.expectedRevision}, current ${revision}`,
    );
  }
  return task;
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
      requireStringList(action.outputs, `Handler create action ${action.id} outputs`);
      requireStringList(action.acceptance, `Handler create action ${action.id} acceptance`);
      if (action.priority !== undefined && !["P0", "P1", "P2", "P3"].includes(action.priority)) {
        throw new Error(`Handler create action ${action.id} has an invalid priority`);
      }
      if (action.owner !== undefined) requireNonEmptyString(action.owner, `Handler create action ${action.id} owner`);
      if (action.workflow !== undefined) {
        requireNonEmptyString(action.workflow, `Handler create action ${action.id} workflow`);
      }
      if (action.id.startsWith("runtime/")) {
        throw new Error("Handler actions cannot create reconciler-owned runtime tasks");
      }
      if (tree.tasks[action.id]) throw new Error(`Handler action task already exists: ${action.id}`);
      if (!tree.tasks[action.parentId]) throw new Error(`Handler action parent not found: ${action.parentId}`);
      continue;
    }

    requireExpectedRevision(action.expectedRevision, `Handler ${action.kind} action ${action.taskId}`);
    mutableActionTask(tree, action);
    if (
      action.kind === "update-task" &&
      action.goal === undefined &&
      action.outputs === undefined &&
      action.acceptance === undefined
    ) {
      throw new Error(`Handler update for ${action.taskId} contains no change`);
    }
    if (action.kind === "update-task" && action.goal !== undefined) {
      requireNonEmptyString(action.goal, `Handler update for ${action.taskId} goal`);
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
      if (taskState(mutableActionTask(tree, action)) !== "blocked") {
        throw new Error(`Handler action task ${action.taskId} is not blocked`);
      }
    }
  }
}

function validateConditions(
  conditions: Array<Record<string, unknown>> | undefined,
  input: { required: boolean; taskId: string },
): void {
  if (input.required && !conditions?.length) {
    throw new Error(`Waiting result for ${input.taskId} requires at least one exact Condition`);
  }
  for (const condition of (conditions ?? []) as unknown[]) {
    if (!isRecord(condition)) {
      throw new Error(`Handler result for ${input.taskId} contains a non-object Condition`);
    }
    const id = condition.id ?? condition.conditionId;
    requireNonEmptyString(id, `Handler result Condition for ${input.taskId} identity`);
  }
}

function validateActionEvidence(taskId: string, evidence: string[] | undefined, actionCount: number): void {
  if (actionCount > 0 && !evidence?.some((entry) => typeof entry === "string" && entry.trim())) {
    throw new Error(`Handler actions for ${taskId} require non-empty evidence`);
  }
}

function applyTaskActions(tree: TaskTree, claim: ProjectAppTaskClaim, actions: ProjectAppTaskAction[]): string[] {
  validateTaskActions(tree, actions);
  const now = new Date().toISOString();
  const applied: string[] = [];
  for (const action of actions) {
    switch (action.kind) {
      case "create-task": {
        const parent = tree.tasks[action.parentId];
        const task: TaskNode = {
          id: action.id,
          revision: 0,
          parent_id: action.parentId,
          state: "backlog",
          kind: "domain_leaf",
          priority: action.priority ?? "P2",
          owner: action.owner ?? claim.owner,
          workflow: action.workflow,
          children: [],
          goal: action.goal.trim(),
          inputs: [],
          outputs: [...action.outputs],
          acceptance: [...action.acceptance],
          forbidden: [],
          trace: {
            created_at: now,
            created_by: "project-app-task-reconciler",
            source_task_id: claim.taskId,
            source_task_generation: claim.generation,
          },
        };
        setTaskState(task, "backlog");
        tree.tasks[task.id] = task;
        parent.children = [...new Set([...(parent.children ?? []), task.id])];
        applied.push(`created ${task.id}`);
        break;
      }
      case "update-task": {
        const task = tree.tasks[action.taskId];
        if (action.goal !== undefined) task.goal = action.goal.trim();
        if (action.outputs !== undefined) task.outputs = [...action.outputs];
        if (action.acceptance !== undefined) task.acceptance = [...action.acceptance];
        task.revision = taskRevision(task) + 1;
        task.trace = {
          ...(task.trace ?? {}),
          updated_at: now,
          updated_by: "project-app-task-reconciler",
          source_task_id: claim.taskId,
          source_task_generation: claim.generation,
        };
        applied.push(`updated ${task.id}`);
        break;
      }
      case "close-task": {
        const task = tree.tasks[action.taskId];
        setTaskState(task, "done");
        task.blocker = undefined;
        task.resolution = task.resolution ?? "completed";
        task.done_at = now;
        task.done_by = "project-app-task-reconciler";
        task.context = {
          ...(task.context ?? {}),
          acceptance_note: action.summary.trim(),
        };
        task.trace = {
          ...(task.trace ?? {}),
          reviewed_at: now,
          reviewed_by: "project-app-task-reconciler",
          review_summary: action.summary.trim(),
          source_task_id: claim.taskId,
          source_task_generation: claim.generation,
        };
        applied.push(`closed ${task.id}`);
        break;
      }
      case "unblock-task": {
        const task = tree.tasks[action.taskId];
        setTaskState(task, "backlog");
        task.blocker = undefined;
        task.revision = taskRevision(task) + 1;
        task.trace = {
          ...(task.trace ?? {}),
          unblocked_at: now,
          unblocked_by: "project-app-task-reconciler",
          unblock_reason: action.reason.trim(),
          source_task_id: claim.taskId,
          source_task_generation: claim.generation,
        };
        applied.push(`unblocked ${task.id}`);
        break;
      }
    }
  }
  return applied;
}

export function completeProjectAppTask(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: { summary: string; evidence?: string[]; actions?: ProjectAppTaskAction[] },
): { status: "applied" | "stale"; actionsApplied: string[] } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = matchingTask(tree, claim);
    if (!task) return { status: "stale", actionsApplied: [] };
    validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
    const actionsApplied = applyTaskActions(tree, claim, input.actions ?? []);
    const now = new Date().toISOString();
    if (claim.mode === "maintain") {
      setTaskState(task, "backlog");
      task.summary = input.summary;
      task.trace = {
        ...(task.trace ?? {}),
        reconciliation: {
          ...reconciliationTrace(task),
          phase: "converged",
          observedGeneration: claim.generation,
          attemptId: undefined,
          completedAt: now,
          summary: input.summary,
          evidence: input.evidence ?? [],
          actionsApplied,
        },
      };
    } else {
      tree.completions = {
        ...(tree.completions ?? {}),
        [task.id]: {
          taskId: task.id,
          generation: claim.generation,
          specHash: claim.specHash,
          handler: claim.handler,
          summary: input.summary,
          completedAt: now,
        },
      };
      const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
      if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
      delete tree.tasks[task.id];
      pruneCompletionTombstones(tree);
    }
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return { status: "applied", actionsApplied };
  });
}

export function deferProjectAppTask(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: {
    disposition: "progressing" | "waiting";
    summary: string;
    evidence?: string[];
    actions?: ProjectAppTaskAction[];
    conditions?: Array<Record<string, unknown>>;
  },
): { status: "applied" | "stale"; actionsApplied: string[] } {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = matchingTask(tree, claim);
    if (!task) return { status: "stale", actionsApplied: [] };
    validateConditions(input.conditions, { required: input.disposition === "waiting", taskId: claim.taskId });
    validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
    const actionsApplied = applyTaskActions(tree, claim, input.actions ?? []);
    const now = new Date().toISOString();
    setTaskState(task, input.disposition === "waiting" ? "blocked" : "backlog");
    if (input.disposition === "waiting") {
      const condition = input.conditions![0];
      const conditionId =
        typeof condition.id === "string"
          ? condition.id
          : typeof condition.conditionId === "string"
            ? condition.conditionId
            : undefined;
      task.blocker = {
        condition: conditionId ?? "exact reconciliation Condition",
        condition_id: conditionId,
        waiting_for: condition,
        blocked_at: now,
      };
    } else {
      task.blocker = undefined;
    }
    task.summary = input.summary;
    task.trace = {
      ...(task.trace ?? {}),
      reconciliation: {
        ...reconciliationTrace(task),
        phase: input.disposition,
        observedGeneration: claim.generation,
        attemptId: undefined,
        completedAt: now,
        summary: input.summary,
        evidence: input.evidence ?? [],
        actionsApplied,
        conditions: input.conditions ?? [],
      },
    };
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return { status: "applied", actionsApplied };
  });
}

export function markProjectAppTaskAttention(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: { summary: string; reason: string },
): "applied" | "stale" {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = matchingTask(tree, claim);
    if (!task) return "stale";
    const now = new Date().toISOString();
    setTaskState(task, "review");
    task.summary = input.summary;
    task.trace = {
      ...(task.trace ?? {}),
      reconciliation: {
        ...reconciliationTrace(task),
        phase: "attention",
        observedGeneration: claim.generation,
        attemptId: undefined,
        failedHandler: claim.handler,
        failedAt: now,
        failureReason: input.reason,
        summary: input.summary,
      },
    };
    refreshActiveTaskProjection(tree);
    saveTaskTree(config, tree);
    return "applied";
  });
}
