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
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

const loopTaskId = "aks-spec-verification-loop";

function usage(): never {
  console.error(`Usage:
  bun run spec-loop status
  bun run spec-loop seed

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

function taskStatus(task: { state?: string; status?: string } | undefined) {
  return String(task?.status ?? task?.state ?? "");
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
      "../aks-rp-e2e/.github/workflows/feature-sets/dev-infra-core.txt",
    ],
    outputs: [".state/spec-loop/state.json", "task tree"],
    acceptance: [
      "Controller pulses keep a bounded child frontier filled from pending specs.",
      "Dev Infra Core selectors are scheduled before the remaining spec backlog.",
      "Each child leaf runs one single-spec GitHub workflow and records pass, fail, or error in spec-loop state.",
      "The loop remains open until every spec has a live pass or the owner intentionally replaces the loop task.",
    ],
    conflict_scope: ["spec-loop"],
    context: {
      windowSize: 5,
      stateRef: ".state/spec-loop/state.json",
      githubWorkflow: "run-single-spec.yaml",
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
} else {
  usage();
}
