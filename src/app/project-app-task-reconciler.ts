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

export function completeProjectAppTask(
  config: TaskTreeConfig,
  claim: ProjectAppTaskClaim,
  input: { summary: string },
): "applied" | "stale" {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = matchingTask(tree, claim);
    if (!task) return "stale";
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
    return "applied";
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
