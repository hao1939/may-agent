import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export type ProjectRuntimePaths = {
  /** Active definition checkout. Code and seeds are read from here. */
  appDir: string;
  /** Stable app root that owns mutable runtime state. */
  stateAppDir: string;
  stateDir: string;
  taskStatePath: string;
  /** Disposable routing projection for task Conditions. */
  taskConditionRoutesPath: string;
  /** Generated human/agent read projection. Never a mutation authority. */
  taskTreePath: string;
  projectStatePath: string;
  journalPath: string;
  migrationLogPath: string;
};

export type EnsureTaskStateResult = {
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

function appendMigrationLog(logPath: string, entry: Record<string, unknown>): void {
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

function appendMigrationLogOnce(logPath: string, entry: Record<string, unknown>): void {
  const fingerprint = JSON.stringify(entry);
  if (existsSync(logPath)) {
    const alreadyRecorded = readFileSync(logPath, "utf-8")
      .split("\n")
      .some((line) => line.includes(fingerprint.slice(1, -1)));
    if (alreadyRecorded) return;
  }
  appendMigrationLog(logPath, entry);
}

/**
 * Definition code may be activated from a branch checkout, but mutable App
 * state keeps one stable address. A branch checkout may adopt the canonical
 * root only when that root already has durable task state; otherwise this is a
 * genuinely new App and normal seed bootstrap remains local to the checkout.
 */
export function resolveRuntimeStateAppDir(
  appDir: string,
  canonicalProjectsRoot = resolve(process.env.APP_ROOT || process.env.PROJECT_ROOT || "/app", "projects"),
): string {
  const activeAppDir = resolve(appDir);
  const canonicalAppDir = resolve(canonicalProjectsRoot, basename(activeAppDir));
  if (canonicalAppDir === activeAppDir) return activeAppDir;
  return existsSync(join(canonicalAppDir, ".state", "tasks", "state.json")) ? canonicalAppDir : activeAppDir;
}

export function projectRuntimePaths(appDir: string, canonicalProjectsRoot?: string): ProjectRuntimePaths {
  const activeAppDir = resolve(appDir);
  const stateAppDir = resolveRuntimeStateAppDir(activeAppDir, canonicalProjectsRoot);
  const stateDir = join(stateAppDir, ".state");
  const taskStateDir = join(stateDir, "tasks");
  return {
    appDir: activeAppDir,
    stateAppDir,
    stateDir,
    taskStatePath: join(taskStateDir, "state.json"),
    taskConditionRoutesPath: join(taskStateDir, "condition-routes.json"),
    taskTreePath: join(taskStateDir, "tree.json"),
    projectStatePath: join(stateDir, "project-state.json"),
    journalPath: join(stateDir, "journal.jsonl"),
    migrationLogPath: join(stateDir, "runtime-state-migrations.jsonl"),
  };
}

export function ensureTaskState(appDir: string, canonicalProjectsRoot?: string): EnsureTaskStateResult {
  const paths = projectRuntimePaths(appDir, canonicalProjectsRoot);
  if (existsSync(paths.taskStatePath)) {
    if (paths.stateAppDir !== paths.appDir) {
      appendMigrationLogOnce(paths.migrationLogPath, {
        kind: "task_state_canonical_lineage_selected",
        activeAppDir: paths.appDir,
        canonicalAppDir: paths.stateAppDir,
        taskStatePath: paths.taskStatePath,
      });
    }
    return { path: paths.taskStatePath, migrated: false, source: "runtime" };
  }

  ensureDir(dirname(paths.taskStatePath));
  const seedPath = join(appDir, "tasks", "seed.json");

  if (existsSync(seedPath)) {
    const seed = readFileSync(seedPath);
    writeFileSync(paths.taskStatePath, seed);
    appendMigrationLog(paths.migrationLogPath, {
      kind: "task_state_runtime_bootstrap",
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
  appendMigrationLog(paths.migrationLogPath, {
    kind: "task_state_runtime_bootstrap",
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
