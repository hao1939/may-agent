/**
 * feature-compact-loop-controller — bounded controller for feature compact packages.
 */

import { join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  appendToolJournal,
  assignTask,
  createTask,
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
  type FeatureCompactLoopState,
} from "./lib/feature-compact-loop-store.ts";
import {
  acceptDoneReviewChildren,
  consumeDispatchedAssignments,
  requeueOrphanedActiveChildren,
} from "./lib/loop-controller-repair.ts";

export const name = "feature-compact-loop-controller";
export const description =
  "Keep a bounded frontier of feature compact planning tasks.";

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

function existingFeatureKeys(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const keys = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!isFeatureCompactChild(child)) continue;
    const featureKey = taskContext(child).featureKey;
    if (typeof featureKey === "string" && featureKey.trim())
      keys.add(featureKey.trim());
  }
  return keys;
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
    if (status === "active") {
      updateFeatureCompactItem(input.state, featureKey, { status: "running" });
    } else if (status === "backlog") {
      updateFeatureCompactItem(input.state, featureKey, { status: "pending" });
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
  state: { features: Record<string, { status?: string }> };
  openChildren: number;
  created: number;
  assigned: number;
}): Record<string, unknown> {
  const counts: Record<string, number> = {};
  for (const feature of Object.values(input.state.features)) {
    const status = feature.status || "pending";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const pending = counts.pending ?? 0;
  const running = counts.running ?? 0;
  const completionReady = pending === 0 && running === 0;
  return {
    completionReady,
    reason: completionReady
      ? "feature-compact loop state has no pending or running features"
      : "feature-compact loop state still has non-terminal features",
    pending,
    running,
    ready: counts.ready ?? 0,
    partial: counts.partial ?? 0,
    blocked: counts.blocked ?? 0,
    error: counts.error ?? 0,
    openChildren: input.openChildren,
    lastPulseCreated: input.created,
    lastPulseAssigned: input.assigned,
    updatedAt: new Date().toISOString(),
  };
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
  const stateRef = stringContext(
    loopTask,
    "stateRef",
    defaultFeatureCompactLoopStatePath(appDir),
  );
  const target = stringContext(loopTask, "target", "staging");
  const checkParallel = numberContext(loopTask, "checkParallel", 50);
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
      updateFeatureCompactItem(state, featureKey, { status: "blocked" });
    }
  }

  const requeuedOrphaned = requeueOrphanedActiveChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isFeatureCompactChild,
    minAgeMs: numberContext(loopTask, "orphanedAssignmentMinAgeMs", 600_000),
    reason:
      "feature-compact loop found active planner child with no queued assignment and no worker start",
  });
  const acceptedReviewChildren = acceptDoneReviewChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isFeatureCompactChild,
    summaryPrefix:
      "Feature compact loop accepted generated package with passing check-mode tests.",
  });

  const refreshedTree = readTaskTree(config);
  const refreshedLoopTask = refreshedTree.tasks[loopTask.id];
  const alreadyOpen = openChildCount(refreshedLoopTask, refreshedTree.tasks);
  const existing = existingFeatureKeys(refreshedLoopTask, refreshedTree.tasks);
  const pending = orderedPendingFeatureCompactKeys(state).filter(
    (featureKey) => !existing.has(featureKey),
  );
  const createdTaskIds: string[] = [];
  const toCreate = Math.max(0, windowSize - alreadyOpen);
  for (const featureKey of pending.slice(0, toCreate)) {
    const item = state.features[featureKey];
    if (!item) continue;
    const taskId = safeFeatureCompactTaskId(featureKey);
    if (refreshedTree.tasks[taskId]) continue;
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
        `features/${item.capabilityId}/compact/${target}.summary.md`,
        `features/${item.capabilityId}/compact/${target}.diagnostics.json`,
      ],
      acceptance: [
        "Feature compact package was generated or a concrete blocker was recorded.",
        "Generated check-mode Vitest tests were run.",
        "Feature compact loop state was updated as ready, partial, blocked, or error.",
      ],
      conflict_scope: [`feature-compact:${featureKey}`],
      context: {
        featureKey,
        capabilityId: item.capabilityId,
        packetPath: item.packetPath,
        specsDir: item.specsDir,
        specCount: item.specCount,
        target,
        checkParallel,
        stateRef,
        loopTaskId: loopTask.id,
      },
    });
    updateFeatureCompactItem(state, featureKey, { status: "pending" });
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
      summary: `Feature compact loop ${loopTask.id} controller pulse created ${createdTaskIds.length} child task(s); releasing controller slot before child assignment.`,
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

  const latestTree = readTaskTree(config);
  const latestLoopTask = latestTree.tasks[loopTask.id];
  syncOpenChildStatuses({
    loopTask: latestLoopTask,
    tasks: latestTree.tasks,
    state,
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
      created: createdTaskIds.length,
      assigned: assignments.length,
    }),
  });

  const summary = [
    `Feature compact loop ${loopTask.id} pulse complete.`,
    created ? "Initialized feature-compact loop state." : "",
    `Created ${createdTaskIds.length} child task(s).`,
    `Assigned ${assignments.length} child task(s).`,
    requeuedOrphaned.length
      ? `Requeued ${requeuedOrphaned.length} orphaned child assignment(s).`
      : "",
    acceptedReviewChildren.length
      ? `Accepted ${acceptedReviewChildren.length} completed compact package review(s).`
      : "",
    `Tracked features: ${Object.keys(state.features).length}.`,
  ]
    .filter(Boolean)
    .join(" ");

  appendToolJournal(config, {
    kind: "feature_compact_loop_controller_pulse",
    task_id: loopTask.id,
    created_task_ids: createdTaskIds,
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    consumed_assignment_rows: consumedAssignmentRows,
    requeued_orphaned_task_ids: requeuedOrphaned,
    accepted_review_task_ids: acceptedReviewChildren,
    state_path: statePath,
  });

  return ctx.done(summary);
}
