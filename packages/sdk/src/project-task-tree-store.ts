import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type TaskNode = {
  id: string;
  parent_id?: string | null;
  status: string;
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
  blocker?: string;
  verification?: unknown;
  trace?: Record<string, unknown>;
};

export type TaskTree = {
  updated_at?: string;
  project_lifecycle?: string;
  root_task_id?: string;
  active_task_id?: string | null;
  active_task_ids?: string[];
  tasks: Record<string, TaskNode>;
};

export type TaskTreeConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  journalPath: string;
  worker: string;
  maxConcurrent: number;
};

function timeoutFromEnv(name: string, fallbackMs: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallbackMs;
}

export function taskEventSnapshot(task: TaskNode): Record<string, unknown> {
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? task.trace
      : {};
  return {
    taskId: task.id,
    task_id: task.id,
    parent_id: task.parent_id,
    status: task.status,
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

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is string => typeof item === "string" && Boolean(item),
    );
  if (typeof value === "string" && value) return [value];
  return [];
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function withTreeLock<T>(config: TaskTreeConfig, operation: () => T): T {
  const lockPath = `${config.treePath}.lock`;
  const waitMs = timeoutFromEnv("PROJECT_TREE_LOCK_WAIT_MS", 30_000);
  const staleMs = timeoutFromEnv("PROJECT_TREE_LOCK_STALE_MS", 2 * 60_000);
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
      if (Date.now() > deadline)
        throw new Error(`Timed out waiting for task tree lock: ${lockPath}`);
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
  return JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
}

export function saveTaskTree(config: TaskTreeConfig, tree: TaskTree): void {
  tree.updated_at = new Date().toISOString();
  ensureDir(dirname(config.treePath));
  const tempPath = `${config.treePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(tree, null, 2)}\n`, "utf-8");
  renameSync(tempPath, config.treePath);
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
  return normalizeStringArray(task.depends_on).every(
    (id) => tree.tasks[id]?.status === "accepted",
  );
}
