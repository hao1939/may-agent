/**
 * feature-compact-planner — generate one feature compact package and verify generated tests.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  buildTaskTreeConfig,
  completeStartedAttempt,
  emitTaskCompleted,
  markAttemptStartedOnce,
} from "./default-task-worker.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  sourceDir,
  triggerString,
} from "./lib/workflow-input.ts";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactStatus,
} from "./lib/feature-compact-loop-store.ts";
import type { TaskNode } from "./lib/task-tree-store.ts";
import type { TaskCompletionClaim } from "./lib/task-tree-tools.ts";

export const name = "feature-compact-planner";
export const description =
  "Generate and check one feature compact test package.";

type CommandResult = {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

type Diagnostics = {
  packageStatus?: string;
  planPath?: string;
  summaryPath?: string;
  metrics?: {
    specsSelected?: number;
    clustersNeeded?: number;
    baselineClusterCount?: number;
    clustersSaved?: number;
  };
};

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function contextString(task: TaskNode, key: string, fallback = ""): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function contextNumber(task: TaskNode, key: string, fallback: number): number {
  const value = taskContext(task)[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: process.env,
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function compactStatus(value: string | undefined): FeatureCompactStatus {
  if (value === "ready" || value === "partial" || value === "blocked")
    return value;
  return "partial";
}

function firstOutputMatch(output: string, pattern: RegExp): string | null {
  return output.match(pattern)?.[1] ?? null;
}

function tail(value: string, max = 1800): string {
  const normalized = value.trim();
  return normalized.length <= max
    ? normalized
    : normalized.slice(normalized.length - max);
}

function commandSummary(command: string, result: CommandResult): string {
  const pieces = [
    `${command} exited ${result.status ?? "unknown"}`,
    result.error ? `error: ${result.error}` : "",
    result.stderr ? `stderr: ${tail(result.stderr)}` : "",
    result.stdout ? `stdout: ${tail(result.stdout)}` : "",
  ].filter(Boolean);
  return pieces.join("\n");
}

function completion(
  ctx: WorkflowContext,
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    task: TaskNode;
    attemptId: string;
    claim: TaskCompletionClaim;
    summary: string;
  },
): WorkflowResult {
  const completed = completeStartedAttempt(config, {
    taskId: input.task.id,
    attemptId: input.attemptId,
    claim: input.claim,
    summary: input.summary,
  });
  if (completed.ok) {
    emitTaskCompleted(ctx, completed.task, {
      attemptId: input.attemptId,
      result: input.claim,
      summary: input.summary,
    });
  }
  return ctx.done(input.summary);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  sourceDir(ctx.task);
  const trigger = parseTriggerEvent(ctx.task);
  const config = buildTaskTreeConfig(
    ctx,
    appDir,
    projectDir,
    maxConcurrent(ctx.task, trigger),
  );

  if (trigger?.type !== "project.task.assigned") {
    return ctx.done(
      `Feature compact planner ignored trigger ${String(trigger?.type ?? "unknown")}; use project.task.assigned.`,
    );
  }

  const taskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    field(ctx.task, "taskId");
  const attemptId =
    triggerString(trigger, "attemptId") || triggerString(trigger, "attempt_id");
  if (!taskId || !attemptId) {
    return ctx.done("Feature compact planner requires taskId and attemptId.");
  }

  const start = markAttemptStartedOnce(config, { taskId, attemptId });
  if (start.ok === false) return ctx.done(start.reason);
  const task = start.task;
  const featureKey = contextString(task, "featureKey");
  const capabilityId = contextString(task, "capabilityId", featureKey);
  const target = contextString(task, "target", "staging");
  const stateRef = contextString(
    task,
    "stateRef",
    defaultFeatureCompactLoopStatePath(appDir),
  );
  const loopTaskId = contextString(
    task,
    "loopTaskId",
    "aks-feature-compact-loop",
  );
  const checkParallel = contextNumber(task, "checkParallel", 50);
  const statePath = stateRef.startsWith("/")
    ? stateRef
    : join(appDir, stateRef);
  const { state } = loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 1,
    statePath,
    featureKeys: featureKey ? [featureKey] : undefined,
    refreshFromProject: false,
  });

  if (!featureKey || !capabilityId) {
    const summary = `Task ${task.id} is missing featureKey or capabilityId.`;
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "blocked",
      summary,
    });
  }

  updateFeatureCompactItem(state, featureKey, {
    status: "running",
    attempts: (state.features[featureKey]?.attempts ?? 0) + 1,
  });
  saveFeatureCompactLoopState(statePath, state);

  const generate = runCommand(
    projectDir,
    "bun",
    ["runner/feature-compact.ts", capabilityId, "--target", target, "--check"],
    600_000,
  );
  if (!generate.ok) {
    const summary = `Feature compact package generation failed for ${featureKey}. ${commandSummary("bun runner/feature-compact.ts", generate)}`;
    updateFeatureCompactItem(state, featureKey, {
      status: generate.stderr.includes("No feature-owned specs")
        ? "blocked"
        : "error",
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "blocked",
      summary,
    });
  }

  const diagnosticsRel =
    firstOutputMatch(
      generate.stdout,
      /\[feature-compact\] diagnostics=(\S+)/,
    ) ?? `features/${capabilityId}/compact/${target}.diagnostics.json`;
  const diagnosticsPath = join(projectDir, diagnosticsRel);
  const diagnostics = readJson<Diagnostics>(diagnosticsPath, {});
  const planRel =
    diagnostics.planPath ||
    firstOutputMatch(generate.stdout, /\[feature-compact\] plan=(\S+)/) ||
    `features/${capabilityId}/compact/${target}.plan.json`;
  const summaryRel =
    diagnostics.summaryPath ||
    firstOutputMatch(generate.stdout, /\[feature-compact\] summary=(\S+)/) ||
    `features/${capabilityId}/compact/${target}.summary.md`;

  if (!existsSync(join(projectDir, planRel))) {
    const summary = `Feature compact package generation for ${featureKey} did not write ${planRel}.`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      lastDiagnosticsPath: diagnosticsRel,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "blocked",
      summary,
    });
  }

  const check = runCommand(
    projectDir,
    "bun",
    ["run", "execute", planRel, "--check", `--parallel=${checkParallel}`],
    900_000,
  );
  const combinedCheckOutput = `${check.stdout}\n${check.stderr}`;
  const resultPath = firstOutputMatch(
    combinedCheckOutput,
    /\[test-executor\] test-result=(\S+)/,
  );
  if (!check.ok) {
    const summary = `Generated tests failed for ${featureKey}. ${commandSummary("bun run execute --check", check)}`;
    updateFeatureCompactItem(state, featureKey, {
      status: "error",
      lastPlanPath: planRel,
      lastSummaryPath: summaryRel,
      lastDiagnosticsPath: diagnosticsRel,
      lastResultPath: resultPath,
      lastSummary: summary,
    });
    saveFeatureCompactLoopState(statePath, state);
    return completion(ctx, config, {
      task,
      attemptId,
      claim: "blocked",
      summary,
    });
  }

  const status = compactStatus(diagnostics.packageStatus);
  const summary = [
    `Feature compact package ${status} for ${featureKey}.`,
    `Plan: ${planRel}.`,
    `Summary: ${summaryRel}.`,
    `Diagnostics: ${diagnosticsRel}.`,
    resultPath ? `Test result: ${resultPath}.` : "",
    diagnostics.metrics
      ? `Specs=${diagnostics.metrics.specsSelected ?? "?"}, clusters=${diagnostics.metrics.clustersNeeded ?? "?"}, saved=${diagnostics.metrics.clustersSaved ?? "?"}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  updateFeatureCompactItem(state, featureKey, {
    status,
    lastPlanPath: planRel,
    lastSummaryPath: summaryRel,
    lastDiagnosticsPath: diagnosticsRel,
    lastResultPath: resultPath,
    lastSummary: summary,
  });
  saveFeatureCompactLoopState(statePath, state);
  return completion(ctx, config, {
    task,
    attemptId,
    claim: status === "blocked" ? "blocked" : "done",
    summary,
  });
}
