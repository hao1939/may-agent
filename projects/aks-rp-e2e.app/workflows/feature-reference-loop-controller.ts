/**
 * feature-reference-loop-controller — bounded controller for official feature references.
 */

import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
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
  defaultFeatureReferenceDraftDir,
  defaultFeatureReferenceLoopStatePath,
  featureReferenceCollectorContractVersion,
  featureReferenceOutputQuality,
  findPromotableFeatureReferenceOutput,
  loadFeatureReferenceLoopState,
  orderedPendingFeatureKeys,
  safeFeatureReferenceTaskId,
  saveFeatureReferenceLoopState,
  updateFeatureReferenceItem,
  type FeatureReferenceLoopState,
} from "./lib/feature-reference-loop-store.ts";
import {
  acceptDoneReviewChildren,
  consumeDispatchedAssignments,
  reopenControllerRootWhenIncomplete,
  requeueOrphanedActiveChildren,
} from "./lib/loop-controller-repair.ts";
import { exactBlockedWaitStewardshipProgress } from "./lib/durable-loop-wait-stewardship.ts";

export const name = "feature-reference-loop-controller";
export const description =
  "Keep a bounded frontier of official feature-reference collection tasks.";

function isFeatureReferenceLoopTick(trigger: TriggerEvent | null): boolean {
  return (
    trigger?.type === "project.task.tick" &&
    triggerString(trigger, "action") === "feature-reference-loop"
  );
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
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

function findLoopTaskForCompletedChild(
  tasks: Record<string, TaskNode>,
  completedTaskId: string,
): TaskNode | null {
  const child = tasks[completedTaskId];
  if (!child?.parent_id) return null;
  const parent = tasks[child.parent_id];
  if (parent?.workflow === "feature-reference-loop-controller") return parent;
  return null;
}

function isFeatureReferenceChild(task: TaskNode | undefined): task is TaskNode {
  if (!task || task.workflow !== "feature-reference-collector") return false;
  const featureKey = taskContext(task).featureKey;
  return typeof featureKey === "string" && featureKey.trim().length > 0;
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
    .filter(isFeatureReferenceChild)
    .filter((task) => {
      const status = taskStatus(task);
      return status === "active" || status === "backlog";
    }).length;
}

function existingFeatureKeys(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const keys = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    const status = taskStatus(child);
    if (
      status !== "active" &&
      status !== "backlog" &&
      status !== "review" &&
      status !== "waiting"
    ) {
      continue;
    }
    const context = child ? taskContext(child) : {};
    const featureKey = context.featureKey;
    if (typeof featureKey === "string" && featureKey.trim())
      keys.add(featureKey.trim());
  }
  return keys;
}

function releaseStaleRunningFeatures(input: {
  state: FeatureReferenceLoopState;
  existing: Set<string>;
}): number {
  let released = 0;
  for (const [featureKey, feature] of Object.entries(input.state.features)) {
    if (feature.status !== "running" || input.existing.has(featureKey))
      continue;
    updateFeatureReferenceItem(input.state, featureKey, {
      status: "pending",
      taskId: null,
    });
    released += 1;
  }
  return released;
}

function backlogChildTaskIds(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): string[] {
  return (loopTask.children ?? []).filter((childId) => {
    const child = tasks[childId];
    return isFeatureReferenceChild(child) && taskStatus(child) === "backlog";
  });
}

function retryTaskIdForFeature(
  featureKey: string,
  tasks: Record<string, TaskNode>,
  sequence: number,
): string {
  const base = safeFeatureReferenceTaskId(featureKey);
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

function taskTrace(task: TaskNode): Record<string, unknown> {
  return task.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function collectorOutputPath(summary: string): string | null {
  const match = summary.match(
    /:\s+(evidence\/archive\/feature-reference-[^\s.]+(?:-[^\s.]+)*-\d{8}\.md)\.?$/,
  );
  return match?.[1] ?? null;
}

function bestFeatureReferenceOutput(input: {
  projectDir: string;
  featureKey: string;
  candidateOutputPath: string | null;
  currentOutputPath: string | null | undefined;
}): string | null {
  const candidateQuality = featureReferenceOutputQuality({
    projectDir: input.projectDir,
    outputPath: input.candidateOutputPath,
  });
  const currentQuality = featureReferenceOutputQuality({
    projectDir: input.projectDir,
    outputPath: input.currentOutputPath,
  });
  const seed =
    candidateQuality.missing.length <= currentQuality.missing.length
      ? input.candidateOutputPath
      : (input.currentOutputPath ?? input.candidateOutputPath);
  return findPromotableFeatureReferenceOutput({
    projectDir: input.projectDir,
    featureKey: input.featureKey,
    outputPath: seed,
  });
}

function syncOpenChildStatuses(input: {
  projectDir: string;
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: FeatureReferenceLoopState;
}): void {
  if (!input.loopTask) return;
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!child) continue;
    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey !== "string" || !featureKey.trim()) continue;
    const status = taskStatus(child);
    const trace = taskTrace(child);
    const lastWorkerResult =
      typeof trace.last_worker_result === "string"
        ? trace.last_worker_result
        : "";
    const lastSummary =
      typeof trace.last_worker_summary === "string"
        ? trace.last_worker_summary
        : "";
    if (status === "active") {
      updateFeatureReferenceItem(input.state, featureKey, {
        status: "running",
        taskId: child.id,
      });
    } else if (status === "backlog") {
      updateFeatureReferenceItem(input.state, featureKey, {
        status: "pending",
        taskId: child.id,
      });
    } else if (
      (status === "review" || status === "done") &&
      lastWorkerResult === "done"
    ) {
      const outputPath = bestFeatureReferenceOutput({
        projectDir: input.projectDir,
        featureKey,
        candidateOutputPath: collectorOutputPath(lastSummary),
        currentOutputPath: input.state.features[featureKey]?.lastOutputPath,
      });
      const quality = featureReferenceOutputQuality({
        projectDir: input.projectDir,
        outputPath,
      });
      updateFeatureReferenceItem(input.state, featureKey, {
        status: quality.missing.length === 0 ? "done" : "error",
        taskId: child.id,
        lastOutputPath: outputPath,
        lastSummary:
          quality.missing.length === 0
            ? lastSummary ||
              input.state.features[featureKey]?.lastSummary ||
              null
            : `Feature reference artifact ${outputPath ?? "unknown"} is incomplete: missing ${quality.missing.join(" and ")}.`,
      });
    } else if (
      (status === "review" || status === "done") &&
      lastWorkerResult === "partial"
    ) {
      const outputPath = bestFeatureReferenceOutput({
        projectDir: input.projectDir,
        featureKey,
        candidateOutputPath: collectorOutputPath(lastSummary),
        currentOutputPath: input.state.features[featureKey]?.lastOutputPath,
      });
      const quality = featureReferenceOutputQuality({
        projectDir: input.projectDir,
        outputPath,
      });
      updateFeatureReferenceItem(input.state, featureKey, {
        status: quality.missing.length === 0 ? "done" : "error",
        taskId: child.id,
        lastOutputPath: outputPath,
        lastSummary:
          quality.missing.length === 0
            ? `Collected official feature references for ${featureKey}: ${outputPath}.`
            : lastSummary ||
              input.state.features[featureKey]?.lastSummary ||
              null,
      });
    } else if (
      (status === "review" || status === "done") &&
      lastWorkerResult === "blocked"
    ) {
      updateFeatureReferenceItem(input.state, featureKey, {
        status: "error",
        taskId: child.id,
        lastSummary:
          lastSummary || input.state.features[featureKey]?.lastSummary || null,
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

function featureReferenceWorkflowProgress(input: {
  state: {
    features: Record<string, { status?: string; attempts?: number }>;
    holdState?: {
      mode?: string;
      staleFeatureKeys?: string[];
      dormantFeatureKeys?: string[];
      noRefillNow?: boolean;
    };
  };
  openChildren: number;
  created: number;
  assigned: number;
  maxDirectAttemptsPerFeature: number;
}): Record<string, unknown> {
  const counts: Record<string, number> = {};
  for (const feature of Object.values(input.state.features)) {
    const status = feature.status || "pending";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const staleFeatureKeys = input.state.holdState?.staleFeatureKeys ?? [];
  const dormantFeatureKeys = input.state.holdState?.dormantFeatureKeys ?? [];
  const heldFeatureKeys = new Set([...staleFeatureKeys, ...dormantFeatureKeys]);
  const staleCount = staleFeatureKeys.length;
  const dormantCount = dormantFeatureKeys.length;
  const pending = counts.pending ?? 0;
  const running = counts.running ?? 0;
  const error = counts.error ?? 0;
  const activePending = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "pending" && !heldFeatureKeys.has(featureKey),
  ).length;
  const activeRunning = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "running" && !heldFeatureKeys.has(featureKey),
  ).length;
  const activeError = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "error" && !heldFeatureKeys.has(featureKey),
  ).length;
  const retryBudgetExhausted = Object.entries(input.state.features).filter(
    ([featureKey, feature]) =>
      feature.status === "error" &&
      !heldFeatureKeys.has(featureKey) &&
      (feature.attempts ?? 0) >= input.maxDirectAttemptsPerFeature,
  ).length;
  const holdMode = input.state.holdState?.mode === "dormant-backlog-preserved";
  const noRefillNow = holdMode
    ? input.state.holdState?.noRefillNow !== false
    : activePending === 0 &&
      activeRunning === 0 &&
      input.openChildren === 0 &&
      activeError > 0 &&
      retryBudgetExhausted === activeError;
  const completionReady = holdMode
    ? activePending === 0 && activeRunning === 0 && activeError === 0
    : pending === 0 && running === 0 && error === 0;
  const reason = completionReady
    ? holdMode
      ? "feature-reference loop has no active refill work; dormant backlog is preserved outside the workflow guard path"
      : "feature-reference loop state has no pending, running, or error features"
    : holdMode
      ? "feature-reference loop still has active non-held features"
      : noRefillNow
        ? "feature-reference loop has no runnable collector children; the remaining frontier is exact unresolved official-reference backlog or held state until a stronger refill reason exists"
        : "feature-reference loop state still has non-terminal features";
  return {
    completionReady,
    reason,
    pending: holdMode ? activePending : pending,
    running: holdMode ? activeRunning : running,
    done: counts.done ?? 0,
    error: holdMode ? activeError : error,
    retryBudgetExhausted,
    maxDirectAttemptsPerFeature: input.maxDirectAttemptsPerFeature,
    dormant: dormantCount,
    stale: staleCount,
    holdMode: holdMode ? "dormant-backlog-preserved" : undefined,
    noRefillNow: noRefillNow ? true : undefined,
    openChildren: input.openChildren,
    lastPulseCreated: input.created,
    lastPulseAssigned: input.assigned,
    updatedAt: new Date().toISOString(),
  };
}

function acceptRecordedCollectorReviewChildren(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    loopTask: TaskNode | undefined;
    tasks: Record<string, TaskNode>;
    state: FeatureReferenceLoopState;
  },
): string[] {
  if (!input.loopTask) return [];
  const accepted: string[] = [];
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isFeatureReferenceChild(child) || taskStatus(child) !== "review") {
      continue;
    }

    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey !== "string" || !featureKey.trim()) continue;
    const item = input.state.features[featureKey];
    const result = String(taskTrace(child).last_worker_result ?? "");
    const summary = String(taskTrace(child).last_worker_summary ?? "");

    const exactRecordedError =
      item?.status === "error" &&
      item.taskId === child.id &&
      Boolean(item.lastOutputPath || item.lastSummary);
    const exactRecordedDone =
      item?.status === "done" &&
      item.taskId === child.id &&
      Boolean(item.lastOutputPath || item.lastSummary);

    if ((result === "done" || result === "partial") && exactRecordedDone) {
      markTaskDone(config, {
        taskId: child.id,
        summary: `Feature-reference loop accepted recorded collector result.${summary ? ` ${summary}` : ""}`,
        resolution: "completed",
      });
      accepted.push(child.id);
      continue;
    }

    if ((result === "partial" || result === "blocked") && exactRecordedError) {
      markTaskDone(config, {
        taskId: child.id,
        summary: `Feature-reference loop accepted recorded collector attempt as terminal; feature remains error for follow-up.${summary ? ` ${summary}` : ""}`,
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
          ? "feature-reference loop frontier is exact blocked wait stewardship; keep the durable root blocked until one named wait resolves or is replaced"
          : "feature-reference loop progress is incomplete; durable controller root must stay runnable until all feature references are done or exactly escalated",
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
  if (!loopTask || loopTask.workflow !== "feature-reference-loop-controller") {
    return ctx.done(
      `Feature reference loop controller ignored trigger ${String(trigger?.type ?? "unknown")} for task ${loopTaskId || "unknown"}.`,
    );
  }

  const windowSize = numberContext(loopTask, "windowSize", 5);
  const maxDirectAttemptsPerFeature = numberContext(
    loopTask,
    "maxDirectAttemptsPerFeature",
    2,
  );
  const stateRef = stringContext(
    loopTask,
    "stateRef",
    defaultFeatureReferenceLoopStatePath(appDir),
  );
  const draftDir = stringContext(
    loopTask,
    "draftDir",
    defaultFeatureReferenceDraftDir(projectDir),
  );
  const referenceFixtureDir = stringContext(
    loopTask,
    "referenceFixtureDir",
    "",
  );
  const {
    state,
    path: statePath,
    created,
  } = loadFeatureReferenceLoopState({
    appDir,
    projectDir,
    loopTaskId: loopTask.id,
    windowSize,
    statePath: stateRef.startsWith("/") ? stateRef : join(appDir, stateRef),
  });

  const completedTaskId =
    trigger?.type === "project.task.completed" ||
    isFeatureReferenceLoopTick(trigger)
      ? triggerString(trigger, "taskId") || triggerString(trigger, "task_id")
      : "";
  const sourceCompletedTaskId = isFeatureReferenceLoopTick(trigger)
    ? triggerString(trigger, "sourceTaskId") ||
      triggerString(trigger, "source_task_id")
    : "";
  const completedChildTaskId = sourceCompletedTaskId || completedTaskId;
  if (completedChildTaskId) {
    const completedTask = tasks[completedChildTaskId];
    const completedContext = completedTask ? taskContext(completedTask) : {};
    const featureKey = completedContext.featureKey;
    if (typeof featureKey === "string" && featureKey.trim()) {
      const result =
        triggerString(trigger, "result") ||
        triggerString(trigger, "claim") ||
        "done";
      const outputPath = bestFeatureReferenceOutput({
        projectDir,
        featureKey,
        candidateOutputPath: collectorOutputPath(
          triggerString(trigger, "summary"),
        ),
        currentOutputPath: state.features[featureKey]?.lastOutputPath,
      });
      const quality = featureReferenceOutputQuality({
        projectDir,
        outputPath,
      });
      updateFeatureReferenceItem(state, featureKey, {
        status:
          result === "done" && quality.missing.length === 0 ? "done" : "error",
        taskId: completedChildTaskId,
        lastOutputPath: outputPath,
        lastSummary:
          result === "done" && quality.missing.length > 0
            ? `Feature reference artifact ${outputPath ?? "unknown"} is incomplete: missing ${quality.missing.join(" and ")}.`
            : state.features[featureKey]?.lastSummary,
      });
    }
  }

  const requeuedOrphaned = requeueOrphanedActiveChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isFeatureReferenceChild,
    minAgeMs: numberContext(loopTask, "orphanedAssignmentMinAgeMs", 600_000),
    reason:
      "feature-reference loop found active collector child with no queued assignment and no worker start",
  });
  const acceptedDoneChildren = acceptDoneReviewChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isFeatureReferenceChild,
    summaryPrefix:
      "Feature-reference loop accepted deterministic collector result.",
  });

  const refreshedTree = readTaskTree(config);
  const refreshedLoopTask = refreshedTree.tasks[loopTask.id];
  syncOpenChildStatuses({
    projectDir,
    loopTask: refreshedLoopTask,
    tasks: refreshedTree.tasks,
    state,
  });
  const acceptedRecordedChildren = acceptRecordedCollectorReviewChildren(
    config,
    {
      loopTask: refreshedLoopTask,
      tasks: refreshedTree.tasks,
      state,
    },
  );
  const alreadyOpen = openChildCount(refreshedLoopTask, refreshedTree.tasks);
  const existing = existingFeatureKeys(refreshedLoopTask, refreshedTree.tasks);
  const releasedStaleRunning = releaseStaleRunningFeatures({
    state,
    existing,
  });
  const pending = orderedPendingFeatureKeys(state).filter((featureKey) => {
    if (existing.has(featureKey)) return false;
    const feature = state.features[featureKey];
    if (
      feature?.status === "error" &&
      feature.attempts >= maxDirectAttemptsPerFeature &&
      feature.collectorContractVersion ===
        featureReferenceCollectorContractVersion
    ) {
      return false;
    }
    return true;
  });
  const createdTaskIds: string[] = [];
  const toCreate = Math.max(0, windowSize - alreadyOpen);
  for (const featureKey of pending.slice(0, toCreate)) {
    const item = state.features[featureKey];
    if (!item) continue;
    const attemptNumber =
      item.status === "error" &&
      item.collectorContractVersion !== featureReferenceCollectorContractVersion
        ? 1
        : (item.attempts ?? 0) + 1;
    const taskId = retryTaskIdForFeature(
      featureKey,
      refreshedTree.tasks,
      createdTaskIds.length + 1,
    );
    createTask(config, {
      id: taskId,
      parentId: loopTask.id,
      priority: "P2",
      workflow: "feature-reference-collector",
      goal: `Collect official API and documentation references for ${item.featureKey}.`,
      inputs: [
        `feature:${item.featureKey}`,
        `packet:${item.packetPath}`,
        "authorities: Microsoft Learn and Azure REST API specs",
      ],
      outputs: [stateRef, "evidence/archive/"],
      acceptance: [
        "Draft feature reference packet was written under evidence/archive/.",
        "At least one official Microsoft Learn documentation reference is present, or the state records an error with exact missing source detail.",
        "At least one Azure REST API spec reference is present, or the state records an error with exact missing source detail.",
        "Gaps or contradictions against existing feature packets/specs were summarized.",
        "Feature-reference loop state was updated.",
      ],
      conflict_scope: [`feature-reference:${featureKey}`],
      context: {
        featureKey,
        packetPath: item.packetPath,
        packetKind: item.packetKind,
        layout: item.layout,
        capabilityId: item.capabilityId,
        coveredFeatureIds: item.coveredFeatureIds,
        stateRef,
        loopTaskId: loopTask.id,
        draftDir,
        attemptNumber,
        referenceFixtureDir: referenceFixtureDir || undefined,
      },
    });
    updateFeatureReferenceItem(state, featureKey, {
      status: "pending",
      taskId,
      attempts: attemptNumber,
    });
    createdTaskIds.push(taskId);
  }

  if (
    trigger?.type === "project.task.assigned" ||
    taskStatus(loopTask) !== "backlog"
  ) {
    releaseContinuingController({
      appDir,
      projectDir,
      taskId: loopTask.id,
      summary: `Feature reference loop ${loopTask.id} controller pulse created ${createdTaskIds.length} child task(s); releasing controller slot before child assignment.`,
    });
  }

  const assignments = [];
  const assignableTree = readTaskTree(config);
  const assignableLoopTask = assignableTree.tasks[loopTask.id];
  const assignmentCandidateIds = assignableLoopTask
    ? backlogChildTaskIds(assignableLoopTask, assignableTree.tasks)
    : [];
  for (const taskId of assignmentCandidateIds) {
    try {
      const assignment = assignTask(config, { taskId });
      assignments.push(assignment);
      dispatchAssignment(ctx, assignment);
    } catch {
      break;
    }
  }
  const consumedAssignmentRows = consumeDispatchedAssignments(
    config,
    assignments,
  );

  saveFeatureReferenceLoopState(statePath, state);
  const latestTree = readTaskTree(config);
  const latestLoopTask = latestTree.tasks[loopTask.id];
  syncOpenChildStatuses({
    projectDir,
    loopTask: latestLoopTask,
    tasks: latestTree.tasks,
    state,
  });
  saveFeatureReferenceLoopState(statePath, state);
  updateControllerWorkflowProgress({
    appDir,
    projectDir,
    taskId: loopTask.id,
    progress: featureReferenceWorkflowProgress({
      state,
      openChildren: latestLoopTask
        ? openChildCount(latestLoopTask, latestTree.tasks)
        : 0,
      created: createdTaskIds.length,
      assigned: assignments.length,
      maxDirectAttemptsPerFeature,
    }),
  });

  const summary = [
    `Feature reference loop ${loopTask.id} pulse complete.`,
    created ? "Initialized feature-reference loop state." : "",
    `Created ${createdTaskIds.length} child task(s).`,
    `Assigned ${assignments.length} child task(s).`,
    requeuedOrphaned.length
      ? `Requeued ${requeuedOrphaned.length} orphaned child assignment(s).`
      : "",
    acceptedDoneChildren.length || acceptedRecordedChildren.length
      ? `Accepted ${
          acceptedDoneChildren.length + acceptedRecordedChildren.length
        } recorded collector review(s).`
      : "",
    releasedStaleRunning
      ? `Released ${releasedStaleRunning} stale running feature(s).`
      : "",
    `Tracked features: ${Object.keys(state.features).length}.`,
  ]
    .filter(Boolean)
    .join(" ");

  appendToolJournal(config, {
    kind: "feature_reference_loop_controller_pulse",
    task_id: loopTask.id,
    created_task_ids: createdTaskIds,
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    consumed_assignment_rows: consumedAssignmentRows,
    requeued_orphaned_task_ids: requeuedOrphaned,
    accepted_review_task_ids: [
      ...acceptedDoneChildren,
      ...acceptedRecordedChildren,
    ],
    state_path: statePath,
  });

  return ctx.done(summary);
}
