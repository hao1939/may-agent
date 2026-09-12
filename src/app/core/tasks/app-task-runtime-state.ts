import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type ProjectRuntimePaths = {
  appDir: string;
  stateDir: string;
  /** Historical JSON facts marker. Never a live Task authority. */
  taskStatePath: string;
  projectStatePath: string;
};

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function projectRuntimePaths(appDir: string): ProjectRuntimePaths {
  const activeAppDir = resolve(appDir);
  const stateDir = join(activeAppDir, ".state");
  const taskStateDir = join(stateDir, "tasks");
  return {
    appDir: activeAppDir,
    stateDir,
    taskStatePath: join(taskStateDir, "state.json"),
    projectStatePath: join(stateDir, "project-state.json"),
  };
}

export function loadProjectReadModel(appDir: string): Record<string, unknown> {
  return {
    ...readJsonObject(join(appDir, "project.json")),
    ...readJsonObject(projectRuntimePaths(appDir).projectStatePath),
  };
}
