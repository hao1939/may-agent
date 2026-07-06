/**
 * spec-loop-controller — bounded controller for the single-spec verification loop.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  importNewerSpecLoopMirrorRows,
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
  reopenControllerRootWhenIncomplete,
  requeueOrphanedActiveChildren,
} from "./lib/loop-controller-repair.ts";
import { exactBlockedWaitStewardshipProgress } from "./lib/durable-loop-wait-stewardship.ts";
import {
  activeWorkflowRuns,
  resolveGitHubClient,
} from "./lib/github-actions.ts";

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

function taskConflictScopes(task: TaskNode): string[] {
  return Array.isArray((task as { conflict_scope?: unknown }).conflict_scope)
    ? (task as { conflict_scope: unknown[] }).conflict_scope.filter(
        (scope): scope is string => typeof scope === "string",
      )
    : [];
}

function staleNonDirectLiveErrorNeedsLiveRun(task: TaskNode): boolean {
  const text = taskText(task).toLowerCase();
  return (
    text.includes("source/check-only") ||
    text.includes("not directly live-executable") ||
    text.includes("requires an existing-cluster carrier") ||
    text.includes("requires a shared-cluster carrier")
  );
}

function dispatchFailedBeforeWorkflowRun(task: TaskNode): boolean {
  const text = taskText(task).toLowerCase();
  return (
    text.includes("github workflow dispatch failed") ||
    text.includes("gh auth login") ||
    text.includes("populate the gh_token") ||
    text.includes("workflow dispatch failed")
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

function reconcileArchivedNonLiveErrors(input: {
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
    if (!archivedTasks.some(staleNonDirectLiveErrorNeedsLiveRun)) {
      continue;
    }
    updateSpecLoopSpec(input.state, specId, {
      status: "error",
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

function optionalBooleanContext(task: TaskNode, key: string): boolean | null {
  const value = taskContext(task)[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return null;
}

function shouldPreflightGitHubAccess(input: {
  projectDir: string;
  loopTask: TaskNode;
}): boolean {
  const explicit = optionalBooleanContext(
    input.loopTask,
    "githubAccessPreflight",
  );
  if (explicit !== null) return explicit;
  return existsSync(join(input.projectDir, ".git"));
}

function shouldPreflightSpecExecutionPolicy(input: {
  projectDir: string;
  loopTask: TaskNode;
}): boolean {
  const explicit = optionalBooleanContext(
    input.loopTask,
    "specExecutionPolicyPreflight",
  );
  if (explicit !== null) return explicit;
  return ["check-private-source-policy.ts", "check-live-admission.ts"].some(
    (script) => existsSync(join(input.projectDir, "runner", script)),
  );
}

type SpecExecutionPolicyResult = { ok: true } | { ok: false; reason: string };

function compactCommandOutput(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 2_000);
}

function checkSpecExecutionPolicy(input: {
  projectDir: string;
  specId: string;
  enabled: boolean;
}): SpecExecutionPolicyResult {
  if (!input.enabled) return { ok: true };
  const scripts = [
    "check-private-source-policy.ts",
    "check-live-admission.ts",
  ].filter((script) => existsSync(join(input.projectDir, "runner", script)));
  for (const script of scripts) {
    const result = spawnSync(
      "bun",
      [`runner/${script}`, "--spec", input.specId],
      {
        cwd: input.projectDir,
        encoding: "utf8",
        timeout: 30_000,
        env: process.env,
      },
    );
    if (result.status === 0) continue;
    const output = compactCommandOutput(
      [result.stderr, result.stdout, result.error?.message]
        .filter(Boolean)
        .join("\n"),
    );
    return {
      ok: false,
      reason:
        output ||
        `${script} failed with status ${String(result.status ?? "unknown")}`,
    };
  }
  return { ok: true };
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

function taskTrace(task: TaskNode | undefined): Record<string, unknown> {
  return task?.trace &&
    typeof task.trace === "object" &&
    !Array.isArray(task.trace)
    ? (task.trace as Record<string, unknown>)
    : {};
}

function traceString(task: TaskNode | undefined, key: string): string {
  const value = taskTrace(task)[key];
  return typeof value === "string" ? value : "";
}

function timestampMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasReviewedPendingSuccessor(
  specState: SpecLoopState["specs"][string] | undefined,
  child: TaskNode,
): boolean {
  if (!specState) return false;
  const stateRecord = specState as Record<string, unknown>;
  const normalizedFromStatus =
    typeof stateRecord.normalizedFromStatus === "string"
      ? stateRecord.normalizedFromStatus
      : "";
  const successorDisposition =
    typeof stateRecord.successorDisposition === "string"
      ? stateRecord.successorDisposition
      : "";
  const normalizedAt = timestampMs(stateRecord.normalizedAt);
  const review =
    specState.review &&
    typeof specState.review === "object" &&
    !Array.isArray(specState.review)
      ? (specState.review as Record<string, unknown>)
      : null;
  const reviewedAt =
    timestampMs(review?.reviewedAt) ??
    timestampMs(review?.updatedAt) ??
    normalizedAt;
  if (!reviewedAt || normalizedFromStatus !== "error") return false;
  const action =
    typeof review?.lastAction === "string"
      ? review.lastAction.toLowerCase()
      : "";
  const normalizedDisposition = successorDisposition.toLowerCase();
  const pendingDisposition = normalizedDisposition.includes("pending");
  const waitDisposition = normalizedDisposition.includes("wait");
  const pendingAction = action.includes("keep pending");
  if (!pendingDisposition && !waitDisposition && !pendingAction) return false;

  const childTerminalAt = Math.max(
    timestampMs(traceString(child, "reviewed_at")) ?? 0,
    timestampMs(traceString(child, "last_worker_completed_at")) ?? 0,
    timestampMs(traceString(child, "worker_started_at")) ?? 0,
  );
  return reviewedAt > childTerminalAt;
}

function isOpenTaskStatus(status: string): boolean {
  return (
    status === "active" ||
    status === "backlog" ||
    status === "review" ||
    status === "waiting"
  );
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

function openSpecVerifierChildCount(
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

function frontierOpenChildStatuses(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): {
  openChildren: number;
  activeChildren: number;
  reviewChildren: number;
  waitingChildren: number;
  backlogChildren: number;
} {
  const counts = {
    openChildren: 0,
    activeChildren: 0,
    reviewChildren: 0,
    waitingChildren: 0,
    backlogChildren: 0,
  };
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!child || isSpecLoopFollowupChild(child)) continue;
    const status = taskStatus(child);
    if (status === "active") {
      counts.activeChildren += 1;
      counts.openChildren += 1;
    } else if (status === "review") {
      counts.reviewChildren += 1;
      counts.openChildren += 1;
    } else if (status === "waiting") {
      counts.waitingChildren += 1;
      counts.openChildren += 1;
    } else if (status === "backlog") {
      counts.backlogChildren += 1;
      counts.openChildren += 1;
    }
  }
  return counts;
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

function representedFollowupGroupKeys(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): Set<string> {
  const keys = new Set<string>();
  for (const childId of loopTask.children ?? []) {
    const child = tasks[childId];
    if (!isRepresentingFollowupStatus(taskStatus(child))) continue;
    for (const key of specLoopFollowupGroupKeys(child)) {
      keys.add(key);
    }
  }
  return keys;
}

function taskHasStructuredBlocker(task: TaskNode | undefined): boolean {
  return !!(task as { blocker?: unknown } | undefined)?.blocker;
}

function specLoopSpecHasStructuredSuccessor(
  spec: SpecLoopState["specs"][string] | undefined,
): boolean {
  if (!spec) return false;
  const record = spec as Record<string, unknown>;
  if (
    typeof record.successorDisposition === "string" &&
    record.successorDisposition.trim()
  ) {
    return true;
  }
  if (
    typeof record.resumeCondition === "string" &&
    record.resumeCondition.trim()
  ) {
    return true;
  }
  return !!spec.review && typeof spec.review === "object";
}

function exactSpecLoopOwnerTaskId(input: {
  tasks: Record<string, TaskNode>;
  state: SpecLoopState;
  specId: string;
}): string | null {
  const spec = input.state.specs[input.specId];
  const isRepresenting = (task: TaskNode | undefined): task is TaskNode =>
    !!task && isRepresentingFollowupStatus(taskStatus(task));

  const taskIds = new Set<string>();
  if (typeof spec?.taskId === "string" && spec.taskId.trim()) {
    taskIds.add(spec.taskId.trim());
  }
  for (const task of Object.values(input.tasks)) {
    if (!isRepresenting(task)) continue;
    if (taskConflictScopes(task).includes(`spec:${input.specId}`)) {
      taskIds.add(task.id);
    }
  }

  for (const taskId of taskIds) {
    const task = input.tasks[taskId];
    if (!isRepresenting(task)) continue;
    if (taskConflictScopes(task).includes(`spec:${input.specId}`)) {
      return taskId;
    }
    if (specLoopFollowupGroupKeys(task).size > 0) return taskId;
    if (
      spec?.taskId === taskId &&
      specLoopSpecHasStructuredSuccessor(spec) &&
      taskHasStructuredBlocker(task)
    ) {
      return taskId;
    }
  }

  return null;
}

function exactRepresentedSpecIds(input: {
  tasks: Record<string, TaskNode>;
  state: SpecLoopState;
}): Set<string> {
  const ids = new Set<string>();
  for (const specId of Object.keys(input.state.specs)) {
    if (exactSpecLoopOwnerTaskId({ ...input, specId })) ids.add(specId);
  }
  return ids;
}

function specLoopFollowupGroupKeys(task: TaskNode | undefined): Set<string> {
  const keys = new Set<string>();
  if (!task) return keys;
  if (isSpecLoopFollowupChild(task)) {
    const context = taskContext(task);
    const status = context.status;
    const family = context.featureFamily;
    if (typeof status === "string" && typeof family === "string") {
      keys.add(`${status}:${family}`);
    }
  }
  for (const scope of taskConflictScopes(task)) {
    const trimmed = scope.trim();
    if (!trimmed.startsWith("spec-loop-followup:")) continue;
    const [, statusPart, familyPart] = trimmed.split(":");
    if (statusPart?.trim() && familyPart?.trim()) {
      keys.add(`${statusPart.trim()}:${familyPart.trim()}`);
    }
  }
  return keys;
}

function blockedWaitChildCount(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): number {
  return (loopTask.children ?? [])
    .map((childId) => tasks[childId])
    .filter(
      (task) =>
        !!task && !isSpecLoopChild(task) && !isSpecLoopFollowupChild(task),
    )
    .filter((task) => taskStatus(task) === "blocked").length;
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
    .filter(isSpecLoopChild)
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

type NonPassSpecStatus = "pending" | "error" | "fail";

type NonPassSpecGroup = {
  status: NonPassSpecStatus;
  family: string;
  count: number;
  specIds: string[];
  sampledSpecIds: string[];
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
    (spec) =>
      spec.status === "pending" ||
      spec.status === "running" ||
      spec.status === "done",
  );
}

function canDirectlyRunSpec(input: {
  state: SpecLoopState;
  specId: string;
  maxDirectAttemptsPerSpec: number;
}): boolean {
  const spec = input.state.specs[input.specId];
  if (!spec) return false;
  if (spec.status === "pending" || spec.status === "done") {
    return (
      !spec.lastRunUrl || (spec.attempts ?? 0) < input.maxDirectAttemptsPerSpec
    );
  }
  if (spec.status !== "error" && spec.status !== "fail") return false;
  return (spec.attempts ?? 0) < input.maxDirectAttemptsPerSpec;
}

function retryBudgetExhaustedCount(input: {
  state: SpecLoopState;
  maxDirectAttemptsPerSpec: number;
}): number {
  return Object.values(input.state.specs).filter(
    (spec) =>
      (spec.status === "error" || spec.status === "fail") &&
      (spec.attempts ?? 0) >= input.maxDirectAttemptsPerSpec,
  ).length;
}

function nonPassSpecGroups(
  state: SpecLoopState,
  input: {
    maxGroups: number;
    maxSpecSamples: number;
    maxDirectAttemptsPerSpec: number;
  },
): NonPassSpecGroup[] {
  const groups = new Map<string, NonPassSpecGroup>();
  for (const [specId, spec] of Object.entries(state.specs)) {
    const status = spec.status;
    const groupedPending =
      status === "pending" &&
      !canDirectlyRunSpec({
        state,
        specId,
        maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
      });
    if (status !== "error" && status !== "fail" && !groupedPending) {
      continue;
    }
    const groupStatus: NonPassSpecStatus = groupedPending ? "pending" : status;
    const family = specFamily(specId);
    const key = `${groupStatus}:${family}`;
    const group = groups.get(key) ?? {
      status: groupStatus,
      family,
      count: 0,
      specIds: [],
      sampledSpecIds: [],
    };
    group.count += 1;
    group.specIds.push(specId);
    if (group.sampledSpecIds.length < input.maxSpecSamples) {
      group.sampledSpecIds.push(specId);
    }
    groups.set(key, group);
  }
  const statusRank: Record<NonPassSpecStatus, number> = {
    error: 0,
    fail: 1,
    pending: 2,
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

function isRepresentingFollowupStatus(status: string): boolean {
  return isOpenTaskStatus(status) || status === "blocked";
}

function existingRepresentingSpecLoopFollowupTaskId(
  tasks: Record<string, TaskNode>,
  group: NonPassSpecGroup,
): string | null {
  const groupKey = `${group.status}:${group.family}`;
  const deterministicTask = tasks[followupTaskId(group)];
  if (
    deterministicTask &&
    isRepresentingFollowupStatus(taskStatus(deterministicTask))
  ) {
    return deterministicTask.id;
  }
  for (const task of Object.values(tasks)) {
    if (!isRepresentingFollowupStatus(taskStatus(task))) continue;
    if (specLoopFollowupGroupKeys(task).has(groupKey)) return task.id;
  }
  return null;
}

function nextAvailableTaskId(
  tasks: Record<string, TaskNode>,
  baseTaskId: string,
): string {
  if (!tasks[baseTaskId]) return baseTaskId;
  for (let index = 2; index < 1_000; index += 1) {
    const candidate = `${baseTaskId}-${index}`;
    if (!tasks[candidate]) return candidate;
  }
  return `${baseTaskId}-${Date.now()}`;
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
    maxDirectAttemptsPerSpec: number;
  },
): string[] {
  const hasRunnableWork = Object.entries(input.state.specs).some(
    ([specId, spec]) =>
      spec.status === "running" ||
      (spec.status === "pending" &&
        canDirectlyRunSpec({
          state: input.state,
          specId,
          maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
        })),
  );
  if (hasRunnableWork) return [];
  const groups = nonPassSpecGroups(input.state, {
    maxGroups: Math.max(input.maxGroups, Object.keys(input.state.specs).length),
    maxSpecSamples: input.maxSpecSamples,
    maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
  });
  const createdTaskIds: string[] = [];
  for (const group of groups) {
    const latestTree = readTaskTree(config);
    if (existingRepresentingSpecLoopFollowupTaskId(latestTree.tasks, group)) {
      continue;
    }
    const allSpecsHaveExactOwners = group.specIds.every((specId) =>
      exactSpecLoopOwnerTaskId({
        tasks: latestTree.tasks,
        state: input.state,
        specId,
      }),
    );
    if (allSpecsHaveExactOwners) continue;
    const taskId = nextAvailableTaskId(latestTree.tasks, followupTaskId(group));
    createTask(config, {
      id: taskId,
      parentId: input.loopTask.id,
      priority: "P1",
      goal: `Reconcile ${group.count} ${group.status} spec-loop result(s) for the ${group.family} feature family by fixing what is fixable, rerunning only meaningful changes, and escalating only after bounded repair paths are exhausted.`,
      inputs: [
        `status:${group.status}`,
        `featureFamily:${group.family}`,
        `target:${input.target}`,
        `branch:${input.branch}`,
        `state:${input.stateRef}`,
        ...group.sampledSpecIds.map((specId) => `spec:${specId}`),
      ],
      outputs: [input.stateRef, "evidence/archive/", "features/", "specs/"],
      acceptance: [
        "Every affected non-pass spec has a concrete root-cause classification.",
        "Every fixable test/spec/runtime issue was repaired and queued for a meaningful live rerun.",
        "If no bounded repo-local fix remains, an escalation task records the exact owner/environment/product reason, affected specs, attempted fixes, and resume condition.",
        "Relevant spec-loop state, spec/model files, or evidence notes were updated to match that pass/fix/escalate decision.",
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
        sampledSpecIds: group.sampledSpecIds,
        representedSpecIds: group.specIds,
        stateRef: input.stateRef,
        target: input.target,
        branch: input.branch,
      },
    });
    createdTaskIds.push(taskId);
  }
  return createdTaskIds;
}

function policyFollowupTaskId(specId: string): string {
  return `repair-spec-loop-policy-${safeTaskIdPart(specFamily(specId))}`;
}

function existingOpenPolicyFollowupTaskId(
  tasks: Record<string, TaskNode>,
  specId: string,
): string | null {
  const family = specFamily(specId);
  for (const task of Object.values(tasks)) {
    if (!isSpecLoopFollowupChild(task)) continue;
    const context = taskContext(task);
    if (context.policyFollowup !== true) continue;
    if (context.featureFamily !== family) continue;
    if (isOpenTaskStatus(taskStatus(task))) return task.id;
  }
  return null;
}

function createOrUpdatePolicyFollowup(
  config: ReturnType<typeof buildTaskTreeConfig>,
  input: {
    loopTask: TaskNode;
    specId: string;
    reason: string;
    stateRef: string;
    target: string;
    branch: string;
  },
): { taskId: string; created: boolean } {
  const taskId = policyFollowupTaskId(input.specId);
  const now = new Date().toISOString();
  let created = false;
  let resolvedTaskId = taskId;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const openTaskId = existingOpenPolicyFollowupTaskId(
      tree.tasks,
      input.specId,
    );
    const existing = openTaskId ? tree.tasks[openTaskId] : undefined;
    if (existing) {
      resolvedTaskId = existing.id;
      const context = taskContext(existing);
      const sampledSpecIds = Array.isArray(context.sampledSpecIds)
        ? context.sampledSpecIds.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      existing.inputs = [
        ...new Set([
          ...(existing.inputs ?? []),
          `spec:${input.specId}`,
          `target:${input.target}`,
          `branch:${input.branch}`,
          `state:${input.stateRef}`,
        ]),
      ];
      existing.context = {
        ...context,
        specLoopFollowup: true,
        status: "error",
        featureFamily: specFamily(input.specId),
        sampledSpecIds: [...new Set([...sampledSpecIds, input.specId])],
        latestPolicyFailure: input.reason,
        updatedAt: now,
      };
      existing.trace = {
        ...(existing.trace ?? {}),
        latest_policy_failure_spec_id: input.specId,
        latest_policy_failure_reason: input.reason,
        latest_policy_failure_at: now,
      };
      saveTaskTreeWithKanbanSnapshot(config, tree);
      appendToolJournal(config, {
        kind: "spec_loop_policy_followup_updated",
        task_id: existing.id,
        spec_id: input.specId,
        reason: input.reason,
      });
      return;
    }
    created = true;
  });
  if (created) {
    const latestTree = readTaskTree(config);
    const availableTaskId = nextAvailableTaskId(latestTree.tasks, taskId);
    resolvedTaskId = availableTaskId;
    createTask(config, {
      id: availableTaskId,
      parentId: input.loopTask.id,
      priority: "P1",
      goal: `Repair spec-loop execution policy failures for the ${specFamily(input.specId)} feature family so affected specs can run live on GitHub without private AKS RP source or Azure CLI fallback.`,
      inputs: [
        `spec:${input.specId}`,
        `target:${input.target}`,
        `branch:${input.branch}`,
        `state:${input.stateRef}`,
        `policyFailure:${input.reason}`,
      ],
      outputs: [input.stateRef, "features/", "specs/", "runs/test-results/"],
      acceptance: [
        "Every sampled spec removes private AKS RP source, Azure CLI fallback, and existing/shared-cluster carrier dependencies from its live execution path.",
        "Each repaired spec is requeued for a standalone live GitHub run.",
        "If no repo-local repair remains, the task records the exact external owner, affected specs, attempted fixes, and resume condition.",
      ],
      conflict_scope: [
        `spec-loop-policy:${specFamily(input.specId)}`,
        `feature:${specFamily(input.specId)}`,
      ],
      context: {
        specLoopFollowup: true,
        policyFollowup: true,
        status: "error",
        featureFamily: specFamily(input.specId),
        sampledSpecIds: [input.specId],
        latestPolicyFailure: input.reason,
        stateRef: input.stateRef,
        target: input.target,
        branch: input.branch,
      },
    });
    return { taskId: availableTaskId, created };
  }
  return { taskId: resolvedTaskId, created };
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

function requeueTerminalSpecsMissingLocalResult(
  state: SpecLoopState,
  maxDirectAttemptsPerSpec: number,
): number {
  let requeued = 0;
  for (const [specId, spec] of Object.entries(state.specs)) {
    if (spec.status !== "error" && spec.status !== "fail") continue;
    if ((spec.attempts ?? 0) >= maxDirectAttemptsPerSpec) continue;
    if (!spec.lastRunUrl) continue;
    if (spec.lastResultPath && existsSync(spec.lastResultPath)) continue;
    updateSpecLoopSpec(state, specId, {
      status: "pending",
      taskId: null,
      activeAttemptId: null,
      activeTaskSessionId: null,
      activeWorkflowRunId: null,
    });
    requeued += 1;
  }
  return requeued;
}

function backlogChildTaskIds(
  loopTask: TaskNode,
  tasks: Record<string, TaskNode>,
): string[] {
  return (loopTask.children ?? []).filter((childId) => {
    const child = tasks[childId];
    if (!isSpecLoopChild(child)) return false;
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
      if (dispatchFailedBeforeWorkflowRun(child) && !specState?.lastRunUrl) {
        updateSpecLoopSpec(input.state, specId, {
          status: "pending",
          taskId: null,
          activeAttemptId: null,
          activeTaskSessionId: null,
          activeWorkflowRunId: null,
        });
        continue;
      }
      if (hasReviewedPendingSuccessor(specState, child)) {
        updateSpecLoopSpec(input.state, specId, {
          status: "pending",
          taskId: child.id,
        });
        continue;
      }
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
            current === "error" && staleNonDirectLiveErrorNeedsLiveRun(child)
              ? "error"
              : String(current) === "blocked"
                ? "error"
                : current,
          taskId: child.id,
        });
      } else {
        updateSpecLoopSpec(input.state, specId, {
          status: "error",
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
  state: SpecLoopState;
  openChildren: number;
  activeChildren: number;
  reviewChildren: number;
  waitingChildren: number;
  backlogChildren: number;
  openSpecVerifierChildren: number;
  openFollowups: number;
  representedFollowupGroupKeys?: Set<string>;
  exactRepresentedSpecIds?: Set<string>;
  blockedWaitChildren: number;
  created: number;
  createdFollowups: number;
  assigned: number;
  reconciledArchivedNonLiveErrors: number;
  importedMirrorRows: number;
  targetRunning: number;
  maxDirectAttemptsPerSpec: number;
  backendBlocker?: string;
  dispatchHold?: string;
  activeGithubRuns?: number;
  githubActiveRunLimit?: number;
}): Record<string, unknown> {
  const counts: Record<string, number> = {};
  let dispatchablePending = 0;
  for (const [specId, spec] of Object.entries(input.state.specs)) {
    const status = spec.status || "pending";
    counts[status] = (counts[status] ?? 0) + 1;
    if (
      status === "pending" &&
      canDirectlyRunSpec({
        state: input.state,
        specId,
        maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
      })
    ) {
      dispatchablePending += 1;
    }
  }
  const residuePending = counts.pending ?? 0;
  const strandedPending = Math.max(0, residuePending - dispatchablePending);
  const residueRunning = counts.running ?? 0;
  const done = counts.done ?? 0;
  const residueError = counts.error ?? 0;
  const residueFail = counts.fail ?? 0;
  const residuePrOpen = counts.pr_open ?? 0;
  const nonPass = residueFail + residueError + residuePrOpen + done;
  const executionDrained = dispatchablePending === 0 && residueRunning === 0;
  const completionReady =
    residuePending === 0 && residueRunning === 0 && nonPass === 0;
  const surplusRunning = Math.max(0, residueRunning - input.targetRunning);
  const retryBudgetExhausted = retryBudgetExhaustedCount({
    state: input.state,
    maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
  });
  let unrepresentedGroupedResidue = 0;
  for (const [specId, spec] of Object.entries(input.state.specs)) {
    const status = spec.status || "pending";
    const groupedPending =
      status === "pending" &&
      !canDirectlyRunSpec({
        state: input.state,
        specId,
        maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
      });
    if (
      status !== "error" &&
      status !== "fail" &&
      status !== "pr_open" &&
      !groupedPending
    ) {
      continue;
    }
    const groupStatus = groupedPending ? "pending" : status;
    const groupKey = `${groupStatus}:${specFamily(specId)}`;
    if (
      !input.representedFollowupGroupKeys?.has(groupKey) &&
      !input.exactRepresentedSpecIds?.has(specId)
    ) {
      unrepresentedGroupedResidue += 1;
    }
  }
  const unrepresentedNonTerminalCount =
    dispatchablePending + residueRunning + done + unrepresentedGroupedResidue;
  const exactWaitOnlyFrontier =
    input.openChildren === 0 &&
    input.activeChildren === 0 &&
    input.reviewChildren === 0 &&
    input.waitingChildren === 0 &&
    input.backlogChildren === 0 &&
    input.openFollowups === 0 &&
    input.blockedWaitChildren > 0;
  const strandedExhaustedResidueOnly =
    exactWaitOnlyFrontier &&
    dispatchablePending === 0 &&
    residueRunning === 0 &&
    done === 0 &&
    residuePrOpen === 0 &&
    retryBudgetExhausted === residueError + residueFail;
  const noRefillNow =
    exactWaitOnlyFrontier && unrepresentedNonTerminalCount === 0;
  const frontierSummary = [
    `${input.activeChildren} active child leaf/leaves`,
    `${input.reviewChildren} review child leaf/leaves`,
    `${input.waitingChildren} waiting child leaf/leaves`,
    `${input.backlogChildren} backlog child leaf/leaves`,
    `${input.blockedWaitChildren} blocked wait leaf/leaves`,
    `${input.openFollowups} backlog follow-up leaf/leaves`,
  ].join(", ");
  return {
    completionReady,
    executionDrained,
    backendBlocked: input.backendBlocker ? true : undefined,
    backendBlocker: input.backendBlocker || undefined,
    dispatchHeld: input.dispatchHold ? true : undefined,
    dispatchHold: input.dispatchHold || undefined,
    noRefillNow: noRefillNow ? true : undefined,
    strandedExhaustedResidueOnly: strandedExhaustedResidueOnly
      ? true
      : undefined,
    reason: completionReady
      ? "spec-loop state has no pending, running, fail, error, or legacy done specs; every spec has a live pass"
      : input.backendBlocker
        ? `spec-loop live backend is unavailable; no new verifier leaves will be created until this is fixed: ${input.backendBlocker}`
        : input.dispatchHold
          ? input.dispatchHold
          : noRefillNow
            ? `spec-loop execution is drained and the remaining frontier is exact wait stewardship: ${frontierSummary}; stranded pending residue=${strandedPending}`
            : surplusRunning > 0
              ? `spec-loop has ${residueRunning} running verifier(s) above targetRunning=${input.targetRunning}; controller suppresses backlog refill until active work drains`
              : input.openChildren > 0 ||
                  input.openFollowups > 0 ||
                  input.blockedWaitChildren > 0
                ? `spec-loop frontier remains narrow while residue is still nonterminal: ${frontierSummary}; residue pending=${residuePending} (dispatchable=${dispatchablePending}, stranded=${strandedPending}), residue running=${residueRunning}, residue error=${residueError}, residue fail=${residueFail}`
                : executionDrained
                  ? `spec-loop execution is drained but residue still needs normalization: pending=${residuePending} (dispatchable=${dispatchablePending}, stranded=${strandedPending}), running=${residueRunning}, error=${residueError}, fail=${residueFail}, pr_open=${residuePrOpen}, done=${done}`
                  : `spec-loop has exact open frontier plus nonterminal residue: ${frontierSummary}; residue pending=${residuePending} (dispatchable=${dispatchablePending}, stranded=${strandedPending}), residue running=${residueRunning}, residue error=${residueError}, residue fail=${residueFail}`,
    pending: residuePending,
    dispatchablePending,
    strandedPending,
    running: residueRunning,
    residuePending,
    residueRunning,
    residueError,
    residueFail,
    residuePrOpen,
    targetRunning: input.targetRunning,
    maxDirectAttemptsPerSpec: input.maxDirectAttemptsPerSpec,
    activeGithubRuns: input.activeGithubRuns,
    githubActiveRunLimit: input.githubActiveRunLimit,
    retryBudgetExhausted,
    unrepresentedNonTerminalCount,
    surplusRunning,
    pass: counts.pass ?? 0,
    fail: residueFail,
    error: residueError,
    prOpen: residuePrOpen,
    nonPass,
    done,
    openChildren: input.openChildren,
    activeChildren: input.activeChildren,
    reviewChildren: input.reviewChildren,
    waitingChildren: input.waitingChildren,
    backlogChildren: input.backlogChildren,
    openSpecVerifierChildren: input.openSpecVerifierChildren,
    openFollowups: input.openFollowups,
    representedFollowupGroups: [
      ...(input.representedFollowupGroupKeys ?? new Set<string>()),
    ].sort((a, b) => a.localeCompare(b)),
    blockedWaitChildren: input.blockedWaitChildren,
    frontierSummary,
    lastPulseCreated: input.created,
    lastPulseCreatedFollowups: input.createdFollowups,
    lastPulseAssigned: input.assigned,
    lastPulseReconciledArchivedNonLiveErrors:
      input.reconciledArchivedNonLiveErrors,
    lastPulseImportedMirrorRows: input.importedMirrorRows,
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

    const trace =
      task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
        ? (task.trace as Record<string, unknown>)
        : {};
    const hasAssignedAttempt =
      typeof trace.current_attempt_id === "string" &&
      trace.current_attempt_id.trim().length > 0;
    const holdReason =
      typeof input.progress.reason === "string" && input.progress.reason.trim()
        ? input.progress.reason.trim()
        : "controller is paused on exact wait stewardship";
    const holdBlocked =
      input.progress.noRefillNow === true ||
      input.progress.backendBlocked === true ||
      input.progress.dispatchHeld === true;

    if (input.progress.completionReady === false) {
      task.blocker = undefined;
      reopenControllerRootWhenIncomplete({
        task,
        progress: input.progress,
        reason: exactBlockedWaitStewardshipProgress(input.progress)
          ? "spec loop frontier is exact blocked wait stewardship; keep the durable root blocked until one named wait resolves or is replaced"
          : "spec loop progress is incomplete; durable controller root must stay runnable until non-pass specs are fixed, rerun, or exactly escalated",
      });

      if (!hasAssignedAttempt) {
        if (holdBlocked) {
          task.status = "blocked";
          task.state = "blocked";
          task.blocker = holdReason;
        } else {
          task.status = "backlog";
          task.state = "backlog";
          task.blocker = undefined;
        }
      }
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
  const maxDirectAttemptsPerSpec = numberContext(
    loopTask,
    "maxDirectAttemptsPerSpec",
    3,
  );
  const targetRunning = Math.min(
    windowSize,
    numberContext(loopTask, "targetRunning", windowSize),
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
  const projectStatePath = join(
    projectDir,
    ".state",
    "spec-loop",
    "state.json",
  );
  const importedMirror = importNewerSpecLoopMirrorRows(state, projectStatePath);

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
            : "error"
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
  const reconciledArchivedNonLiveErrors = reconcileArchivedNonLiveErrors({
    appDir,
    tasks: refreshedTree.tasks,
    state,
  });
  const alreadyOpen = openSpecVerifierChildCount(
    refreshedLoopTask,
    refreshedTree.tasks,
  );
  const existing = existingSpecIds(refreshedLoopTask, refreshedTree.tasks);
  const releasedStaleRunning = releaseStaleRunningSpecs({
    state,
    activeOrBacklog: activeOrBacklogSpecIds(
      refreshedLoopTask,
      refreshedTree.tasks,
    ),
  });
  const requeuedMissingLocalResults = requeueTerminalSpecsMissingLocalResult(
    state,
    maxDirectAttemptsPerSpec,
  );
  const githubAccess = shouldPreflightGitHubAccess({
    projectDir,
    loopTask,
  })
    ? resolveGitHubClient(projectDir)
    : { client: { kind: "gh" as const } };
  const backendBlocker = githubAccess.client
    ? ""
    : (githubAccess.reason ??
      "GitHub Actions access is unavailable for live single-spec verification.");
  const githubActiveRunLimit = numberContext(
    loopTask,
    "githubActiveRunLimit",
    6,
  );
  const activeGithubRuns = githubAccess.client
    ? activeWorkflowRuns({
        client: githubAccess.client,
        projectDir,
        branch,
      }).length
    : 0;
  const dispatchHold =
    !backendBlocker && activeGithubRuns >= githubActiveRunLimit
      ? `spec-loop live dispatch held because ${activeGithubRuns} GitHub workflow run(s) are already in progress on ${branch}; limit=${githubActiveRunLimit}`
      : "";
  const specExecutionPolicyPreflight = shouldPreflightSpecExecutionPolicy({
    projectDir,
    loopTask,
  });
  const pending =
    backendBlocker || dispatchHold
      ? []
      : orderedPendingSpecIds(state).filter(
          (specId) =>
            !existing.has(specId) &&
            canDirectlyRunSpec({ state, specId, maxDirectAttemptsPerSpec }),
        );
  const createdTaskIds: string[] = [];
  const policyFailureTaskIds: string[] = [];
  let policyPreflightFailures = 0;
  const policyPreflightFailureSamples: string[] = [];
  const toCreate = Math.max(0, windowSize - alreadyOpen);
  for (const specId of pending) {
    if (createdTaskIds.length >= toCreate) break;
    const policy = checkSpecExecutionPolicy({
      projectDir,
      specId,
      enabled: specExecutionPolicyPreflight,
    });
    if (policy.ok === false) {
      policyPreflightFailures += 1;
      if (policyPreflightFailureSamples.length < 5) {
        policyPreflightFailureSamples.push(specId);
      }
      const followup = createOrUpdatePolicyFollowup(config, {
        loopTask,
        specId,
        reason: policy.reason,
        stateRef,
        target,
        branch,
      });
      if (followup.created) policyFailureTaskIds.push(followup.taskId);
      updateSpecLoopSpec(state, specId, {
        status: "error",
        taskId: followup.taskId,
        attempts: Math.max(
          state.specs[specId]?.attempts ?? 0,
          maxDirectAttemptsPerSpec,
        ),
      });
      continue;
    }
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
        "GitHub workflow run completed against the fixed target environment.",
        "result.json and summary artifacts were reviewed when available.",
        "Spec status was classified as pass, fail, or error with exact root cause.",
        "Any fail/error has a concrete repair-and-rerun path, or an escalation record after bounded fixes are exhausted.",
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
    refreshedLoopTask &&
    createdTaskIds.length === 0 &&
    policyFailureTaskIds.length === 0
      ? materializeSpecLoopFollowups(config, {
          loopTask: refreshedLoopTask,
          state,
          stateRef,
          target,
          branch,
          maxGroups: numberContext(loopTask, "maxFollowupGroups", 12),
          maxSpecSamples: numberContext(loopTask, "maxFollowupSpecSamples", 20),
          maxDirectAttemptsPerSpec,
        })
      : [];
  const allCreatedFollowupTaskIds = [
    ...policyFailureTaskIds,
    ...createdFollowupTaskIds,
  ];

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
    ? backendBlocker || dispatchHold
      ? []
      : backlogChildTaskIds(assignableLoopTask, assignableTree.tasks)
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
  saveSpecLoopState(statePath, state, [projectStatePath]);
  const frontierCounts = latestLoopTask
    ? frontierOpenChildStatuses(latestLoopTask, latestTree.tasks)
    : {
        openChildren: 0,
        activeChildren: 0,
        reviewChildren: 0,
        waitingChildren: 0,
        backlogChildren: 0,
      };
  const openSpecVerifierChildren = latestLoopTask
    ? openSpecVerifierChildCount(latestLoopTask, latestTree.tasks)
    : 0;
  const openFollowups = latestLoopTask
    ? openFollowupCount(latestLoopTask, latestTree.tasks)
    : 0;
  const blockedWaitChildren = latestLoopTask
    ? blockedWaitChildCount(latestLoopTask, latestTree.tasks)
    : 0;
  const exactOwnedSpecIds = exactRepresentedSpecIds({
    tasks: latestTree.tasks,
    state,
  });
  updateControllerWorkflowProgress({
    appDir,
    projectDir,
    taskId: loopTask.id,
    progress: specLoopWorkflowProgress({
      state,
      openChildren: frontierCounts.openChildren,
      activeChildren: frontierCounts.activeChildren,
      reviewChildren: frontierCounts.reviewChildren,
      waitingChildren: frontierCounts.waitingChildren,
      backlogChildren: frontierCounts.backlogChildren,
      openSpecVerifierChildren,
      created: createdTaskIds.length,
      assigned: assignments.length,
      openFollowups,
      representedFollowupGroupKeys: latestLoopTask
        ? representedFollowupGroupKeys(latestLoopTask, latestTree.tasks)
        : new Set<string>(),
      exactRepresentedSpecIds: exactOwnedSpecIds,
      blockedWaitChildren,
      createdFollowups: allCreatedFollowupTaskIds.length,
      reconciledArchivedNonLiveErrors,
      importedMirrorRows: importedMirror.imported,
      targetRunning,
      maxDirectAttemptsPerSpec,
      backendBlocker,
      dispatchHold,
      activeGithubRuns,
      githubActiveRunLimit,
    }),
  });
  const summary = [
    `Spec loop ${loopTask.id} pulse complete.`,
    created ? "Initialized spec-loop state." : "",
    `Created ${createdTaskIds.length} child task(s).`,
    createdFollowupTaskIds.length
      ? `Created ${createdFollowupTaskIds.length} grouped follow-up task(s).`
      : "",
    policyFailureTaskIds.length
      ? `Created ${policyFailureTaskIds.length} policy repair follow-up task(s).`
      : "",
    policyPreflightFailures
      ? `Policy-preflighted ${policyPreflightFailures} spec(s) into repair before GitHub dispatch: ${policyPreflightFailureSamples.join(", ")}.`
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
    requeuedMissingLocalResults
      ? `Requeued ${requeuedMissingLocalResults} terminal spec(s) with missing local result artifacts.`
      : "",
    importedMirror.imported
      ? `Imported ${importedMirror.imported} newer domain mirror row(s): ${importedMirror.specIds.slice(0, 5).join(", ")}.`
      : "",
    backendBlocker ? `Backend blocked: ${backendBlocker}` : "",
    dispatchHold ? `Dispatch held: ${dispatchHold}` : "",
    `Target running spec workflows: ${targetRunning}.`,
    `Active GitHub workflow runs: ${activeGithubRuns}/${githubActiveRunLimit}.`,
    `Max direct attempts per spec: ${maxDirectAttemptsPerSpec}.`,
    `Priority specs from dev-infra-core: ${state.prioritySpecIds.length}.`,
  ]
    .filter(Boolean)
    .join(" ");

  appendToolJournal(config, {
    kind: "spec_loop_controller_pulse",
    task_id: loopTask.id,
    created_task_ids: createdTaskIds,
    created_followup_task_ids: allCreatedFollowupTaskIds,
    policy_preflight_failures: policyPreflightFailures,
    policy_preflight_failure_samples: policyPreflightFailureSamples,
    assigned_task_ids: assignments.map((assignment) => assignment.taskId),
    consumed_assignment_rows: consumedAssignmentRows,
    requeued_orphaned_task_ids: requeuedOrphaned,
    requeued_missing_local_result_count: requeuedMissingLocalResults,
    imported_mirror_spec_ids: importedMirror.specIds,
    accepted_review_task_ids: acceptedReviewChildren,
    state_path: statePath,
  });

  return ctx.done(summary);
}
