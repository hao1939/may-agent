import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type {
  ProjectAppCondition,
  ProjectAppTaskAcceptanceBasis,
  ProjectAppTaskAttempt,
  ProjectAppTaskResource,
  ProjectAppTaskTrigger,
} from "./project-app.js";
import { projectRuntimePaths } from "./project-runtime-state.js";

export type TaskNode = {
  id: string;
  revision?: number;
  parent_id?: string | null;
  state?: string;
  kind?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  conflict_scope?: string[] | string;
  goal?: string;
  children?: string[];
  depends_on?: string[] | string;
  inputs?: string[];
  outputs?: string[];
  acceptance?: string[];
  forbidden?: string[];
  context?: Record<string, unknown>;
  context_ref?: string;
  summary?: string;
  rollup_summary?: string;
  strategy_context?: string;
  progress?: Record<string, unknown>;
  result?: string;
  evidence?: string[];
  verification?: unknown;
  trace?: Record<string, unknown>;
  resolution?: string;
  replaced_by?: string[];
  done_at?: string;
  done_by?: string;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  reconcile_mode?: "achieve" | "maintain";
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
  handler: string;
  summary: string;
  evidence: string[];
  acceptanceBasis: ProjectAppTaskAcceptanceBasis;
  failureFingerprints: string[];
  completedAt: string;
};

export type TaskTree = {
  updated_at?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  active_task_id?: string | null;
  active_task_ids?: string[];
  conditions?: Record<string, ProjectAppCondition>;
  resources?: Record<string, ProjectAppTaskResource>;
  attempts?: Record<string, ProjectAppTaskAttempt>;
  taskTriggers?: Record<string, ProjectAppTaskTrigger>;
  receipts?: Record<string, TaskCompletionReceipt>;
  /** Structural labels/containers only. Executable task nodes are projected from resources. */
  groups?: Record<string, TaskNode>;
  tasks: Record<string, TaskNode>;
};

export type TaskStateConfig = {
  appDir: string;
  projectDir: string;
  statePath: string;
  journalPath: string;
  worker: string;
  maxConcurrent: number;
  mutationAuthority?: unknown;
  validateMutation?: (input: { current: TaskTree; next: TaskTree; authority?: unknown }) => void;
};

function timeoutFromAnyEnv(names: string[], fallbackMs: number): number {
  for (const name of names) {
    const value = Number(process.env[name]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallbackMs;
}

export function taskState(task: TaskNode | undefined): string {
  return task?.state ?? "backlog";
}

export function taskRevision(task: TaskNode | undefined): number {
  const value = task?.revision;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof value === "string" && value) return [value];
  return [];
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isRetryableTaskTreeReadError(error: unknown): boolean {
  if (error instanceof SyntaxError) return true;
  if (!(error instanceof Error)) return false;
  return error.message.includes("ENOENT") || error.message.includes("EAGAIN");
}

export function withTaskStateLock<T>(config: TaskStateConfig, operation: () => T): T {
  const lockPath = `${config.statePath}.lock`;
  const waitMs = timeoutFromAnyEnv(["PROJECT_TREE_LOCK_WAIT_MS", "AKS_RP_E2E_TREE_LOCK_WAIT_MS"], 30_000);
  const staleMs = timeoutFromAnyEnv(["PROJECT_TREE_LOCK_STALE_MS", "AKS_RP_E2E_TREE_LOCK_STALE_MS"], 2 * 60_000);
  const deadline = Date.now() + waitMs;
  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > staleMs) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Retry until the deadline.
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for task state lock: ${lockPath}`);
      sleepSync(50);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function readTaskState(config: TaskStateConfig): TaskTree {
  const canonicalPath = projectRuntimePaths(config.appDir).taskStatePath;
  if (config.statePath !== canonicalPath) {
    throw new Error(`Task state must be read from canonical state.json: ${canonicalPath}`);
  }
  const retryMs = timeoutFromAnyEnv(["PROJECT_TREE_READ_RETRY_MS", "AKS_RP_E2E_TREE_READ_RETRY_MS"], 250);
  const deadline = Date.now() + retryMs;

  while (true) {
    try {
      const tree = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
      normalizeTaskStateInPlace(tree);
      return tree;
    } catch (error) {
      if (!isRetryableTaskTreeReadError(error) || Date.now() >= deadline) {
        throw error;
      }
      sleepSync(10);
    }
  }
}

export type SaveTaskStateOptions = {
  /** Set to true to bypass the shrinkage guard (e.g. intentional tree reset). */
  allowShrinkage?: boolean;
  /**
   * Required for every explicit project lifecycle transition. Normal task-tree
   * saves must preserve lifecycle; they cannot silently pause or resume an app.
   */
  projectLifecycleReason?: string;
};

function normalizedLifecycle(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function appendTaskTreeJournal(config: TaskStateConfig, entry: Record<string, unknown>): void {
  ensureDir(dirname(config.journalPath));
  appendFileSync(
    config.journalPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      actor: config.worker,
      ...entry,
    })}\n`,
    "utf-8",
  );
}

function validateLifecycleTransition(
  config: TaskStateConfig,
  current: TaskTree,
  next: TaskTree,
  options?: SaveTaskStateOptions,
): void {
  const currentLifecycle = normalizedLifecycle(current.project_lifecycle);
  const nextLifecycle = normalizedLifecycle(next.project_lifecycle);
  if (currentLifecycle !== nextLifecycle && !options?.projectLifecycleReason?.trim()) {
    throw new Error(
      `saveTaskState lifecycle guard: refusing to change project ${config.projectDir} ` +
        `from ${currentLifecycle || "unset"} to ${nextLifecycle || "unset"} without an explicit reason.`,
    );
  }
}

export function saveTaskState(config: TaskStateConfig, tree: TaskTree, options?: SaveTaskStateOptions): void {
  const runtimePaths = projectRuntimePaths(config.appDir);
  if (config.statePath !== runtimePaths.taskStatePath) {
    throw new Error(`Task state must be written to canonical state.json: ${runtimePaths.taskStatePath}`);
  }
  normalizeTaskStateInPlace(tree);

  let existingTree: TaskTree | null = null;
  if (existsSync(config.statePath)) {
    try {
      existingTree = JSON.parse(readFileSync(config.statePath, "utf-8")) as TaskTree;
      normalizeTaskStateInPlace(existingTree);
    } catch {
      existingTree = null;
    }
  }

  if (existingTree && config.validateMutation) {
    config.validateMutation({
      current: existingTree,
      next: tree,
      authority: config.mutationAuthority,
    });
  }

  if (existingTree) {
    validateLifecycleTransition(config, existingTree, tree, options);
  }

  // Shrinkage guard: reject writes that reduce task count by >80%.
  // This prevents agent-caused data loss from whole-file overwrites.
  if (!options?.allowShrinkage && existsSync(config.statePath)) {
    try {
      const existing = existingTree;
      if (!existing) throw new Error("existing task tree is unavailable");
      const existingCount = Object.keys(existing.groups ?? {}).length + Object.keys(existing.resources ?? {}).length;
      const newCount = Object.keys(tree.groups ?? {}).length + Object.keys(tree.resources ?? {}).length;
      // Only guard when existing tree has enough tasks to be meaningful (>=5)
      // and the new tree drops by more than 80%.
      if (existingCount >= 5 && newCount < existingCount * 0.2) {
        throw new Error(
          `saveTaskState shrinkage guard: refusing to overwrite ${existingCount} tasks with ${newCount} tasks ` +
            `(${Math.round((1 - newCount / existingCount) * 100)}% reduction). ` +
            `Pass { allowShrinkage: true } to override if this is intentional.`,
        );
      }
    } catch (e) {
      // Re-throw shrinkage guard errors; swallow file read/parse errors
      if (e instanceof Error && e.message.startsWith("saveTaskState shrinkage guard")) throw e;
    }
  }

  tree.updated_at = new Date().toISOString();
  const serialized = `${JSON.stringify(canonicalTaskStateForWrite(tree), null, 2)}\n`;
  ensureDir(dirname(config.statePath));
  const tempPath = `${config.statePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, serialized, "utf-8");
  renameSync(tempPath, config.statePath);

  const projectionPath = runtimePaths.taskTreePath;
  const projectionTempPath = `${projectionPath}.${process.pid}.${Date.now()}.tmp`;
  ensureDir(dirname(projectionPath));
  writeFileSync(projectionTempPath, `${JSON.stringify(taskTreeProjectionForWrite(tree), null, 2)}\n`, "utf-8");
  renameSync(projectionTempPath, projectionPath);

  if (
    existingTree &&
    normalizedLifecycle(existingTree.project_lifecycle) !== normalizedLifecycle(tree.project_lifecycle)
  ) {
    const from = normalizedLifecycle(existingTree.project_lifecycle);
    const to = normalizedLifecycle(tree.project_lifecycle);
    appendTaskTreeJournal(config, {
      kind:
        to === "paused"
          ? "project_lifecycle_paused"
          : to === "active"
            ? "project_lifecycle_resumed"
            : "project_lifecycle_changed",
      from: from || null,
      to: to || null,
      reason: options?.projectLifecycleReason?.trim(),
    });
  }
}

export function setProjectLifecycle(config: TaskStateConfig, lifecycle: string, reason: string): void {
  const nextLifecycle = normalizedLifecycle(lifecycle);
  const transitionReason = reason.trim();
  if (!nextLifecycle) throw new Error("Project lifecycle must not be empty");
  if (!transitionReason) throw new Error("Project lifecycle change requires a reason");

  withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    if (normalizedLifecycle(tree.project_lifecycle) === nextLifecycle) return;
    tree.project_lifecycle = nextLifecycle;
    saveTaskState(config, tree, { projectLifecycleReason: transitionReason });
  });
}

export function normalizeTaskStateInPlace(tree: TaskTree): TaskTree {
  const resources = tree.resources ?? {};
  const groups: Record<string, TaskNode> = Object.fromEntries(
    Object.entries(tree.groups ?? {}).map(([id, group]) => {
      const { children: _derivedChildren, ...structural } = group;
      return [id, { ...structural, id }];
    }),
  );
  tree.groups = groups;
  tree.tasks = buildTaskTreeProjection(groups, resources);
  tree.active_task_ids = Object.values(resources)
    .filter((resource) => resource.status.phase === "running")
    .map((resource) => resource.metadata.id)
    .sort();
  tree.active_task_id = tree.active_task_ids[0] ?? null;
  tree.root_task_id ??= Object.values(groups).find((group) => group.parent_id === null)?.id;
  return tree;
}

function projectedTaskState(resource: ProjectAppTaskResource): string {
  switch (resource.status.phase) {
    case "running":
      return "active";
    case "waiting":
      return "blocked";
    case "attention":
      return "review";
    default:
      return "backlog";
  }
}

function buildTaskTreeProjection(
  groups: Record<string, TaskNode>,
  resources: Record<string, ProjectAppTaskResource>,
): Record<string, TaskNode> {
  const tasks: Record<string, TaskNode> = {};
  for (const [id, group] of Object.entries(groups)) {
    tasks[id] = { ...group, id, state: group.state ?? "backlog", children: [] };
  }

  const inheritedOwner = (resource: ProjectAppTaskResource): string | undefined => {
    if (resource.spec.owner?.trim()) return resource.spec.owner.trim();
    let parentId: string | undefined = resource.spec.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parentResource: ProjectAppTaskResource | undefined = resources[parentId];
      if (parentResource?.spec.owner?.trim()) return parentResource.spec.owner.trim();
      if (parentResource) {
        parentId = parentResource.spec.parentId;
        continue;
      }
      const group: TaskNode | undefined = groups[parentId];
      if (group?.owner?.trim()) return group.owner.trim();
      parentId = group?.parent_id ?? undefined;
    }
    return undefined;
  };

  for (const resource of Object.values(resources)) {
    const { spec, status, metadata } = resource;
    tasks[metadata.id] = {
      id: metadata.id,
      revision: metadata.generation,
      parent_id: spec.parentId,
      state: projectedTaskState(resource),
      ...(spec.category ? { kind: spec.category } : {}),
      priority: spec.priority ?? "P2",
      ...(inheritedOwner(resource) ? { owner: inheritedOwner(resource) } : {}),
      ...(spec.workflow ? { workflow: spec.workflow } : {}),
      goal: spec.outcome,
      children: [],
      depends_on: [...(spec.dependsOn ?? [])],
      outputs: [...(spec.outputs ?? [])],
      acceptance: [...spec.acceptance],
      ...(status.summary ? { summary: status.summary } : {}),
      ...(status.evidence ? { evidence: [...status.evidence] } : {}),
      reconcile_mode: spec.mode,
    };
  }

  for (const task of Object.values(tasks)) {
    const parent = task.parent_id ? tasks[task.parent_id] : undefined;
    if (parent) parent.children = [...(parent.children ?? []), task.id];
  }
  for (const task of Object.values(tasks)) task.children = [...new Set(task.children ?? [])].sort();
  return tasks;
}

function canonicalTaskStateForWrite(tree: TaskTree): Record<string, unknown> {
  const state = JSON.parse(JSON.stringify(tree)) as Record<string, unknown>;
  delete state.tasks;
  delete state.active_task_id;
  delete state.active_task_ids;
  return state;
}

function taskTreeProjectionForWrite(tree: TaskTree): TaskTree {
  const projection = JSON.parse(JSON.stringify(tree)) as TaskTree;
  delete projection.groups;
  return projection;
}

export function isLeaf(task: TaskNode): boolean {
  return normalizeStringArray(task.children).length === 0;
}
