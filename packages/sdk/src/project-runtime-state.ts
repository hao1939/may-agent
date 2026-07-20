import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ProjectRuntimePaths = {
  appDir: string;
  stateDir: string;
  taskStatePath: string;
  /** Generated human/agent read projection. Never a mutation authority. */
  taskTreePath: string;
  projectStatePath: string;
  journalPath: string;
  migrationLogPath: string;
};

export type EnsureTaskTreeStateResult = {
  path: string;
  migrated: boolean;
  source: "runtime" | "seed" | "empty";
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

function appendMigrationLog(appDir: string, entry: Record<string, unknown>): void {
  const logPath = projectRuntimePaths(appDir).migrationLogPath;
  ensureDir(dirname(logPath));
  appendFileSync(
    logPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    })}\n`,
    "utf-8",
  );
}

export function projectRuntimePaths(appDir: string): ProjectRuntimePaths {
  const stateDir = join(appDir, ".state");
  const taskStateDir = join(stateDir, "tasks");
  return {
    appDir,
    stateDir,
    taskStatePath: join(taskStateDir, "state.json"),
    taskTreePath: join(taskStateDir, "tree.json"),
    projectStatePath: join(stateDir, "project-state.json"),
    journalPath: join(stateDir, "journal.jsonl"),
    migrationLogPath: join(stateDir, "runtime-state-migrations.jsonl"),
  };
}

export function ensureTaskTreeState(appDir: string): EnsureTaskTreeStateResult {
  const paths = projectRuntimePaths(appDir);
  if (existsSync(paths.taskStatePath)) {
    return { path: paths.taskStatePath, migrated: false, source: "runtime" };
  }

  ensureDir(dirname(paths.taskStatePath));
  const seedPath = join(appDir, "tasks", "seed.json");

  if (existsSync(seedPath)) {
    const seed = readFileSync(seedPath);
    writeFileSync(paths.taskStatePath, seed);
    appendMigrationLog(appDir, {
      kind: "task_tree_runtime_state_bootstrap",
      source: "seed",
      from: "tasks/seed.json",
      to: ".state/tasks/state.json",
    });
    return { path: paths.taskStatePath, migrated: true, source: "seed" };
  }

  const empty = {
    updated_at: new Date().toISOString(),
    groups: {},
    resources: {},
  };
  writeJson(paths.taskStatePath, empty);
  appendMigrationLog(appDir, {
    kind: "task_tree_runtime_state_bootstrap",
    source: "empty",
    to: ".state/tasks/state.json",
  });
  return { path: paths.taskStatePath, migrated: true, source: "empty" };
}

export function resolveTaskTreePath(appDir: string): string {
  return projectRuntimePaths(appDir).taskTreePath;
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
