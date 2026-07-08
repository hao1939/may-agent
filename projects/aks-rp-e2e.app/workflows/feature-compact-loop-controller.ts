/**
 * feature-compact-loop-controller — bounded controller for feature compact packages.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  workflowResultVersion,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  appendToolJournal,
  assignTask,
  createTask,
  markTaskDone,
  saveTaskTreeWithKanbanSnapshot,
} from "./lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "./lib/task-tree-store.ts";
import { buildTaskTreeConfig, traceValue } from "./default-task-worker.ts";
import {
  field,
  maxConcurrent,
  parseTriggerEvent,
  resolveAppDir,
  sourceDir,
  triggerString,
  triggerValue,
  type TriggerEvent,
} from "./lib/workflow-input.ts";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  orderedPendingFeatureCompactKeys,
  safeFeatureCompactTaskId,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
  type FeatureCompactLoopState,
} from "./lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "./lib/spec-loop-store.ts";
import {
  consumeDispatchedAssignments,
  reopenControllerRootWhenIncomplete,
  requeueOrphanedActiveChildren,
} from "./lib/loop-controller-repair.ts";
import { exactBlockedWaitStewardshipProgress } from "./lib/durable-loop-wait-stewardship.ts";
import {
  activeWorkflowRuns,
  getWorkflowRun,
  resolvePipelineClient,
  type PipelineClient,
  type PipelineRun,
} from "./lib/ado-pipelines.ts";
import {
  capacityPreflightReason,
  inspectLiveWorkflowArtifacts,
  liveAksProofVersion,
} from "./feature-compact-planner.ts";
import {
  fixForwardErrorFingerprint,
  fixForwardInputFingerprint,
} from "./lib/fix-forward.ts";

export const name = "feature-compact-loop-controller";
export const description =
  "Keep a bounded frontier of feature compact planning tasks.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "feature-compact-loop-controller-v1",
  input: {
    required: [
      "project.task.tick action=feature-compact-loop",
      "target.taskId",
    ],
    optional: ["maxConcurrent", "task.context.windowSize"],
    description:
      "Pulse the feature compact loop root, reconcile planner results, and fill the bounded compact-planner frontier.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["summary", "task.context.workflowProgress"],
    description:
      "Updates loop progress, creates or assigns compact-planner children, and keeps non-terminal feature compact records represented by work or exact waits.",
  },
};

const compactRuntimeWriteForbid = [
  "Do not append task refresh, no-decision, progress, or journal notes to features/*/compact/*.summary.md.",
  "Do not write transient loop evidence or task notes into tracked compact package artifacts; keep runtime state in .state/feature-compact-loop/state.json or ignored run artifacts.",
];

function isFeatureCompactLoopTick(trigger: TriggerEvent | null): boolean {
  return (
    trigger?.type === "project.task.tick" &&
    triggerString(trigger, "action") === "feature-compact-loop"
  );
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function taskTrace(task: TaskNode): Record<string, unknown> {
  return task.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function taskConflictScopes(task: TaskNode): string[] {
  return Array.isArray((task as { conflict_scope?: unknown }).conflict_scope)
    ? (task as { conflict_scope: unknown[] }).conflict_scope.filter(
        (scope): scope is string => typeof scope === "string",
      )
    : [];
}

function traceString(task: TaskNode, key: string): string {
  const value = taskTrace(task)[key];
  return typeof value === "string" ? value : "";
}

function safeTaskIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "unknown"
  );
}

function numberContext(task: TaskNode, key: string, fallback: number): number {
  const value = taskContext(task)[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function stringContext(task: TaskNode, key: string, fallback = ""): string {
  const value = taskContext(task)[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function pipelineNameContext(task: TaskNode, fallback: string): string {
  return (
    stringContext(task, "adoPipeline", "") ||
    stringContext(task, "githubWorkflow", fallback)
  );
}

function pipelineLimitContext(task: TaskNode, fallback: number): number {
  const adoLimit = numberContext(task, "adoActiveRunLimit", 0);
  return adoLimit > 0
    ? adoLimit
    : numberContext(task, "githubActiveRunLimit", fallback);
}

function stringArrayContext(task: TaskNode, key: string): string[] {
  const value = taskContext(task)[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function loopTaskIdFromTrigger(trigger: TriggerEvent | null): string {
  const target = triggerValue(trigger, "target");
  if (target && typeof target === "object" && !Array.isArray(target)) {
    const taskId = (target as Record<string, unknown>).taskId;
    if (typeof taskId === "string" && taskId.trim()) return taskId.trim();
  }
  return (
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    triggerString(trigger, "loopTaskId") ||
    triggerString(trigger, "loop_task_id")
  );
}

function taskStatus(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "");
}

function isFeatureCompactChild(task: TaskNode | undefined): task is TaskNode {
  if (!task || task.workflow !== "feature-compact-planner") return false;
  const featureKey = taskContext(task).featureKey;
  return typeof featureKey === "string" && featureKey.trim().length > 0;
}

function findLoopTaskForCompletedChild(
  tasks: Record<string, TaskNode>,
  completedTaskId: string,
): TaskNode | null {
  const child = tasks[completedTaskId];
  if (!child?.parent_id) return null;
  const parent = tasks[child.parent_id];
  if (parent?.workflow === "feature-compact-loop-controller") return parent;
  return null;
}

function releaseContinuingController(input: {
  appDir: string;
  projectDir: string;
  taskId: string;
  summary: string;
}): void {
  const config = buildTaskTreeConfig(
    {
      task: `app: ${input.appDir}\nproject: ${input.projectDir}`,
      agent: "aks-explorer",
    } as WorkflowContext,
    input.appDir,
    input.projectDir,
    1,
  );
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) return;
    const now = new Date().toISOString();
    task.status = "backlog";
    task.state = "backlog";
    task.blocker = undefined;
    task.trace = {
      ...(task.trace ?? {}),
      last_controller_pulse_at: now,
      last_controller_pulse_summary: input.summary,
      previous_attempt_id:
        typeof traceValue(task, "current_attempt_id") === "string"
          ? traceValue(task, "current_attempt_id")
          : undefined,
      current_attempt_id: undefined,
      worker_started_attempt_id: undefined,
    };
    tree.active_task_ids = Object.values(tree.tasks)
      .filter(
        (candidate) =>
          taskStatus(candidate) === "active" &&
          (!candidate.children || candidate.children.length === 0),
      )
      .map((candidate) => candidate.id);
    tree.active_task_id = tree.active_task_ids[0] ?? null;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_controller_continuing",
      task_id: input.taskId,
      summary: input.summary,
    });
  });
}

function openChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter(isFeatureCompactChild)
    .filter((task) => {
      const status = taskStatus(task);
      return status === "active" || status === "backlog";
    }).length;
}

function activeFeatureChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter(isFeatureCompactChild)
    .filter((task) => taskStatus(task) === "active").length;
}

function compactPlannerSlotLimit(input: {
  windowSize: number;
  activeGithubRuns: number;
  githubActiveRunLimit: number;
  dispatchHold: string;
}): number {
  if (input.dispatchHold) return 0;
  const remainingGithubSlots = Math.max(
    0,
    input.githubActiveRunLimit - input.activeGithubRuns,
  );
  return Math.max(0, Math.min(input.windowSize, remainingGithubSlots));
}

function openSupportChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter((task) => !!task && !isFeatureCompactChild(task))
    .filter((task) => {
      const status = taskStatus(task);
      return status !== "done" && status !== "blocked";
    }).length;
}

function representedSupportErrorClasses(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const classes = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!child || isFeatureCompactChild(child)) continue;
    const status = taskStatus(child);
    if (status === "done") continue;
    const context = taskContext(child);
    const errorClass = context.errorClass;
    if (
      context.featureCompactFollowup === true &&
      typeof errorClass === "string" &&
      errorClass.trim()
    ) {
      classes.add(errorClass.trim());
    }
    for (const scope of taskConflictScopes(child)) {
      const trimmed = scope.trim();
      if (!trimmed.startsWith("feature-compact-followup:")) continue;
      const scopedClass = trimmed
        .slice("feature-compact-followup:".length)
        .trim();
      if (scopedClass) classes.add(scopedClass);
    }
  }
  return classes;
}

function blockedWaitChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter((task) => !!task && !isFeatureCompactChild(task))
    .filter((task) => taskStatus(task) === "blocked").length;
}

function taskText(task: TaskNode): string {
  return [
    task.id,
    task.goal,
    ...(Array.isArray(task.acceptance) ? task.acceptance : []),
    ...(Array.isArray(task.inputs) ? task.inputs : []),
    ...(Array.isArray(task.outputs) ? task.outputs : []),
    task.blocker && typeof task.blocker === "object"
      ? JSON.stringify(task.blocker)
      : "",
    task.context && typeof task.context === "object"
      ? JSON.stringify(task.context)
      : "",
  ]
    .filter((part): part is string => typeof part === "string")
    .join("\n");
}

function readSpecStatuses(appDir: string): Map<string, string> {
  const state = readJsonFile(join(appDir, ".state", "spec-loop", "state.json"));
  const specs =
    state?.specs &&
    typeof state.specs === "object" &&
    !Array.isArray(state.specs)
      ? (state.specs as Record<string, unknown>)
      : {};
  const statuses = new Map<string, string>();
  for (const [specId, value] of Object.entries(specs)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const status = (value as Record<string, unknown>).status;
      if (typeof status === "string") statuses.set(specId, status);
    }
  }
  return statuses;
}

function specIdsNamedByTask(
  task: TaskNode | undefined,
  knownSpecIds: Iterable<string>,
): string[] {
  if (!task) return [];
  const named = new Set<string>();
  for (const scope of taskConflictScopes(task)) {
    const specId = scope.trim().replace(/^spec:/, "");
    if (scope.startsWith("spec:")) named.add(specId);
  }
  const text = taskText(task);
  for (const specId of knownSpecIds) {
    if (text.includes(specId)) named.add(specId);
  }
  return [...named].sort((a, b) => a.localeCompare(b));
}

function closeStalePassedSpecBlockedWaitChildren(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    appDir: string;
    loopTaskId: string;
  },
): string[] {
  const specStatuses = readSpecStatuses(input.appDir);
  if (specStatuses.size === 0) return [];
  const closedTaskIds: string[] = [];
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const loopTask = tree.tasks[input.loopTaskId];
    if (!loopTask) return;
    const now = new Date().toISOString();
    for (const childId of loopTask.children ?? []) {
      const child = tree.tasks[childId];
      if (!child || taskStatus(child) !== "blocked") continue;
      const namedSpecIds = specIdsNamedByTask(child, specStatuses.keys());
      if (namedSpecIds.length === 0) continue;
      if (
        !namedSpecIds.every((specId) => specStatuses.get(specId) === "pass")
      ) {
        continue;
      }
      child.status = "done";
      child.state = "done";
      child.done_at = now;
      child.done_by = "feature-compact-loop-controller";
      child.resolution = "completed";
      child.result = `Closed stale compact blocked wait because every named spec already has live pass evidence: ${namedSpecIds.join(", ")}.`;
      child.blocker = undefined;
      child.trace = {
        ...(child.trace ?? {}),
        stale_wait_closed_at: now,
        stale_wait_closed_by: "feature-compact-loop-controller",
        stale_wait_closed_reason:
          "all spec ids named by this compact wait are already pass in spec-loop state",
        stale_wait_spec_ids: namedSpecIds,
      };
      closedTaskIds.push(childId);
    }
    if (closedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
  });
  if (closedTaskIds.length > 0) {
    appendToolJournal(config, {
      kind: "feature_compact_loop_stale_blocked_waits_closed",
      task_id: input.loopTaskId,
      closed_task_ids: closedTaskIds,
    });
  }
  return closedTaskIds;
}

type TerminalCompactGitHubWaitCandidate = {
  taskId: string;
  runId: string;
  featureKeys: string[];
  namedSpecIds: string[];
};

type TerminalCompactGitHubWaitHarvest = {
  harvestedTaskIds: string[];
  terminalRunIds: string[];
  lookupMissRunIds: string[];
  checkedRunIds: string[];
};

function runIdFromCompactWaitTask(task: TaskNode): string {
  const blocker = recordValue(task.blocker);
  const waitingFor = recordValue(blocker?.waiting_for);
  const structuredRunId = stringField(waitingFor, "runId");
  if (/^\d{6,}$/.test(structuredRunId)) return structuredRunId;

  const context = taskContext(task);
  for (const key of [
    "runId",
    "workflowRunId",
    "activeWorkflowRunId",
    "lastRunId",
    "lastWorkflowRunId",
  ]) {
    const value = context[key];
    if (typeof value === "string" && /^\d{6,}$/.test(value.trim())) {
      return value.trim();
    }
  }

  const trace = taskTrace(task);
  for (const key of [
    "runId",
    "workflowRunId",
    "activeWorkflowRunId",
    "lastRunId",
    "lastWorkflowRunId",
  ]) {
    const value = trace[key];
    if (typeof value === "string" && /^\d{6,}$/.test(value.trim())) {
      return value.trim();
    }
  }

  const haystack = JSON.stringify({
    goal: task.goal,
    inputs: task.inputs,
    context: task.context,
    blocker: task.blocker,
    trace: task.trace,
  });
  const match = haystack.match(
    /\b(?:github\s+)?(?:workflow\s+)?run(?:\s+id|Id)?["':\s-]+(\d{6,})\b/i,
  );
  return match?.[1] ?? "";
}

function terminalCompactGitHubWaitCandidates(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: FeatureCompactLoopState;
  knownSpecIds: Iterable<string>;
  limit: number;
}): TerminalCompactGitHubWaitCandidate[] {
  if (!input.loopTask) return [];
  const candidates: TerminalCompactGitHubWaitCandidate[] = [];
  const seenTaskIds = new Set<string>();
  const knownFeatureKeys = Object.keys(input.state.features);
  for (const childId of input.loopTask.children ?? []) {
    if (candidates.length >= input.limit) break;
    const child = input.tasks[childId];
    if (!child || seenTaskIds.has(childId) || isFeatureCompactChild(child)) {
      continue;
    }
    const status = taskStatus(child);
    if (status !== "blocked" && status !== "waiting") continue;
    const runId = runIdFromCompactWaitTask(child);
    if (!runId) continue;
    candidates.push({
      taskId: childId,
      runId,
      featureKeys: [
        ...featureKeysRepresentedByTask({
          task: child,
          knownFeatureKeys,
        }),
      ].sort((a, b) => a.localeCompare(b)),
      namedSpecIds: specIdsNamedByTask(child, input.knownSpecIds),
    });
    seenTaskIds.add(childId);
  }
  return candidates;
}

function terminalRunSummary(run: PipelineRun): string {
  return [
    `status=${run.status ?? "unknown"}`,
    `conclusion=${run.conclusion ?? "unknown"}`,
    run.url ? `url=${run.url}` : "",
    run.displayTitle ? `title=${run.displayTitle}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function harvestTerminalCompactGitHubWaits(input: {
  config: ReturnType<typeof buildTaskTreeConfig>;
  projectDir: string;
  appDir: string;
  loopTaskId: string;
  state: FeatureCompactLoopState;
  client: PipelineClient;
  limit: number;
  getRun?: (runId: string) => PipelineRun | null;
}): TerminalCompactGitHubWaitHarvest {
  const specStatuses = readSpecStatuses(input.appDir);
  const snapshot = readTaskTree(input.config);
  const candidates = terminalCompactGitHubWaitCandidates({
    loopTask: snapshot.tasks[input.loopTaskId],
    tasks: snapshot.tasks,
    state: input.state,
    knownSpecIds: specStatuses.keys(),
    limit: input.limit,
  });
  const checkedRunIds: string[] = [];
  const lookupMissRunIds: string[] = [];
  const terminalByTaskId = new Map<string, PipelineRun>();

  for (const candidate of candidates) {
    checkedRunIds.push(candidate.runId);
    const run =
      input.getRun?.(candidate.runId) ??
      getWorkflowRun({
        client: input.client,
        projectDir: input.projectDir,
        runId: candidate.runId,
      });
    if (!run) {
      lookupMissRunIds.push(candidate.runId);
      continue;
    }
    if (run.status !== "completed") continue;
    terminalByTaskId.set(candidate.taskId, run);
  }

  const harvestedTaskIds: string[] = [];
  const terminalRunIds: string[] = [];
  if (terminalByTaskId.size === 0) {
    return {
      harvestedTaskIds,
      terminalRunIds,
      lookupMissRunIds,
      checkedRunIds,
    };
  }

  withTreeLock(input.config, () => {
    const tree = readTaskTree(input.config);
    const now = new Date().toISOString();
    for (const candidate of candidates) {
      const run = terminalByTaskId.get(candidate.taskId);
      if (!run) continue;
      const child = tree.tasks[candidate.taskId];
      if (!child) continue;
      const status = taskStatus(child);
      if (status !== "blocked" && status !== "waiting") continue;
      if (runIdFromCompactWaitTask(child) !== candidate.runId) continue;

      const previousBlocker = child.blocker;
      child.status = "review";
      child.state = "review";
      child.blocker = undefined;
      child.result = [
        `Azure DevOps pipeline run ${candidate.runId} is terminal; inspect the returned compact artifacts and record branch-level pass/fail/error results, or record the exact artifact recovery blocker.`,
        terminalRunSummary(run),
        candidate.featureKeys.length
          ? `Feature keys: ${candidate.featureKeys.join(", ")}.`
          : "",
        candidate.namedSpecIds.length
          ? `Named specs: ${candidate.namedSpecIds.join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      child.context = {
        ...taskContext(child),
        terminalPipelineWaitReview: {
          runId: candidate.runId,
          runStatus: run.status ?? null,
          runConclusion: run.conclusion ?? null,
          runUrl: run.url ?? null,
          runTitle: run.displayTitle ?? null,
          featureKeys: candidate.featureKeys,
          namedSpecIds: candidate.namedSpecIds,
          observedAt: now,
        },
      };
      child.trace = {
        ...(child.trace ?? {}),
        terminal_pipeline_wait_observed_at: now,
        terminal_pipeline_wait_run_id: candidate.runId,
        terminal_pipeline_wait_run_status: run.status ?? null,
        terminal_pipeline_wait_run_conclusion: run.conclusion ?? null,
        terminal_pipeline_wait_run_url: run.url ?? null,
        terminal_github_wait_observed_at: now,
        terminal_github_wait_run_id: candidate.runId,
        terminal_github_wait_run_status: run.status ?? null,
        terminal_github_wait_run_conclusion: run.conclusion ?? null,
        terminal_github_wait_run_url: run.url ?? null,
        previous_blocker_before_terminal_github_wait_review: previousBlocker,
      };
      for (const featureKey of candidate.featureKeys) {
        const feature = input.state.features[featureKey];
        if (
          !feature ||
          feature.status === "done" ||
          feature.status === "running"
        ) {
          continue;
        }
        updateFeatureCompactItem(input.state, featureKey, {
          taskId: child.id,
          lastWorkflowRunId: candidate.runId,
          lastWorkflowRunUrl: run.url ?? feature.lastWorkflowRunUrl ?? null,
          lastCheckedAt: now,
          lastSummary: `Terminal Azure DevOps pipeline wait observed by feature compact loop controller for run ${candidate.runId}; review task ${child.id} now owns the result.`,
          observedBy: {
            workflow: name,
            taskId: child.id,
            runId: candidate.runId,
            runStatus: run.status ?? null,
            runConclusion: run.conclusion ?? null,
            runUrl: run.url ?? null,
            observedAt: now,
          },
        });
      }
      harvestedTaskIds.push(child.id);
      terminalRunIds.push(candidate.runId);
    }
    if (harvestedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(input.config, tree);
    }
  });

  if (harvestedTaskIds.length > 0) {
    appendToolJournal(input.config, {
      kind: "feature_compact_loop_terminal_github_waits_harvested",
      task_id: input.loopTaskId,
      harvested_task_ids: harvestedTaskIds,
      terminal_run_ids: terminalRunIds,
    });
  }
  return { harvestedTaskIds, terminalRunIds, lookupMissRunIds, checkedRunIds };
}

function featureKeysRepresentedByTask(input: {
  task: TaskNode;
  knownFeatureKeys?: Iterable<string>;
}): Set<string> {
  const keys = new Set<string>();
  const context = taskContext(input.task);

  const explicitFeatureKey = context.featureKey;
  if (typeof explicitFeatureKey === "string" && explicitFeatureKey.trim()) {
    keys.add(explicitFeatureKey.trim());
  }

  const sampledFeatureKeys = context.sampledFeatureKeys;
  if (Array.isArray(sampledFeatureKeys)) {
    for (const sampledFeatureKey of sampledFeatureKeys) {
      if (typeof sampledFeatureKey === "string" && sampledFeatureKey.trim()) {
        keys.add(sampledFeatureKey.trim());
      }
    }
  }

  for (const scope of taskConflictScopes(input.task)) {
    const trimmed = scope.trim();
    if (!trimmed.startsWith("feature-compact:")) continue;
    const featureKey = trimmed.slice("feature-compact:".length).trim();
    if (featureKey) keys.add(featureKey);
  }

  const knownFeatureKeys = [...(input.knownFeatureKeys ?? [])].filter(Boolean);
  if (knownFeatureKeys.length > 0) {
    const searchable = [
      input.task.id,
      input.task.goal,
      ...(input.task.inputs ?? []).filter(
        (value): value is string => typeof value === "string",
      ),
      ...(input.task.outputs ?? []).filter(
        (value): value is string => typeof value === "string",
      ),
    ]
      .join("\n")
      .toLowerCase();
    for (const featureKey of knownFeatureKeys) {
      if (searchable.includes(featureKey.toLowerCase())) {
        keys.add(featureKey);
      }
    }
  }

  return keys;
}

function blockedWaitFeatureKeys(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
  knownFeatureKeys?: Iterable<string>,
): Set<string> {
  const keys = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!child || isFeatureCompactChild(child)) continue;
    if (taskStatus(child) !== "blocked") continue;

    for (const featureKey of featureKeysRepresentedByTask({
      task: child,
      knownFeatureKeys,
    })) {
      keys.add(featureKey);
    }
  }
  return keys;
}

function blockedSupportFeatureKeysForErrorClass(
  loopTask: TaskNode | undefined,
  tasks: Record<string, TaskNode>,
  errorClass: string,
): Set<string> {
  const keys = new Set<string>();
  if (!loopTask) return keys;
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!child || isFeatureCompactChild(child)) continue;
    if (taskStatus(child) !== "blocked") continue;
    if (taskContext(child).errorClass !== errorClass) continue;

    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey === "string" && featureKey.trim()) {
      keys.add(featureKey.trim());
    }

    for (const scope of taskConflictScopes(child)) {
      const trimmed = scope.trim();
      if (!trimmed.startsWith("feature-compact:")) continue;
      const scopedFeatureKey = trimmed.slice("feature-compact:".length).trim();
      if (scopedFeatureKey) keys.add(scopedFeatureKey);
    }
  }
  return keys;
}

function compactErrorClass(item: FeatureCompactItemState): string {
  const durableErrorClass =
    typeof item.errorClass === "string" ? item.errorClass.trim() : "";
  if (durableErrorClass) return durableErrorClass;

  const retryReason = (item.retryReason ?? "").toLowerCase();
  const summary = (item.lastSummary ?? "").toLowerCase();
  const text = `${retryReason}\n${summary}`;

  if (
    summary.includes("shared-fixture carrier") ||
    summary.includes("shared fixture carrier") ||
    summary.includes("carrier gap")
  ) {
    return "shared-fixture-carrier-gap";
  }
  if (summary.includes("partial") || summary.includes("not ready")) {
    return "package-partial";
  }
  if (summary.includes("coverage") || summary.includes("selected")) {
    return "coverage-gap";
  }
  if (summary.includes("check-mode") || summary.includes("check result")) {
    return "check-failure";
  }
  if (
    /\breviewed-exception\b/.test(text) ||
    /\bpipeline\b/.test(text) ||
    /\barm64\b/.test(text) ||
    /\bk8s?>?=?.*1\.34\b/.test(text) ||
    /\bkubernetes>?=?.*1\.34\b/.test(text)
  ) {
    return "reviewed-exception";
  }
  if (
    /\bruntime\/product\b/.test(text) ||
    /\bowner-review lineage\b/.test(text) ||
    /\bnonpass lineage\b/.test(text) ||
    /\bmeaningful remediator runtime\/product change\b/.test(text)
  ) {
    return "runtime-product-lineage";
  }
  if (
    summary.includes("capacity") ||
    summary.includes("quota") ||
    summary.includes("managed clusters")
  ) {
    return "staging-capacity";
  }
  if (
    summary.includes("github") ||
    summary.includes("workflow") ||
    summary.includes("dispatch") ||
    summary.includes("run id")
  ) {
    return "live-workflow";
  }
  if (summary.includes("cleanup")) return "cleanup";
  return "compact-error";
}

type CompactFollowupGroup = {
  errorClass: string;
  count: number;
  featureKeys: string[];
  lastFeatureUpdatedAt: string;
  inputFingerprints: string[];
  errorFingerprints: string[];
};

function compactErrorNeedsFollowup(
  item:
    | FeatureCompactItemState
    | { status?: string; attempts?: number; retryable?: boolean | null },
  maxDirectAttemptsPerFeature: number,
): boolean {
  return (
    item.status === "error" &&
    ((item.attempts ?? 0) >= maxDirectAttemptsPerFeature ||
      item.retryable === false)
  );
}

function compactFollowupGroups(
  state: FeatureCompactLoopState,
  input: {
    maxDirectAttemptsPerFeature: number;
    maxGroups: number;
    representedFeatureKeys?: Set<string>;
    target: string;
    branch: string;
  },
): CompactFollowupGroup[] {
  const groups = new Map<string, CompactFollowupGroup>();
  for (const [featureKey, item] of Object.entries(state.features)) {
    if (
      !compactErrorNeedsFollowup(item, input.maxDirectAttemptsPerFeature) ||
      input.representedFeatureKeys?.has(featureKey)
    ) {
      continue;
    }
    const errorClass = compactErrorClass(item);
    if (
      errorClass === "reviewed-exception" ||
      errorClass === "runtime-product-lineage"
    ) {
      continue;
    }
    const group = groups.get(errorClass) ?? {
      errorClass,
      count: 0,
      featureKeys: [],
      lastFeatureUpdatedAt: "",
      inputFingerprints: [],
      errorFingerprints: [],
    };
    group.count += 1;
    if (group.featureKeys.length < 20) group.featureKeys.push(featureKey);
    if (item.updatedAt && item.updatedAt > group.lastFeatureUpdatedAt) {
      group.lastFeatureUpdatedAt = item.updatedAt;
    }
    const inputFingerprint =
      item.inputFingerprint ||
      fixForwardInputFingerprint({
        featureKey,
        target: input.target,
        branch: input.branch,
        planPath: item.lastPlanPath,
        diagnosticsPath: item.lastDiagnosticsPath,
      });
    const errorFingerprint =
      item.errorFingerprint ||
      fixForwardErrorFingerprint({
        status: item.status,
        failureClass: errorClass,
        reason: item.retryReason || item.lastSummary || "",
        resultPath: item.lastResultPath,
      });
    if (!group.inputFingerprints.includes(inputFingerprint)) {
      group.inputFingerprints.push(inputFingerprint);
    }
    if (!group.errorFingerprints.includes(errorFingerprint)) {
      group.errorFingerprints.push(errorFingerprint);
    }
    groups.set(errorClass, group);
  }
  return [...groups.values()]
    .sort(
      (a, b) => b.count - a.count || a.errorClass.localeCompare(b.errorClass),
    )
    .slice(0, input.maxGroups);
}

function compactFollowupTaskId(group: CompactFollowupGroup): string {
  return `reconcile-compact-loop-${safeTaskIdPart(group.errorClass)}`;
}

function taskTimestamp(task: TaskNode, key: string): number | null {
  const direct = (task as Record<string, unknown>)[key];
  const traced = taskTrace(task)[key];
  const value = typeof direct === "string" ? direct : traced;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactFollowupTaskCoversGroup(
  task: TaskNode,
  group: CompactFollowupGroup,
): boolean {
  const context = taskContext(task);
  if (context.featureCompactFollowup !== true) return false;
  if (context.errorClass !== group.errorClass) return false;

  const totalFeatureCount = context.totalFeatureCount;
  if (
    typeof totalFeatureCount === "number" &&
    totalFeatureCount !== group.count
  ) {
    return false;
  }

  const sampledFeatureKeys = Array.isArray(context.sampledFeatureKeys)
    ? context.sampledFeatureKeys.filter(
        (featureKey): featureKey is string => typeof featureKey === "string",
      )
    : [];
  if (
    sampledFeatureKeys.length > 0 &&
    sampledFeatureKeys.join("\n") !== group.featureKeys.join("\n")
  ) {
    return false;
  }

  return true;
}

type CompactRetryResetDirective = {
  errorClass?: string;
  featureKeys: string[];
  reason: string;
  resetAttemptsTo: number;
  includeBlockedWaits: boolean;
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function stringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function compactRetryResetDirectivesFromValue(
  value: unknown,
): CompactRetryResetDirective[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const directives: CompactRetryResetDirective[] = [];
  for (const entry of values) {
    const record = recordValue(entry);
    if (!record) continue;
    const featureKeys = [
      ...stringArrayValue(record.featureKeys),
      ...stringArrayValue(record.features),
      ...stringArrayValue(record.featureKey),
    ];
    const errorClass =
      typeof record.errorClass === "string" && record.errorClass.trim()
        ? record.errorClass.trim()
        : undefined;
    if (!errorClass && featureKeys.length === 0) continue;

    const resetAttemptsTo =
      typeof record.resetAttemptsTo === "number" &&
      Number.isFinite(record.resetAttemptsTo) &&
      record.resetAttemptsTo >= 0
        ? Math.floor(record.resetAttemptsTo)
        : 0;
    const reason =
      typeof record.reason === "string" && record.reason.trim()
        ? record.reason.trim()
        : "retry budget reset requested by completed compact repair task";

    directives.push({
      errorClass,
      featureKeys: [...new Set(featureKeys)],
      reason,
      resetAttemptsTo,
      includeBlockedWaits: record.includeBlockedWaits === true,
    });
  }
  return directives;
}

function compactRetryResetDirectives(
  task: TaskNode,
): CompactRetryResetDirective[] {
  const context = taskContext(task);
  const trace = taskTrace(task);
  const workflowResult = recordValue(trace.workflowResult);
  const details = recordValue(workflowResult?.details);
  return [
    ...compactRetryResetDirectivesFromValue(context.compactRetryReset),
    ...compactRetryResetDirectivesFromValue(context.compactRetryResets),
    ...compactRetryResetDirectivesFromValue(trace.compactRetryReset),
    ...compactRetryResetDirectivesFromValue(trace.compactRetryResets),
    ...compactRetryResetDirectivesFromValue(workflowResult?.compactRetryReset),
    ...compactRetryResetDirectivesFromValue(details?.compactRetryReset),
  ];
}

function taskTextValues(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function inferredCompactRetryResetDirective(
  task: TaskNode,
): CompactRetryResetDirective | null {
  const context = taskContext(task);
  const trace = taskTrace(task);
  const reviewedTask = recordValue(context.reviewedTask);
  const featureKeys = new Set<string>();

  if (context.featureCompactFocusedDiagnostic === true) {
    return null;
  }

  const directFeatureKey = context.featureKey;
  if (typeof directFeatureKey === "string" && directFeatureKey.trim()) {
    featureKeys.add(directFeatureKey.trim());
  }
  for (const scope of taskConflictScopes(task)) {
    const trimmed = scope.trim();
    if (!trimmed.startsWith("feature-compact:")) continue;
    const featureKey = trimmed.slice("feature-compact:".length).trim();
    if (featureKey) featureKeys.add(featureKey);
  }

  // Grouped family tasks must opt in with structured compactRetryReset. Their
  // text often says "classified" or "no rerun"; inferring a family-wide retry
  // would create noisy live work.
  if (
    context.featureCompactFollowup === true &&
    typeof context.errorClass === "string" &&
    featureKeys.size === 0
  ) {
    return null;
  }
  if (featureKeys.size === 0) return null;

  const text = [
    task.result,
    context.acceptance_note,
    trace.last_worker_summary,
    trace.review_summary,
    reviewedTask?.summary,
    ...taskTextValues(reviewedTask?.findings),
    ...taskTextValues(reviewedTask?.feedback),
    ...taskTextValues(reviewedTask?.suggestedFollowups),
  ]
    .filter((value): value is string => typeof value === "string")
    .join("\n")
    .toLowerCase();

  const hasRetryIntent =
    /\b(requeue|requeued|rerun|retry|retrying)\b/.test(text) ||
    /\b(live[- ]dispatchable|live dispatch ready|live proof|live verification)\b/.test(
      text,
    ) ||
    /\b(package is ready|ready package|package.*ready|fixed|repaired|resolved)\b/.test(
      text,
    );
  const hasNoRetryIntent =
    /\b(no|not|without)\b[^.\n]{0,80}\b(rerun|requeue|dispatch|live run|live proof|live verification)\b/.test(
      text,
    ) ||
    /\b(do not|don't)\b[^.\n]{0,80}\b(rerun|requeue|dispatch|live run|live proof|live verification)\b/.test(
      text,
    ) ||
    /\b(no-rerun|no broad .*rerun|not truthful.*rerun)\b/.test(text);

  if (!hasRetryIntent || hasNoRetryIntent) return null;

  return {
    featureKeys: [...featureKeys],
    reason:
      "accepted compact repair indicates the exact feature is ready for another live proof attempt",
    resetAttemptsTo: 0,
    includeBlockedWaits: false,
  };
}

function allCompactRetryResetDirectives(
  task: TaskNode,
): CompactRetryResetDirective[] {
  const explicit = compactRetryResetDirectives(task);
  const inferred = inferredCompactRetryResetDirective(task);
  return inferred ? [...explicit, inferred] : explicit;
}

function compactRetryResetMatches(
  directive: CompactRetryResetDirective,
  featureKey: string,
  item: FeatureCompactItemState,
): boolean {
  if (directive.featureKeys.length > 0) {
    return directive.featureKeys.includes(featureKey);
  }
  return Boolean(
    directive.errorClass && compactErrorClass(item) === directive.errorClass,
  );
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type CompactSpecResult = {
  specId: string;
  status: string;
  reason: string;
  category: string;
};

type CompactResult = {
  status: string;
  targetSurface: string;
  specResults: CompactSpecResult[];
};

function absolutePath(
  baseDir: string,
  path: string | null | undefined,
): string {
  if (!path) return "";
  return path.startsWith("/") ? path : join(baseDir, path);
}

function compactResultFromItem(input: {
  appDir: string;
  item: FeatureCompactItemState;
}): CompactResult | null {
  const resultPath = absolutePath(input.appDir, input.item.lastResultPath);
  if (!resultPath || !existsSync(resultPath)) return null;
  const raw = readJsonFile(resultPath);
  if (!raw) return null;
  const specResults = Array.isArray(raw.specResults)
    ? raw.specResults
        .map((entry): CompactSpecResult | null => {
          const record = recordValue(entry);
          const specId = stringField(record, "specId");
          if (!specId) return null;
          return {
            specId,
            status: stringField(record, "status").toLowerCase(),
            reason: stringField(record, "reason"),
            category: stringField(record, "category"),
          };
        })
        .filter((entry): entry is CompactSpecResult => Boolean(entry))
    : [];
  if (specResults.length === 0) return null;
  const target = recordValue(raw.target);
  return {
    status: stringField(raw, "status").toLowerCase(),
    targetSurface: stringField(target, "surface"),
    specResults,
  };
}

function compactResultIsLive(result: CompactResult): boolean {
  return result.targetSurface === "live-azure-run";
}

function compactResultPassingSpecs(result: CompactResult): CompactSpecResult[] {
  if (!compactResultIsLive(result)) return [];
  return result.specResults.filter((entry) => entry.status === "pass");
}

function compactResultNonPassingSpecs(
  result: CompactResult,
): CompactSpecResult[] {
  if (!compactResultIsLive(result)) return [];
  return result.specResults.filter(
    (entry) =>
      entry.status !== "pass" &&
      entry.category !== "environment_blocker" &&
      !/capacity preflight|managed clusters|cluster create slots|quota/i.test(
        entry.reason,
      ),
  );
}

function syncCompactPassesToSpecLoop(input: {
  appDir: string;
  projectDir: string;
  compactState: FeatureCompactLoopState;
}): string[] {
  const specStatePath = defaultSpecLoopStatePath(input.appDir);
  const specLoop = loadSpecLoopState({
    appDir: input.appDir,
    projectDir: input.projectDir,
    loopTaskId: "aks-spec-verification-loop",
    windowSize: 5,
    statePath: specStatePath,
  }).state;
  const synced = new Set<string>();
  for (const item of Object.values(input.compactState.features)) {
    const result = compactResultFromItem({ appDir: input.appDir, item });
    if (!result) continue;
    for (const spec of compactResultPassingSpecs(result)) {
      updateSpecLoopSpec(specLoop, spec.specId, {
        status: "pass",
        taskId: item.taskId ?? null,
        lastRunId: item.lastWorkflowRunId,
        lastRunUrl: item.lastWorkflowRunUrl,
        lastResultPath: item.lastResultPath,
        review: {
          source: "feature-compact-loop",
          featureKey: item.featureKey,
          compactWorkflowRunId: item.lastWorkflowRunId,
          compactResultPath: item.lastResultPath,
          summary:
            spec.reason ||
            `Spec passed as part of compact feature ${item.featureKey}.`,
        },
      });
      synced.add(spec.specId);
    }
  }
  if (synced.size > 0) saveSpecLoopState(specStatePath, specLoop);
  return [...synced].sort((a, b) => a.localeCompare(b));
}

function focusedFailedBranchTaskId(input: {
  featureKey: string;
  specId: string;
  tasks: Record<string, TaskNode>;
}): string {
  const base = `verify-compact-${safeTaskIdPart(input.featureKey)}-${safeTaskIdPart(input.specId.replace(/^spec\./, ""))}`;
  if (!input.tasks[base]) return base;
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 12);
  const suffix = `-${stamp}`;
  let candidate = `${base.slice(0, Math.max(1, 120 - suffix.length))}${suffix}`;
  let counter = 2;
  while (input.tasks[candidate]) {
    const nextSuffix = `${suffix}-${counter}`;
    candidate = `${base.slice(0, Math.max(1, 120 - nextSuffix.length))}${nextSuffix}`;
    counter += 1;
  }
  return candidate;
}

function hasOpenFocusedFailedBranchTask(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  featureKey: string;
  specId: string;
}): boolean {
  if (!input.loopTask) return false;
  const scope = `compact-failed-branch:${input.featureKey}:${input.specId}`;
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!child) continue;
    const status = taskStatus(child);
    if (status === "done" || status === "cancelled") continue;
    const context = taskContext(child);
    if (
      context.featureCompactFocusedSpec === true &&
      context.featureKey === input.featureKey &&
      context.specId === input.specId
    ) {
      return true;
    }
    if (taskConflictScopes(child).includes(scope)) return true;
  }
  return false;
}

function materializeFocusedFailedBranchDiagnosticTasks(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    appDir: string;
    loopTask: TaskNode | undefined;
    tasks: Record<string, TaskNode>;
    state: FeatureCompactLoopState;
    target: string;
    branch: string;
    singleSpecWorkflow: string;
    timeoutMinutes: string;
    specStateRef: string;
    maxTasks: number;
  },
): string[] {
  if (!input.loopTask) return [];
  const createdTaskIds: string[] = [];
  for (const [featureKey, item] of Object.entries(input.state.features)) {
    if (createdTaskIds.length >= input.maxTasks) break;
    if (item.status !== "error") continue;
    const result = compactResultFromItem({
      appDir: input.appDir,
      item,
    });
    if (!result) continue;
    for (const spec of compactResultNonPassingSpecs(result)) {
      if (createdTaskIds.length >= input.maxTasks) break;
      if (
        hasOpenFocusedFailedBranchTask({
          loopTask: input.loopTask,
          tasks: input.tasks,
          featureKey,
          specId: spec.specId,
        })
      ) {
        continue;
      }
      const taskId = focusedFailedBranchTaskId({
        featureKey,
        specId: spec.specId,
        tasks: input.tasks,
      });
      createTask(config, {
        id: taskId,
        parentId: input.loopTask.id,
        priority: "P1",
        goal: `Diagnose the failed compact branch ${spec.specId} from ${featureKey} and decide the smallest truthful rerun or repair.`,
        inputs: [
          `feature:${featureKey}`,
          `spec:${spec.specId}`,
          `sourceCompactRun:${item.lastWorkflowRunId ?? ""}`,
          `sourceCompactResult:${item.lastResultPath ?? ""}`,
          `workflow:${input.singleSpecWorkflow}`,
          `target:${input.target}`,
          `timeoutMinutes:${input.timeoutMinutes}`,
        ],
        outputs: [
          input.specStateRef,
          "runs/test-results/",
          "test-results/",
          "evidence/archive/",
        ],
        acceptance: [
          "The compact branch artifact and same-run assertion evidence were reviewed.",
          "If existing same-run evidence is enough, update the spec/compact state with that classification and do not rerun.",
          "If isolation needs live proof, create or requeue one exact single-spec verifier for this spec only.",
          "If a repo-local test/spec/planner fix is needed first, record the exact fix and rerun only after that change is made.",
          "The result is recorded as a focused spec/test/product issue or exact rerun request, not a broad compact-planner issue.",
        ],
        forbidden: compactRuntimeWriteForbid,
        conflict_scope: [
          `feature-compact:${featureKey}`,
          `feature:${featureKey}`,
          `spec:${spec.specId}`,
          `compact-failed-branch:${featureKey}:${spec.specId}`,
        ],
        context: {
          featureCompactFocusedSpec: true,
          featureCompactFocusedDiagnostic: true,
          requiresGitHubRun: false,
          featureKey,
          specId: spec.specId,
          sourceCompactWorkflowRunId: item.lastWorkflowRunId,
          sourceCompactWorkflowRunUrl: item.lastWorkflowRunUrl,
          sourceCompactResultPath: item.lastResultPath,
          sourceCompactStatus: result.status,
          sourceCompactBranchStatus: spec.status,
          sourceCompactBranchReason: spec.reason,
          sourceCompactBranchCategory: spec.category,
          adoPipeline: input.singleSpecWorkflow,
          target: input.target,
          branch: input.branch,
          timeoutMinutes: input.timeoutMinutes,
          stateRef: input.specStateRef,
          loopTaskId: "aks-spec-verification-loop",
        },
      });
      createdTaskIds.push(taskId);
    }
  }
  return createdTaskIds;
}

function currentPlanAllowsLiveDispatch(input: {
  projectDir: string;
  featureKey: string;
  item: FeatureCompactItemState;
  target: string;
}): boolean {
  const planPath =
    input.item.lastPlanPath ||
    `features/${input.featureKey}/compact/${input.target}.plan.json`;
  const absolutePlanPath = join(input.projectDir, planPath);
  if (!existsSync(absolutePlanPath)) return false;
  const plan = readJsonFile(absolutePlanPath);
  const gate = recordValue(plan?.liveDispatchGate);
  return gate?.allowed === true;
}

function stalePackageGateSummary(summary: string | null | undefined): boolean {
  const normalized = (summary ?? "").toLowerCase();
  return (
    normalized.includes("compact package is incomplete") ||
    normalized.includes("feature compact package is incomplete") ||
    (normalized.includes("feature compact package for") &&
      (normalized.includes(" is partial;") ||
        normalized.includes(" is blocked;")) &&
      (normalized.includes(
        "live github dispatch is intentionally blocked until the package becomes ready",
      ) ||
        normalized.includes(
          "live azure devops pipeline dispatch is intentionally blocked until the package becomes ready",
        )))
  );
}

function reconcileReadyCompactArtifacts(input: {
  projectDir: string;
  state: FeatureCompactLoopState;
  target: string;
}): string[] {
  const resetFeatureKeys: string[] = [];
  for (const [featureKey, item] of Object.entries(input.state.features)) {
    if (item.status !== "error") continue;
    if (!stalePackageGateSummary(item.lastSummary)) continue;
    if (
      !currentPlanAllowsLiveDispatch({
        projectDir: input.projectDir,
        featureKey,
        item,
        target: input.target,
      })
    ) {
      continue;
    }
    updateFeatureCompactItem(input.state, featureKey, {
      status: "pending",
      retryable: true,
      retryReason: null,
      taskId: null,
      attempts: 0,
      lastWorkflowRunId: null,
      lastWorkflowRunUrl: null,
      lastWorkflowLoopKey: null,
      lastDispatchMetadataPath: null,
      lastLiveProofVersion: null,
      lastSummary: `Reset compact feature ${featureKey}: current compact plan is live-dispatchable, so the previous package-gate error is stale and needs a fresh live proof.`,
    });
    resetFeatureKeys.push(featureKey);
  }
  return resetFeatureKeys.sort((a, b) => a.localeCompare(b));
}

function applyCompactRetryResets(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: FeatureCompactLoopState;
  maxDirectAttemptsPerFeature: number;
  blockedWaits: Set<string>;
}): string[] {
  if (!input.loopTask) return [];
  const resetFeatureKeys = new Set<string>();
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!child || isFeatureCompactChild(child)) continue;
    if (taskStatus(child) !== "done") continue;

    for (const directive of allCompactRetryResetDirectives(child)) {
      const terminalAt =
        taskTimestamp(child, "done_at") ??
        taskTimestamp(child, "reviewed_at") ??
        taskTimestamp(child, "last_worker_completed_at");
      if (terminalAt === null) continue;

      for (const [featureKey, item] of Object.entries(input.state.features)) {
        if (item.status !== "error") continue;
        if (
          item.retryable !== false &&
          (item.attempts ?? 0) < input.maxDirectAttemptsPerFeature
        ) {
          continue;
        }
        if (
          input.blockedWaits.has(featureKey) &&
          !directive.includeBlockedWaits
        ) {
          continue;
        }
        if (!compactRetryResetMatches(directive, featureKey, item)) continue;

        const itemUpdatedAt = Date.parse(item.updatedAt || "");
        if (Number.isFinite(itemUpdatedAt) && terminalAt < itemUpdatedAt) {
          continue;
        }

        updateFeatureCompactItem(input.state, featureKey, {
          status: "pending",
          taskId: null,
          attempts: directive.resetAttemptsTo,
          lastWorkflowRunId: null,
          lastWorkflowRunUrl: null,
          lastWorkflowLoopKey: null,
          lastDispatchMetadataPath: null,
          lastSummary: `Reset compact retry budget for ${featureKey} after ${child.id}: ${directive.reason}`,
        });
        resetFeatureKeys.add(featureKey);
      }
    }
  }
  return [...resetFeatureKeys].sort((a, b) => a.localeCompare(b));
}

function existingOpenCompactFollowupTaskId(
  tasks: Record<string, TaskNode>,
  group: CompactFollowupGroup,
): string | null {
  for (const task of Object.values(tasks)) {
    const status = taskStatus(task);
    if (status !== "done" && status !== "blocked" && status !== "cancelled") {
      if (compactFollowupTaskCoversGroup(task, group)) return task.id;
      if (
        taskConflictScopes(task).includes(
          `feature-compact-followup:${group.errorClass}`,
        )
      ) {
        return task.id;
      }
    }
  }
  return null;
}

function nextCompactFollowupTaskId(
  tasks: Record<string, TaskNode>,
  group: CompactFollowupGroup,
): string | null {
  if (existingOpenCompactFollowupTaskId(tasks, group)) return null;

  const base = compactFollowupTaskId(group);
  const existing = tasks[base];
  if (!existing) return base;

  const existingStatus = taskStatus(existing);
  if (
    existingStatus !== "done" &&
    existingStatus !== "blocked" &&
    existingStatus !== "cancelled"
  ) {
    return null;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 12);
  const suffix = `-${stamp}`;
  const prefix = base.slice(0, Math.max(1, 120 - suffix.length));
  let candidate = `${prefix}${suffix}`;
  let counter = 2;
  while (tasks[candidate]) {
    const nextSuffix = `${suffix}-${counter}`;
    candidate = `${base.slice(0, Math.max(1, 120 - nextSuffix.length))}${nextSuffix}`;
    counter += 1;
  }
  return candidate;
}

function materializeFeatureCompactFollowups(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    loopTask: TaskNode;
    state: FeatureCompactLoopState;
    stateRef: string;
    target: string;
    branch: string;
    maxDirectAttemptsPerFeature: number;
    maxGroups: number;
    representedFeatureKeys?: Set<string>;
  },
): string[] {
  const groups = compactFollowupGroups(input.state, {
    maxDirectAttemptsPerFeature: input.maxDirectAttemptsPerFeature,
    maxGroups: input.maxGroups,
    representedFeatureKeys: input.representedFeatureKeys,
    target: input.target,
    branch: input.branch,
  });
  const createdTaskIds: string[] = [];
  for (const group of groups) {
    const latestTree = readTaskTree(config);
    const taskId = nextCompactFollowupTaskId(latestTree.tasks, group);
    if (!taskId) continue;
    if (latestTree.tasks[taskId]) continue;
    const isCapacityWait = group.errorClass === "staging-capacity";
    createTask(config, {
      id: taskId,
      parentId: input.loopTask.id,
      priority: isCapacityWait ? "P2" : "P1",
      goal: isCapacityWait
        ? `Hold ${group.count} feature compact package(s) on exact ${input.target} capacity wait until managed-cluster headroom returns or quota changes.`
        : `Reconcile ${group.count} retry-drained feature compact error(s) in the ${group.errorClass} family, repair what is fixable, and requeue live proof only after a meaningful package/runtime change.`,
      inputs: [
        `errorClass:${group.errorClass}`,
        `target:${input.target}`,
        `branch:${input.branch}`,
        `state:${input.stateRef}`,
        ...group.featureKeys.map((featureKey) => `feature:${featureKey}`),
      ],
      outputs: [input.stateRef, "features/", "evidence/archive/"],
      acceptance: isCapacityWait
        ? [
            "This wait remains truthful only while sampled compact features already have exact staging capacity evidence.",
            "Resume only after managed-cluster headroom returns, quota changes, or an explicit reroute target is accepted.",
            "Do not reset retry budget or dispatch live proof while this wait condition remains true.",
          ]
        : [
            "Every sampled compact feature has a concrete root-cause classification.",
            "Before any rerun, compare inputFingerprint and errorFingerprint; rerun only after the compact package, generated test, runner, target config, diagnosis, or external fact changed.",
            "Every fixable package, planner, generated-test, or workflow issue was repaired and the affected feature was requeued for a meaningful live run.",
            "If no bounded repo-local fix remains, an exact escalation or wait records owner/environment/product reason, affected features, attempted fixes, and resume condition.",
            "Feature compact state was updated to match the repair, requeue, or escalation decision; feature-owned compact artifacts were updated only for material reusable package/spec changes.",
          ],
      forbidden: compactRuntimeWriteForbid,
      conflict_scope: [
        `feature-compact-followup:${group.errorClass}`,
        ...(isCapacityWait
          ? group.featureKeys.map(
              (featureKey) => `feature-compact:${featureKey}`,
            )
          : []),
        ...group.featureKeys
          .slice(0, 8)
          .map((featureKey) => `feature:${featureKey}`),
      ],
      context: {
        featureCompactFollowup: true,
        workflow: "fix-forward",
        subjectKind: "compact-feature-family",
        errorClass: group.errorClass,
        totalFeatureCount: group.count,
        sampledFeatureKeys: group.featureKeys,
        inputFingerprints: group.inputFingerprints,
        errorFingerprints: group.errorFingerprints,
        stateRef: input.stateRef,
        target: input.target,
        branch: input.branch,
      },
    });
    const createdTree = readTaskTree(config);
    if (!createdTree.tasks[taskId]) continue;
    if (isCapacityWait) {
      const tree = createdTree;
      const task = tree.tasks[taskId];
      const blockedAt = new Date().toISOString();
      const nextCheckAt = new Date(
        Date.parse(blockedAt) + 10 * 60 * 1000,
      ).toISOString();
      const fallbackAt = new Date(
        Date.parse(blockedAt) + 6 * 60 * 60 * 1000,
      ).toISOString();
      const reason = `Blocked on ${input.target} managed-cluster capacity for feature compact live proof: ${group.featureKeys.join(", ")}.`;
      const waitingCondition =
        "Resume when staging managed-cluster headroom returns, quota changes, or an accepted reroute target is written into the compact plan target.";
      const waitingFor = {
        type: "azure.capacity.available",
        target: input.target,
        resource: "managedClusters",
        scope: "feature-compact-live-proof",
        featureKeys: group.featureKeys,
      };
      const observedBy = {
        workflow: "feature-compact-loop-controller",
        trigger: "project.task.tick",
      };
      const observationMethod =
        "On each compact-loop tick, recheck staging managed-cluster headroom and reroute evidence before dispatching more compact live proof.";
      if (task) {
        task.state = "blocked";
        task.status = "blocked";
        task.blocker = {
          condition: reason,
          category: "external-wait",
          owner: "operator",
          blocked_at: blockedAt,
          waiting_for: waitingFor,
          observed_by: observedBy,
          observation_method: observationMethod,
          next_check_at: nextCheckAt,
          resume_condition: waitingCondition,
          resume_action:
            "Rerun the compact loop controller after capacity returns or the accepted reroute target is configured.",
          fallback_at: fallbackAt,
          fallback_action:
            "Recheck managed-cluster capacity and escalate to the operator if the wait is still true.",
          evidence: group.featureKeys.map(
            (featureKey) => `feature-compact:${featureKey}`,
          ),
        } as typeof task.blocker;
        task.trace = {
          ...(task.trace ?? {}),
          blocked_at: blockedAt,
        };
        saveTaskTreeWithKanbanSnapshot(config, tree);
      }
      for (const featureKey of group.featureKeys) {
        updateFeatureCompactItem(input.state, featureKey, {
          status: "blocked",
          errorClass: group.errorClass,
          retryable: false,
          retryReason: waitingCondition,
          blockedAt,
          blockedReason: reason,
          waitingFor,
          waitingCondition,
          observedBy,
          observationMethod,
          nextCheckAt,
          resumeCondition: waitingCondition,
          blockerOwner: "operator",
          fallbackAt,
          fallbackAction:
            "Recheck managed-cluster capacity and escalate to the operator if the wait is still true.",
          resumeAction:
            "Rerun the compact loop controller after capacity returns or the accepted reroute target is configured.",
          blockedScope: {
            kind: "feature",
            ids: [featureKey],
          },
          blockedFingerprint: {
            errorClass: group.errorClass,
            target: input.target,
            branch: input.branch,
            featureKey,
          },
          lastCheckedAt: blockedAt,
        });
      }
    }
    createdTaskIds.push(taskId);
  }
  return createdTaskIds;
}

function existingFeatureKeys(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const keys = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!isFeatureCompactChild(child)) continue;
    const status = taskStatus(child);
    if (status !== "active" && status !== "backlog" && status !== "waiting")
      continue;
    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey === "string" && featureKey.trim())
      keys.add(featureKey.trim());
  }
  return keys;
}

function openFeatureScopedChildKeys(
  loopTask: TaskNode | undefined,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const keys = new Set<string>();
  if (!loopTask) return keys;
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!child) continue;
    const status = taskStatus(child);
    if (status === "done" || status === "cancelled") continue;

    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey === "string" && featureKey.trim()) {
      keys.add(featureKey.trim());
    }

    const sampledFeatureKeys = taskContext(child).sampledFeatureKeys;
    if (Array.isArray(sampledFeatureKeys)) {
      for (const sampledFeatureKey of sampledFeatureKeys) {
        if (typeof sampledFeatureKey === "string" && sampledFeatureKey.trim()) {
          keys.add(sampledFeatureKey.trim());
        }
      }
    }

    for (const scope of taskConflictScopes(child)) {
      const trimmed = scope.trim();
      if (!trimmed.startsWith("feature-compact:")) continue;
      const scopedFeatureKey = trimmed.slice("feature-compact:".length).trim();
      if (scopedFeatureKey) keys.add(scopedFeatureKey);
    }
  }
  return keys;
}

function hasCurrentLiveProof(
  item:
    | {
        lastLiveProofVersion?: string | null;
        lastWorkflowRunId?: string | null;
      }
    | undefined,
): boolean {
  return (
    item?.lastLiveProofVersion === liveAksProofVersion &&
    Boolean(item.lastWorkflowRunId)
  );
}

function backlogChildTaskIds(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): string[] {
  return (loopTask.children ?? []).filter((childId) => {
    const child = tasks[childId];
    return isFeatureCompactChild(child) && taskStatus(child) === "backlog";
  });
}

function backlogSupportChildTaskIds(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): string[] {
  return (loopTask.children ?? []).filter((childId) => {
    const child = tasks[childId];
    return (
      !!child &&
      !isFeatureCompactChild(child) &&
      taskStatus(child) === "backlog"
    );
  });
}

function supportChildRequiresPipelineRun(task: TaskNode | undefined): boolean {
  if (!task) return false;
  const context = taskContext(task);
  return (
    context.requiresPipelineRun === true ||
    context.requiresGitHubRun === true ||
    task.workflow === "single-spec-verifier"
  );
}

function supportChildAssignmentPriority(task: TaskNode | undefined): number {
  if (!task) return 100;
  const context = taskContext(task);
  if (context.featureCompactFocusedDiagnostic === true) return 0;
  if (context.featureCompactFocusedSpec === true) return 1;
  if (context.featureCompactFollowup === true) return 10;
  return 20;
}

function orderedSupportCandidateIds(
  ids: string[],
  tasks: Record<string, TaskNode>,
): string[] {
  return [...ids].sort((a, b) => {
    const priority =
      supportChildAssignmentPriority(tasks[a]) -
      supportChildAssignmentPriority(tasks[b]);
    return priority || a.localeCompare(b);
  });
}

function normalizeFocusedBranchDiagnostics(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: { loopTask: TaskNode | undefined },
): string[] {
  if (!input.loopTask) return [];
  const normalizedTaskIds: string[] = [];
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const loopTask = tree.tasks[input.loopTask?.id ?? ""];
    if (!loopTask) return;
    for (const childId of loopTask.children ?? []) {
      const child = tree.tasks[childId];
      if (!child) continue;
      const context = taskContext(child);
      if (context.featureCompactFocusedSpec !== true) continue;
      if (context.featureCompactFocusedDiagnostic === true) continue;
      const status = taskStatus(child);
      if (status !== "backlog" && status !== "active") continue;

      child.workflow = undefined;
      child.goal =
        typeof context.specId === "string" &&
        typeof context.featureKey === "string"
          ? `Diagnose the failed compact branch ${context.specId} from ${context.featureKey} and decide the smallest truthful rerun or repair.`
          : child.goal;
      child.acceptance = [
        "The compact branch artifact and same-run assertion evidence were reviewed.",
        "If existing same-run evidence is enough, update the spec/compact state with that classification and do not rerun.",
        "If isolation needs live proof, create or requeue one exact single-spec verifier for this spec only.",
        "If a repo-local test/spec/planner fix is needed first, record the exact fix and rerun only after that change is made.",
        "The result is recorded as a focused spec/test/product issue or exact rerun request, not a broad compact-planner issue.",
      ];
      child.context = {
        ...context,
        featureCompactFocusedDiagnostic: true,
        requiresGitHubRun: false,
      };
      child.trace = {
        ...(child.trace ?? {}),
        focused_branch_normalized_at: new Date().toISOString(),
        focused_branch_normalized_by: "feature-compact-loop-controller",
        focused_branch_previous_workflow: "single-spec-verifier",
      };
      normalizedTaskIds.push(childId);
    }
    if (normalizedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
  });
  if (normalizedTaskIds.length > 0) {
    appendToolJournal(config, {
      kind: "feature_compact_focused_branch_diagnostics_normalized",
      task_ids: normalizedTaskIds,
    });
  }
  return normalizedTaskIds;
}

function retryTaskIdForFeature(
  featureKey: string,
  tasks: Record<string, TaskNode>,
  sequence: number,
): string {
  const base = safeFeatureCompactTaskId(featureKey);
  if (!tasks[base]) return base;
  const stamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 12);
  const suffix = `-retry-${stamp}-${sequence}`;
  const prefix = base.slice(0, Math.max(1, 120 - suffix.length));
  let candidate = `${prefix}${suffix}`;
  let counter = 2;
  while (tasks[candidate]) {
    const nextSuffix = `${suffix}-${counter}`;
    candidate = `${base.slice(0, Math.max(1, 120 - nextSuffix.length))}${nextSuffix}`;
    counter += 1;
  }
  return candidate;
}

function releaseStaleRunningFeatures(input: {
  state: FeatureCompactLoopState;
  existing: Set<string>;
  activeWorkflowRunIds: Set<string>;
}): number {
  let released = 0;
  for (const [featureKey, feature] of Object.entries(input.state.features)) {
    if (feature.status !== "running" || input.existing.has(featureKey))
      continue;
    if (
      feature.lastWorkflowRunId &&
      input.activeWorkflowRunIds.has(String(feature.lastWorkflowRunId))
    ) {
      continue;
    }
    updateFeatureCompactItem(input.state, featureKey, {
      status: feature.lastWorkflowRunId ? "error" : "pending",
      lastSummary: feature.lastWorkflowRunId
        ? `Reopened compact feature ${featureKey}: loop state was running but no planner child is open; reconcile Azure DevOps pipeline run ${feature.lastWorkflowRunId} before marking done.`
        : `Reopened compact feature ${featureKey}: local package/check evidence exists but no live Azure DevOps pipeline run id was captured.`,
    });
    released += 1;
  }
  return released;
}

function compactPlanPath(input: {
  featureKey: string;
  item: FeatureCompactItemState;
  target: string;
}): string {
  return (
    input.item.lastPlanPath ||
    `features/${input.item.capabilityId || input.featureKey}/compact/${input.target}.plan.json`
  );
}

function shouldBackfillCompletedErrorRun(
  item: FeatureCompactItemState,
): boolean {
  if (item.status !== "error") return false;
  if (!item.lastWorkflowRunId) return false;
  if (item.lastLiveProofVersion === liveAksProofVersion) return false;
  if (
    compactErrorClass(item) === "staging-capacity" &&
    item.retryable === false
  )
    return false;

  const summary = (item.lastSummary ?? "").toLowerCase();
  if (
    summary.includes("backfilled completed compact github run") ||
    summary.includes("reconciled completed compact github run") ||
    summary.includes(
      "backfilled completed compact azure devops pipeline run",
    ) ||
    summary.includes("reconciled completed compact azure devops pipeline run")
  ) {
    return false;
  }
  return (
    compactErrorClass(item) === "live-workflow" ||
    summary.includes("did not pass") ||
    summary.includes("did not prove a live azure pass") ||
    summary.includes("live proof is still failing") ||
    summary.includes("workflow run did not complete successfully") ||
    summary.includes("github artifact download failed") ||
    summary.includes("no top-level result.json")
  );
}

function applyCompletedWorkflowRunProof(input: {
  state: FeatureCompactLoopState;
  featureKey: string;
  item: FeatureCompactItemState;
  runId: string;
  runUrl: string | null;
  planRel: string;
  proof: ReturnType<typeof inspectLiveWorkflowArtifacts>;
  summaryPrefix: string;
}): void {
  if (input.proof.ok) {
    const summary = [
      `${input.summaryPrefix} ${input.runId} for ${input.featureKey}; live proof passed.`,
      `Plan: ${input.planRel}.`,
      input.proof.resultPath
        ? `Live test result: ${input.proof.resultPath}.`
        : "",
      input.runUrl ? `Workflow run: ${input.runUrl}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    updateFeatureCompactItem(input.state, input.featureKey, {
      status: "done",
      retryable: true,
      retryReason: null,
      taskId: input.item.taskId,
      lastPlanPath: input.planRel,
      lastResultPath: input.proof.resultPath ?? input.item.lastResultPath,
      lastWorkflowRunId: input.runId,
      lastWorkflowRunUrl: input.runUrl,
      lastLiveProofVersion: liveAksProofVersion,
      lastSummary: summary,
    });
    return;
  }

  const capacityReason = capacityPreflightReason(input.proof);
  const isCapacity = Boolean(capacityReason);
  const summary = isCapacity
    ? [
        `${input.summaryPrefix} ${input.runId} for ${input.featureKey}; staging capacity is still blocking live proof.`,
        `Plan: ${input.planRel}.`,
        capacityReason,
        input.proof.resultPath
          ? `Azure DevOps artifact result: ${input.proof.resultPath}.`
          : "",
        input.runUrl ? `Workflow run: ${input.runUrl}.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        `${input.summaryPrefix} ${input.runId} for ${input.featureKey}; live proof is still failing.`,
        `Plan: ${input.planRel}.`,
        input.proof.detail,
        input.proof.resultPath
          ? `Azure DevOps artifact result: ${input.proof.resultPath}.`
          : "",
        input.runUrl ? `Workflow run: ${input.runUrl}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
  updateFeatureCompactItem(input.state, input.featureKey, {
    status: "error",
    retryable: isCapacity ? false : true,
    retryReason: isCapacity
      ? "Staging AKS managed-cluster capacity is full; retry only after capacity returns, quota changes, or target reroute is accepted."
      : input.item.retryReason?.trim() || null,
    taskId: input.item.taskId,
    lastPlanPath: input.planRel,
    lastResultPath: input.proof.resultPath ?? input.item.lastResultPath,
    lastWorkflowRunId: input.runId,
    lastWorkflowRunUrl: input.runUrl,
    lastLiveProofVersion: null,
    lastSummary: summary,
  });
}

function reconcileCompletedWorkflowRuns(input: {
  client: PipelineClient;
  projectDir: string;
  appDir: string;
  state: FeatureCompactLoopState;
  target: string;
  existing: Set<string>;
  activeWorkflowRunIds: Set<string>;
}): { reconciled: string[]; protectedRunIds: string[] } {
  const reconciled: string[] = [];
  const protectedRunIds: string[] = [];

  for (const [featureKey, item] of Object.entries(input.state.features)) {
    if (item.status !== "running") continue;
    if (input.existing.has(featureKey)) continue;
    const runId = item.lastWorkflowRunId;
    if (!runId) continue;
    if (input.activeWorkflowRunIds.has(runId)) continue;

    const run = getWorkflowRun({
      client: input.client,
      projectDir: input.projectDir,
      runId,
    });
    if (run && run.status !== "completed") {
      protectedRunIds.push(runId);
      continue;
    }
    if (!run) continue;

    const planRel = compactPlanPath({
      featureKey,
      item,
      target: input.target,
    });
    const proof = inspectLiveWorkflowArtifacts({
      client: input.client,
      projectDir: input.projectDir,
      appDir: input.appDir,
      runId,
      featureKey,
      planRel,
    });
    applyCompletedWorkflowRunProof({
      state: input.state,
      featureKey,
      item,
      runId,
      runUrl: run.url ?? item.lastWorkflowRunUrl ?? null,
      planRel,
      proof,
      summaryPrefix: "Reconciled completed compact Azure DevOps pipeline run",
    });
    reconciled.push(featureKey);
  }

  return { reconciled, protectedRunIds };
}

function backfillCompletedErrorWorkflowRuns(input: {
  client: PipelineClient;
  projectDir: string;
  appDir: string;
  state: FeatureCompactLoopState;
  target: string;
  existing: Set<string>;
  activeWorkflowRunIds: Set<string>;
  maxFeatures: number;
}): { backfilled: string[]; protectedRunIds: string[] } {
  const backfilled: string[] = [];
  const protectedRunIds: string[] = [];

  for (const [featureKey, item] of Object.entries(input.state.features)) {
    if (backfilled.length >= input.maxFeatures) break;
    if (!shouldBackfillCompletedErrorRun(item)) continue;
    if (input.existing.has(featureKey)) continue;
    const runId = item.lastWorkflowRunId;
    if (!runId) continue;
    if (input.activeWorkflowRunIds.has(runId)) continue;

    const run = getWorkflowRun({
      client: input.client,
      projectDir: input.projectDir,
      runId,
    });
    if (run && run.status !== "completed") {
      protectedRunIds.push(runId);
      continue;
    }
    if (!run) continue;

    const planRel = compactPlanPath({
      featureKey,
      item,
      target: input.target,
    });
    const proof = inspectLiveWorkflowArtifacts({
      client: input.client,
      projectDir: input.projectDir,
      appDir: input.appDir,
      runId,
      featureKey,
      planRel,
    });
    applyCompletedWorkflowRunProof({
      state: input.state,
      featureKey,
      item,
      runId,
      runUrl: run.url ?? item.lastWorkflowRunUrl ?? null,
      planRel,
      proof,
      summaryPrefix: "Backfilled completed compact Azure DevOps pipeline run",
    });
    backfilled.push(featureKey);
  }

  return { backfilled, protectedRunIds };
}

function preferredFeatureSummary(input: {
  existingSummary: string | null | undefined;
  childSummary: string;
}): string {
  const existingSummary = input.existingSummary?.trim() || "";
  const childSummary = input.childSummary.trim();
  if (!childSummary) return existingSummary;
  if (
    stalePackageGateSummary(childSummary) &&
    existingSummary &&
    !stalePackageGateSummary(existingSummary)
  ) {
    return existingSummary;
  }
  return childSummary;
}

function syncOpenChildStatuses(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: FeatureCompactLoopState;
}): void {
  if (!input.loopTask) return;
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isFeatureCompactChild(child)) continue;
    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey !== "string" || !featureKey.trim()) continue;
    const status = taskStatus(child);
    const result = traceString(child, "last_worker_result");
    const summary = traceString(child, "last_worker_summary");
    if (status === "active") {
      updateFeatureCompactItem(input.state, featureKey, {
        status: "running",
        taskId: child.id,
      });
    } else if (status === "backlog") {
      updateFeatureCompactItem(input.state, featureKey, {
        status: "pending",
        taskId: child.id,
      });
    } else if (
      (status === "review" || status === "done") &&
      result === "done"
    ) {
      const item = input.state.features[featureKey];
      updateFeatureCompactItem(
        input.state,
        featureKey,
        hasCurrentLiveProof(item)
          ? {
              status: "done",
              taskId: child.id,
              lastSummary: preferredFeatureSummary({
                existingSummary: item?.lastSummary,
                childSummary: summary,
              }),
            }
          : {
              status: "error",
              taskId: child.id,
              lastSummary:
                "Recorded compact planner result predates the current live AKS proof gate; rerun this feature compact workflow before marking it done.",
            },
      );
    } else if (
      (status === "review" || status === "done") &&
      ["partial", "error", "fail"].includes(result)
    ) {
      const item = input.state.features[featureKey];
      if (hasCurrentLiveProof(item)) {
        updateFeatureCompactItem(input.state, featureKey, {
          status: "done",
          taskId: item?.taskId ?? child.id,
          lastSummary: item?.lastSummary,
        });
        continue;
      }
      updateFeatureCompactItem(input.state, featureKey, {
        status: "error",
        taskId: child.id,
        lastSummary: preferredFeatureSummary({
          existingSummary: input.state.features[featureKey]?.lastSummary,
          childSummary: summary,
        }),
      });
    }
  }
}

function dispatchAssignment(
  ctx: WorkflowContext,
  assignment: ReturnType<typeof assignTask>,
): void {
  try {
    ctx.dispatchEvent("project.task.assigned", {
      target: { project: "aks-rp-e2e", taskId: assignment.taskId },
      project: "aks-rp-e2e",
      ...assignment,
    });
  } catch {
    // Unit tests may not provide a dispatcher.
  }
}

function compactLoopWorkflowProgress(input: {
  state: {
    features: Record<
      string,
      {
        status?: string;
        attempts?: number;
        retryable?: boolean | null;
        lastWorkflowRunId?: string | null;
      }
    >;
  };
  openChildren: number;
  openSupportChildren: number;
  blockedWaitChildren: number;
  blockedWaitFeatureKeys?: Set<string>;
  representedFeatureKeys?: Set<string>;
  activePipelineFeatureKeys?: Set<string>;
  representedSupportErrorClasses?: Set<string>;
  created: number;
  assigned: number;
  harvestedTerminalGitHubWaits?: number;
  checkedTerminalGitHubWaits?: number;
  maxDirectAttemptsPerFeature: number;
  dispatchHold?: string;
  activeGithubRuns?: number;
  githubActiveRunLimit?: number;
}): Record<string, unknown> {
  const counts: Record<string, number> = {};
  for (const feature of Object.values(input.state.features)) {
    const status = feature.status || "pending";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const pending = counts.pending ?? 0;
  const running = counts.running ?? 0;
  const blocked = counts.blocked ?? 0;
  const error = counts.error ?? 0;
  const retryBudgetExhausted = Object.values(input.state.features).filter(
    (feature) =>
      feature.status === "error" &&
      (feature.attempts ?? 0) >= input.maxDirectAttemptsPerFeature,
  ).length;
  const blockedWaitErrorCount = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "error" &&
      input.blockedWaitFeatureKeys?.has(featureKey),
  ).length;
  const blockedWaitBlockedCount = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "blocked" &&
      input.blockedWaitFeatureKeys?.has(featureKey),
  ).length;
  const representedFeatureErrorCount = Object.entries(
    input.state.features,
  ).filter(
    ([featureKey, feature]) =>
      feature.status === "error" &&
      input.representedFeatureKeys?.has(featureKey),
  ).length;
  const representedSupportErrorCount = Object.values(
    input.state.features,
  ).filter(
    (feature) =>
      feature.status === "error" &&
      input.representedSupportErrorClasses?.has(
        compactErrorClass(feature as FeatureCompactItemState),
      ),
  ).length;
  const activePipelineRunningCount = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "running" &&
      input.activePipelineFeatureKeys?.has(featureKey),
  ).length;
  const unrepresentedErrorCount = Math.max(
    0,
    error -
      blockedWaitErrorCount -
      representedFeatureErrorCount -
      representedSupportErrorCount,
  );
  const unrepresentedBlockedCount = Math.max(
    0,
    blocked - blockedWaitBlockedCount,
  );
  const unrepresentedNonTerminalCount =
    pending +
    Math.max(0, running - activePipelineRunningCount) +
    unrepresentedErrorCount +
    unrepresentedBlockedCount;
  const noRefillNow =
    pending === 0 &&
    running === 0 &&
    input.openChildren === 0 &&
    input.openSupportChildren === 0 &&
    unrepresentedNonTerminalCount === 0 &&
    (blocked > 0 || error === retryBudgetExhausted) &&
    input.blockedWaitChildren > 0;
  const completionReady =
    pending === 0 && running === 0 && error === 0 && blocked === 0;
  return {
    completionReady,
    dispatchHeld: input.dispatchHold ? true : undefined,
    dispatchHold: input.dispatchHold || undefined,
    noRefillNow: noRefillNow ? true : undefined,
    reason: completionReady
      ? "feature-compact loop state has no pending, running, or error features"
      : input.dispatchHold
        ? input.dispatchHold
        : noRefillNow
          ? "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands"
          : "feature-compact loop state still has non-terminal features",
    pending,
    running,
    done: counts.done ?? 0,
    blocked,
    error,
    retryBudgetExhausted,
    maxDirectAttemptsPerFeature: input.maxDirectAttemptsPerFeature,
    blockedWaitBlockedCount,
    blockedWaitErrorCount,
    unrepresentedBlockedCount,
    unrepresentedErrorCount,
    unrepresentedNonTerminalCount,
    activeGithubRuns: input.activeGithubRuns,
    githubActiveRunLimit: input.githubActiveRunLimit,
    openChildren: input.openChildren,
    openSupportChildren: input.openSupportChildren,
    blockedWaitChildren: input.blockedWaitChildren,
    harvestedTerminalGitHubWaits: input.harvestedTerminalGitHubWaits,
    checkedTerminalGitHubWaits: input.checkedTerminalGitHubWaits,
    representedSupportErrorClasses: [
      ...(input.representedSupportErrorClasses ?? new Set<string>()),
    ].sort((a, b) => a.localeCompare(b)),
    representedFeatureKeys: [
      ...(input.representedFeatureKeys ?? new Set<string>()),
    ].sort((a, b) => a.localeCompare(b)),
    activePipelineFeatureKeys: [
      ...(input.activePipelineFeatureKeys ?? new Set<string>()),
    ].sort((a, b) => a.localeCompare(b)),
    lastPulseCreated: input.created,
    lastPulseAssigned: input.assigned,
    updatedAt: new Date().toISOString(),
  };
}

function activePipelineFeatureKeys(input: {
  state: FeatureCompactLoopState;
  activeWorkflowRunIds: Set<string>;
}): Set<string> {
  const featureKeys = new Set<string>();
  for (const [featureKey, item] of Object.entries(input.state.features)) {
    if (item.status !== "running") continue;
    const runId = item.lastWorkflowRunId;
    if (runId && input.activeWorkflowRunIds.has(String(runId))) {
      featureKeys.add(featureKey);
    }
  }
  return featureKeys;
}

function acceptRecordedCompactReviewChildren(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    loopTask: TaskNode | undefined;
    tasks: Record<string, TaskNode>;
    state: FeatureCompactLoopState;
  },
): string[] {
  if (!input.loopTask) return [];
  const accepted: string[] = [];
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isFeatureCompactChild(child) || taskStatus(child) !== "review") {
      continue;
    }

    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey !== "string" || !featureKey.trim()) continue;
    const item = input.state.features[featureKey];
    const result = traceString(child, "last_worker_result");
    const summary = traceString(child, "last_worker_summary");
    const exactRecorded = item?.taskId === child.id;

    if (
      result === "done" &&
      item?.status === "done" &&
      exactRecorded &&
      hasCurrentLiveProof(item)
    ) {
      markTaskDone(config, {
        taskId: child.id,
        summary: `Feature compact loop accepted recorded live-verified planner result.${summary ? ` ${summary}` : ""}`,
        resolution: "completed",
      });
      accepted.push(child.id);
      continue;
    }

    if (
      ["partial", "error", "fail"].includes(result) &&
      item?.status === "error" &&
      exactRecorded &&
      Boolean(item.lastSummary)
    ) {
      markTaskDone(config, {
        taskId: child.id,
        summary: `Feature compact loop accepted recorded planner attempt as terminal; feature remains error for bounded repair.${summary ? ` ${summary}` : ""}`,
        resolution: "terminal",
      });
      accepted.push(child.id);
    }
  }
  return accepted;
}

function updateControllerWorkflowProgress(input: {
  appDir: string;
  projectDir: string;
  taskId: string;
  progress: Record<string, unknown>;
}): void {
  const config = buildTaskTreeConfig(
    {
      task: `app: ${input.appDir}\nproject: ${input.projectDir}`,
      agent: "aks-explorer",
    } as WorkflowContext,
    input.appDir,
    input.projectDir,
    1,
  );
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[input.taskId];
    if (!task) return;
    if (input.progress.completionReady === false) {
      task.blocker = undefined;
      reopenControllerRootWhenIncomplete({
        task,
        progress: input.progress,
        reason: exactBlockedWaitStewardshipProgress(input.progress)
          ? "feature-compact loop frontier is exact blocked wait stewardship; keep the durable root blocked until one named wait resolves or is replaced"
          : "feature-compact loop progress is incomplete; durable controller root must stay runnable until every compact feature has live proof or exact escalation",
      });
    }
    task.context = {
      ...taskContext(task),
      workflowProgress: input.progress,
    };
    saveTaskTreeWithKanbanSnapshot(config, tree);
    appendToolJournal(config, {
      kind: "task_workflow_progress_updated",
      task_id: input.taskId,
      workflow: task.workflow,
      progress: input.progress,
    });
  });
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
  const tree = readTaskTree(config);
  const tasks = tree.tasks;

  let loopTaskId = loopTaskIdFromTrigger(trigger);
  if (trigger?.type === "project.task.completed" && loopTaskId) {
    const parent = findLoopTaskForCompletedChild(tasks, loopTaskId);
    loopTaskId = parent?.id ?? "";
  }
  const loopTask = loopTaskId ? tasks[loopTaskId] : null;
  if (!loopTask || loopTask.workflow !== "feature-compact-loop-controller") {
    return ctx.done(
      `Feature compact loop controller ignored trigger ${String(trigger?.type ?? "unknown")} for task ${loopTaskId || "unknown"}.`,
    );
  }

  const windowSize = numberContext(loopTask, "windowSize", 1);
  const maxDirectAttemptsPerFeature = numberContext(
    loopTask,
    "maxDirectAttemptsPerFeature",
    2,
  );
  const stateRef = stringContext(
    loopTask,
    "stateRef",
    defaultFeatureCompactLoopStatePath(appDir),
  );
  const target = stringContext(loopTask, "target", "staging");
  const checkParallel = numberContext(loopTask, "checkParallel", 50);
  const liveParallel = numberContext(loopTask, "liveParallel", checkParallel);
  const branch = stringContext(loopTask, "branch", "dev");
  const githubAccess = resolvePipelineClient(projectDir);
  const githubActiveRunLimit = pipelineLimitContext(loopTask, 6);
  const activeGithubRunList = githubAccess.client
    ? activeWorkflowRuns({
        client: githubAccess.client,
        projectDir,
        branch,
      }).filter((run) => run.status !== "completed")
    : [];
  const activeGithubRuns = activeGithubRunList.length;
  const activeGithubRunIds = new Set(
    activeGithubRunList
      .map((run) => run.databaseId)
      .filter((runId): runId is number => typeof runId === "number")
      .map((runId) => String(runId)),
  );
  let dispatchHold = !githubAccess.client
    ? (githubAccess.reason ??
      "Azure DevOps pipeline access is unavailable for live compact verification.")
    : activeGithubRuns >= githubActiveRunLimit
      ? `feature-compact loop live dispatch held because ${activeGithubRuns} Azure DevOps pipeline run(s) are already in progress on ${branch}; limit=${githubActiveRunLimit}`
      : "";
  const githubWorkflow = pipelineNameContext(loopTask, "ado-pipeline-467665");
  const singleSpecWorkflow = stringContext(
    loopTask,
    "singleSpecAdoPipeline",
    "ado-pipeline-467665",
  );
  const focusedSpecTimeoutMinutes = stringContext(
    loopTask,
    "focusedSpecTimeoutMinutes",
    "180",
  );
  const focusedSpecStateRef = stringContext(
    loopTask,
    "specStateRef",
    ".state/spec-loop/state.json",
  );
  const testTimeoutSeconds = numberContext(
    loopTask,
    "testTimeoutSeconds",
    7200,
  );
  const maxCompactFollowupGroups = numberContext(
    loopTask,
    "maxCompactFollowupGroups",
    8,
  );
  const maxCompactSupportAssignments = numberContext(
    loopTask,
    "maxCompactSupportAssignments",
    3,
  );
  const maxCompletedErrorBackfill = numberContext(
    loopTask,
    "maxCompletedErrorBackfill",
    20,
  );
  const githubWaitTimeoutMinutes = numberContext(
    loopTask,
    "githubWaitTimeoutMinutes",
    720,
  );
  const featureKeys = stringArrayContext(loopTask, "featureKeys");
  const {
    state,
    path: statePath,
    created,
  } = loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId: loopTask.id,
    windowSize,
    statePath: stateRef.startsWith("/") ? stateRef : join(appDir, stateRef),
    featureKeys,
  });
  const closedStaleBlockedWaitTaskIds = closeStalePassedSpecBlockedWaitChildren(
    config,
    {
      appDir,
      loopTaskId: loopTask.id,
    },
  );
  const terminalGitHubWaitHarvest = githubAccess.client
    ? harvestTerminalCompactGitHubWaits({
        config,
        projectDir,
        appDir,
        loopTaskId: loopTask.id,
        state,
        client: githubAccess.client,
        limit: numberContext(loopTask, "terminalGitHubWaitHarvestLimit", 25),
      })
    : {
        harvestedTaskIds: [],
        terminalRunIds: [],
        lookupMissRunIds: [],
        checkedRunIds: [],
      };
  const reconciledReadyArtifacts = reconcileReadyCompactArtifacts({
    projectDir,
    state,
    target,
  });

  const completedTaskId =
    trigger?.type === "project.task.completed" ||
    isFeatureCompactLoopTick(trigger)
      ? triggerString(trigger, "taskId") || triggerString(trigger, "task_id")
      : "";
  const sourceCompletedTaskId = isFeatureCompactLoopTick(trigger)
    ? triggerString(trigger, "sourceTaskId") ||
      triggerString(trigger, "source_task_id")
    : "";
  const completedChildTaskId = sourceCompletedTaskId || completedTaskId;
  if (completedChildTaskId) {
    const completedTask = tasks[completedChildTaskId];
    const featureKey = completedTask
      ? taskContext(completedTask).featureKey
      : undefined;
    const result =
      triggerString(trigger, "result") || triggerString(trigger, "claim");
    if (
      typeof featureKey === "string" &&
      featureKey.trim() &&
      result &&
      result !== "done" &&
      state.features[featureKey]?.status === "running"
    ) {
      updateFeatureCompactItem(state, featureKey, { status: "error" });
    }
  }

  const requeuedOrphaned = requeueOrphanedActiveChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isFeatureCompactChild,
    minAgeMs: numberContext(loopTask, "orphanedAssignmentMinAgeMs", 600_000),
    reason:
      "feature-compact loop found active planner child with no queued assignment and no worker start",
  });
  const preNormalizeTree = readTaskTree(config);
  const normalizedFocusedBranchTaskIds = normalizeFocusedBranchDiagnostics(
    config,
    {
      loopTask: preNormalizeTree.tasks[loopTask.id],
    },
  );
  const refreshedTree = normalizedFocusedBranchTaskIds.length
    ? readTaskTree(config)
    : preNormalizeTree;
  const refreshedLoopTask = refreshedTree.tasks[loopTask.id];
  syncOpenChildStatuses({
    loopTask: refreshedLoopTask,
    tasks: refreshedTree.tasks,
    state,
  });
  const acceptedRecordedChildren = acceptRecordedCompactReviewChildren(config, {
    loopTask: refreshedLoopTask,
    tasks: refreshedTree.tasks,
    state,
  });
  const postAcceptTree = acceptedRecordedChildren.length
    ? readTaskTree(config)
    : refreshedTree;
  const postAcceptLoopTask = postAcceptTree.tasks[loopTask.id];
  const alreadyOpen = openChildCount(postAcceptLoopTask, postAcceptTree.tasks);
  const existing = existingFeatureKeys(
    postAcceptLoopTask,
    postAcceptTree.tasks,
  );
  const knownFeatureKeys = Object.keys(state.features);
  const blockedWaits = postAcceptLoopTask
    ? blockedWaitFeatureKeys(
        postAcceptLoopTask,
        postAcceptTree.tasks,
        knownFeatureKeys,
      )
    : new Set<string>();
  const capacityWaits = blockedSupportFeatureKeysForErrorClass(
    postAcceptLoopTask,
    postAcceptTree.tasks,
    "staging-capacity",
  );
  if (!dispatchHold && capacityWaits.size > 0 && activeGithubRuns > 0) {
    dispatchHold = `feature-compact loop live dispatch held because staging capacity wait evidence exists for ${capacityWaits.size} feature(s) and ${activeGithubRuns} Azure DevOps live run(s) are still in progress; wait for cleanup before probing more compact packages`;
  }
  const plannerSlotLimit = Math.min(
    compactPlannerSlotLimit({
      windowSize,
      activeGithubRuns,
      githubActiveRunLimit,
      dispatchHold,
    }),
    capacityWaits.size > 0 ? 1 : Number.POSITIVE_INFINITY,
  );
  const completedWorkflowRunReconcile = githubAccess.client
    ? reconcileCompletedWorkflowRuns({
        client: githubAccess.client,
        projectDir,
        appDir,
        state,
        target,
        existing,
        activeWorkflowRunIds: activeGithubRunIds,
      })
    : { reconciled: [], protectedRunIds: [] };
  const completedErrorRunBackfill = githubAccess.client
    ? backfillCompletedErrorWorkflowRuns({
        client: githubAccess.client,
        projectDir,
        appDir,
        state,
        target,
        existing,
        activeWorkflowRunIds: activeGithubRunIds,
        maxFeatures: maxCompletedErrorBackfill,
      })
    : { backfilled: [], protectedRunIds: [] };
  const compactSyncedPassSpecIds = syncCompactPassesToSpecLoop({
    appDir,
    projectDir,
    compactState: state,
  });
  const protectedWorkflowRunIds = new Set<string>([
    ...activeGithubRunIds,
    ...completedWorkflowRunReconcile.protectedRunIds,
    ...completedErrorRunBackfill.protectedRunIds,
  ]);
  const releasedStaleRunning = releaseStaleRunningFeatures({
    state,
    existing: new Set<string>([...existing, ...blockedWaits]),
    activeWorkflowRunIds: protectedWorkflowRunIds,
  });
  const retryResetFeatureKeys = applyCompactRetryResets({
    loopTask: postAcceptLoopTask,
    tasks: postAcceptTree.tasks,
    state,
    maxDirectAttemptsPerFeature,
    blockedWaits,
  });
  const pending = dispatchHold
    ? []
    : orderedPendingFeatureCompactKeys(state).filter((featureKey) => {
        if (existing.has(featureKey) || blockedWaits.has(featureKey))
          return false;
        const feature = state.features[featureKey];
        if (
          feature?.status === "error" &&
          feature.attempts >= maxDirectAttemptsPerFeature
        ) {
          return false;
        }
        return true;
      });
  const createdTaskIds: string[] = [];
  const toCreate = Math.max(0, plannerSlotLimit - alreadyOpen);
  for (const featureKey of pending.slice(0, toCreate)) {
    const item = state.features[featureKey];
    if (!item) continue;
    const attemptNumber = (item.attempts ?? 0) + 1;
    const taskId = retryTaskIdForFeature(
      featureKey,
      refreshedTree.tasks,
      createdTaskIds.length + 1,
    );
    createTask(config, {
      id: taskId,
      parentId: loopTask.id,
      priority: "P1",
      workflow: "feature-compact-planner",
      goal: `Generate and verify the ${item.capabilityId} feature compact package.`,
      inputs: [
        `feature:${item.featureKey}`,
        `specs:${item.specsDir}`,
        `target:${target}`,
      ],
      outputs: [
        stateRef,
        `features/${item.capabilityId}/compact/${target}.plan.json`,
        `features/${item.capabilityId}/compact/${target}.diagnostics.json`,
      ],
      acceptance: [
        "Feature compact package covers every feature-owned spec, or records an error with exact missing coverage.",
        "Generated check-mode Vitest tests were run.",
        "The compact plan passed the live Azure DevOps pipeline.",
        "If live Azure DevOps verification cannot pass after every bounded repo-local repair, an escalation task records the exact owner/environment/product reason and resume condition.",
        "Per-task refresh, progress, no-decision, and local runtime paths are recorded in feature compact loop state, not appended to generated compact summaries.",
      ],
      forbidden: compactRuntimeWriteForbid,
      conflict_scope: [`feature-compact:${featureKey}`],
      context: {
        featureKey,
        capabilityId: item.capabilityId,
        packetPath: item.packetPath,
        specsDir: item.specsDir,
        specCount: item.specCount,
        target,
        checkParallel,
        liveParallel,
        branch,
        adoPipeline: githubWorkflow,
        testTimeoutSeconds,
        githubWaitTimeoutMinutes,
        maxDirectAttemptsPerFeature,
        attemptNumber,
        stateRef,
        loopTaskId: loopTask.id,
      },
    });
    updateFeatureCompactItem(state, featureKey, {
      status: "pending",
      taskId,
      attempts: attemptNumber,
    });
    createdTaskIds.push(taskId);
  }
  const focusTaskTree = readTaskTree(config);
  const focusLoopTask = focusTaskTree.tasks[loopTask.id];
  const createdFocusedBranchTaskIds =
    materializeFocusedFailedBranchDiagnosticTasks(config, {
      appDir,
      loopTask: focusLoopTask,
      tasks: focusTaskTree.tasks,
      state,
      target,
      branch,
      singleSpecWorkflow,
      timeoutMinutes: focusedSpecTimeoutMinutes,
      specStateRef: focusedSpecStateRef,
      maxTasks: numberContext(loopTask, "maxFocusedFailedBranchTasks", 12),
    });
  const postFocusTree = createdFocusedBranchTaskIds.length
    ? readTaskTree(config)
    : postAcceptTree;
  const postFocusLoopTask = postFocusTree.tasks[loopTask.id];
  const createdSupportTaskIds = postFocusLoopTask
    ? materializeFeatureCompactFollowups(config, {
        loopTask: postFocusLoopTask,
        state,
        stateRef,
        target,
        branch,
        maxDirectAttemptsPerFeature,
        maxGroups: maxCompactFollowupGroups,
        representedFeatureKeys: openFeatureScopedChildKeys(
          postFocusLoopTask,
          postFocusTree.tasks,
        ),
      })
    : [];

  if (
    trigger?.type === "project.task.assigned" ||
    taskStatus(loopTask) !== "backlog"
  ) {
    releaseContinuingController({
      appDir,
      projectDir,
      taskId: loopTask.id,
      summary: `Feature compact loop ${loopTask.id} controller pulse created ${createdTaskIds.length} child task(s); releasing controller slot before child assignment.`,
    });
  }

  const assignments = [];
  const assignableTree = readTaskTree(config);
  const assignableLoopTask = assignableTree.tasks[loopTask.id];
  const assignmentCandidateIds = assignableLoopTask
    ? dispatchHold
      ? []
      : backlogChildTaskIds(assignableLoopTask, assignableTree.tasks)
    : [];
  const supportCandidateIds = assignableLoopTask
    ? backlogSupportChildTaskIds(assignableLoopTask, assignableTree.tasks)
    : [];
  const activeChildren = assignableLoopTask
    ? activeFeatureChildCount(assignableLoopTask, assignableTree.tasks)
    : 0;
  const assignableSlots = Math.max(0, plannerSlotLimit - activeChildren);
  for (const taskId of assignmentCandidateIds.slice(0, assignableSlots)) {
    try {
      const assignment = assignTask(config, { taskId });
      assignments.push(assignment);
      dispatchAssignment(ctx, assignment);
    } catch {
      break;
    }
  }
  let assignedSupportChildren = 0;
  const assignableSupportCandidateIds = orderedSupportCandidateIds(
    supportCandidateIds.filter(
      (taskId) =>
        !supportChildRequiresPipelineRun(assignableTree.tasks[taskId]) ||
        !dispatchHold,
    ),
    assignableTree.tasks,
  );
  for (const taskId of assignableSupportCandidateIds.slice(
    0,
    maxCompactSupportAssignments,
  )) {
    try {
      const assignment = assignTask(config, { taskId });
      assignments.push(assignment);
      assignedSupportChildren += 1;
      dispatchAssignment(ctx, assignment);
    } catch {
      break;
    }
  }
  const consumedAssignmentRows = consumeDispatchedAssignments(
    config,
    assignments,
  );

  const latestTree = readTaskTree(config);
  const latestLoopTask = latestTree.tasks[loopTask.id];
  syncOpenChildStatuses({
    loopTask: latestLoopTask,
    tasks: latestTree.tasks,
    state,
  });
  const latestRepresentedFeatureKeys = openFeatureScopedChildKeys(
    latestLoopTask,
    latestTree.tasks,
  );
  const latestRepresentedSupportErrorClasses = new Set<string>([
    ...(latestLoopTask
      ? representedSupportErrorClasses(latestLoopTask, latestTree.tasks)
      : new Set<string>()),
  ]);
  const finalReleasedStaleRunning = releaseStaleRunningFeatures({
    state,
    existing: latestLoopTask
      ? existingFeatureKeys(latestLoopTask, latestTree.tasks)
      : new Set<string>(),
    activeWorkflowRunIds: protectedWorkflowRunIds,
  });
  saveFeatureCompactLoopState(statePath, state);
  updateControllerWorkflowProgress({
    appDir,
    projectDir,
    taskId: loopTask.id,
    progress: compactLoopWorkflowProgress({
      state,
      openChildren: latestLoopTask
        ? openChildCount(latestLoopTask, latestTree.tasks)
        : 0,
      openSupportChildren: latestLoopTask
        ? openSupportChildCount(latestLoopTask, latestTree.tasks)
        : 0,
      blockedWaitChildren: latestLoopTask
        ? blockedWaitChildCount(latestLoopTask, latestTree.tasks)
        : 0,
      blockedWaitFeatureKeys: latestLoopTask
        ? blockedWaitFeatureKeys(
            latestLoopTask,
            latestTree.tasks,
            knownFeatureKeys,
          )
        : new Set<string>(),
      representedFeatureKeys: latestRepresentedFeatureKeys,
      activePipelineFeatureKeys: activePipelineFeatureKeys({
        state,
        activeWorkflowRunIds: protectedWorkflowRunIds,
      }),
      representedSupportErrorClasses: latestRepresentedSupportErrorClasses,
      created: createdTaskIds.length,
      assigned: assignments.length,
      harvestedTerminalGitHubWaits:
        terminalGitHubWaitHarvest.harvestedTaskIds.length,
      checkedTerminalGitHubWaits:
        terminalGitHubWaitHarvest.checkedRunIds.length,
      maxDirectAttemptsPerFeature,
      dispatchHold,
      activeGithubRuns,
      githubActiveRunLimit,
    }),
  });

  const summary = [
    `Feature compact loop ${loopTask.id} pulse complete.`,
    created ? "Initialized feature-compact loop state." : "",
    `Created ${createdTaskIds.length} child task(s).`,
    createdSupportTaskIds.length
      ? `Created ${createdSupportTaskIds.length} grouped compact repair task(s).`
      : "",
    createdFocusedBranchTaskIds.length
      ? `Created ${createdFocusedBranchTaskIds.length} focused failed-branch diagnostic task(s).`
      : "",
    `Assigned ${assignments.length} child task(s).`,
    assignedSupportChildren
      ? `Assigned ${assignedSupportChildren} compact repair task(s).`
      : "",
    dispatchHold ? `Dispatch held: ${dispatchHold}` : "",
    `Active Azure DevOps pipeline runs: ${activeGithubRuns}/${githubActiveRunLimit}.`,
    requeuedOrphaned.length
      ? `Requeued ${requeuedOrphaned.length} orphaned child assignment(s).`
      : "",
    normalizedFocusedBranchTaskIds.length
      ? `Normalized ${normalizedFocusedBranchTaskIds.length} focused failed-branch diagnostic task(s).`
      : "",
    acceptedRecordedChildren.length
      ? `Accepted ${acceptedRecordedChildren.length} recorded compact package review(s).`
      : "",
    reconciledReadyArtifacts.length
      ? `Reset ${reconciledReadyArtifacts.length} stale package-gate error(s) whose current compact plan is live-dispatchable.`
      : "",
    completedWorkflowRunReconcile.reconciled.length
      ? `Reconciled ${completedWorkflowRunReconcile.reconciled.length} completed Azure DevOps compact run(s).`
      : "",
    completedErrorRunBackfill.backfilled.length
      ? `Backfilled ${completedErrorRunBackfill.backfilled.length} stale compact error run(s).`
      : "",
    compactSyncedPassSpecIds.length
      ? `Recorded ${compactSyncedPassSpecIds.length} compact branch pass(es) in the spec loop.`
      : "",
    releasedStaleRunning + finalReleasedStaleRunning
      ? `Released ${releasedStaleRunning + finalReleasedStaleRunning} stale running feature(s).`
      : "",
    retryResetFeatureKeys.length
      ? `Reset compact retry budget for ${retryResetFeatureKeys.length} feature(s).`
      : "",
    closedStaleBlockedWaitTaskIds.length
      ? `Closed ${closedStaleBlockedWaitTaskIds.length} stale compact blocked wait child task(s) whose named specs already passed.`
      : "",
    terminalGitHubWaitHarvest.harvestedTaskIds.length
      ? `Moved ${terminalGitHubWaitHarvest.harvestedTaskIds.length} terminal GitHub wait child task(s) to review: ${terminalGitHubWaitHarvest.terminalRunIds.slice(0, 5).join(", ")}.`
      : "",
    `Tracked features: ${Object.keys(state.features).length}.`,
  ]
    .filter(Boolean)
    .join(" ");

  appendToolJournal(config, {
    kind: "feature_compact_loop_controller_pulse",
    task_id: loopTask.id,
    created_task_ids: createdTaskIds,
    created_support_task_ids: createdSupportTaskIds,
    created_focused_branch_task_ids: createdFocusedBranchTaskIds,
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    consumed_assignment_rows: consumedAssignmentRows,
    requeued_orphaned_task_ids: requeuedOrphaned,
    normalized_focused_branch_task_ids: normalizedFocusedBranchTaskIds,
    accepted_review_task_ids: acceptedRecordedChildren,
    retry_reset_feature_keys: retryResetFeatureKeys,
    closed_stale_blocked_wait_task_ids: closedStaleBlockedWaitTaskIds,
    terminal_github_wait_harvested_task_ids:
      terminalGitHubWaitHarvest.harvestedTaskIds,
    terminal_github_wait_terminal_run_ids:
      terminalGitHubWaitHarvest.terminalRunIds,
    terminal_github_wait_checked_run_ids:
      terminalGitHubWaitHarvest.checkedRunIds,
    terminal_github_wait_lookup_miss_run_ids:
      terminalGitHubWaitHarvest.lookupMissRunIds,
    reconciled_ready_artifact_feature_keys: reconciledReadyArtifacts,
    reconciled_completed_workflow_feature_keys:
      completedWorkflowRunReconcile.reconciled,
    backfilled_completed_error_workflow_feature_keys:
      completedErrorRunBackfill.backfilled,
    compact_synced_pass_spec_ids: compactSyncedPassSpecIds,
    protected_workflow_run_ids: completedWorkflowRunReconcile.protectedRunIds,
    protected_error_backfill_workflow_run_ids:
      completedErrorRunBackfill.protectedRunIds,
    released_stale_running_count:
      releasedStaleRunning + finalReleasedStaleRunning,
    state_path: statePath,
  });

  return ctx.done(summary);
}
