#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  projectRuntimePaths,
  readTaskState,
  type TaskStateConfig,
  type TaskTree,
} from "@may-agent/sdk";

type MetricSampleOutput = {
  value: number;
  measuredAt: number;
  treePath: string;
  note?: unknown;
};

type PlannerRun = {
  kind?: string;
  steps?: string[];
  ts?: string;
  result?: string;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimePaths = projectRuntimePaths(appDir);
const treePath = join(appDir, ".state", "tasks", "tree.json");
const plannerRunsPath = join(appDir, ".state", "planner-runs.jsonl");
const now = Date.now();
const dayAgo = now - 24 * 60 * 60 * 1000;

function usage(): never {
  console.error(
    "Usage: bun run metrics:sample <metric-id> [--json]\n\nSupported metrics:\n- aks-rp-e2e.task.active-count\n- aks-rp-e2e.task.ready-count\n- aks-rp-e2e.task.blocked-count\n- aks-rp-e2e.planner.timeout-24h",
  );
  process.exit(2);
}

function taskStateConfig(): TaskStateConfig {
  return {
    appDir,
    projectDir: appDir,
    statePath: runtimePaths.taskStatePath,
    journalPath: runtimePaths.journalPath,
    worker: "app-ops",
    maxConcurrent: 80,
  };
}

function loadTree(): TaskTree {
  return readTaskState(taskStateConfig());
}

function taskPhase(tree: TaskTree, taskId: string): string {
  const resourcePhase = (tree.resources?.[taskId] as any)?.status?.phase;
  const projectedState = (tree.tasks?.[taskId] as any)?.state;
  return String(resourcePhase ?? projectedState ?? "unknown");
}

function isLeaf(task: Record<string, unknown> | undefined): boolean {
  return !Array.isArray(task?.children) || task.children.length === 0;
}

function isVisibleTask(tree: TaskTree, taskId: string): boolean {
  return taskId !== tree.root_task_id && !taskId.startsWith("runtime/");
}

function visibleTaskCount(tree: TaskTree, phases: string[]): number {
  return Object.keys(tree.tasks ?? {}).filter(
    (taskId) =>
      isVisibleTask(tree, taskId) && phases.includes(taskPhase(tree, taskId)),
  ).length;
}

function runnableLeafCount(tree: TaskTree): number {
  return Object.entries(tree.tasks ?? {}).filter(([taskId, task]) => {
    if (!isVisibleTask(tree, taskId) || !isLeaf(task as any)) return false;
    const phase = taskPhase(tree, taskId);
    const readiness = String((task as any)?.readiness?.state ?? "");
    return (
      ["backlog", "pending", "ready"].includes(phase) &&
      readiness !== "dependency-blocked"
    );
  }).length;
}

function blockedLeafCount(tree: TaskTree): number {
  return Object.entries(tree.tasks ?? {}).filter(([taskId, task]) => {
    const taskRecord = task as Record<string, unknown> | undefined;
    return (
      isVisibleTask(tree, taskId) &&
      isLeaf(taskRecord) &&
      taskPhase(tree, taskId) === "waiting"
    );
  }).length;
}

function plannerRuns(): PlannerRun[] {
  if (!existsSync(plannerRunsPath)) return [];
  try {
    return readFileSync(plannerRunsPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PlannerRun)
      .filter((run) => run.kind === "planner_wake");
  } catch {
    return [];
  }
}

function plannerRunTimestamp(run: PlannerRun): number | null {
  const parsed = typeof run.ts === "string" ? Date.parse(run.ts) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function plannerTouchesOwnerSteps(run: PlannerRun): boolean {
  return (
    run.steps?.includes("event-review") ||
    run.steps?.includes("planning-update") ||
    false
  );
}

function plannerTimedOut(run: PlannerRun): boolean {
  return String(run.result ?? "")
    .toLowerCase()
    .includes("timed out after");
}

function plannerTimeoutCount24h(): number {
  const ordered = plannerRuns()
    .filter((run) => {
      const ts = plannerRunTimestamp(run);
      return ts != null && ts >= dayAgo && plannerTouchesOwnerSteps(run);
    })
    .sort(
      (a, b) => (plannerRunTimestamp(a) ?? 0) - (plannerRunTimestamp(b) ?? 0),
    );

  let streak = 0;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    if (plannerTimedOut(ordered[index])) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function sampleFor(metricId: string): MetricSampleOutput {
  const tree = loadTree();

  switch (metricId) {
    case "aks-rp-e2e.task.active-count":
      return {
        value: visibleTaskCount(tree, ["active", "running"]),
        measuredAt: Date.now(),
        treePath,
        note: { source: "task-state", phases: ["active", "running"] },
      };
    case "aks-rp-e2e.task.ready-count":
      return {
        value: runnableLeafCount(tree),
        measuredAt: Date.now(),
        treePath,
        note: { source: "task-state", leavesOnly: true },
      };
    case "aks-rp-e2e.task.blocked-count":
      return {
        value: blockedLeafCount(tree),
        measuredAt: Date.now(),
        treePath,
        note: {
          source: "task-state",
          phase: "waiting",
          leavesOnly: true,
          compatibilityMetricId: true,
        },
      };
    case "aks-rp-e2e.planner.timeout-24h":
      return {
        value: plannerTimeoutCount24h(),
        measuredAt: Date.now(),
        treePath,
        note: {
          source: plannerRunsPath,
          windowHours: 24,
          ownerSteps: ["event-review", "planning-update"],
          trailingTimeoutStreak: true,
        },
      };
    default:
      console.error(`Unsupported metric id: ${metricId}`);
      usage();
  }
}

const args = process.argv.slice(2);
const metricId = args.find((arg) => !arg.startsWith("--"));
const asJson = args.includes("--json");

if (!metricId) usage();

const sample = sampleFor(metricId);
if (asJson) {
  console.log(JSON.stringify(sample));
} else {
  console.log(String(sample.value));
}
