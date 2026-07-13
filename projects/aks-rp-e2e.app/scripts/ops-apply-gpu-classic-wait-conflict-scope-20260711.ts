import { resolve } from "node:path";
import { taskTreeConfig, saveTaskTreeWithKanbanSnapshot } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const taskId = "wait-spec-gpu-classic-westus2-sku-support-family-return-20260704";
const removedScope = "spec:spec.gpu.skip-driver-install";
const attemptId =
  "a_ops_repair-gpu-classic-wait-conflict-scope-20260711_20260711120634";
const checkedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId];
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const beforeScopes = Array.isArray(task.conflict_scope)
    ? task.conflict_scope.filter((value): value is string => typeof value === "string")
    : [];
  const afterScopes = beforeScopes.filter((scope) => scope !== removedScope);
  const changed = afterScopes.length !== beforeScopes.length;

  if (!changed) {
    return {
      taskId,
      attemptId,
      changed,
      checkedAt,
      beforeScopes,
      afterScopes,
      goal: task.goal,
      blocker: task.blocker ?? null,
    };
  }

  task.conflict_scope = afterScopes;
  task.trace = {
    ...(task.trace ?? {}),
    gpu_classic_wait_conflict_scope_repaired_at: checkedAt,
    gpu_classic_wait_conflict_scope_repaired_by: "app-ops-script",
    gpu_classic_wait_conflict_scope_repair_attempt_id: attemptId,
    gpu_classic_wait_conflict_scope_removed: removedScope,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    taskId,
    attemptId,
    changed,
    checkedAt,
    beforeScopes,
    afterScopes,
    goal: task.goal,
    blocker: task.blocker ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
