/**
 * feature-compact-loop-controller — bounded controller for feature compact packages.
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
  consumeDispatchedAssignments,
  reopenControllerRootWhenIncomplete,
  requeueOrphanedActiveChildren,
} from "./lib/loop-controller-repair.ts";
import { exactBlockedWaitStewardshipProgress } from "./lib/durable-loop-wait-stewardship.ts";
import {
  activeWorkflowRuns,
  resolveGitHubClient,
} from "./lib/github-actions.ts";

export const name = "feature-compact-loop-controller";
export const description =
  "Keep a bounded frontier of feature compact planning tasks.";

const liveAksProofVersion = "live-aks-proof-v2";

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

function blockedWaitChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter((task) => !!task && !isFeatureCompactChild(task))
    .filter((task) => taskStatus(task) === "blocked").length;
}

function blockedWaitFeatureKeys(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const keys = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!child || isFeatureCompactChild(child)) continue;
    if (taskStatus(child) !== "blocked") continue;

    const explicitFeatureKey = taskContext(child).featureKey;
    if (typeof explicitFeatureKey === "string" && explicitFeatureKey.trim()) {
      keys.add(explicitFeatureKey.trim());
    }

    const conflictScope = Array.isArray(
      (child as { conflict_scope?: unknown }).conflict_scope,
    )
      ? (child as { conflict_scope: unknown[] }).conflict_scope
      : [];
    for (const scope of conflictScope) {
      if (typeof scope !== "string") continue;
      const trimmed = scope.trim();
      if (!trimmed.startsWith("feature-compact:")) continue;
      const featureKey = trimmed.slice("feature-compact:".length).trim();
      if (featureKey) keys.add(featureKey);
    }
  }
  return keys;
}

function compactErrorClass(item: FeatureCompactItemState): string {
  const summary = (item.lastSummary ?? "").toLowerCase();
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
    summary.includes("github") ||
    summary.includes("workflow") ||
    summary.includes("dispatch") ||
    summary.includes("run id")
  ) {
    return "live-workflow";
  }
  if (
    summary.includes("capacity") ||
    summary.includes("quota") ||
    summary.includes("managed clusters")
  ) {
    return "staging-capacity";
  }
  if (summary.includes("cleanup")) return "cleanup";
  return "compact-error";
}

type CompactFollowupGroup = {
  errorClass: string;
  count: number;
  featureKeys: string[];
  lastFeatureUpdatedAt: string;
};

function compactFollowupGroups(
  state: FeatureCompactLoopState,
  input: { maxDirectAttemptsPerFeature: number; maxGroups: number },
): CompactFollowupGroup[] {
  const groups = new Map<string, CompactFollowupGroup>();
  for (const [featureKey, item] of Object.entries(state.features)) {
    if (
      item.status !== "error" ||
      (item.attempts ?? 0) < input.maxDirectAttemptsPerFeature
    ) {
      continue;
    }
    const errorClass = compactErrorClass(item);
    const group = groups.get(errorClass) ?? {
      errorClass,
      count: 0,
      featureKeys: [],
      lastFeatureUpdatedAt: "",
    };
    group.count += 1;
    if (group.featureKeys.length < 20) group.featureKeys.push(featureKey);
    if (item.updatedAt && item.updatedAt > group.lastFeatureUpdatedAt) {
      group.lastFeatureUpdatedAt = item.updatedAt;
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

function terminalCompactFollowupIsCurrent(
  task: TaskNode,
  group: CompactFollowupGroup,
): boolean {
  if (!compactFollowupTaskCoversGroup(task, group)) return false;
  if (task.resolution === "cancelled") return false;

  const terminalAt =
    taskTimestamp(task, "done_at") ?? taskTimestamp(task, "reviewed_at");
  if (terminalAt === null) return false;

  const lastFeatureUpdatedAt = Date.parse(group.lastFeatureUpdatedAt);
  if (!Number.isFinite(lastFeatureUpdatedAt)) return false;
  return terminalAt >= lastFeatureUpdatedAt;
}

function existingOpenCompactFollowupTaskId(
  tasks: Record<string, TaskNode>,
  group: CompactFollowupGroup,
): string | null {
  for (const task of Object.values(tasks)) {
    if (!compactFollowupTaskCoversGroup(task, group)) continue;

    const status = taskStatus(task);
    if (status !== "done" && status !== "blocked" && status !== "cancelled") {
      return task.id;
    }
  }
  return null;
}

function existingCurrentTerminalCompactFollowupTaskId(
  tasks: Record<string, TaskNode>,
  group: CompactFollowupGroup,
): string | null {
  for (const task of Object.values(tasks)) {
    const status = taskStatus(task);
    if (status !== "done" && status !== "blocked" && status !== "cancelled") {
      continue;
    }
    if (terminalCompactFollowupIsCurrent(task, group)) return task.id;
  }
  return null;
}

function nextCompactFollowupTaskId(
  tasks: Record<string, TaskNode>,
  group: CompactFollowupGroup,
): string | null {
  if (existingOpenCompactFollowupTaskId(tasks, group)) return null;
  if (existingCurrentTerminalCompactFollowupTaskId(tasks, group)) return null;

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
  },
): string[] {
  const groups = compactFollowupGroups(input.state, {
    maxDirectAttemptsPerFeature: input.maxDirectAttemptsPerFeature,
    maxGroups: input.maxGroups,
  });
  const createdTaskIds: string[] = [];
  for (const group of groups) {
    const latestTree = readTaskTree(config);
    const taskId = nextCompactFollowupTaskId(latestTree.tasks, group);
    if (!taskId) continue;
    createTask(config, {
      id: taskId,
      parentId: input.loopTask.id,
      priority: "P1",
      goal: `Reconcile ${group.count} retry-drained feature compact error(s) in the ${group.errorClass} family, repair what is fixable, and requeue live proof only after a meaningful package/runtime change.`,
      inputs: [
        `errorClass:${group.errorClass}`,
        `target:${input.target}`,
        `branch:${input.branch}`,
        `state:${input.stateRef}`,
        ...group.featureKeys.map((featureKey) => `feature:${featureKey}`),
      ],
      outputs: [input.stateRef, "features/", "evidence/archive/"],
      acceptance: [
        "Every sampled compact feature has a concrete root-cause classification.",
        "Every fixable package, planner, generated-test, or workflow issue was repaired and the affected feature was requeued for a meaningful live run.",
        "If no bounded repo-local fix remains, an exact escalation or wait records owner/environment/product reason, affected features, attempted fixes, and resume condition.",
        "Feature compact state and feature-owned compact artifacts were updated to match the repair, requeue, or escalation decision.",
      ],
      conflict_scope: [
        `feature-compact-followup:${group.errorClass}`,
        ...group.featureKeys
          .slice(0, 8)
          .map((featureKey) => `feature:${featureKey}`),
      ],
      context: {
        featureCompactFollowup: true,
        errorClass: group.errorClass,
        totalFeatureCount: group.count,
        sampledFeatureKeys: group.featureKeys,
        stateRef: input.stateRef,
        target: input.target,
        branch: input.branch,
      },
    });
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
        ? `Reopened compact feature ${featureKey}: loop state was running but no planner child is open; reconcile GitHub run ${feature.lastWorkflowRunId} before marking done.`
        : `Reopened compact feature ${featureKey}: local package/check evidence exists but no live GitHub workflow run id was captured.`,
    });
    released += 1;
  }
  return released;
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
              lastSummary: summary || item?.lastSummary,
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
        lastSummary: summary || input.state.features[featureKey]?.lastSummary,
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
  state: { features: Record<string, { status?: string; attempts?: number }> };
  openChildren: number;
  openSupportChildren: number;
  blockedWaitChildren: number;
  created: number;
  assigned: number;
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
  const error = counts.error ?? 0;
  const retryBudgetExhausted = Object.values(input.state.features).filter(
    (feature) =>
      feature.status === "error" &&
      (feature.attempts ?? 0) >= input.maxDirectAttemptsPerFeature,
  ).length;
  const unrepresentedNonTerminalCount =
    pending + running + (input.openSupportChildren > 0 ? 0 : error);
  const noRefillNow =
    pending === 0 &&
    running === 0 &&
    input.openChildren === 0 &&
    input.openSupportChildren === 0 &&
    unrepresentedNonTerminalCount === 0 &&
    error === retryBudgetExhausted &&
    input.blockedWaitChildren > 0;
  const completionReady = pending === 0 && running === 0 && error === 0;
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
    error,
    retryBudgetExhausted,
    maxDirectAttemptsPerFeature: input.maxDirectAttemptsPerFeature,
    unrepresentedNonTerminalCount,
    activeGithubRuns: input.activeGithubRuns,
    githubActiveRunLimit: input.githubActiveRunLimit,
    openChildren: input.openChildren,
    openSupportChildren: input.openSupportChildren,
    blockedWaitChildren: input.blockedWaitChildren,
    lastPulseCreated: input.created,
    lastPulseAssigned: input.assigned,
    updatedAt: new Date().toISOString(),
  };
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
  const githubAccess = resolveGitHubClient(projectDir);
  const githubActiveRunLimit = numberContext(
    loopTask,
    "githubActiveRunLimit",
    6,
  );
  const activeGithubRunList = githubAccess.client
    ? activeWorkflowRuns({
        client: githubAccess.client,
        projectDir,
        branch,
      })
    : [];
  const activeGithubRuns = activeGithubRunList.length;
  const activeGithubRunIds = new Set(
    activeGithubRunList
      .map((run) => run.databaseId)
      .filter((runId): runId is number => typeof runId === "number")
      .map((runId) => String(runId)),
  );
  const dispatchHold = !githubAccess.client
    ? (githubAccess.reason ??
      "GitHub Actions access is unavailable for live compact verification.")
    : activeGithubRuns >= githubActiveRunLimit
      ? `feature-compact loop live dispatch held because ${activeGithubRuns} GitHub workflow run(s) are already in progress on ${branch}; limit=${githubActiveRunLimit}`
      : "";
  const githubWorkflow = stringContext(
    loopTask,
    "githubWorkflow",
    "aks-rp-e2e-plan-execute.yaml",
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
  const refreshedTree = readTaskTree(config);
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
  const plannerSlotLimit = compactPlannerSlotLimit({
    windowSize,
    activeGithubRuns,
    githubActiveRunLimit,
    dispatchHold,
  });
  const existing = existingFeatureKeys(
    postAcceptLoopTask,
    postAcceptTree.tasks,
  );
  const blockedWaits = postAcceptLoopTask
    ? blockedWaitFeatureKeys(postAcceptLoopTask, postAcceptTree.tasks)
    : new Set<string>();
  const releasedStaleRunning = releaseStaleRunningFeatures({
    state,
    existing: new Set<string>([...existing, ...blockedWaits]),
    activeWorkflowRunIds: activeGithubRunIds,
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
        `features/${item.capabilityId}/compact/${target}.summary.md`,
        `features/${item.capabilityId}/compact/${target}.diagnostics.json`,
      ],
      acceptance: [
        "Feature compact package covers every feature-owned spec, or records an error with exact missing coverage.",
        "Generated check-mode Vitest tests were run.",
        "The compact plan passed the live GitHub plan-execute workflow.",
        "If live GitHub verification cannot pass after every bounded repo-local repair, an escalation task records the exact owner/environment/product reason and resume condition.",
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
        liveParallel,
        branch,
        githubWorkflow,
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
  const createdSupportTaskIds = postAcceptLoopTask
    ? materializeFeatureCompactFollowups(config, {
        loopTask: postAcceptLoopTask,
        state,
        stateRef,
        target,
        branch,
        maxDirectAttemptsPerFeature,
        maxGroups: maxCompactFollowupGroups,
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
  for (const taskId of supportCandidateIds.slice(
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
  const finalReleasedStaleRunning = releaseStaleRunningFeatures({
    state,
    existing: latestLoopTask
      ? existingFeatureKeys(latestLoopTask, latestTree.tasks)
      : new Set<string>(),
    activeWorkflowRunIds: activeGithubRunIds,
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
      created: createdTaskIds.length,
      assigned: assignments.length,
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
    `Assigned ${assignments.length} child task(s).`,
    assignedSupportChildren
      ? `Assigned ${assignedSupportChildren} compact repair task(s).`
      : "",
    dispatchHold ? `Dispatch held: ${dispatchHold}` : "",
    `Active GitHub workflow runs: ${activeGithubRuns}/${githubActiveRunLimit}.`,
    requeuedOrphaned.length
      ? `Requeued ${requeuedOrphaned.length} orphaned child assignment(s).`
      : "",
    acceptedRecordedChildren.length
      ? `Accepted ${acceptedRecordedChildren.length} recorded compact package review(s).`
      : "",
    releasedStaleRunning + finalReleasedStaleRunning
      ? `Released ${releasedStaleRunning + finalReleasedStaleRunning} stale running feature(s).`
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
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    consumed_assignment_rows: consumedAssignmentRows,
    requeued_orphaned_task_ids: requeuedOrphaned,
    accepted_review_task_ids: acceptedRecordedChildren,
    released_stale_running_count:
      releasedStaleRunning + finalReleasedStaleRunning,
    state_path: statePath,
  });

  return ctx.done(summary);
}
