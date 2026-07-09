import {
  normalizeStringArray,
  projectRuntimePaths,
  readTaskTree,
  saveTaskTree,
  withTreeLock,
  type TaskBlocker,
  type TaskNode,
  type TaskTreeConfig,
} from "@may-agent/sdk";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { saveTaskTreeWithKanbanSnapshot } from "../workflows/lib/task-tree-tools.ts";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type Surface = "runtime" | "durable";

type SurfaceSelection = "runtime" | "durable" | "both";

function usage(): never {
  console.error(`Usage:
  bun run compact-organizer publish-holder <task-id> [--source runtime|durable] [--target runtime|durable|both]
  bun run compact-organizer upsert-holder <task-id> --parent <task-id> --goal "..." --output <path> --acceptance "..." [--target runtime|durable|both] [--state backlog|blocked] [--kind domain_leaf] [--priority P2] [--owner aks-explorer] [--workflow workflow-name] [--input <path> ...] [--forbidden <text> ...] [--conflict-scope <scope[,scope...]> ...] [--depends-on <task-id[,task-id...]> ...] [--context-json '{"k":"v"}'] [--blocker "..."] [--blocker-category external-wait] [--blocker-owner human] [--resume-condition "..."] [--resume-at ISO] [--next-check-at ISO] [--fallback-at ISO] [--fallback-action "..."]
  bun run compact-organizer bind-task <feature-key> --task-id <task-id> [--state-path <path>] [--allow-missing-task]
  bun run compact-organizer show-binding <feature-key> [--state-path <path>]

Environment:
  APP_DIR=/app/projects/aks-rp-e2e.app
  PROJECT_DIR=/app/projects/aks-rp-e2e
  WORKER=aks-explorer
  MAX_CONCURRENT=5`);
  process.exit(2);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function repeatedStringOption(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index++) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index++;
    }
  }
  return values.map((value) => value.trim()).filter(Boolean);
}

function commaListOption(name: string): string[] {
  return repeatedStringOption(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readProjectPolicyMaxConcurrent(appDir: string): number | null {
  const path = join(appDir, "project.json");
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as {
      policy?: { maxConcurrent?: unknown };
    };
    const value = parsed?.policy?.maxConcurrent;
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(1, Math.trunc(value))
      : null;
  } catch {
    return null;
  }
}

function contextOption(): Record<string, unknown> | undefined {
  const raw = option("--context-json");
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--context-json must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeTargetSurface(value: string | undefined): SurfaceSelection {
  const raw = (value ?? "durable").trim().toLowerCase();
  if (raw === "runtime" || raw === "durable" || raw === "both") return raw;
  throw new Error(
    `Invalid target surface ${value}; expected runtime, durable, or both`,
  );
}

function normalizeSourceSurface(value: string | undefined): Surface {
  const raw = (value ?? "runtime").trim().toLowerCase();
  if (raw === "runtime" || raw === "durable") return raw;
  throw new Error(`Invalid source surface ${value}; expected runtime or durable`);
}

function stateOption(): "backlog" | "blocked" {
  const raw = option("--state") ?? "backlog";
  if (raw === "blocked") return "blocked";
  if (raw === "backlog" || raw === "ready" || raw === "proposed") {
    return "backlog";
  }
  throw new Error(`Invalid --state ${raw}; expected backlog or blocked`);
}

function priorityOption(): "P0" | "P1" | "P2" | "P3" {
  const raw = option("--priority") ?? "P2";
  if (raw === "P0" || raw === "P1" || raw === "P2" || raw === "P3") {
    return raw;
  }
  throw new Error(`Invalid --priority ${raw}; expected P0, P1, P2, or P3`);
}

function blockerOptions(): {
  blocker?: string;
  blockerCategory?: string;
  blockerOwner?: string;
  resumeCondition?: string;
  resumeAt?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
} {
  return {
    blocker: option("--blocker"),
    blockerCategory: option("--blocker-category"),
    blockerOwner: option("--blocker-owner"),
    resumeCondition: option("--resume-condition"),
    resumeAt: option("--resume-at"),
    nextCheckAt: option("--next-check-at"),
    fallbackAt: option("--fallback-at"),
    fallbackAction: option("--fallback-action"),
  };
}

function buildBlocker(
  state: "backlog" | "blocked",
  input: ReturnType<typeof blockerOptions>,
): TaskBlocker | undefined {
  if (state !== "blocked") {
    if (
      input.blocker ||
      input.blockerCategory ||
      input.blockerOwner ||
      input.resumeCondition ||
      input.resumeAt ||
      input.nextCheckAt ||
      input.fallbackAt ||
      input.fallbackAction
    ) {
      throw new Error("--blocker fields are only valid with --state blocked");
    }
    return undefined;
  }

  const condition = input.blocker?.trim();
  if (!condition) throw new Error("Blocked tasks require --blocker");
  const owner = input.blockerOwner?.trim();
  if (!owner) throw new Error("Blocked tasks require --blocker-owner");
  const blocker: Record<string, unknown> = { condition, owner };
  if (input.blockerCategory?.trim()) blocker.category = input.blockerCategory.trim();
  if (input.resumeCondition?.trim()) {
    blocker.resume_condition = input.resumeCondition.trim();
  }
  if (input.resumeAt?.trim()) blocker.resume_at = input.resumeAt.trim();
  if (input.nextCheckAt?.trim()) blocker.next_check_at = input.nextCheckAt.trim();
  if (input.fallbackAt?.trim()) blocker.fallback_at = input.fallbackAt.trim();
  if (input.fallbackAction?.trim()) {
    blocker.fallback_action = input.fallbackAction.trim();
  }
  return blocker as TaskBlocker;
}

function appDir(): string {
  return resolve(
    process.env.APP_DIR ??
      dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, ""),
  );
}

function projectDir(currentAppDir: string): string {
  return resolve(process.env.PROJECT_DIR ?? join(currentAppDir, "..", "aks-rp-e2e"));
}

function runtimeConfig(currentAppDir: string, currentProjectDir: string): TaskTreeConfig {
  const runtimePaths = projectRuntimePaths(currentAppDir);
  return {
    appDir: currentAppDir,
    projectDir: currentProjectDir,
    treePath: runtimePaths.taskTreePath,
    journalPath: runtimePaths.journalPath,
    worker: process.env.WORKER ?? "aks-explorer",
    maxConcurrent:
      numberEnv("MAX_CONCURRENT", readProjectPolicyMaxConcurrent(currentAppDir) ?? 1),
  };
}

function durableConfig(currentAppDir: string, currentProjectDir: string): TaskTreeConfig {
  const runtimePaths = projectRuntimePaths(currentAppDir);
  return {
    appDir: currentAppDir,
    projectDir: currentProjectDir,
    treePath: join(currentAppDir, "tasks", "tree.json"),
    journalPath: runtimePaths.journalPath,
    worker: process.env.WORKER ?? "aks-explorer",
    maxConcurrent:
      numberEnv("MAX_CONCURRENT", readProjectPolicyMaxConcurrent(currentAppDir) ?? 1),
  };
}

function configForSurface(
  surface: Surface,
  currentAppDir: string,
  currentProjectDir: string,
): TaskTreeConfig {
  return surface === "runtime"
    ? runtimeConfig(currentAppDir, currentProjectDir)
    : durableConfig(currentAppDir, currentProjectDir);
}

function ensureTreeExists(config: TaskTreeConfig, label: Surface): void {
  if (!existsSync(config.treePath)) {
    throw new Error(`${label} task tree not found: ${config.treePath}`);
  }
}

function selectedSurfaces(selection: SurfaceSelection): Surface[] {
  if (selection === "both") return ["runtime", "durable"];
  return [selection];
}

function sourceTask(
  surface: Surface,
  currentAppDir: string,
  currentProjectDir: string,
  taskId: string,
): TaskNode {
  const config = configForSurface(surface, currentAppDir, currentProjectDir);
  ensureTreeExists(config, surface);
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId];
  if (!task) throw new Error(`${surface} task not found: ${taskId}`);
  return deepClone(task);
}

function createTaskNode(taskId: string): TaskNode {
  const parentId = option("--parent");
  const goal = option("--goal");
  const outputs = repeatedStringOption("--output");
  const acceptance = repeatedStringOption("--acceptance");
  if (!taskId || !parentId || !goal || outputs.length === 0 || acceptance.length === 0) {
    usage();
  }

  const state = stateOption();
  const blocker = buildBlocker(state, blockerOptions());
  const now = new Date().toISOString();
  return {
    id: taskId,
    parent_id: parentId,
    state,
    status: state,
    kind: option("--kind") ?? "domain_leaf",
    priority: priorityOption(),
    owner: option("--owner") ?? process.env.WORKER ?? "aks-explorer",
    workflow: option("--workflow"),
    children: [],
    goal,
    inputs: repeatedStringOption("--input"),
    outputs,
    acceptance,
    forbidden: repeatedStringOption("--forbidden"),
    conflict_scope: commaListOption("--conflict-scope"),
    depends_on: commaListOption("--depends-on"),
    context: contextOption(),
    blocker,
    trace: {
      created_at: now,
      created_by: "compact-organizer",
    },
  };
}

function normalizeTaskForWrite(task: TaskNode): TaskNode {
  const normalized = deepClone(task);
  normalized.state = normalized.state ?? normalized.status ?? "backlog";
  normalized.status = normalized.state;
  normalized.children = normalizeStringArray(normalized.children);
  normalized.inputs = normalizeStringArray(normalized.inputs);
  normalized.outputs = normalizeStringArray(normalized.outputs);
  normalized.acceptance = normalizeStringArray(normalized.acceptance);
  normalized.forbidden = normalizeStringArray(normalized.forbidden);
  normalized.conflict_scope = normalizeStringArray(normalized.conflict_scope);
  normalized.depends_on = normalizeStringArray(normalized.depends_on);
  return normalized;
}

function tasksEqual(a: TaskNode | undefined, b: TaskNode): boolean {
  if (!a) return false;
  return JSON.stringify(normalizeTaskForWrite(a)) === JSON.stringify(normalizeTaskForWrite(b));
}

function upsertTaskOnSurface(
  config: TaskTreeConfig,
  task: TaskNode,
  surface: Surface,
): { surface: Surface; changed: boolean; action: "created" | "updated" | "unchanged"; path: string } {
  ensureTreeExists(config, surface);
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const parentId = task.parent_id;
    if (!parentId) throw new Error(`Task ${task.id} is missing parent_id`);
    const parent = tree.tasks[parentId];
    if (!parent) throw new Error(`Parent task not found in ${surface} tree: ${parentId}`);

    const normalized = normalizeTaskForWrite(task);
    const existing = tree.tasks[task.id];
    const action: "created" | "updated" | "unchanged" = !existing
      ? "created"
      : tasksEqual(existing, normalized)
        ? "unchanged"
        : "updated";

    if (action !== "unchanged") {
      tree.tasks[task.id] = normalized;
      parent.children = [
        ...new Set([...normalizeStringArray(parent.children), task.id]),
      ];
      if (surface === "runtime") {
        saveTaskTreeWithKanbanSnapshot(config, tree);
      } else {
        saveTaskTree(config, tree);
      }
    }

    return {
      surface,
      changed: action !== "unchanged",
      action,
      path: config.treePath,
    };
  });
}

function taskExistsInAnySurface(
  taskId: string,
  currentAppDir: string,
  currentProjectDir: string,
): { durable: boolean; runtime: boolean } {
  const durable = (() => {
    const config = durableConfig(currentAppDir, currentProjectDir);
    if (!existsSync(config.treePath)) return false;
    return Boolean(readTaskTree(config).tasks[taskId]);
  })();
  const runtime = (() => {
    const config = runtimeConfig(currentAppDir, currentProjectDir);
    if (!existsSync(config.treePath)) return false;
    return Boolean(readTaskTree(config).tasks[taskId]);
  })();
  return { durable, runtime };
}

function runPublishHolder(): void {
  const currentAppDir = appDir();
  const currentProjectDir = projectDir(currentAppDir);
  const taskId = process.argv[3];
  if (!taskId) usage();

  const source = normalizeSourceSurface(option("--source"));
  const target = normalizeTargetSurface(option("--target"));
  const surfaces = selectedSurfaces(target);
  const sourceNode = sourceTask(source, currentAppDir, currentProjectDir, taskId);

  const results = surfaces.map((surface) =>
    upsertTaskOnSurface(
      configForSurface(surface, currentAppDir, currentProjectDir),
      sourceNode,
      surface,
    ),
  );

  console.log(
    JSON.stringify(
      {
        command: "publish-holder",
        taskId,
        source,
        target,
        parentId: sourceNode.parent_id ?? null,
        results,
      },
      null,
      2,
    ),
  );
}

function runUpsertHolder(): void {
  const currentAppDir = appDir();
  const currentProjectDir = projectDir(currentAppDir);
  const taskId = process.argv[3];
  if (!taskId) usage();
  const target = normalizeTargetSurface(option("--target"));
  const surfaces = selectedSurfaces(target);
  const task = createTaskNode(taskId);

  const results = surfaces.map((surface) =>
    upsertTaskOnSurface(
      configForSurface(surface, currentAppDir, currentProjectDir),
      task,
      surface,
    ),
  );

  console.log(
    JSON.stringify(
      {
        command: "upsert-holder",
        taskId,
        target,
        parentId: task.parent_id ?? null,
        state: task.state ?? null,
        results,
      },
      null,
      2,
    ),
  );
}

function runBindTask(): void {
  const currentAppDir = appDir();
  const currentProjectDir = projectDir(currentAppDir);
  const featureKey = process.argv[3];
  const taskId = option("--task-id");
  if (!featureKey || !taskId) usage();

  const statePath = resolve(
    option("--state-path") ?? defaultFeatureCompactLoopStatePath(currentAppDir),
  );
  const existence = taskExistsInAnySurface(taskId, currentAppDir, currentProjectDir);
  if (!hasFlag("--allow-missing-task") && !existence.durable && !existence.runtime) {
    throw new Error(
      `Task ${taskId} does not exist in durable or runtime task trees; create/publish the holder before rebinding ${featureKey}`,
    );
  }

  const { state } = loadFeatureCompactLoopState({
    appDir: currentAppDir,
    projectDir: currentProjectDir,
    loopTaskId: "aks-feature-compact-loop",
    windowSize: 1,
    statePath,
    refreshFromProject: false,
  });
  const previous = state.features?.[featureKey];
  if (!previous) {
    throw new Error(`Feature ${featureKey} not found in compact loop state: ${statePath}`);
  }

  const beforeTaskId = previous.taskId ?? null;
  updateFeatureCompactItem(state, featureKey, { taskId });
  saveFeatureCompactLoopState(statePath, state);
  const after = loadFeatureCompactLoopState({
    appDir: currentAppDir,
    projectDir: currentProjectDir,
    loopTaskId: state.loopTaskId,
    windowSize: state.windowSize,
    statePath,
    refreshFromProject: false,
  }).state.features[featureKey];

  console.log(
    JSON.stringify(
      {
        command: "bind-task",
        featureKey,
        statePath,
        beforeTaskId,
        afterTaskId: after?.taskId ?? null,
        taskExists: existence,
      },
      null,
      2,
    ),
  );
}

function runShowBinding(): void {
  const currentAppDir = appDir();
  const currentProjectDir = projectDir(currentAppDir);
  const featureKey = process.argv[3];
  if (!featureKey) usage();
  const statePath = resolve(
    option("--state-path") ?? defaultFeatureCompactLoopStatePath(currentAppDir),
  );
  const { state } = loadFeatureCompactLoopState({
    appDir: currentAppDir,
    projectDir: currentProjectDir,
    loopTaskId: "aks-feature-compact-loop",
    windowSize: 1,
    statePath,
    refreshFromProject: false,
  });
  const feature = state.features?.[featureKey];
  if (!feature) {
    throw new Error(`Feature ${featureKey} not found in compact loop state: ${statePath}`);
  }
  console.log(
    JSON.stringify(
      {
        command: "show-binding",
        featureKey,
        statePath,
        taskId: feature.taskId ?? null,
        status: feature.status,
        errorClass: feature.errorClass ?? null,
      },
      null,
      2,
    ),
  );
}

const command = process.argv[2];
if (!command) usage();

if (command === "publish-holder") {
  runPublishHolder();
} else if (command === "upsert-holder") {
  runUpsertHolder();
} else if (command === "bind-task") {
  runBindTask();
} else if (command === "show-binding") {
  runShowBinding();
} else {
  usage();
}
