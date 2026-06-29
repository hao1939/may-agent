/**
 * spec-loop-controller — bounded controller for the single-spec verification loop.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  defaultSpecLoopStatePath,
  loadSpecLoopState,
  orderedPendingSpecIds,
  safeTaskIdForSpec,
  saveSpecLoopState,
  type SpecLoopState,
  updateSpecLoopSpec,
} from "./lib/spec-loop-store.ts";
import {
  acceptTerminalReviewChildren,
  consumeDispatchedAssignments,
  requeueOrphanedActiveChildren,
} from "./lib/loop-controller-repair.ts";

export const name = "spec-loop-controller";
export const description =
  "Keep a bounded frontier of single-spec verification leaves under a loop task.";

function isSpecLoopTick(trigger: TriggerEvent | null): boolean {
  return (
    trigger?.type === "project.task.tick" &&
    triggerString(trigger, "action") === "spec-loop"
  );
}

function taskContext(task: TaskNode): Record<string, unknown> {
  return task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? (task.context as Record<string, unknown>)
    : {};
}

function taskText(task: TaskNode): string {
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? (task.trace as Record<string, unknown>)
      : {};
  return [
    task.result,
    taskContext(task).acceptance_note,
    trace.last_worker_summary,
    trace.review_summary,
  ]
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean)
    .join("\n");
}

function staleNonDirectLiveErrorIsDone(task: TaskNode): boolean {
  const text = taskText(task).toLowerCase();
  return (
    text.includes("source/check-only") ||
    text.includes("not directly live-executable") ||
    text.includes("requires an existing-cluster carrier") ||
    text.includes("requires a shared-cluster carrier")
  );
}

function archivedDoneLeafFiles(appDir: string): string[] {
  const archiveDir = join(appDir, "tasks", "archive");
  if (!existsSync(archiveDir)) return [];
  return readdirSync(archiveDir)
    .filter((name) => name.startsWith("done-leaves-") && name.endsWith(".json"))
    .sort()
    .map((name) => join(archiveDir, name));
}

function archivedTasksById(appDir: string, taskId: string): TaskNode[] {
  const matches: TaskNode[] = [];
  for (const file of archivedDoneLeafFiles(appDir)) {
    let parsed: { tasks?: TaskNode[] };
    try {
      parsed = JSON.parse(readFileSync(file, "utf-8")) as {
        tasks?: TaskNode[];
      };
    } catch {
      continue;
    }
    const task = Array.isArray(parsed.tasks)
      ? parsed.tasks.find((candidate) => candidate.id === taskId)
      : undefined;
    if (task) matches.push(task);
  }
  return matches;
}

function reconcileArchivedDoneStatuses(input: {
  appDir: string;
  tasks: Record<string, TaskNode>;
  state: SpecLoopState;
}): number {
  let reconciled = 0;
  for (const [specId, spec] of Object.entries(input.state.specs)) {
    if (spec.status !== "error" || !spec.taskId || input.tasks[spec.taskId]) {
      continue;
    }
    const archivedTasks = archivedTasksById(input.appDir, spec.taskId);
    if (!archivedTasks.some(staleNonDirectLiveErrorIsDone)) {
      continue;
    }
    updateSpecLoopSpec(input.state, specId, {
      status: "done",
      taskId: spec.taskId,
    });
    reconciled += 1;
  }
  return reconciled;
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

function stringContext(task: TaskNode, key: string, fallback: string): string {
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

function isSpecLoopChild(task: TaskNode | undefined): task is TaskNode {
  if (!task || task.workflow !== "single-spec-verifier") return false;
  const specId = taskContext(task).specId;
  return typeof specId === "string" && specId.trim().length > 0;
}

function isSpecLoopFollowupChild(task: TaskNode | undefined): task is TaskNode {
  if (!task) return false;
  return taskContext(task).specLoopFollowup === true;
}

function findLoopTaskForCompletedChild(
  tasks: Record<string, TaskNode>,
  completedTaskId: string,
): TaskNode | null {
  const child = tasks[completedTaskId];
  if (!child?.parent_id) return null;
  const parent = tasks[child.parent_id];
  if (parent?.workflow === "spec-loop-controller") return parent;
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
    .filter(isSpecLoopChild)
    .filter((task) => {
      const status = taskStatus(task);
      return status === "active" || status === "backlog";
    }).length;
}

function openFollowupCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter(isSpecLoopFollowupChild)
    .filter((task) => {
      const status = taskStatus(task);
      return status === "active" || status === "backlog" || status === "review";
    }).length;
}

function activeOrBacklogSpecIds(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const ids = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!isSpecLoopChild(child)) continue;
    const status = taskStatus(child);
    if (status !== "active" && status !== "backlog") continue;
    const specId = taskContext(child).specId;
    if (typeof specId === "string" && specId.trim()) ids.add(specId.trim());
  }
  return ids;
}

function activeSpecLoopChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter((task) => isSpecLoopChild(task) || isSpecLoopFollowupChild(task))
    .filter((task) => taskStatus(task) === "active").length;
}

function existingSpecIds(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const ids = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!isSpecLoopChild(child)) continue;
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
    const specId = context.specId;
    if (typeof specId === "string" && specId.trim()) ids.add(specId.trim());
  }
  return ids;
}

function retryTaskIdForSpec(
  specId: string,
  tasks: Record<string, TaskNode>,
  sequence: number,
): string {
  const base = safeTaskIdForSpec(specId);
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

type NonPassSpecStatus = "error" | "fail";

type NonPassSpecGroup = {
  status: NonPassSpecStatus;
  family: string;
  count: number;
  specIds: string[];
};

function safeTaskIdPart(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "unknown"
  );
}

function specFamily(specId: string): string {
  const withoutPrefix = specId.replace(/^spec\./, "");
  return withoutPrefix.split(".")[0]?.trim() || "unknown";
}

function hasPendingOrRunningSpecs(state: SpecLoopState): boolean {
  return Object.values(state.specs).some(
    (spec) => spec.status === "pending" || spec.status === "running",
  );
}

function nonPassSpecGroups(
  state: SpecLoopState,
  input: { maxGroups: number; maxSpecSamples: number },
): NonPassSpecGroup[] {
  const groups = new Map<string, NonPassSpecGroup>();
  for (const [specId, spec] of Object.entries(state.specs)) {
    if (spec.status !== "error" && spec.status !== "fail") {
      continue;
    }
    const family = specFamily(specId);
    const key = `${spec.status}:${family}`;
    const group = groups.get(key) ?? {
      status: spec.status,
      family,
      count: 0,
      specIds: [],
    };
    group.count += 1;
    if (group.specIds.length < input.maxSpecSamples) {
      group.specIds.push(specId);
    }
    groups.set(key, group);
  }
  const statusRank: Record<NonPassSpecStatus, number> = {
    error: 0,
    fail: 1,
  };
  return [...groups.values()]
    .sort(
      (a, b) =>
        statusRank[a.status] - statusRank[b.status] ||
        b.count - a.count ||
        a.family.localeCompare(b.family),
    )
    .slice(0, input.maxGroups);
}

function followupTaskId(group: NonPassSpecGroup): string {
  return `reconcile-spec-loop-${safeTaskIdPart(group.status)}-${safeTaskIdPart(group.family)}`;
}

function materializeSpecLoopFollowups(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    loopTask: TaskNode;
    state: SpecLoopState;
    stateRef: string;
    target: string;
    branch: string;
    maxGroups: number;
    maxSpecSamples: number;
  },
): string[] {
  if (hasPendingOrRunningSpecs(input.state)) return [];
  const groups = nonPassSpecGroups(input.state, {
    maxGroups: input.maxGroups,
    maxSpecSamples: input.maxSpecSamples,
  });
  const createdTaskIds: string[] = [];
  for (const group of groups) {
    const taskId = followupTaskId(group);
    const latestTree = readTaskTree(config);
    if (latestTree.tasks[taskId]) continue;
    createTask(config, {
      id: taskId,
      parentId: input.loopTask.id,
      priority: "P1",
      goal: `Reconcile ${group.count} ${group.status} spec-loop result(s) for the ${group.family} feature family without blindly rerunning unchanged live tests.`,
      inputs: [
        `status:${group.status}`,
        `featureFamily:${group.family}`,
        `target:${input.target}`,
        `branch:${input.branch}`,
        `state:${input.stateRef}`,
        ...group.specIds.map((specId) => `spec:${specId}`),
      ],
      outputs: [input.stateRef, "evidence/archive/", "features/", "specs/"],
      acceptance: [
        "Grouped non-pass result root cause was classified as test/spec issue, product issue, environment wait, or rerun-ready.",
        "Relevant spec-loop state, spec/model files, or evidence notes were updated when the classification changed.",
        "No live test was rerun unless the blocker changed or a concrete test/spec fix made the rerun meaningful.",
        "Any remaining blocker has an exact resume condition and affected spec list.",
      ],
      conflict_scope: [
        `spec-loop-followup:${group.status}:${group.family}`,
        `feature:${group.family}`,
      ],
      context: {
        specLoopFollowup: true,
        status: group.status,
        featureFamily: group.family,
        totalSpecCount: group.count,
        sampledSpecIds: group.specIds,
        stateRef: input.stateRef,
        target: input.target,
        branch: input.branch,
      },
    });
    createdTaskIds.push(taskId);
  }
  return createdTaskIds;
}

function releaseStaleRunningSpecs(input: {
  state: SpecLoopState;
  activeOrBacklog: Set<string>;
}): number {
  let released = 0;
  for (const [specId, spec] of Object.entries(input.state.specs)) {
    if (spec.status !== "running" || input.activeOrBacklog.has(specId))
      continue;
    updateSpecLoopSpec(input.state, specId, {
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
    if (!isSpecLoopChild(child) && !isSpecLoopFollowupChild(child))
      return false;
    return child && taskStatus(child) === "backlog";
  });
}

function syncOpenChildStatuses(input: {
  loopTask: TaskNode | undefined;
  tasks: Record<string, TaskNode>;
  state: SpecLoopState;
}): void {
  if (!input.loopTask) return;
  for (const childId of input.loopTask.children ?? []) {
    const child = input.tasks[childId];
    if (!isSpecLoopChild(child)) continue;
    const specId = taskContext(child).specId;
    if (typeof specId !== "string" || !specId.trim()) continue;
    const status = taskStatus(child);
    if (status === "active") {
      updateSpecLoopSpec(input.state, specId, {
        status: "running",
        taskId: child.id,
      });
    } else if (status === "backlog") {
      updateSpecLoopSpec(input.state, specId, {
        status: "pending",
        taskId: child.id,
      });
    } else if (status === "review" || status === "done") {
      const specState = input.state.specs[specId];
      const current = specState?.status;
      if (
        (current === "pending" || current === "running") &&
        specState?.taskId !== child.id
      ) {
        continue;
      }
      if (
        current === "pass" ||
        current === "fail" ||
        String(current) === "blocked" ||
        current === "error" ||
        current === "pr_open"
      ) {
        updateSpecLoopSpec(input.state, specId, {
          status:
            current === "error" && staleNonDirectLiveErrorIsDone(child)
              ? "done"
              : String(current) === "blocked"
                ? "error"
                : current,
          taskId: child.id,
        });
      } else {
        updateSpecLoopSpec(input.state, specId, {
          status: status === "done" ? "done" : "error",
          taskId: child.id,
        });
      }
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

function specLoopWorkflowProgress(input: {
  state: { specs: Record<string, { status?: string }> };
  openChildren: number;
  openFollowups: number;
  created: number;
  createdFollowups: number;
  assigned: number;
  reconciledArchivedDone: number;
  targetRunning: number;
}): Record<string, unknown> {
  const counts: Record<string, number> = {};
  for (const spec of Object.values(input.state.specs)) {
    const status = spec.status || "pending";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  const pending = counts.pending ?? 0;
  const running = counts.running ?? 0;
  const nonPass = (counts.fail ?? 0) + (counts.error ?? 0);
  const executionDrained = pending === 0 && running === 0;
  const completionReady = executionDrained && nonPass === 0;
  const surplusRunning = Math.max(0, running - input.targetRunning);
  return {
    completionReady,
    executionDrained,
    reason: completionReady
      ? "spec-loop state has no pending, running, fail, or error specs"
      : executionDrained
        ? "spec-loop execution is drained but non-pass results need grouped follow-up"
        : surplusRunning > 0
          ? `spec-loop has ${running} running verifier(s) above targetRunning=${input.targetRunning}; controller suppresses backlog refill until active work drains`
          : "spec-loop state still has non-terminal specs",
    pending,
    running,
    targetRunning: input.targetRunning,
    surplusRunning,
    pass: counts.pass ?? 0,
    fail: counts.fail ?? 0,
    error: counts.error ?? 0,
    nonPass,
    done: counts.done ?? 0,
    openChildren: input.openChildren,
    openFollowups: input.openFollowups,
    lastPulseCreated: input.created,
    lastPulseCreatedFollowups: input.createdFollowups,
    lastPulseAssigned: input.assigned,
    lastPulseReconciledArchivedDone: input.reconciledArchivedDone,
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
  if (!loopTask || loopTask.workflow !== "spec-loop-controller") {
    return ctx.done(
      `Spec loop controller ignored trigger ${String(trigger?.type ?? "unknown")} for task ${loopTaskId || "unknown"}.`,
    );
  }

  const windowSize = numberContext(loopTask, "windowSize", 5);
  const stateRef = stringContext(
    loopTask,
    "stateRef",
    defaultSpecLoopStatePath(appDir),
  );
  const githubWorkflow = stringContext(
    loopTask,
    "githubWorkflow",
    "run-single-spec.yaml",
  );
  const target = stringContext(loopTask, "target", "staging");
  const branch = stringContext(loopTask, "branch", "dev");
  const timeoutMinutes = String(numberContext(loopTask, "timeoutMinutes", 60));
  const targetRunning = Math.min(
    windowSize,
    numberContext(loopTask, "targetRunning", Math.min(3, windowSize)),
  );
  const {
    state,
    path: statePath,
    created,
  } = loadSpecLoopState({
    appDir,
    projectDir,
    loopTaskId: loopTask.id,
    windowSize,
    statePath: stateRef.startsWith("/") ? stateRef : join(appDir, stateRef),
  });

  const completedTaskId =
    trigger?.type === "project.task.completed" || isSpecLoopTick(trigger)
      ? triggerString(trigger, "taskId") || triggerString(trigger, "task_id")
      : "";
  const sourceCompletedTaskId = isSpecLoopTick(trigger)
    ? triggerString(trigger, "sourceTaskId") ||
      triggerString(trigger, "source_task_id")
    : "";
  const completedChildTaskId = sourceCompletedTaskId || completedTaskId;
  if (completedChildTaskId) {
    const completedTask = tasks[completedChildTaskId];
    const specId = completedTask
      ? taskContext(completedTask).specId
      : undefined;
    if (typeof specId === "string" && specId.trim()) {
      const result =
        triggerString(trigger, "result") ||
        triggerString(trigger, "claim") ||
        "done";
      const current = state.specs[specId]?.status;
      const currentTerminal =
        current === "pass" ||
        current === "fail" ||
        String(current) === "blocked" ||
        current === "error" ||
        current === "pr_open";
      const status =
        result === "done"
          ? currentTerminal
            ? String(current) === "blocked"
              ? "error"
              : current
            : "done"
          : "error";
      updateSpecLoopSpec(state, specId, {
        status,
        taskId: completedChildTaskId,
      });
    }
  }

  const acceptedReviewChildren = acceptTerminalReviewChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isSpecLoopChild,
    summaryPrefix:
      "Spec loop accepted terminal verifier classification without owner review.",
  });

  const requeuedOrphaned = requeueOrphanedActiveChildren(config, {
    loopTaskId: loopTask.id,
    isChild: isSpecLoopChild,
    minAgeMs: numberContext(loopTask, "orphanedAssignmentMinAgeMs", 600_000),
    reason:
      "spec loop found active verifier child with no queued assignment and no worker start",
  });

  const refreshedTree = readTaskTree(config);
  const refreshedLoopTask = refreshedTree.tasks[loopTask.id];
  syncOpenChildStatuses({
    loopTask: refreshedLoopTask,
    tasks: refreshedTree.tasks,
    state,
  });
  const reconciledArchivedDone = reconcileArchivedDoneStatuses({
    appDir,
    tasks: refreshedTree.tasks,
    state,
  });
  const alreadyOpen = openChildCount(refreshedLoopTask, refreshedTree.tasks);
  const existing = existingSpecIds(refreshedLoopTask, refreshedTree.tasks);
  const releasedStaleRunning = releaseStaleRunningSpecs({
    state,
    activeOrBacklog: activeOrBacklogSpecIds(
      refreshedLoopTask,
      refreshedTree.tasks,
    ),
  });
  const pending = orderedPendingSpecIds(state).filter(
    (specId) => !existing.has(specId),
  );
  const createdTaskIds: string[] = [];
  const toCreate = Math.max(0, windowSize - alreadyOpen);
  for (const specId of pending.slice(0, toCreate)) {
    const taskId = retryTaskIdForSpec(
      specId,
      refreshedTree.tasks,
      createdTaskIds.length + 1,
    );
    createTask(config, {
      id: taskId,
      parentId: loopTask.id,
      priority: "P1",
      workflow: "single-spec-verifier",
      goal: `Run and review ${specId} through the single-spec workflow.`,
      inputs: [
        `spec:${specId}`,
        `workflow:${githubWorkflow}`,
        `target:${target}`,
        `timeoutMinutes:${timeoutMinutes}`,
      ],
      outputs: [stateRef, "runs/test-results/", "test-results/"],
      acceptance: [
        "GitHub workflow run completed or produced a concrete blocker.",
        "result.json and summary artifacts were reviewed when available.",
        "Spec status was classified as pass, fail, or error.",
        "Test result/model update or fix PR was proposed when needed.",
        "Spec-loop state was updated.",
      ],
      conflict_scope: [`spec:${specId}`],
      context: {
        specId,
        githubWorkflow,
        target,
        branch,
        timeoutMinutes,
        stateRef,
        loopTaskId: loopTask.id,
      },
    });
    updateSpecLoopSpec(state, specId, { status: "pending", taskId });
    createdTaskIds.push(taskId);
  }
  const createdFollowupTaskIds =
    refreshedLoopTask && createdTaskIds.length === 0
      ? materializeSpecLoopFollowups(config, {
          loopTask: refreshedLoopTask,
          state,
          stateRef,
          target,
          branch,
          maxGroups: numberContext(loopTask, "maxFollowupGroups", 12),
          maxSpecSamples: numberContext(loopTask, "maxFollowupSpecSamples", 20),
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
      summary: `Spec loop ${loopTask.id} controller pulse created ${createdTaskIds.length} child task(s); releasing controller slot before child assignment.`,
    });
  }

  const assignments = [];
  const assignableTree = readTaskTree(config);
  const assignableLoopTask = assignableTree.tasks[loopTask.id];
  let activeSpecChildren = assignableLoopTask
    ? activeSpecLoopChildCount(assignableLoopTask, assignableTree.tasks)
    : 0;
  const assignmentCandidateIds = assignableLoopTask
    ? backlogChildTaskIds(assignableLoopTask, assignableTree.tasks)
    : [];
  for (const taskId of assignmentCandidateIds) {
    if (activeSpecChildren >= targetRunning) break;
    try {
      const assignment = assignTask(config, { taskId });
      assignments.push(assignment);
      activeSpecChildren += 1;
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
  saveSpecLoopState(statePath, state);
  updateControllerWorkflowProgress({
    appDir,
    projectDir,
    taskId: loopTask.id,
    progress: specLoopWorkflowProgress({
      state,
      openChildren: latestLoopTask
        ? openChildCount(latestLoopTask, latestTree.tasks)
        : 0,
      created: createdTaskIds.length,
      assigned: assignments.length,
      openFollowups: latestLoopTask
        ? openFollowupCount(latestLoopTask, latestTree.tasks)
        : 0,
      createdFollowups: createdFollowupTaskIds.length,
      reconciledArchivedDone,
      targetRunning,
    }),
  });
  const summary = [
    `Spec loop ${loopTask.id} pulse complete.`,
    created ? "Initialized spec-loop state." : "",
    `Created ${createdTaskIds.length} child task(s).`,
    createdFollowupTaskIds.length
      ? `Created ${createdFollowupTaskIds.length} grouped follow-up task(s).`
      : "",
    `Assigned ${assignments.length} child task(s).`,
    requeuedOrphaned.length
      ? `Requeued ${requeuedOrphaned.length} orphaned child assignment(s).`
      : "",
    acceptedReviewChildren.length
      ? `Accepted ${acceptedReviewChildren.length} terminal verifier review(s).`
      : "",
    releasedStaleRunning
      ? `Released ${releasedStaleRunning} stale running spec(s).`
      : "",
    `Target running spec workflows: ${targetRunning}.`,
    `Priority specs from dev-infra-core: ${state.prioritySpecIds.length}.`,
  ]
    .filter(Boolean)
    .join(" ");

  appendToolJournal(config, {
    kind: "spec_loop_controller_pulse",
    task_id: loopTask.id,
    created_task_ids: createdTaskIds,
    created_followup_task_ids: createdFollowupTaskIds,
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    consumed_assignment_rows: consumedAssignmentRows,
    requeued_orphaned_task_ids: requeuedOrphaned,
    accepted_review_task_ids: acceptedReviewChildren,
    state_path: statePath,
  });

  return ctx.done(summary);
}
