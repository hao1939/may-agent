import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { projectRuntimePaths } from "./project-runtime-state.js";

export type TaskBlocker =
  | string
  | {
      condition?: string;
      category?: string;
      owner?: string;
      resume_condition?: string;
      resume_at?: string;
      resumeCondition?: string;
      resumeAt?: string;
      blocked_at?: string;
      blockedAt?: string;
      waiting_for?: Record<string, unknown>;
      waitingFor?: Record<string, unknown>;
      observed_by?: Record<string, unknown>;
      observedBy?: Record<string, unknown>;
      observation_method?: string;
      observationMethod?: string;
      next_check_at?: string;
      nextCheckAt?: string;
      fallback_at?: string;
      fallbackAt?: string;
      fallback_action?: string;
      fallbackAction?: string;
      condition_id?: string;
      conditionId?: string;
      last_observed_at?: string;
      lastObservedAt?: string;
      last_observed_status?: string;
      lastObservedStatus?: string;
    };

export type TaskNode = {
  id: string;
  revision?: number;
  parent_id?: string | null;
  state?: string;
  status?: string;
  kind?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  session_id?: string;
  session_history?: string[];
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
  blocker?: TaskBlocker;
  verification?: unknown;
  trace?: Record<string, unknown>;
  resolution?: string;
  replaced_by?: string[];
  done_at?: string;
  done_by?: string;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
  archive_summary?: string;
  tags?: string[];
};

export type TaskTree = {
  updated_at?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  active_task_id?: string | null;
  active_task_ids?: string[];
  conditions?: Record<string, unknown>;
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

export function taskEventSnapshot(task: TaskNode): Record<string, unknown> {
  const trace = task.trace && typeof task.trace === "object" && !Array.isArray(task.trace) ? task.trace : {};
  return {
    taskId: task.id,
    taskRevision: taskRevision(task),
    task_revision: taskRevision(task),
    parent_id: task.parent_id,
    state: taskState(task),
    kind: task.kind,
    priority: task.priority,
    owner: task.owner,
    workflow: task.workflow,
    session_id: task.session_id,
    goal: task.goal,
    inputs: normalizeStringArray(task.inputs),
    outputs: normalizeStringArray(task.outputs),
    acceptance: normalizeStringArray(task.acceptance),
    forbidden: normalizeStringArray(task.forbidden),
    depends_on: normalizeStringArray(task.depends_on),
    conflict_scope: normalizeStringArray(task.conflict_scope),
    context: task.context,
    blocker: task.blocker,
    verification: task.verification,
    result: trace.last_worker_result ?? trace.last_worker_claim,
    claim: trace.last_worker_claim,
    summary: trace.last_worker_summary,
    evidence: trace.last_worker_evidence,
    completed_at: trace.last_worker_completed_at,
  };
}

export function taskState(task: TaskNode | undefined): string {
  const raw = task?.state ?? task?.status ?? "backlog";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw;
}

export function taskRevision(task: TaskNode | undefined): number {
  const value = task?.revision;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function rawTaskState(task: TaskNode | undefined): string {
  return String(task?.state ?? task?.status ?? "");
}

function installLegacyStatusAlias(task: TaskNode): void {
  const descriptor = Object.getOwnPropertyDescriptor(task, "status");
  if (descriptor?.get && descriptor?.set && descriptor.enumerable === false) return;
  delete task.status;
  Object.defineProperty(task, "status", {
    configurable: true,
    enumerable: false,
    get: () => task.state,
    set: (value: string | undefined) => {
      task.state = value;
    },
  });
}

export function setTaskState(task: TaskNode, state: string): void {
  task.state = state;
  installLegacyStatusAlias(task);
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof value === "string" && value) return [value];
  return [];
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
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
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

export function readTaskTree(config: TaskTreeConfig): TaskTree {
  const tree = JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
  normalizeTaskTreeInPlace(tree);
  return tree;
}

export type SaveTaskTreeOptions = {
  /** Set to true to bypass the shrinkage guard (e.g. intentional tree reset). */
  allowShrinkage?: boolean;
};

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

  const runtimeTreePath = projectRuntimePaths(config.appDir).taskTreePath;
  if (config.treePath === runtimeTreePath) {
    const legacyPath = join(config.appDir, "tasks", "tree.json");
    ensureDir(dirname(legacyPath));
    writeFileSync(legacyPath, serialized, "utf-8");
  }
}

function normalizeLegacyState(raw: string): string {
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw || "backlog";
}

export function normalizeTaskTreeInPlace(tree: TaskTree): TaskTree {
  const rawTasks = (tree as unknown as { tasks?: unknown }).tasks;
  if (Array.isArray(rawTasks)) {
    const tasks: Record<string, TaskNode> = {};
    for (const rawTask of rawTasks) {
      if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) continue;
      const task = rawTask as TaskNode;
      if (!task.id) continue;
      tasks[task.id] = task;
    }
    tree.tasks = tasks;
  }
  for (const task of Object.values(tree.tasks ?? {})) {
    const raw = String(task.state ?? task.status ?? "");
    const state = normalizeLegacyState(raw);
    task.state = state;
    installLegacyStatusAlias(task);
    if (raw === "accepted") {
      task.resolution = task.resolution ?? "completed";
      const record = task as Record<string, unknown>;
      if (record.accepted_at && !record.done_at) record.done_at = record.accepted_at;
      if (record.accepted_by && !record.done_by) record.done_by = record.accepted_by;
    } else if (raw === "superseded") {
      task.resolution = task.resolution ?? "replaced";
      const record = task as Record<string, unknown>;
      if (!record.replaced_by && record.supersededBy) record.replaced_by = record.supersededBy;
    } else if (raw === "cancelled") {
      task.resolution = task.resolution ?? "cancelled";
    }
    if (task.children === undefined) task.children = [];
  }
  return tree;
}

function canonicalTaskTreeForWrite(tree: TaskTree): TaskTree {
  const copy = JSON.parse(JSON.stringify(tree)) as TaskTree;
  for (const task of Object.values(copy.tasks ?? {})) {
    const state = normalizeLegacyState(String(task.state ?? task.status ?? ""));
    task.state = state;
    delete task.status;
  }
  return copy;
}

export function isLeaf(task: TaskNode): boolean {
  return normalizeStringArray(task.children).length === 0;
}

export function isClearEnough(task: TaskNode): boolean {
  return (
    Boolean((task.goal ?? "").trim()) &&
    normalizeStringArray(task.acceptance).length > 0 &&
    normalizeStringArray(task.outputs).length > 0
  );
}

export function dependenciesSatisfied(tree: TaskTree, task: TaskNode): boolean {
  return normalizeStringArray(task.depends_on).every((id) => taskState(tree.tasks[id]) === "done");
}
