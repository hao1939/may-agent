import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type ProjectRuntimePaths = {
  appDir: string;
  stateDir: string;
  /** Historical JSON evidence marker. Never a live Task authority. */
  taskStatePath: string;
  projectStatePath: string;
};

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
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

export function saveProjectRuntimeState(appDir: string, patch: Record<string, unknown>): void {
  const path = projectRuntimePaths(appDir).projectStatePath;
  writeJson(path, {
    ...readJsonObject(path),
    ...patch,
    updatedAt: typeof patch.updatedAt === "string" ? patch.updatedAt : new Date().toISOString(),
  });
}
