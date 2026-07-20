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
  tasks: Record<string, TaskNode>;
};

export type TaskTreeConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
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

export function withTreeLock<T>(config: TaskTreeConfig, operation: () => T): T {
  const lockPath = `${config.treePath}.lock`;
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
      if (Date.now() > deadline) throw new Error(`Timed out waiting for task tree lock: ${lockPath}`);
      sleepSync(50);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function readTaskTree(config: TaskTreeConfig): TaskTree {
  const retryMs = timeoutFromAnyEnv(["PROJECT_TREE_READ_RETRY_MS", "AKS_RP_E2E_TREE_READ_RETRY_MS"], 250);
  const deadline = Date.now() + retryMs;

  while (true) {
    try {
      const tree = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
      normalizeTaskTreeInPlace(tree);
      return tree;
    } catch (error) {
      if (!isRetryableTaskTreeReadError(error) || Date.now() >= deadline) {
        throw error;
      }
      sleepSync(10);
    }
  }
}

export type SaveTaskTreeOptions = {
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

function appendTaskTreeJournal(config: TaskTreeConfig, entry: Record<string, unknown>): void {
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
  config: TaskTreeConfig,
  current: TaskTree,
  next: TaskTree,
  options?: SaveTaskTreeOptions,
): void {
  const currentLifecycle = normalizedLifecycle(current.project_lifecycle);
  const nextLifecycle = normalizedLifecycle(next.project_lifecycle);
  if (currentLifecycle !== nextLifecycle && !options?.projectLifecycleReason?.trim()) {
    throw new Error(
      `saveTaskTree lifecycle guard: refusing to change project ${config.projectDir} ` +
        `from ${currentLifecycle || "unset"} to ${nextLifecycle || "unset"} without an explicit reason.`,
    );
  }
}

export function saveTaskTree(config: TaskTreeConfig, tree: TaskTree, options?: SaveTaskTreeOptions): void {
  normalizeTaskTreeInPlace(tree);

  let existingTree: TaskTree | null = null;
  if (existsSync(config.treePath)) {
    try {
      existingTree = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
      normalizeTaskTreeInPlace(existingTree);
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
  if (!options?.allowShrinkage && existsSync(config.treePath)) {
    try {
      const existing = existingTree as {
        tasks?: Record<string, unknown> | unknown[];
      } | null;
      if (!existing) throw new Error("existing task tree is unavailable");
      const existingCount = Array.isArray(existing.tasks)
        ? existing.tasks.length
        : typeof existing.tasks === "object" && existing.tasks !== null
          ? Object.keys(existing.tasks).length
          : 0;
      const newCount = Object.keys(tree.tasks ?? {}).length;
      // Only guard when existing tree has enough tasks to be meaningful (>=5)
      // and the new tree drops by more than 80%.
      if (existingCount >= 5 && newCount < existingCount * 0.2) {
        throw new Error(
          `saveTaskTree shrinkage guard: refusing to overwrite ${existingCount} tasks with ${newCount} tasks ` +
            `(${Math.round((1 - newCount / existingCount) * 100)}% reduction). ` +
            `Pass { allowShrinkage: true } to override if this is intentional.`,
        );
      }
    } catch (e) {
      // Re-throw shrinkage guard errors; swallow file read/parse errors
      if (e instanceof Error && e.message.startsWith("saveTaskTree shrinkage guard")) throw e;
    }
  }

  tree.updated_at = new Date().toISOString();
  const serialized = `${JSON.stringify(canonicalTaskTreeForWrite(tree), null, 2)}\n`;
  ensureDir(dirname(config.treePath));
  const tempPath = `${config.treePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, serialized, "utf-8");
  renameSync(tempPath, config.treePath);

  const runtimePaths = projectRuntimePaths(config.appDir);
  if (config.treePath === runtimePaths.taskStatePath) {
    const projectionPath = runtimePaths.taskTreePath;
    const projectionTempPath = `${projectionPath}.${process.pid}.${Date.now()}.tmp`;
    ensureDir(dirname(projectionPath));
    writeFileSync(projectionTempPath, serialized, "utf-8");
    renameSync(projectionTempPath, projectionPath);
  }

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

export function setProjectLifecycle(config: TaskTreeConfig, lifecycle: string, reason: string): void {
  const nextLifecycle = normalizedLifecycle(lifecycle);
  const transitionReason = reason.trim();
  if (!nextLifecycle) throw new Error("Project lifecycle must not be empty");
  if (!transitionReason) throw new Error("Project lifecycle change requires a reason");

  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    if (normalizedLifecycle(tree.project_lifecycle) === nextLifecycle) return;
    tree.project_lifecycle = nextLifecycle;
    saveTaskTree(config, tree, { projectLifecycleReason: transitionReason });
  });
}

export function normalizeTaskTreeInPlace(tree: TaskTree): TaskTree {
  const liveTaskIds = new Set(Object.keys(tree.tasks ?? {}));
  for (const task of Object.values(tree.tasks ?? {})) {
    task.state ??= "backlog";
    if (task.children === undefined) {
      task.children = [];
      continue;
    }
    task.children = normalizeStringArray(task.children).filter((childId) => liveTaskIds.has(childId));
  }
  return tree;
}

function canonicalTaskTreeForWrite(tree: TaskTree): TaskTree {
  return JSON.parse(JSON.stringify(tree)) as TaskTree;
}

export function isLeaf(task: TaskNode): boolean {
  return normalizeStringArray(task.children).length === 0;
}
