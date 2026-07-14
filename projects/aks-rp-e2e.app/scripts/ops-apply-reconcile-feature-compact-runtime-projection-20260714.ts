import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { reconcileFeatureCompactRuntimeProjection } from "../workflows/lib/feature-compact-runtime-projection.ts";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "defender-profile";
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const loaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const state = loaded.state;

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);

  const repair = reconcileFeatureCompactRuntimeProjection({
    loopTask,
    tasks: tree.tasks,
    state,
  });

  saveTaskTreeWithKanbanSnapshot(config, tree);
  saveFeatureCompactLoopState(loaded.path, state);

  return {
    repair,
    workflowProgress: loopTask.context?.workflowProgress ?? null,
    feature: state.features[featureKey] ?? null,
    holderTask: tree.tasks[
      state.features[featureKey]?.taskId ??
        "hold-compact-defender-profile-reviewed-exception-frontier"
    ] ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
