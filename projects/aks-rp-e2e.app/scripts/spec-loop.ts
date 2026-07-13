import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTask,
  readTask,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";
import {
  defaultSpecLoopStatePath,
  devInfraCorePrioritySpecIds,
  loadSpecs,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopSpecState,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

const loopTaskId = "aks-spec-verification-loop";

function usage(): never {
  console.error(`Usage:
  bun run spec-loop status
  bun run spec-loop seed
  bun run spec-loop bind-task <spec-id> --task-id <task-id> [--state-path <path>] [--allow-missing-task]
  bun run spec-loop update-successor <spec-id> [--state-path <path>] [--task-id <task-id>] [--status <pending|running|pass|fail|error|pr_open|done>] [--attempts <n>] [--last-run-id <id>] [--last-run-url <url>] [--last-result-path <path>] [--last-pr-url <url>] [--successor-disposition <value>] [--successor-evidence-path <path>] [--successor-state-reason <text>] [--resume-condition <text>] [--review-classification <value>] [--review-last-root-cause <text>] [--review-last-action <text>] [--review-reviewed-at <iso>] [--clear-review] [--clear-successor-disposition] [--clear-successor-evidence-path] [--clear-successor-state-reason] [--clear-resume-condition]

Environment:
  APP_DIR=/app/projects/aks-rp-e2e.app
  PROJECT_DIR=/app/projects/aks-rp-e2e`);
  process.exit(2);
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
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

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function taskStatus(task: { state?: string; status?: string } | undefined) {
  return String(task?.status ?? task?.state ?? "");
}

function taskExists(taskId: string): { durable: boolean; runtime: boolean } {
  const tree = readTaskTree(config);
  const runtimeTask = tree.tasks?.[taskId];
  return {
    durable: Boolean(readTask(config, taskId)),
    runtime:
      Boolean(runtimeTask) ||
      Object.values(tree.tasks ?? {}).some((task) => task.id === taskId),
  };
}

const appDir = resolve(
  process.env.APP_DIR ??
    dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, ""),
);
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(appDir, "..", "aks-rp-e2e"),
);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "aks-explorer",
  maxConcurrent: Number.parseInt(process.env.MAX_CONCURRENT ?? "1", 10) || 1,
});

const command = process.argv[2];
if (!command) usage();

if (command === "seed") {
  const existing = readTask(config, loopTaskId);
  if (existing) {
    console.log(JSON.stringify({ seeded: false, task: existing }, null, 2));
    process.exit(0);
  }
  const specs = loadSpecs(projectDir);
  const task = createTask(config, {
    id: loopTaskId,
    parentId: "project",
    state: "backlog",
    priority: "P1",
    owner: process.env.WORKER ?? "aks-explorer",
    workflow: "spec-loop-controller",
    goal: "Run a bounded spec verification loop over aks-rp-e2e specs, prioritizing the dev-infra-core feature set first and keeping only a small frontier of live verification leaves open.",
    inputs: [
      "../aks-rp-e2e/specs/index.json",
      "../aks-rp-e2e/ci/feature-sets/dev-infra-core.txt",
    ],
    outputs: [".state/spec-loop/state.json", "task tree"],
    acceptance: [
      "Controller pulses keep a bounded child frontier filled from pending specs.",
      "Dev Infra Core selectors are scheduled before the remaining spec backlog.",
      "Each child leaf runs one single-spec pipeline workflow and records pass, fail, or error in spec-loop state.",
      "The loop remains open until every spec has a live pass or the owner intentionally replaces the loop task.",
    ],
    conflict_scope: ["spec-loop"],
    context: {
      windowSize: 5,
      stateRef: ".state/spec-loop/state.json",
      adoPipeline: "ado-pipeline-467665",
      target: "staging",
      branch: "dev",
      timeoutMinutes: 60,
      priorityFeatureSet: "dev-infra-core",
      workflowProgress: {
        completionReady: false,
        reason: "spec-loop task has been seeded but not yet pulsed",
        pending: specs.length,
        running: 0,
        updatedAt: new Date().toISOString(),
      },
    },
  });
  console.log(JSON.stringify({ seeded: true, task }, null, 2));
} else if (command === "status") {
  const task = readTask(config, loopTaskId);
  const tree = readTaskTree(config);
  const statePath = defaultSpecLoopStatePath(appDir);
  const state = existsSync(statePath)
    ? readJson<SpecLoopState>(statePath)
    : null;
  const specs = loadSpecs(projectDir);
  const prioritySpecIds = devInfraCorePrioritySpecIds(projectDir);
  const counts: Record<string, number> = {};
  if (state) {
    for (const spec of Object.values(state.specs)) {
      const status = String(spec.status) === "blocked" ? "error" : spec.status;
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }
  const childStates: Record<string, number> = {};
  for (const childId of task?.children ?? []) {
    const rawState = taskStatus(tree.tasks[childId]);
    const state = rawState === "blocked" ? "waiting" : rawState;
    childStates[state || "missing"] =
      (childStates[state || "missing"] ?? 0) + 1;
  }
  const activeChildren = childStates.active ?? 0;
  const backlogChildren = childStates.backlog ?? 0;
  console.log(
    JSON.stringify(
      {
        loopTaskId,
        loopTaskPresent: Boolean(task),
        loopTaskStatus: taskStatus(task ?? undefined),
        openChildren: activeChildren + backlogChildren,
        rawChildCount: (task?.children ?? []).length,
        childStates,
        statePath,
        statePresent: Boolean(state),
        totalSpecs: specs.length,
        devInfraCorePrioritySpecs: prioritySpecIds.length,
        stateCounts: counts,
      },
      null,
      2,
    ),
  );
} else if (command === "bind-task") {
  const specId = process.argv[3];
  const taskId = option("--task-id");
  if (!specId || !taskId) usage();

  const statePath = resolve(option("--state-path") ?? defaultSpecLoopStatePath(appDir));
  const state = readJson<SpecLoopState>(statePath);
  if (!state?.specs || !state.specs[specId]) {
    throw new Error(`Spec ${specId} not found in spec loop state: ${statePath}`);
  }

  const existence = taskExists(taskId);
  if (!hasFlag("--allow-missing-task") && !existence.durable && !existence.runtime) {
    throw new Error(
      `Task ${taskId} does not exist in durable or runtime task trees; create/publish the successor before rebinding ${specId}`,
    );
  }

  const beforeTaskId = state.specs[specId]?.taskId ?? null;
  updateSpecLoopSpec(state, specId, { taskId });
  saveSpecLoopState(statePath, state);
  const after = readJson<SpecLoopState>(statePath)?.specs?.[specId];

  console.log(
    JSON.stringify(
      {
        command: "bind-task",
        specId,
        statePath,
        beforeTaskId,
        afterTaskId: after?.taskId ?? null,
        taskExists: existence,
      },
      null,
      2,
    ),
  );
} else if (command === "update-successor") {
  const specId = process.argv[3];
  if (!specId) usage();

  const statePath = resolve(option("--state-path") ?? defaultSpecLoopStatePath(appDir));
  const state = readJson<SpecLoopState>(statePath);
  if (!state?.specs || !state.specs[specId]) {
    throw new Error(`Spec ${specId} not found in spec loop state: ${statePath}`);
  }

  const before = state.specs[specId];
  const patch: Partial<SpecLoopSpecState> = {};

  const taskId = option("--task-id");
  if (taskId) {
    const existence = taskExists(taskId);
    if (!hasFlag("--allow-missing-task") && !existence.durable && !existence.runtime) {
      throw new Error(
        `Task ${taskId} does not exist in durable or runtime task trees; create/publish the successor before rebinding ${specId}`,
      );
    }
    patch.taskId = taskId;
  }

  const status = option("--status");
  if (status) {
    if (
      status !== "pending" &&
      status !== "running" &&
      status !== "pass" &&
      status !== "fail" &&
      status !== "error" &&
      status !== "pr_open" &&
      status !== "done"
    ) {
      throw new Error(`Invalid --status ${status}`);
    }
    patch.status = status;
  }

  const attempts = option("--attempts");
  if (attempts) {
    const parsed = Number.parseInt(attempts, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid --attempts ${attempts}`);
    }
    patch.attempts = parsed;
  }

  const stringFields: Array<[keyof SpecLoopSpecState, string]> = [
    ["lastRunId", "--last-run-id"],
    ["lastRunUrl", "--last-run-url"],
    ["lastResultPath", "--last-result-path"],
    ["lastPrUrl", "--last-pr-url"],
    ["successorDisposition", "--successor-disposition"],
    ["successorEvidencePath", "--successor-evidence-path"],
    ["successorStateReason", "--successor-state-reason"],
    ["resumeCondition", "--resume-condition"],
  ];
  for (const [key, flag] of stringFields) {
    const value = option(flag);
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }

  if (hasFlag("--clear-successor-disposition")) patch.successorDisposition = undefined;
  if (hasFlag("--clear-successor-evidence-path")) patch.successorEvidencePath = undefined;
  if (hasFlag("--clear-successor-state-reason")) patch.successorStateReason = undefined;
  if (hasFlag("--clear-resume-condition")) patch.resumeCondition = undefined;

  const review =
    before.review && typeof before.review === "object" && !Array.isArray(before.review)
      ? { ...before.review }
      : {};
  let reviewTouched = false;
  if (hasFlag("--clear-review")) {
    patch.review = undefined;
    reviewTouched = true;
  } else {
    const reviewFieldMap: Array<[string, string]> = [
      ["classification", "--review-classification"],
      ["lastRootCause", "--review-last-root-cause"],
      ["lastAction", "--review-last-action"],
      ["reviewedAt", "--review-reviewed-at"],
    ];
    for (const [key, flag] of reviewFieldMap) {
      const values = repeatedStringOption(flag);
      if (values.length === 0) continue;
      review[key] = values[values.length - 1];
      reviewTouched = true;
    }
    if (reviewTouched) patch.review = review;
  }

  updateSpecLoopSpec(state, specId, patch);
  saveSpecLoopState(statePath, state);
  const after = readJson<SpecLoopState>(statePath)?.specs?.[specId];

  console.log(
    JSON.stringify(
      {
        command: "update-successor",
        specId,
        statePath,
        before,
        after,
      },
      null,
      2,
    ),
  );
} else {
  usage();
}
