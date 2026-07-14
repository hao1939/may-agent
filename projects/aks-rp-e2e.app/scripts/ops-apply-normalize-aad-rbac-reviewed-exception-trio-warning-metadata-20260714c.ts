import { resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const worker = process.env.WORKER ?? "app-ops";
const taskId = "hold-compact-aad-rbac-reviewed-exception-trio-frontier";
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId] as TaskNode | undefined;
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (!task.blocker || typeof task.blocker !== "object" || Array.isArray(task.blocker)) {
    throw new Error(`Task blocker is missing or invalid: ${taskId}`);
  }

  const blocker = task.blocker as Record<string, unknown>;
  const waitingFor =
    blocker.waiting_for &&
    typeof blocker.waiting_for === "object" &&
    !Array.isArray(blocker.waiting_for)
      ? { ...(blocker.waiting_for as Record<string, unknown>) }
      : {};

  blocker.waiting_for = {
    ...waitingFor,
    type: "compact.frontier.changed",
    taskId,
    featureKey: "aad-rbac",
    errorClass: "reviewed-exception",
    scope: "feature-compact",
  };

  task.conflict_scope = unique([
    ...(Array.isArray(task.conflict_scope) ? task.conflict_scope : []),
    "feature-compact:aad-rbac",
    "feature:aad-rbac",
    "feature-compact-wait:reviewed-exception",
  ]);

  const existingContext =
    task.context && typeof task.context === "object" && !Array.isArray(task.context)
      ? (task.context as Record<string, unknown>)
      : {};
  task.context = {
    ...existingContext,
    featureCompactExactWait: true,
    featureKey: "aad-rbac",
    errorClass: "reviewed-exception",
    stateRef: ".state/feature-compact-loop/state.json",
    target: "staging",
    branch: "dev",
  };

  const now = new Date().toISOString();
  task.trace = {
    ...(task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? task.trace
      : {}),
    blocked_warning_metadata_normalized_at: now,
    blocked_warning_metadata_normalized_by: worker,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    taskId,
    waitingFor: blocker.waiting_for,
    conflict_scope: task.conflict_scope,
    context: task.context,
    trace: task.trace,
  };
});

console.log(JSON.stringify(result, null, 2));
