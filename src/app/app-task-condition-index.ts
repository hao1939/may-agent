import { renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { AppTaskCondition } from "./app-task-state.js";
import type { TaskStateConfig, TaskTree } from "./app-task-store.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";

type TaskStateSignature = {
  dev: number;
  ino: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
};

export type AppTaskConditionRoute = {
  condition: AppTaskCondition;
  taskIds: string[];
};

type AppTaskConditionRouteIndex = {
  schemaVersion: 1;
  state: TaskStateSignature;
  eventTypes: Record<string, AppTaskConditionRoute[]>;
};

function stateSignature(path: string): TaskStateSignature {
  const stat = statSync(path);
  return {
    dev: stat.dev,
    ino: stat.ino,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs,
  };
}

function sameSignature(left: TaskStateSignature, right: TaskStateSignature): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

export function appTaskConditionRoutesByEventType(tree: TaskTree): Record<string, AppTaskConditionRoute[]> {
  const taskIdsByCondition = new Map<string, string[]>();
  for (const resource of Object.values(tree.resources ?? {})) {
    if (resource.status.phase !== "waiting") continue;
    for (const conditionId of resource.status.conditionIds ?? []) {
      const taskIds = taskIdsByCondition.get(conditionId) ?? [];
      taskIds.push(resource.metadata.id);
      taskIdsByCondition.set(conditionId, taskIds);
    }
  }

  const eventTypes: Record<string, AppTaskConditionRoute[]> = {};
  for (const [conditionId, taskIds] of taskIdsByCondition) {
    const condition = tree.conditions?.[conditionId];
    const eventType = condition?.spec?.type?.trim();
    if (!condition || !eventType) continue;
    (eventTypes[eventType] ??= []).push({ condition, taskIds: [...new Set(taskIds)].sort() });
  }
  for (const routes of Object.values(eventTypes)) {
    routes.sort((left, right) => left.condition.metadata.id.localeCompare(right.condition.metadata.id));
  }
  return eventTypes;
}

function buildIndex(tree: TaskTree, state: TaskStateSignature): AppTaskConditionRouteIndex {
  return { schemaVersion: 1, state, eventTypes: appTaskConditionRoutesByEventType(tree) };
}

/**
 * Refresh the disposable Condition routing projection after canonical state is
 * committed. A concurrent state change simply leaves this projection stale;
 * readers detect that and fall back to canonical state.
 */
export function writeAppTaskConditionRouteIndex(config: TaskStateConfig, tree: TaskTree): boolean {
  const paths = projectRuntimePaths(config.stateAppDir ?? config.appDir);
  const indexPath = paths.taskConditionRoutesPath;
  const tempPath = `${indexPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const before = stateSignature(config.statePath);
    const serialized = `${JSON.stringify(buildIndex(tree, before))}\n`;
    writeFileSync(tempPath, serialized, "utf-8");
    const after = stateSignature(config.statePath);
    if (!sameSignature(before, after)) {
      rmSync(tempPath, { force: true });
      return false;
    }
    renameSync(tempPath, indexPath);
    return true;
  } catch {
    rmSync(tempPath, { force: true });
    return false;
  }
}
