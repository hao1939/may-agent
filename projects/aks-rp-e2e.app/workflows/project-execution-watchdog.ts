/**
 * project-execution-watchdog — liveness observer for aks-rp-e2e.
 *
 * The planner owns task-tree decisions. This workflow only observes runtime
 * sessions and wakes app-ops when review is needed.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { defaultFeatureCompactLoopStatePath } from "./lib/feature-compact-loop-store.ts";
import { defaultFeatureReferenceLoopStatePath } from "./lib/feature-reference-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  type SpecLoopState,
} from "./lib/spec-loop-store.ts";
import {
  resolveTaskTreePath,
  type StructuredWorkflowResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  normalizeTaskTreeInPlace,
  taskRevision,
  taskState,
  withTreeLock,
  type TaskNode,
  type TaskTreeConfig,
  type TaskTree,
} from "./lib/task-tree-store.ts";
import {
  acknowledgeTaskAssignments,
  appendToolJournal,
  assignTask,
  listRunnableBacklogTaskIds,
  normalizeBlockedWaitObservationWindow,
  saveTaskTreeWithKanbanSnapshot,
  type TaskCompletionClaim,
  waitingBacklogTaskSnapshots,
} from "./lib/task-tree-tools.ts";
import {
  getWorkflowRun,
  resolvePipelineClient,
  type PipelineClient,
  type PipelineRun,
} from "./lib/ado-pipelines.ts";
import {
  completeStartedAttempt,
  emitTaskCompleted,
} from "./default-task-worker.ts";
import {
  claimPipelineConditionFallbackV2,
  conditionRegistry,
  ensureResolvedPipelineConditionAssignmentsV2,
  exactAdoConditionV2Enabled,
  finishPipelineConditionFallbackV2,
  openExactConditionSubjectIdsV2,
  observePipelineConditionV2,
  resolvePipelineConditionV2,
  type ProjectConditionV2Mode,
} from "./lib/project-conditions.ts";
import {
  captureRuntimeProjectSnapshotV2,
  findRuntimeReviewerRowV2,
  type RuntimeReviewerRowV2,
} from "./lib/project-snapshot-capture-v2.ts";
import type { ReviewProjectionV2 } from "./lib/project-snapshot-v2.ts";
import {
  claimNextReviewHandoffActionV2,
  completeReviewHandoffActionV2,
  failReviewHandoffActionV2,
  terminalAttemptRecoveryCandidatesV2,
  type SupervisorActionClaimV2,
} from "./lib/project-supervisor-v2.ts";
import {
  completionReviewPendingActionV2,
  deliverPendingActionV2,
  reviewApplicationPendingActionV2,
} from "./lib/project-pending-actions-v2.ts";
import {
  appendCompletionReviewDeliveryReceiptV2,
  completionReviewDeliveryReceiptsV2,
} from "./lib/project-completion-delivery-v2.ts";
import {
  appendPendingActionDeliveryReceiptV2,
  pendingActionDeliveryReceiptsV2,
} from "./lib/project-review-delivery-v2.ts";
import {
  adoptExactPipelineWaitV2,
  type ExactPipelineConditionAdoptionV2Mode,
} from "./lib/work-commands-v2.ts";
import { syncProjectReadout } from "./lib/project-readout-sync.ts";
import {
  activeExternalRunWaitProgress,
  exactBlockedWaitStewardshipProgress,
} from "./lib/durable-loop-wait-stewardship.ts";
import { field, readJson, resolveAppDir } from "./lib/workflow-input.ts";

export const name = "project-execution-watchdog";
export const description =
  "Observe aks-rp-e2e task/session liveness and wake app-ops when review is needed.";

const REVIEW_RECOVERY_DELAY_MS = 15 * 60_000;
const REVIEW_APPLICATION_GRACE_MS = 5 * 60_000;
const PIPELINE_WAIT_NEXT_CHECK_MS = 10 * 60_000;

type WatchdogConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  stateDbPath: string;
  specLoopStatePath: string;
  featureReferenceLoopStatePath: string;
  featureCompactLoopStatePath: string;
  agent: string;
  maxConcurrent: number;
  staleNoActivityMs: number;
  sessionStartGraceMs: number;
  supervisorV2: "off" | "review-handoff-revisioned";
  pendingActionRedeliveryV2:
    "off" | "review-application-revisioned" | "review-handoffs-revisioned";
  supervisorAttemptV2: "off" | "shadow";
  conditionV2: ProjectConditionV2Mode;
  conditionAdoptionV2: ExactPipelineConditionAdoptionV2Mode;
  conditionAdoptionV2TaskId?: string;
  conditionAdoptionV2RunId?: string;
};

type ActiveTaskSnapshot = {
  taskId: string;
  taskRevision: number;
  currentAttemptId?: string;
  sessionId?: string;
  assignedAt?: string;
  workerStartedAt?: string;
  workflow?: string;
  futureWindowGateAt?: string;
  verifierLiveness?: {
    specId?: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  };
  compactLiveness?: {
    featureKey?: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  };
};

type OpenTaskSnapshot = {
  taskId: string;
  parentId?: string | null;
  workflow?: string;
  owner?: string;
  updatedAt?: string;
  reviewKind?: string;
  resultSummary?: string;
  lastWorkerResult?: string;
  lastWorkerSummary?: string;
  terminalPipelineWaitReview?: Record<string, unknown>;
  terminalGitHubWaitReview?: Record<string, unknown>;
  blocker?: unknown;
  waitType?: string;
  resumeAt?: string;
  resumeCondition?: string;
  nextCheckAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
  reasons?: string[];
};

type OverdueOwnerAction = {
  taskId: string;
  owner: string;
  watchAt: string;
  nextCheckAt?: string;
  resumeAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
  recoveryRequired: string;
};

type TerminalSessionRecovery = {
  sessionId: string;
  summary: string;
  evidence: string[];
  actionable: boolean;
};

type WatchdogTreeSnapshot = {
  runnableBacklogTaskIds: string[];
  runnableBacklogTreeUpdatedAt?: string;
  runnableBacklogSnapshotAt: string;
  activeTasks: ActiveTaskSnapshot[];
  reviewTasks: OpenTaskSnapshot[];
  blockedTasks: OpenTaskSnapshot[];
  conditionOwnedBlockedTaskIds: string[];
  overdueOwnerActions: OverdueOwnerAction[];
  waitingBacklogTasks: OpenTaskSnapshot[];
  activeCount: number;
  hasOpenWork: boolean;
  needsRefill: boolean;
  durableLoopLiveness: DurableLoopLiveness[];
};

type TerminalPipelineWaitHarvest = {
  adoptedTaskIds: string[];
  harvestedTaskIds: string[];
  refreshedTaskIds: string[];
  checkedRunIds: string[];
  terminalRunIds: string[];
  resolvedConditionTaskIds: string[];
  continuationDispatchedTaskIds: string[];
  continuationDispatchFailedTaskIds: string[];
  fallbackDispatchedTaskIds: string[];
  fallbackDispatchFailedTaskIds: string[];
};

type ReviewCompletionRecovery = {
  task: TaskTree["tasks"][string];
  taskRevision: number;
  attemptId: string;
  result: TaskCompletionClaim;
  summary: string;
  evidence: string[];
  reason: string;
};

type TerminalReviewAssignmentRecovery = {
  requeuedTaskIds: string[];
  dispatchedTaskIds: string[];
  dispatchFailedTaskIds: string[];
  retainedBacklogTaskIds: string[];
};

type TerminalPipelineWaitCandidate = {
  taskId: string;
  runId: string;
  conditionId?: string;
};

type BlockedFrontierSummary = {
  totalCount: number;
  overdueCount: number;
  futureWatchCount: number;
  missingWatchCount: number;
  sampledTaskIds: string[];
  sampledOverdueTaskIds: string[];
  parentGroups: Array<{
    parentId: string;
    count: number;
    overdueCount: number;
  }>;
  waitTypeGroups: Array<{
    waitType: string;
    count: number;
    overdueCount: number;
  }>;
};

type DurableLoopLiveness = {
  taskId: string;
  action: string;
  statePath: string;
  stateExists: boolean;
  taskStatus: string | null;
  completionReady: boolean | null;
  statusCounts: Record<string, number>;
  nonTerminalCount: number;
  unrepresentedNonTerminalCount: number;
  exactBlockedWaitStewardship: boolean;
  activeExternalRunWait: boolean;
  needsAttention: boolean;
};

function parseInput(raw: string, defaultAgent: string): WatchdogConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(raw, "app"));

  const supervisorV2 = field(raw, "supervisorV2");
  const pendingActionRedeliveryV2 = field(raw, "pendingActionRedeliveryV2");
  const supervisorAttemptV2 = field(raw, "supervisorAttemptV2");
  const conditionV2 = field(raw, "conditionV2");
  const conditionAdoptionV2 = field(raw, "conditionAdoptionV2");
  return {
    appDir,
    projectDir,
    treePath: resolveTaskTreePath(appDir),
    stateDbPath: field(raw, "stateDb") ?? "/app/.state/may.db",
    specLoopStatePath:
      field(raw, "specLoopState") ?? defaultSpecLoopStatePath(appDir),
    featureReferenceLoopStatePath:
      field(raw, "featureReferenceLoopState") ??
      defaultFeatureReferenceLoopStatePath(appDir),
    featureCompactLoopStatePath:
      field(raw, "featureCompactLoopState") ??
      defaultFeatureCompactLoopStatePath(appDir),
    agent: field(raw, "agent") ?? defaultAgent,
    maxConcurrent: Number(field(raw, "maxConcurrent") ?? 3),
    staleNoActivityMs: Number(field(raw, "staleNoActivityMs") ?? 600_000),
    sessionStartGraceMs: Number(field(raw, "sessionStartGraceMs") ?? 60_000),
    supervisorV2:
      supervisorV2 === "review-handoff-revisioned"
        ? "review-handoff-revisioned"
        : "off",
    pendingActionRedeliveryV2:
      pendingActionRedeliveryV2 === "review-application-revisioned" ||
      pendingActionRedeliveryV2 === "review-handoffs-revisioned"
        ? pendingActionRedeliveryV2
        : "off",
    supervisorAttemptV2: supervisorAttemptV2 === "shadow" ? "shadow" : "off",
    conditionV2:
      conditionV2 === "exact-ado-revisioned" ? "exact-ado-revisioned" : "off",
    conditionAdoptionV2:
      conditionAdoptionV2 === "exact-task" ? "exact-task" : "off",
    conditionAdoptionV2TaskId:
      field(raw, "conditionAdoptionV2TaskId")?.trim() || undefined,
    conditionAdoptionV2RunId:
      field(raw, "conditionAdoptionV2RunId")?.trim() || undefined,
  };
}

function buildTaskTreeConfig(config: WatchdogConfig): TaskTreeConfig {
  return {
    appDir: config.appDir,
    projectDir: config.projectDir,
    treePath: config.treePath,
    journalPath: join(config.appDir, ".state", "journal.jsonl"),
    worker: config.agent,
    maxConcurrent: config.maxConcurrent,
  };
}

function readTree(path: string): TaskTree | null {
  if (!existsSync(path)) return null;
  const tree = readJson<TaskTree | null>(path, null);
  return tree ? normalizeTaskTreeInPlace(tree) : null;
}

function isLeaf(task: TaskTree["tasks"][string]): boolean {
  return (task.children ?? []).length === 0;
}

function countsAsExecutableActiveLeaf(
  task: TaskTree["tasks"][string],
): boolean {
  if (!isLeaf(task)) return false;
  if ((task.status ?? task.state ?? "backlog") !== "active") return false;
  if (task.kind === "focus_plan") return false;
  return true;
}

function activeLeaves(tree: TaskTree): Array<TaskTree["tasks"][string]> {
  return Object.values(tree.tasks).filter((task) =>
    countsAsExecutableActiveLeaf(task),
  );
}

function leafTasksByStatus(
  tree: TaskTree,
  state: string,
): Array<TaskTree["tasks"][string]> {
  return Object.values(tree.tasks).filter(
    (task) =>
      isLeaf(task) && (task.status ?? task.state ?? "backlog") === state,
  );
}

function taskUpdatedAt(task: TaskTree["tasks"][string]): string | undefined {
  const trace = task.trace && typeof task.trace === "object" ? task.trace : {};
  const candidates = [
    (task as { updated_at?: string }).updated_at,
    typeof trace.reviewed_at === "string" ? trace.reviewed_at : undefined,
    typeof trace.last_worker_completed_at === "string"
      ? trace.last_worker_completed_at
      : undefined,
    typeof trace.blocked_at === "string" ? trace.blocked_at : undefined,
    typeof trace.created_at === "string" ? trace.created_at : undefined,
  ];
  return candidates.find((value): value is string => Boolean(value));
}

function blockerRecord(
  blocker: TaskTree["tasks"][string]["blocker"],
): Record<string, unknown> | null {
  return blocker && typeof blocker === "object" && !Array.isArray(blocker)
    ? (blocker as Record<string, unknown>)
    : null;
}

function blockerStringField(
  blocker: TaskTree["tasks"][string]["blocker"],
  keys: string[],
): string | undefined {
  const record = blockerRecord(blocker);
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function taskConflictScopes(task: TaskTree["tasks"][string]): string[] {
  return Array.isArray(task.conflict_scope)
    ? task.conflict_scope.filter(
        (scope): scope is string => typeof scope === "string",
      )
    : [];
}

function structuredBlockedTaskIds(task: TaskTree["tasks"][string]): string[] {
  const context = taskContext(task);
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      ids.add(value.trim());
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    const id = ["taskId", "task_id", "id"]
      .map((key) => record[key])
      .find(
        (entry): entry is string => typeof entry === "string" && !!entry.trim(),
      )
      ?.trim();
    if (id) ids.add(id);
  };
  const collectArray = (value: unknown) => {
    if (!Array.isArray(value)) return;
    for (const entry of value) collect(entry);
  };

  collectArray(context.blockedTaskIds);
  collectArray(context.blocked_task_ids);
  collectArray(context.blockedTasks);
  collectArray(context.blocked_tasks);
  collectArray(context.auditedBlockedTaskIds);
  collectArray(context.audited_blocked_task_ids);
  collectArray(context.auditedBlockedTasks);
  collectArray(context.audited_blocked_tasks);
  collectArray(context.offenderTaskIds);
  collectArray(context.offender_task_ids);
  collectArray(context.overdueOwnerActions);
  collectArray(context.overdue_owner_actions);

  return [...ids].sort((a, b) => a.localeCompare(b));
}

function blockedOverdueScope(parentId: string | null | undefined): string {
  if (parentId === "aks-spec-verification-loop") return "spec-loop";
  if (parentId === "aks-feature-compact-loop") return "compact-loop";
  if (parentId === "project") return "project";
  return "";
}

function blockedOverdueScopeAliases(scope: string): string[] {
  const aliases = new Set([scope]);
  if (scope.endsWith("-loop")) {
    aliases.add(scope.slice(0, -"-loop".length));
  }
  if (scope === "spec-loop") aliases.add("spec-verification");
  if (scope === "compact-loop") aliases.add("feature-compact");
  if (scope === "project") aliases.add("project-root");
  return [...aliases];
}

function blockedWaitLineageKeys(blockedTask: OpenTaskSnapshot): string[] {
  if (!blockedTask.blocker || typeof blockedTask.blocker !== "object")
    return [];
  const blocker = blockedTask.blocker as Record<string, unknown>;
  const waitingFor =
    blocker.waiting_for &&
    typeof blocker.waiting_for === "object" &&
    !Array.isArray(blocker.waiting_for)
      ? (blocker.waiting_for as Record<string, unknown>)
      : {};
  return [
    waitingFor.pathId,
    waitingFor.path_id,
    waitingFor.approvalPathId,
    waitingFor.approval_path_id,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim());
}

function blockedWaitSpecConflictScopes(
  blockedTask: OpenTaskSnapshot,
): string[] {
  if (!blockedTask.blocker || typeof blockedTask.blocker !== "object") {
    return [];
  }
  const blocker = blockedTask.blocker as Record<string, unknown>;
  const waitingFor =
    blocker.waiting_for &&
    typeof blocker.waiting_for === "object" &&
    !Array.isArray(blocker.waiting_for)
      ? (blocker.waiting_for as Record<string, unknown>)
      : {};
  const scopes = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    scopes.add(trimmed.startsWith("spec:") ? trimmed : `spec:${trimmed}`);
  };

  collect(waitingFor.specId);
  collect(waitingFor.spec_id);
  for (const value of [waitingFor.specIds, waitingFor.spec_ids]) {
    if (!Array.isArray(value)) continue;
    for (const specId of value) collect(specId);
  }
  return [...scopes];
}

function childBlockedLineageTaskIds(blockedTask: OpenTaskSnapshot): string[] {
  if (!blockedTask.blocker || typeof blockedTask.blocker !== "object")
    return [];
  const blocker = blockedTask.blocker as Record<string, unknown>;
  const waitingFor =
    blocker.waiting_for &&
    typeof blocker.waiting_for === "object" &&
    !Array.isArray(blocker.waiting_for)
      ? (blocker.waiting_for as Record<string, unknown>)
      : {};
  return [waitingFor.childTaskIds, waitingFor.child_task_ids]
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim());
}

function taskCoversBlockedOverdueWait(
  candidate: TaskTree["tasks"][string],
  blockedTask: OpenTaskSnapshot,
): boolean {
  if (candidate.id === blockedTask.taskId) return false;
  if (candidate.id === blockedTask.parentId) return false;
  const candidateBlockedTaskIds = structuredBlockedTaskIds(candidate);
  if (candidateBlockedTaskIds.includes(blockedTask.taskId)) {
    return true;
  }

  const childLineageTaskIds = childBlockedLineageTaskIds(blockedTask);
  if (
    childLineageTaskIds.length > 0 &&
    childLineageTaskIds.some((taskId) =>
      candidateBlockedTaskIds.includes(taskId),
    )
  ) {
    return true;
  }

  const blockedLineageKeys = blockedWaitLineageKeys(blockedTask);
  if (
    blockedLineageKeys.length > 0 &&
    taskConflictScopes(candidate).some((scope) =>
      blockedLineageKeys.includes(scope.trim()),
    )
  ) {
    return true;
  }

  const blockedSpecScopes = blockedWaitSpecConflictScopes(blockedTask);
  if (
    blockedSpecScopes.length > 0 &&
    taskConflictScopes(candidate).some((scope) =>
      blockedSpecScopes.includes(scope.trim()),
    )
  ) {
    return true;
  }

  const scope = blockedOverdueScope(blockedTask.parentId);
  if (!scope) return false;
  const aliases = blockedOverdueScopeAliases(scope);
  return taskConflictScopes(candidate).some((conflictScope) => {
    const normalizedScope = conflictScope.trim();
    if (normalizedScope === `ops:blocked-overdue:${scope}`) {
      return true;
    }
    if (
      scope !== "project" &&
      normalizedScope.startsWith(`ops:blocked-overdue:${scope}:`)
    ) {
      return true;
    }
    if (
      scope === "project" &&
      normalizedScope === `ops:blocked-overdue:project:${blockedTask.taskId}`
    ) {
      return true;
    }
    return aliases.some(
      (alias) =>
        normalizedScope === `ops:${alias}-overdue-blocked-frontier` ||
        normalizedScope.startsWith(`ops:${alias}-overdue-blocked-frontier-`) ||
        normalizedScope === `ops:${alias}-overdue-frontier` ||
        normalizedScope.startsWith(`ops:${alias}-overdue-frontier-`),
    );
  });
}

function blockerNestedStringField(
  blocker: TaskTree["tasks"][string]["blocker"],
  path: string[],
): string | undefined {
  let current: unknown = blockerRecord(blocker);
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim()
    ? current.trim()
    : undefined;
}

function taskRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function compactText(value: unknown, limit = 700): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/\s+/g, " ").slice(0, limit);
}

function stringField(record: unknown, key: string): string {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return "";
  }
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isPipelineCompletionWaitType(value: string): boolean {
  return [
    "ado.pipeline_run.completed",
    "github.workflow_run.completed",
  ].includes(value);
}

function runIdFromPipelineWaitTask(task: TaskTree["tasks"][string]): string {
  const blocker = blockerRecord(task.blocker);
  const waitingFor =
    blocker && typeof blocker.waiting_for === "object"
      ? (blocker.waiting_for as Record<string, unknown>)
      : null;
  const context = taskRecord(task.context);
  const trace = taskRecord(task.trace);
  if (
    waitingFor &&
    isPipelineCompletionWaitType(stringField(waitingFor, "type"))
  ) {
    for (const key of [
      "adoRunId",
      "runId",
      "workflowRunId",
      "activeWorkflowRunId",
      "lastRunId",
      "sourceCompactWorkflowRunId",
      "terminal_pipeline_wait_run_id",
      "terminal_github_wait_run_id",
    ]) {
      const value = stringField(waitingFor, key);
      if (/^\d{6,}$/.test(value)) return value;
    }
  }
  for (const source of [context, trace]) {
    for (const key of [
      "adoRunId",
      "runId",
      "workflowRunId",
      "activeWorkflowRunId",
      "lastRunId",
      "sourceCompactWorkflowRunId",
      "terminal_pipeline_wait_run_id",
      "terminal_github_wait_run_id",
    ]) {
      const value = stringField(source, key);
      if (/^\d{6,}$/.test(value)) return value;
    }
  }

  return "";
}

function isArtifactRecoveryWait(task: TaskTree["tasks"][string]): boolean {
  const haystack = JSON.stringify({
    id: task.id,
    goal: task.goal,
    blocker: task.blocker,
    context: task.context,
    result: task.result,
  }).toLowerCase();

  return (
    haystack.includes("artifact recovery") ||
    haystack.includes("authenticated azure devops") ||
    haystack.includes("auth-capable runtime") ||
    haystack.includes("downloaded artifact bundle")
  );
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

function terminalPipelineWaitCandidates(
  config: TaskTreeConfig,
  limit = 50,
): TerminalPipelineWaitCandidate[] {
  const snapshot = readTree(config.treePath);
  if (snapshot === null) return [];

  const exactConditions = Object.values(conditionRegistry(snapshot))
    .filter((condition) => condition.status === "open")
    .flatMap((condition): TerminalPipelineWaitCandidate[] => {
      const task = snapshot.tasks[condition.subject.id];
      return task &&
        taskState(task) === "blocked" &&
        taskRevision(task) === condition.subject.revision &&
        task.context?.controlPlaneVersion === 2
        ? [
            {
              taskId: task.id,
              runId: condition.runId,
              conditionId: condition.id,
            },
          ]
        : [];
    })
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
  const exactTaskIds = new Set(exactConditions.map((entry) => entry.taskId));
  const legacy = leafTasksByStatus(snapshot, "blocked")
    .concat(leafTasksByStatus(snapshot, "waiting"))
    .filter((task) => !exactTaskIds.has(task.id))
    .filter((task) => !isArtifactRecoveryWait(task))
    .map((task) => ({
      taskId: task.id,
      runId: runIdFromPipelineWaitTask(task),
    }))
    .filter((candidate) => candidate.runId)
    .slice(0, Math.max(0, limit - exactConditions.length));
  return [...exactConditions, ...legacy];
}

function pipelineObservationDue(
  tree: TaskTree,
  candidate: TerminalPipelineWaitCandidate,
  conditionV2: ProjectConditionV2Mode,
  nowMs = Date.now(),
): boolean {
  if (!candidate.conditionId) return true;
  if (!exactAdoConditionV2Enabled(conditionV2)) return false;
  const condition = conditionRegistry(tree)[candidate.conditionId];
  if (!condition || condition.status !== "open") return false;
  const nextCheckMs = Date.parse(condition.nextCheckAt);
  const fallbackMs = Date.parse(condition.fallbackAt);
  const fallbackDelivered =
    condition.fallbackExecution?.status === "dispatched" ||
    condition.fallbackExecution?.status === "acknowledged";
  return (
    !Number.isFinite(nextCheckMs) ||
    nextCheckMs <= nowMs ||
    (!fallbackDelivered && Number.isFinite(fallbackMs) && fallbackMs <= nowMs)
  );
}

function reviewerDecisionKeys(appDir: string): Set<string> {
  const path = join(appDir, ".state", "task-reviewer-runs.jsonl");
  if (!existsSync(path)) return new Set();
  const keys = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      if (row.result !== "project.task.reviewed") continue;
      const taskId =
        typeof row.task_id === "string"
          ? row.task_id.trim()
          : typeof row.taskId === "string"
            ? row.taskId.trim()
            : "";
      const attemptId =
        typeof row.attempt_id === "string"
          ? row.attempt_id.trim()
          : typeof row.attemptId === "string"
            ? row.attemptId.trim()
            : "";
      const revisionValue = row.task_revision ?? row.taskRevision;
      const revision =
        typeof revisionValue === "number" &&
        Number.isInteger(revisionValue) &&
        revisionValue >= 0
          ? revisionValue
          : 0;
      if (taskId && attemptId) keys.add(`${taskId}:${revision}:${attemptId}`);
    } catch {
      // A malformed historical reviewer row should not block watchdog recovery.
    }
  }
  return keys;
}

function safeAttemptSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function taskTrace(task: TaskTree["tasks"][string]): Record<string, unknown> {
  return taskRecord(task.trace) ?? {};
}

function terminalPipelineReview(
  task: TaskTree["tasks"][string],
): Record<string, unknown> | null {
  const context = taskContext(task);
  return (
    taskRecord(context.terminalPipelineWaitReview) ??
    taskRecord(context.terminalGitHubWaitReview)
  );
}

function validCompletionClaim(value: unknown): TaskCompletionClaim | null {
  return value === "done" || value === "partial" || value === "blocked"
    ? value
    : null;
}

function reviewAttemptId(trace: Record<string, unknown>): string {
  return typeof trace.current_attempt_id === "string"
    ? trace.current_attempt_id.trim()
    : "";
}

function workerStartedAttemptId(trace: Record<string, unknown>): string {
  return typeof trace.worker_started_attempt_id === "string"
    ? trace.worker_started_attempt_id.trim()
    : "";
}

function isSyntheticTerminalReviewAttempt(attemptId: string): boolean {
  return attemptId.endsWith("_terminal_wait_review");
}

function hasCurrentReviewWorkerCompletion(
  task: TaskTree["tasks"][string],
): boolean {
  const trace = taskTrace(task);
  const currentAttemptId = reviewAttemptId(trace);
  const startedAttemptId = workerStartedAttemptId(trace);
  return Boolean(
    validCompletionClaim(trace.last_worker_result) &&
    currentAttemptId &&
    startedAttemptId === currentAttemptId,
  );
}

function terminalReviewNeedsWorkerRecovery(
  task: TaskTree["tasks"][string],
): boolean {
  if (!terminalPipelineReview(task)) return false;
  if (hasCurrentReviewWorkerCompletion(task)) return false;
  const currentAttemptId = reviewAttemptId(taskTrace(task));
  return (
    !currentAttemptId || isSyntheticTerminalReviewAttempt(currentAttemptId)
  );
}

function reviewRecoveryEvidence(task: TaskTree["tasks"][string]): string[] {
  const evidence = new Set<string>();
  for (const value of Array.isArray(task.evidence) ? task.evidence : []) {
    if (typeof value === "string" && value.trim()) evidence.add(value.trim());
  }
  for (const value of Array.isArray(task.outputs) ? task.outputs : []) {
    if (typeof value === "string" && value.trim()) evidence.add(value.trim());
  }
  return [...evidence];
}

function reviewRecoveryDue(
  task: TaskTree["tasks"][string],
  now = Date.now(),
): boolean {
  const trace = taskTrace(task);
  const completedAt =
    typeof trace.last_worker_completed_at === "string"
      ? Date.parse(trace.last_worker_completed_at)
      : Number.NaN;
  return (
    !Number.isFinite(completedAt) ||
    now - completedAt >= REVIEW_RECOVERY_DELAY_MS
  );
}

function reviewSnapshotRecoveryDue(
  task: OpenTaskSnapshot,
  now = Date.now(),
): boolean {
  const updatedAt = task.updatedAt ? Date.parse(task.updatedAt) : Number.NaN;
  return (
    !Number.isFinite(updatedAt) || now - updatedAt >= REVIEW_RECOVERY_DELAY_MS
  );
}

function recoverTerminalReviewAssignmentsWithoutWorker(
  ctx: WorkflowContext,
  treeConfig: TaskTreeConfig,
): TerminalReviewAssignmentRecovery {
  const requeuedTaskIds: string[] = [];
  withTreeLock(treeConfig, () => {
    const tree = readTree(treeConfig.treePath);
    if (!tree) return;
    const now = new Date().toISOString();
    for (const task of leafTasksByStatus(tree, "review")) {
      const terminalReview = terminalPipelineReview(task);
      if (!terminalReview || !terminalReviewNeedsWorkerRecovery(task)) continue;
      const trace = taskTrace(task);
      const priorAttemptId = reviewAttemptId(trace);
      const priorSessionId =
        typeof task.session_id === "string" && task.session_id.trim()
          ? task.session_id.trim()
          : undefined;
      task.status = "backlog";
      task.state = "backlog";
      task.trace = {
        ...trace,
        terminal_review_requeued_at: now,
        terminal_review_requeued_by: name,
        terminal_review_requeue_reason:
          "terminal wait review needs a real worker artifact inspection before reviewer handoff",
        previous_attempt_id: priorAttemptId || undefined,
        previous_session_id: priorSessionId,
        current_attempt_id: undefined,
        worker_started_attempt_id: undefined,
        worker_started_at: undefined,
      };
      task.session_id = undefined;
      requeuedTaskIds.push(task.id);
    }
    if (requeuedTaskIds.length > 0) {
      tree.active_task_ids = Object.values(tree.tasks)
        .filter((task) => taskState(task) === "active")
        .map((task) => task.id)
        .sort((a, b) => a.localeCompare(b));
      tree.active_task_id = tree.active_task_ids[0] ?? null;
      saveTaskTreeWithKanbanSnapshot(treeConfig, tree);
      appendToolJournal(treeConfig, {
        kind: "terminal_review_worker_requeue",
        task_ids: requeuedTaskIds,
        reason:
          "terminal pipeline wait review lacked a worker completion and was requeued for real artifact inspection",
      });
    }
  });

  const dispatchedTaskIds: string[] = [];
  const dispatchFailedTaskIds: string[] = [];
  const retainedBacklogTaskIds: string[] = [];
  const acknowledged = [] as Array<ReturnType<typeof assignTask>>;
  for (const taskId of requeuedTaskIds) {
    let assignment: ReturnType<typeof assignTask>;
    try {
      assignment = assignTask(treeConfig, { taskId });
    } catch {
      retainedBacklogTaskIds.push(taskId);
      continue;
    }
    try {
      ctx.dispatchEvent("project.task.assigned", {
        target: { project: "aks-rp-e2e", taskId: assignment.taskId },
        project: "aks-rp-e2e",
        ...assignment,
        requested_by: name,
        continuation: "terminal-pipeline-artifact-review",
      });
      acknowledged.push(assignment);
      dispatchedTaskIds.push(taskId);
    } catch {
      dispatchFailedTaskIds.push(taskId);
    }
  }
  if (acknowledged.length > 0) {
    acknowledgeTaskAssignments(treeConfig, acknowledged);
  }
  return {
    requeuedTaskIds,
    dispatchedTaskIds,
    dispatchFailedTaskIds,
    retainedBacklogTaskIds,
  };
}

function recoverReviewCompletionsWithoutReviewer(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  treeConfig: TaskTreeConfig,
  options: { v2OwnedTaskIds?: ReadonlySet<string> } = {},
): string[] {
  const reviewerDecisions = reviewerDecisionKeys(config.appDir);
  const recoveries: ReviewCompletionRecovery[] = [];

  withTreeLock(treeConfig, () => {
    const tree = readTree(config.treePath);
    if (!tree) return;
    const now = new Date().toISOString();
    for (const task of leafTasksByStatus(tree, "review")) {
      const trace = taskTrace(task);
      const terminalReview = terminalPipelineReview(task);
      if (terminalReview && terminalReviewNeedsWorkerRecovery(task)) continue;
      let attemptId = reviewAttemptId(trace);
      let reason = "watchdog-recovered-review-completion-trigger";

      if (!attemptId && terminalReview) {
        const runId = stringField(terminalReview, "runId") || "terminal-run";
        attemptId = `a_${safeAttemptSegment(task.id)}_${safeAttemptSegment(runId)}_terminal_wait_review`;
        task.trace = {
          ...trace,
          current_attempt_id: attemptId,
          terminal_wait_review_attempt_created_at: now,
          terminal_wait_review_attempt_created_by: "project-execution-watchdog",
        };
        reason = "watchdog-recovered-terminal-pipeline-wait-review";
      }

      if (!attemptId) continue;
      if (
        options.v2OwnedTaskIds?.has(task.id) &&
        !reason.includes("terminal-pipeline")
      ) {
        continue;
      }
      if (
        reviewerDecisions.has(`${task.id}:${taskRevision(task)}:${attemptId}`)
      )
        continue;
      const createdTerminalReviewAttempt = reason.includes("terminal-pipeline");
      if (!createdTerminalReviewAttempt && !reviewRecoveryDue(task)) continue;

      const refreshedTrace = taskTrace(task);
      const result =
        validCompletionClaim(refreshedTrace.last_worker_result) ??
        (terminalReview ? "blocked" : null);
      if (!result) continue;
      const summary =
        compactText(refreshedTrace.last_worker_summary, 2000) ??
        compactText(task.result, 2000) ??
        `Review task ${task.id} is waiting for reviewer decision.`;
      recoveries.push({
        task: { ...task },
        taskRevision: taskRevision(task),
        attemptId,
        result,
        summary,
        evidence: reviewRecoveryEvidence(task),
        reason,
      });
    }

    if (recoveries.length > 0) {
      saveTaskTreeWithKanbanSnapshot(treeConfig, tree);
      appendToolJournal(treeConfig, {
        kind: "watchdog_review_completion_reemitted",
        task_ids: recoveries.map((recovery) => recovery.task.id),
        reason:
          "Review leaf had a worker/terminal-wait claim but no current reviewer decision; re-emitting project.task.completed so task-reviewer remains the judge.",
      });
    }
  });

  for (const recovery of recoveries) {
    emitTaskCompleted(ctx, recovery.task, {
      taskRevision: recovery.taskRevision,
      attemptId: recovery.attemptId,
      result: recovery.result,
      summary: recovery.summary,
      evidence: recovery.evidence,
      review: {
        required: true,
        reason: recovery.reason,
      },
    });
  }

  return recoveries.map((recovery) => recovery.task.id);
}

type ReviewHandoffSupervisorTickV2 = {
  handled: boolean;
  reviewsAvailable: boolean;
  correlatedTaskIds: string[];
  actionKind?: string;
  taskId?: string;
  message?: string;
};

function rowValue(row: RuntimeReviewerRowV2, key: string): unknown {
  return row[key];
}

function currentReviewAttemptId(
  task: TaskTree["tasks"][string],
): string | null {
  const trace = taskTrace(task);
  return (
    compactText(trace.current_attempt_id, 256) ??
    compactText(trace.previous_attempt_id, 256)
  );
}

function taskMatchesSupervisorClaim(
  task: TaskTree["tasks"][string] | undefined,
  claim: SupervisorActionClaimV2,
): task is TaskTree["tasks"][string] {
  return Boolean(
    task &&
    taskState(task) === "review" &&
    taskRevision(task) === claim.taskRevision &&
    currentReviewAttemptId(task) === claim.attemptId,
  );
}

function emitStoredReviewDecisionV2(
  ctx: WorkflowContext,
  claim: SupervisorActionClaimV2,
  row: RuntimeReviewerRowV2,
): void {
  const taskId = claim.taskId!;
  const taskRevisionValue = claim.taskRevision!;
  const attemptId = claim.attemptId!;
  const review: Record<string, unknown> = {};
  for (const key of [
    "decision",
    "confidence",
    "summary",
    "findings",
    "feedback",
    "suggestedFollowups",
    "artifacts",
    "verification",
    "events",
    "reviewAction",
  ]) {
    const value = rowValue(row, key);
    if (value !== undefined) review[key] = value;
  }
  ctx.dispatchEvent("project.task.reviewed", {
    target: { project: "aks-rp-e2e", taskId },
    project: "aks-rp-e2e",
    taskId,
    task_id: taskId,
    taskRevision: taskRevisionValue,
    task_revision: taskRevisionValue,
    attemptId,
    attempt_id: attemptId,
    reviewId: claim.decisionId,
    review_id: claim.decisionId,
    reviewedAt: rowValue(row, "ts"),
    reviewed_at: rowValue(row, "ts"),
    ...review,
    suggested_followups: review.suggestedFollowups,
    ...(review.reviewAction
      ? {
          review_action: review.reviewAction,
        }
      : {}),
    review,
    reason: "project-supervisor-v2-reemit-reviewed",
    requested_by: "project-execution-watchdog",
    supervisor_recovery_key: claim.recoveryKey,
    review_decision_id: claim.decisionId,
  });
}

function dispatchStoredReviewDecisionV2(
  ctx: WorkflowContext,
  claim: SupervisorActionClaimV2,
  row: RuntimeReviewerRowV2,
): boolean {
  try {
    emitStoredReviewDecisionV2(ctx, claim, row);
    return true;
  } catch {
    return false;
  }
}

function dispatchStoredCompletionPendingActionV2(
  ctx: WorkflowContext,
  treeConfig: TaskTreeConfig,
  claim: SupervisorActionClaimV2,
  task: TaskTree["tasks"][string],
  review: ReviewProjectionV2,
): boolean {
  const action = completionReviewPendingActionV2(
    review,
    REVIEW_RECOVERY_DELAY_MS,
  );
  if (
    !action ||
    !claim.taskId ||
    claim.taskRevision == null ||
    !claim.attemptId
  ) {
    return false;
  }
  const trace = taskTrace(task);
  const terminalReview = terminalPipelineReview(task);
  const result =
    validCompletionClaim(trace.last_worker_result) ??
    (terminalReview ? "blocked" : null);
  if (!result) return false;
  const replayedWorkflowResult =
    compactText(trace.worker_started_attempt_id, 256) === claim.attemptId
      ? taskRecord(trace.workflowResult)
      : null;
  const delivery = deliverPendingActionV2({
    action,
    now: new Date().toISOString(),
    priorReceipts: completionReviewDeliveryReceiptsV2(task, action.key),
    redeliverAccepted: true,
    dispatch: () => {
      const accepted = emitTaskCompleted(ctx, task, {
        taskRevision: claim.taskRevision!,
        attemptId: claim.attemptId!,
        result,
        summary:
          compactText(trace.last_worker_summary, 2000) ??
          compactText(task.result, 2000) ??
          `Review task ${task.id} is waiting for reviewer decision.`,
        evidence: reviewRecoveryEvidence(task),
        workflowResult: replayedWorkflowResult
          ? (replayedWorkflowResult as StructuredWorkflowResult)
          : undefined,
        review: {
          required: true,
          reason: "project-supervisor-v2-recovered-review-completion",
        },
      });
      if (!accepted) {
        throw new Error("project.task.completed dispatch was not accepted");
      }
    },
  });
  if (delivery.receipt) {
    const persisted = appendCompletionReviewDeliveryReceiptV2(treeConfig, {
      taskId: claim.taskId,
      taskRevision: claim.taskRevision,
      attemptId: claim.attemptId,
      receipt: delivery.receipt,
    });
    if (!persisted) return false;
  }
  return delivery.accepted && delivery.dispatched;
}

function dispatchStoredReviewDecisionPendingActionV2(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  claim: SupervisorActionClaimV2,
  row: RuntimeReviewerRowV2,
  reviewerRows: RuntimeReviewerRowV2[],
): boolean {
  const reviewId = claim.decisionId!;
  const reviewedAt =
    typeof rowValue(row, "ts") === "string"
      ? (rowValue(row, "ts") as string)
      : new Date().toISOString();
  const action = reviewApplicationPendingActionV2(
    {
      taskId: claim.taskId!,
      taskRevision: claim.taskRevision!,
      attemptId: claim.attemptId!,
      completedAt: reviewedAt,
      latestDecision:
        typeof rowValue(row, "decision") === "string"
          ? (rowValue(row, "decision") as string)
          : null,
      latestDecisionId: reviewId,
      latestDecisionAt: reviewedAt,
      deliveryState: "decision-pending-apply",
      actionDeliveryStatus: "pending",
    },
    REVIEW_APPLICATION_GRACE_MS,
  );
  if (!action) return false;
  const delivery = deliverPendingActionV2({
    action,
    now: new Date().toISOString(),
    priorReceipts: pendingActionDeliveryReceiptsV2(reviewerRows, action.key),
    redeliverAccepted: true,
    dispatch: () => emitStoredReviewDecisionV2(ctx, claim, row),
  });
  if (delivery.receipt) {
    appendPendingActionDeliveryReceiptV2(
      config.appDir,
      "project-execution-watchdog",
      delivery.receipt,
      {
        reviewId,
        taskId: claim.taskId!,
        taskRevision: claim.taskRevision!,
        attemptId: claim.attemptId!,
      },
    );
  }
  return delivery.accepted && delivery.dispatched;
}

function runReviewHandoffSupervisorV2(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  treeConfig: TaskTreeConfig,
): ReviewHandoffSupervisorTickV2 {
  if (config.supervisorV2 !== "review-handoff-revisioned") {
    return {
      handled: false,
      reviewsAvailable: false,
      correlatedTaskIds: [],
    };
  }
  const captured = captureRuntimeProjectSnapshotV2({
    appDir: config.appDir,
    treePath: config.treePath,
    stateDbPath: config.stateDbPath,
    projectId: "aks-rp-e2e",
    sessionStartGraceMs: config.sessionStartGraceMs,
    staleNoActivityMs: config.staleNoActivityMs,
    reviewGraceMs: REVIEW_RECOVERY_DELAY_MS,
    reviewApplicationGraceMs: REVIEW_APPLICATION_GRACE_MS,
  });
  if (!captured) {
    return {
      handled: false,
      reviewsAvailable: false,
      correlatedTaskIds: [],
    };
  }
  const reviewsAvailable = captured.snapshot.coverage.reviews === "available";
  const correlatedTaskIds = captured.snapshot.reviews.flatMap((review) =>
    review.attemptId &&
    review.taskRevision > 0 &&
    review.controlPlaneVersion === 2
      ? [review.taskId]
      : [],
  );
  const claim = claimNextReviewHandoffActionV2(treeConfig, captured.snapshot, {
    now: new Date().toISOString(),
  });
  if (!claim.claimed) {
    return { handled: false, reviewsAvailable, correlatedTaskIds };
  }

  const currentTree = readTree(config.treePath);
  const task = claim.taskId ? currentTree?.tasks[claim.taskId] : undefined;
  if (!taskMatchesSupervisorClaim(task, claim)) {
    return {
      handled: true,
      reviewsAvailable,
      correlatedTaskIds,
      actionKind: claim.actionKind,
      taskId: claim.taskId,
      message: "claimed review handoff became stale before dispatch",
    };
  }

  let dispatched = false;
  if (claim.actionKind === "reemit-completion") {
    const review = captured.snapshot.reviews.find(
      (candidate) =>
        candidate.taskId === claim.taskId &&
        candidate.taskRevision === claim.taskRevision &&
        candidate.attemptId === claim.attemptId,
    );
    if (
      config.pendingActionRedeliveryV2 === "review-handoffs-revisioned" &&
      review
    ) {
      dispatched = dispatchStoredCompletionPendingActionV2(
        ctx,
        treeConfig,
        claim,
        task,
        review,
      );
    } else {
      const trace = taskTrace(task);
      const terminalReview = terminalPipelineReview(task);
      const result =
        validCompletionClaim(trace.last_worker_result) ??
        (terminalReview ? "blocked" : null);
      if (result) {
        const replayedWorkflowResult =
          compactText(trace.worker_started_attempt_id, 256) === claim.attemptId
            ? taskRecord(trace.workflowResult)
            : null;
        dispatched = emitTaskCompleted(ctx, task, {
          taskRevision: claim.taskRevision!,
          attemptId: claim.attemptId!,
          result,
          summary:
            compactText(trace.last_worker_summary, 2000) ??
            compactText(task.result, 2000) ??
            `Review task ${task.id} is waiting for reviewer decision.`,
          evidence: reviewRecoveryEvidence(task),
          workflowResult: replayedWorkflowResult
            ? (replayedWorkflowResult as StructuredWorkflowResult)
            : undefined,
          review: {
            required: true,
            reason: "project-supervisor-v2-recovered-review-completion",
          },
        });
      }
    }
  } else if (
    claim.actionKind === "reemit-reviewed" &&
    claim.attemptId &&
    claim.decisionId
  ) {
    const row = findRuntimeReviewerRowV2(captured.reviewerRows, {
      taskId: claim.taskId!,
      taskRevision: claim.taskRevision!,
      attemptId: claim.attemptId,
      decisionId: claim.decisionId,
    });
    dispatched = row
      ? config.pendingActionRedeliveryV2 === "review-application-revisioned" ||
        config.pendingActionRedeliveryV2 === "review-handoffs-revisioned"
        ? dispatchStoredReviewDecisionPendingActionV2(
            ctx,
            config,
            claim,
            row,
            captured.reviewerRows,
          )
        : dispatchStoredReviewDecisionV2(ctx, claim, row)
      : false;
  } else if (claim.actionKind === "request-owner") {
    dispatched = emitOwnerRequested(
      ctx,
      config,
      "project-supervisor-v2-review-handoff-exhausted",
      {
        taskId: claim.taskId,
        taskRevision: claim.taskRevision,
        attemptId: claim.attemptId,
        decisionId: claim.decisionId,
        recoveryKey: claim.recoveryKey,
        invariant:
          claim.decisionId === null
            ? "review-delivery-missing"
            : "review-decision-not-applied",
      },
    );
  }

  if (!dispatched) {
    failReviewHandoffActionV2(treeConfig, {
      recoveryKey: claim.recoveryKey!,
      leaseId: claim.leaseId!,
      actionKind: claim.actionKind!,
      failedAt: new Date().toISOString(),
      reason:
        claim.actionKind === "reemit-completion"
          ? "No replayable completion payload was available or completion dispatch failed."
          : claim.actionKind === "reemit-reviewed"
            ? "The exact stored reviewer row was unavailable or reviewed-event dispatch failed."
            : "Owner-request dispatch failed.",
    });
    return {
      handled: true,
      reviewsAvailable,
      correlatedTaskIds,
      actionKind: claim.actionKind,
      taskId: claim.taskId,
      message:
        "review handoff dispatch failed and consumed its bounded action budget",
    };
  }
  const completed = completeReviewHandoffActionV2(treeConfig, {
    recoveryKey: claim.recoveryKey!,
    leaseId: claim.leaseId!,
    actionKind: claim.actionKind!,
    completedAt: new Date().toISOString(),
  });
  if (completed) {
    try {
      syncProjectReadout(treeConfig);
    } catch {
      // The recovery action and ledger are durable; readout can catch up.
    }
  }
  return {
    handled: true,
    reviewsAvailable,
    correlatedTaskIds,
    actionKind: claim.actionKind,
    taskId: claim.taskId,
    message: completed
      ? "review handoff action dispatched and recorded"
      : "review handoff dispatched but ledger completion lost its lease",
  };
}

function harvestTerminalPipelineWaits(input: {
  ctx: WorkflowContext;
  config: TaskTreeConfig;
  projectDir: string;
  client: PipelineClient | null;
  pipelineAccessReason?: string;
  conditionV2: ProjectConditionV2Mode;
  conditionAdoptionV2: ExactPipelineConditionAdoptionV2Mode;
  conditionAdoptionV2TaskId?: string;
  conditionAdoptionV2RunId?: string;
  maxConcurrent: number;
  limit?: number;
}): TerminalPipelineWaitHarvest {
  const continuationDispatchedTaskIds: string[] = [];
  const continuationDispatchFailedTaskIds: string[] = [];
  const deliverConditionContinuations = (): void => {
    for (const assignment of ensureResolvedPipelineConditionAssignmentsV2(
      input.config,
      { mode: input.conditionV2 },
    )) {
      let dispatched = false;
      try {
        input.ctx.dispatchEvent("project.task.assigned", {
          target: { project: "aks-rp-e2e", taskId: assignment.taskId },
          project: "aks-rp-e2e",
          ...assignment,
          requested_by: "project-execution-watchdog",
          continuation: "condition-resolved",
        });
        dispatched = true;
      } catch {
        // The exact assignment remains in the durable outbox for retry.
      }
      if (dispatched) {
        acknowledgeTaskAssignments(input.config, [assignment]);
        continuationDispatchedTaskIds.push(assignment.taskId);
      } else {
        continuationDispatchFailedTaskIds.push(assignment.taskId);
      }
    }
  };
  deliverConditionContinuations();
  const adoptedTaskIds: string[] = [];
  if (
    input.conditionAdoptionV2 === "exact-task" &&
    input.conditionAdoptionV2TaskId &&
    input.conditionAdoptionV2RunId
  ) {
    const adopted = adoptExactPipelineWaitV2(input.config, {
      adoptionV2: input.conditionAdoptionV2,
      conditionV2: input.conditionV2,
      taskId: input.conditionAdoptionV2TaskId,
      runId: input.conditionAdoptionV2RunId,
    });
    if (adopted.applied && !adopted.replayed) {
      adoptedTaskIds.push(adopted.taskId);
    }
  }
  const candidates = terminalPipelineWaitCandidates(
    input.config,
    input.limit ?? 50,
  );

  const checkedRunIds: string[] = [];
  const runByTaskId = new Map<string, PipelineRun>();
  const candidateTree = readTree(input.config.treePath);
  for (const candidate of candidates) {
    if (
      !input.client ||
      !candidateTree ||
      !pipelineObservationDue(candidateTree, candidate, input.conditionV2)
    ) {
      continue;
    }
    checkedRunIds.push(candidate.runId);
    const run = getWorkflowRun({
      client: input.client,
      projectDir: input.projectDir,
      runId: candidate.runId,
    });
    if (run) runByTaskId.set(candidate.taskId, run);
  }

  const harvestedTaskIds: string[] = [];
  const refreshedTaskIds: string[] = [];
  const terminalRunIds: string[] = [];
  const resolvedConditionTaskIds: string[] = [];
  const fallbackDispatchedTaskIds: string[] = [];
  const fallbackDispatchFailedTaskIds: string[] = [];

  const v2HandledTaskIds = new Set<string>();
  const conditionTree = readTree(input.config.treePath);
  if (conditionTree) {
    const registry = conditionRegistry(conditionTree);
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    for (const candidate of candidates) {
      const run = runByTaskId.get(candidate.taskId);
      const task = conditionTree.tasks[candidate.taskId];
      if (!task || taskRevision(task) <= 0) continue;
      const blocker = blockerRecord(task.blocker);
      const conditionId =
        candidate.conditionId ??
        (typeof blocker?.condition_id === "string"
          ? blocker.condition_id
          : typeof blocker?.conditionId === "string"
            ? blocker.conditionId
            : "");
      const condition = conditionId ? registry[conditionId] : undefined;
      if (!condition || condition.runId !== candidate.runId) continue;
      v2HandledTaskIds.add(task.id);
      if (!exactAdoConditionV2Enabled(input.conditionV2)) continue;
      if (
        !pipelineObservationDue(
          conditionTree,
          candidate,
          input.conditionV2,
          nowMs,
        )
      ) {
        continue;
      }

      if (run?.status === "completed") {
        const resolved = resolvePipelineConditionV2(input.config, {
          mode: input.conditionV2,
          conditionId,
          backend: "ado",
          runId: candidate.runId,
          taskId: task.id,
          taskRevision: taskRevision(task),
          resolvedAt: now,
          resolution: {
            status: run.status,
            conclusion: run.conclusion ?? null,
            runUrl: run.url ?? condition.runUrl,
            runTitle: run.displayTitle ?? null,
          },
        });
        if (resolved.applied) {
          harvestedTaskIds.push(task.id);
          terminalRunIds.push(candidate.runId);
          resolvedConditionTaskIds.push(task.id);
          deliverConditionContinuations();
        }
        continue;
      }

      const nextCheckMs = Date.parse(condition.nextCheckAt);
      const fallbackMs = Date.parse(condition.fallbackAt);
      if (Number.isFinite(fallbackMs) && fallbackMs <= nowMs) {
        const claim = claimPipelineConditionFallbackV2(input.config, {
          mode: input.conditionV2,
          conditionId,
          backend: "ado",
          runId: candidate.runId,
          taskId: task.id,
          taskRevision: taskRevision(task),
          claimedAt: now,
          observation: {
            status: run?.status ?? "unavailable",
            conclusion: run?.conclusion ?? null,
            runUrl: run?.url ?? condition.runUrl,
            ...(run
              ? {}
              : {
                  observationError:
                    input.pipelineAccessReason ??
                    "exact pipeline run observation was unavailable",
                }),
          },
        });
        if (claim.claimed && claim.claimId && claim.recoveryKey) {
          let dispatched = false;
          let error: string | undefined;
          try {
            input.ctx.dispatchEvent("project.condition.fallback.requested", {
              target: { project: "aks-rp-e2e" },
              project: "aks-rp-e2e",
              reason: "condition-overdue-fallback",
              maxConcurrent: input.maxConcurrent,
              requested_by: "project-execution-watchdog",
              recoveryKey: claim.recoveryKey,
              conditionId: claim.conditionId,
              taskId: claim.taskId,
              taskRevision: claim.taskRevision,
              fallbackAction: claim.fallbackAction,
              observation: claim.observation,
              instruction:
                "The exact Condition reached its declared fallback while its external fact remains nonterminal. Judge the declared fallback once; do not create another polling wait or replay completed work.",
            });
            dispatched = true;
          } catch (cause) {
            error = cause instanceof Error ? cause.message : String(cause);
          }
          finishPipelineConditionFallbackV2(input.config, {
            mode: input.conditionV2,
            conditionId,
            claimId: claim.claimId,
            finishedAt: new Date().toISOString(),
            dispatched,
            error,
          });
          (dispatched
            ? fallbackDispatchedTaskIds
            : fallbackDispatchFailedTaskIds
          ).push(task.id);
        }
        const fallbackDelivered =
          (claim.claimed && fallbackDispatchedTaskIds.includes(task.id)) ||
          (claim.replayed &&
            [
              "condition fallback was already dispatched",
              "condition fallback was already acknowledged",
              "condition fallback delivery acknowledgement is overdue and its retry budget is exhausted",
            ].includes(claim.reason ?? ""));
        if (fallbackDelivered) {
          observePipelineConditionV2(input.config, {
            mode: input.conditionV2,
            conditionId,
            backend: "ado",
            runId: candidate.runId,
            taskId: task.id,
            taskRevision: taskRevision(task),
            observedAt: now,
            observation: {
              status: run?.status ?? "unavailable",
              conclusion: run?.conclusion ?? null,
              runUrl: run?.url ?? condition.runUrl,
              ...(run
                ? {}
                : {
                    observationError:
                      input.pipelineAccessReason ??
                      "exact pipeline run observation was unavailable",
                  }),
            },
            nextCheckAt: new Date(
              nowMs + PIPELINE_WAIT_NEXT_CHECK_MS,
            ).toISOString(),
          });
        }
        continue;
      }
      if (!Number.isFinite(nextCheckMs) || nextCheckMs > nowMs) {
        continue;
      }
      const observed = observePipelineConditionV2(input.config, {
        mode: input.conditionV2,
        conditionId,
        backend: "ado",
        runId: candidate.runId,
        taskId: task.id,
        taskRevision: taskRevision(task),
        observedAt: now,
        observation: {
          status: run?.status ?? "unavailable",
          conclusion: run?.conclusion ?? null,
          runUrl: run?.url ?? condition.runUrl,
          ...(run
            ? {}
            : {
                observationError:
                  input.pipelineAccessReason ??
                  "exact pipeline run observation was unavailable",
              }),
        },
        nextCheckAt: new Date(
          nowMs + PIPELINE_WAIT_NEXT_CHECK_MS,
        ).toISOString(),
      });
      if (observed.applied && !observed.replayed) {
        refreshedTaskIds.push(task.id);
      }
    }
  }

  withTreeLock(input.config, () => {
    const tree = readTree(input.config.treePath);
    if (!tree) return;
    const now = new Date().toISOString();
    const nowMs = Date.parse(now);
    for (const candidate of candidates) {
      if (v2HandledTaskIds.has(candidate.taskId)) continue;
      const run = runByTaskId.get(candidate.taskId);
      if (!run) continue;
      const task = tree.tasks[candidate.taskId];
      if (!task) continue;
      const state = task.status ?? task.state ?? "backlog";
      if (state !== "blocked" && state !== "waiting") continue;
      if (runIdFromPipelineWaitTask(task) !== candidate.runId) continue;

      if (run.status !== "completed") {
        const blocker = blockerRecord(task.blocker);
        if (!blocker) continue;
        const nextCheckAt = blockerStringField(task.blocker, [
          "nextCheckAt",
          "next_check_at",
        ]);
        const fallbackAt = blockerStringField(task.blocker, [
          "fallbackAt",
          "fallback_at",
        ]);
        const nextCheckMs = Date.parse(nextCheckAt ?? "");
        const fallbackMs = Date.parse(fallbackAt ?? "");
        const nextCheckIsDue =
          Number.isFinite(nextCheckMs) && nextCheckMs <= nowMs;
        const fallbackIsDue =
          Number.isFinite(fallbackMs) && fallbackMs <= nowMs;
        if (!nextCheckIsDue || fallbackIsDue) continue;

        const normalizedWindow = normalizeBlockedWaitObservationWindow({
          nextCheckAt: new Date(
            nowMs + PIPELINE_WAIT_NEXT_CHECK_MS,
          ).toISOString(),
          fallbackAt,
        });
        task.blocker = {
          ...blocker,
          next_check_at: normalizedWindow.nextCheckAt,
          ...(normalizedWindow.nextCheckAt
            ? { resume_at: normalizedWindow.nextCheckAt }
            : {}),
          ...(normalizedWindow.fallbackAt
            ? { fallback_at: normalizedWindow.fallbackAt }
            : {}),
          last_observed_at: now,
          last_observed_status: run.status ?? "unknown",
        };
        task.updated_at = now;
        task.trace = {
          ...(taskRecord(task.trace) ?? {}),
          pipeline_wait_last_checked_at: now,
          pipeline_wait_last_status: run.status ?? "unknown",
          pipeline_wait_last_run_id: candidate.runId,
          pipeline_wait_next_check_refreshed_by: name,
        };
        refreshedTaskIds.push(task.id);
        continue;
      }

      const previousBlocker = task.blocker;
      task.status = "review";
      task.state = "review";
      task.blocker = undefined;
      task.result = [
        `Azure DevOps pipeline run ${candidate.runId} is terminal; inspect the returned artifacts and update this wait to pass, repair, refreshed wait, or exact artifact blocker.`,
        terminalRunSummary(run),
      ]
        .filter(Boolean)
        .join(" ");
      task.context = {
        ...(taskRecord(task.context) ?? {}),
        terminalPipelineWaitReview: {
          runId: candidate.runId,
          runStatus: run.status ?? null,
          runConclusion: run.conclusion ?? null,
          runUrl: run.url ?? null,
          runTitle: run.displayTitle ?? null,
          observedAt: now,
        },
      };
      task.trace = {
        ...(taskRecord(task.trace) ?? {}),
        current_attempt_id: `a_${safeAttemptSegment(task.id)}_${safeAttemptSegment(candidate.runId)}_terminal_wait_review`,
        terminal_wait_review_attempt_created_at: now,
        terminal_wait_review_attempt_created_by: name,
        terminal_pipeline_wait_observed_at: now,
        terminal_pipeline_wait_run_id: candidate.runId,
        terminal_pipeline_wait_run_status: run.status ?? null,
        terminal_pipeline_wait_run_conclusion: run.conclusion ?? null,
        terminal_pipeline_wait_run_url: run.url ?? null,
        previous_blocker_before_terminal_pipeline_wait_review: previousBlocker,
      };
      harvestedTaskIds.push(task.id);
      terminalRunIds.push(candidate.runId);
    }
    if (harvestedTaskIds.length > 0 || refreshedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(input.config, tree);
    }
  });

  return {
    adoptedTaskIds,
    harvestedTaskIds,
    refreshedTaskIds,
    checkedRunIds,
    terminalRunIds,
    resolvedConditionTaskIds,
    continuationDispatchedTaskIds,
    continuationDispatchFailedTaskIds,
    fallbackDispatchedTaskIds,
    fallbackDispatchFailedTaskIds,
  };
}

function reviewSnapshotFields(
  task: TaskTree["tasks"][string],
): Partial<OpenTaskSnapshot> {
  const context = taskRecord(task.context);
  const trace = taskRecord(task.trace);
  const terminalPipelineWaitReview =
    taskRecord(context?.terminalPipelineWaitReview) ??
    taskRecord(context?.terminalGitHubWaitReview);
  const lastWorkerResult = compactText(trace?.last_worker_result, 120);
  const lastWorkerSummary = compactText(trace?.last_worker_summary);
  return {
    ...(typeof task.parent_id === "string" || task.parent_id === null
      ? { parentId: task.parent_id }
      : {}),
    ...(typeof task.workflow === "string" && task.workflow.trim()
      ? { workflow: task.workflow.trim() }
      : {}),
    reviewKind: terminalPipelineWaitReview
      ? "terminal-pipeline-wait"
      : lastWorkerResult || lastWorkerSummary
        ? "worker-completion"
        : "manual-review",
    ...(compactText(task.result)
      ? { resultSummary: compactText(task.result) }
      : {}),
    ...(lastWorkerResult ? { lastWorkerResult } : {}),
    ...(lastWorkerSummary ? { lastWorkerSummary } : {}),
    ...(terminalPipelineWaitReview ? { terminalPipelineWaitReview } : {}),
  };
}

function openTaskSnapshots(
  tree: TaskTree,
  state: "review" | "blocked",
): OpenTaskSnapshot[] {
  const snapshots = leafTasksByStatus(tree, state).map((task) => ({
    taskId: task.id,
    ...(typeof task.parent_id === "string" || task.parent_id === null
      ? { parentId: task.parent_id }
      : {}),
    ...(typeof task.workflow === "string" && task.workflow.trim()
      ? { workflow: task.workflow.trim() }
      : {}),
    ...(blockerStringField(task.blocker, ["owner"])
      ? { owner: blockerStringField(task.blocker, ["owner"]) }
      : {}),
    ...(state === "review" ? reviewSnapshotFields(task) : {}),
    ...(taskUpdatedAt(task) ? { updatedAt: taskUpdatedAt(task) } : {}),
    ...(task.blocker !== undefined ? { blocker: task.blocker } : {}),
    ...((blockerNestedStringField(task.blocker, ["waiting_for", "type"]) ??
    blockerNestedStringField(task.blocker, ["waitingFor", "type"]))
      ? {
          waitType:
            blockerNestedStringField(task.blocker, ["waiting_for", "type"]) ??
            blockerNestedStringField(task.blocker, ["waitingFor", "type"]),
        }
      : {}),
    ...(blockerStringField(task.blocker, ["resumeAt", "resume_at"])
      ? {
          resumeAt: blockerStringField(task.blocker, ["resumeAt", "resume_at"]),
        }
      : {}),
    ...(blockerStringField(task.blocker, [
      "resumeCondition",
      "resume_condition",
    ])
      ? {
          resumeCondition: blockerStringField(task.blocker, [
            "resumeCondition",
            "resume_condition",
          ]),
        }
      : {}),
    ...(blockerStringField(task.blocker, ["nextCheckAt", "next_check_at"])
      ? {
          nextCheckAt: blockerStringField(task.blocker, [
            "nextCheckAt",
            "next_check_at",
          ]),
        }
      : {}),
    ...(blockerStringField(task.blocker, ["fallbackAt", "fallback_at"])
      ? {
          fallbackAt: blockerStringField(task.blocker, [
            "fallbackAt",
            "fallback_at",
          ]),
        }
      : {}),
    ...(blockerStringField(task.blocker, ["fallbackAction", "fallback_action"])
      ? {
          fallbackAction: blockerStringField(task.blocker, [
            "fallbackAction",
            "fallback_action",
          ]),
        }
      : {}),
  }));

  return state === "blocked"
    ? sortBlockedSnapshots(snapshots)
    : snapshots.sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function parseWatchTime(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function blockedWatchTime(task: OpenTaskSnapshot): number | null {
  const candidates = [
    parseWatchTime(task.nextCheckAt),
    parseWatchTime(task.resumeAt),
    parseWatchTime(task.fallbackAt),
  ].filter((value): value is number => typeof value === "number");
  return candidates.length ? Math.min(...candidates) : null;
}

function blockedTaskRank(task: OpenTaskSnapshot, now = Date.now()): number {
  const watchTime = blockedWatchTime(task);
  if (watchTime !== null && watchTime <= now) return 0;
  if (watchTime === null) return 1;
  return 2;
}

function sortBlockedSnapshots(tasks: OpenTaskSnapshot[]): OpenTaskSnapshot[] {
  const now = Date.now();
  return [...tasks].sort((a, b) => {
    const rankDiff = blockedTaskRank(a, now) - blockedTaskRank(b, now);
    if (rankDiff !== 0) return rankDiff;
    const aWatch = blockedWatchTime(a) ?? Number.POSITIVE_INFINITY;
    const bWatch = blockedWatchTime(b) ?? Number.POSITIVE_INFINITY;
    if (aWatch !== bWatch) return aWatch - bWatch;
    return a.taskId.localeCompare(b.taskId);
  });
}

function incrementGroup(groups: Record<string, number>, key: string): void {
  groups[key] = (groups[key] ?? 0) + 1;
}

function topGroups(
  counts: Record<string, number>,
  overdueCounts: Record<string, number>,
  keyName: "parentId" | "waitType",
):
  | Array<{ parentId: string; count: number; overdueCount: number }>
  | Array<{
      waitType: string;
      count: number;
      overdueCount: number;
    }> {
  return Object.entries(counts)
    .map(([key, count]) => ({
      [keyName]: key,
      count,
      overdueCount: overdueCounts[key] ?? 0,
    }))
    .sort((a, b) => {
      const overdueDiff = b.overdueCount - a.overdueCount;
      if (overdueDiff !== 0) return overdueDiff;
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return String(a[keyName]).localeCompare(String(b[keyName]));
    })
    .slice(0, 8) as never;
}

function blockedWaitType(task: OpenTaskSnapshot): string {
  const value = (task as { waitType?: unknown }).waitType;
  return typeof value === "string" && value.trim() ? value.trim() : "<missing>";
}

function blockedParentId(task: OpenTaskSnapshot): string {
  return task.parentId ?? "<missing>";
}

function blockedFrontierSummary(
  allTasks: OpenTaskSnapshot[],
  sampledTasks: OpenTaskSnapshot[],
): BlockedFrontierSummary {
  const now = Date.now();
  let overdueCount = 0;
  let futureWatchCount = 0;
  let missingWatchCount = 0;
  const parentCounts: Record<string, number> = {};
  const parentOverdueCounts: Record<string, number> = {};
  const waitTypeCounts: Record<string, number> = {};
  const waitTypeOverdueCounts: Record<string, number> = {};

  for (const task of allTasks) {
    const watchTime = blockedWatchTime(task);
    const overdue = watchTime !== null && watchTime <= now;
    if (overdue) overdueCount += 1;
    else if (watchTime === null) missingWatchCount += 1;
    else futureWatchCount += 1;

    const parentId = blockedParentId(task);
    const waitType = blockedWaitType(task);
    incrementGroup(parentCounts, parentId);
    incrementGroup(waitTypeCounts, waitType);
    if (overdue) {
      incrementGroup(parentOverdueCounts, parentId);
      incrementGroup(waitTypeOverdueCounts, waitType);
    }
  }

  return {
    totalCount: allTasks.length,
    overdueCount,
    futureWatchCount,
    missingWatchCount,
    sampledTaskIds: sampledTasks.map((task) => task.taskId),
    sampledOverdueTaskIds: sampledTasks
      .filter((task) => blockedTaskRank(task, now) === 0)
      .map((task) => task.taskId),
    parentGroups: topGroups(
      parentCounts,
      parentOverdueCounts,
      "parentId",
    ) as BlockedFrontierSummary["parentGroups"],
    waitTypeGroups: topGroups(
      waitTypeCounts,
      waitTypeOverdueCounts,
      "waitType",
    ) as BlockedFrontierSummary["waitTypeGroups"],
  };
}

function futureBlockedFrontierEarliestWatchAt(
  tasks: OpenTaskSnapshot[],
): string | null {
  const futureWatches = tasks
    .map(blockedWatchTime)
    .filter((value): value is number => typeof value === "number")
    .filter((value) => value > Date.now());
  if (futureWatches.length === 0) return null;
  return new Date(Math.min(...futureWatches)).toISOString();
}

function recoveryTaskAlreadyOpen(
  tree: TaskTree,
  blockedTask: OpenTaskSnapshot,
): boolean {
  return Object.values(tree.tasks ?? {}).some((task) => {
    if (!isLeaf(task)) return false;
    const state = task.status ?? task.state ?? "backlog";
    if (state !== "active" && state !== "review") return false;
    return taskCoversBlockedOverdueWait(task, blockedTask);
  });
}

function overdueOwnerActions(
  tree: TaskTree,
  blockedTasks: OpenTaskSnapshot[],
): OverdueOwnerAction[] {
  const now = Date.now();
  return blockedTasks
    .flatMap((task): OverdueOwnerAction[] => {
      const watchCandidates = [
        { at: task.nextCheckAt, kind: "next-check" },
        { at: task.resumeAt, kind: "resume" },
        { at: task.fallbackAt, kind: "fallback" },
      ]
        .map((candidate) => ({
          ...candidate,
          ts: parseWatchTime(candidate.at),
        }))
        .filter(
          (candidate): candidate is { at: string; kind: string; ts: number } =>
            typeof candidate.at === "string" &&
            typeof candidate.ts === "number",
        )
        .sort((a, b) => a.ts - b.ts);
      const watch = watchCandidates[0];
      if (!watch || watch.ts > now) return [];
      if (recoveryTaskAlreadyOpen(tree, task)) return [];
      return [
        {
          taskId: task.taskId,
          owner: task.owner ?? "",
          watchAt: new Date(watch.ts).toISOString(),
          ...(task.nextCheckAt ? { nextCheckAt: task.nextCheckAt } : {}),
          ...(task.resumeAt ? { resumeAt: task.resumeAt } : {}),
          ...(task.fallbackAt ? { fallbackAt: task.fallbackAt } : {}),
          ...(task.fallbackAction
            ? { fallbackAction: task.fallbackAction }
            : {}),
          recoveryRequired:
            watch.kind === "resume"
              ? "Resume window passed without active/review recovery work."
              : watch.kind === "next-check"
                ? "Next-check window passed without active/review recovery work."
                : "Fallback window passed without active/review recovery work.",
        },
      ];
    })
    .sort((a, b) => a.watchAt.localeCompare(b.watchAt));
}

function waitingBacklogSnapshots(tree: TaskTree): OpenTaskSnapshot[] {
  return waitingBacklogTaskSnapshots(tree)
    .map((task) => ({
      taskId: task.id,
      ...(task.blocker !== undefined ? { blocker: task.blocker } : {}),
      ...(task.readiness_reasons?.length
        ? { reasons: task.readiness_reasons }
        : {}),
    }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function activeTaskSnapshots(
  tree: TaskTree,
  verifierByTaskId: Map<
    string,
    {
      specId: string;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      activeWorkflowRunId?: string | null;
      heartbeatAt?: string | null;
    }
  >,
  compactByTaskId: Map<
    string,
    {
      featureKey: string;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      activeWorkflowRunId?: string | null;
      heartbeatAt?: string | null;
    }
  >,
): ActiveTaskSnapshot[] {
  return activeLeaves(tree)
    .map((task) => ({
      taskId: task.id,
      taskRevision: taskRevision(task),
      currentAttemptId:
        task.trace && typeof task.trace.current_attempt_id === "string"
          ? task.trace.current_attempt_id
          : undefined,
      sessionId:
        typeof task.session_id === "string" && task.session_id.trim()
          ? task.session_id.trim()
          : undefined,
      assignedAt:
        task.trace && typeof task.trace.assigned_at === "string"
          ? task.trace.assigned_at
          : undefined,
      workerStartedAt:
        task.trace && typeof task.trace.worker_started_at === "string"
          ? task.trace.worker_started_at
          : undefined,
      workflow:
        typeof task.workflow === "string" && task.workflow.trim()
          ? task.workflow.trim()
          : undefined,
      futureWindowGateAt: activeTaskFutureWindowGateAt(task),
      verifierLiveness: verifierByTaskId.get(task.id),
      compactLiveness: compactByTaskId.get(task.id),
    }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function loadVerifierLivenessByTaskId(path: string): Map<
  string,
  {
    specId: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  }
> {
  const state = readJson<SpecLoopState | null>(path, null);
  const byTaskId = new Map<
    string,
    {
      specId: string;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      activeWorkflowRunId?: string | null;
      heartbeatAt?: string | null;
    }
  >();
  const specs = state?.specs ?? {};
  for (const [specId, spec] of Object.entries(specs)) {
    if (!spec || typeof spec !== "object") continue;
    if (spec.status !== "running") continue;
    if (!spec.taskId || typeof spec.taskId !== "string") continue;
    byTaskId.set(spec.taskId, {
      specId,
      activeAttemptId:
        typeof spec.activeAttemptId === "string" ? spec.activeAttemptId : null,
      activeTaskSessionId:
        typeof spec.activeTaskSessionId === "string"
          ? spec.activeTaskSessionId
          : null,
      activeWorkflowRunId:
        typeof spec.activeWorkflowRunId === "string"
          ? spec.activeWorkflowRunId
          : null,
      heartbeatAt:
        typeof spec.heartbeatAt === "string" ? spec.heartbeatAt : null,
    });
  }
  return byTaskId;
}

function loadCompactLivenessByTaskId(path: string): Map<
  string,
  {
    featureKey: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  }
> {
  const state = readJson<Record<string, unknown> | null>(path, null);
  const byTaskId = new Map<
    string,
    {
      featureKey: string;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      activeWorkflowRunId?: string | null;
      heartbeatAt?: string | null;
    }
  >();
  const features = state?.features;
  const records =
    features && typeof features === "object" && !Array.isArray(features)
      ? (features as Record<string, Record<string, unknown>>)
      : {};
  for (const [featureKey, feature] of Object.entries(records)) {
    if (!feature || typeof feature !== "object") continue;
    if (feature.status !== "running") continue;
    if (!feature.taskId || typeof feature.taskId !== "string") continue;
    byTaskId.set(feature.taskId, {
      featureKey,
      activeAttemptId:
        typeof feature.activeAttemptId === "string"
          ? feature.activeAttemptId
          : null,
      activeTaskSessionId:
        typeof feature.activeTaskSessionId === "string"
          ? feature.activeTaskSessionId
          : null,
      activeWorkflowRunId:
        typeof feature.activeWorkflowRunId === "string"
          ? feature.activeWorkflowRunId
          : null,
      heartbeatAt:
        typeof feature.heartbeatAt === "string" ? feature.heartbeatAt : null,
    });
  }
  return byTaskId;
}

function hasOpenWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(
    (task) => !["done"].includes(task.status ?? "backlog"),
  );
}

function taskContext(
  task: TaskTree["tasks"][string] | undefined,
): Record<string, unknown> {
  const context = task?.context;
  return context && typeof context === "object" && !Array.isArray(context)
    ? (context as Record<string, unknown>)
    : {};
}

function taskWorkflowProgress(
  task: TaskTree["tasks"][string] | undefined,
): Record<string, unknown> | null {
  const progress = taskContext(task).workflowProgress;
  return progress && typeof progress === "object" && !Array.isArray(progress)
    ? (progress as Record<string, unknown>)
    : null;
}

function taskCompletionReady(
  task: TaskTree["tasks"][string] | undefined,
): boolean | null {
  const progress = taskWorkflowProgress(task);
  return typeof progress?.completionReady === "boolean"
    ? progress.completionReady
    : null;
}

function progressNumber(
  progress: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = progress?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function loopStatusCounts(input: {
  statePath: string;
  collectionKey: "specs" | "features";
}): { stateExists: boolean; counts: Record<string, number> } {
  if (!existsSync(input.statePath)) return { stateExists: false, counts: {} };
  const state = readJson<Record<string, unknown>>(input.statePath, {});
  const collection = state[input.collectionKey];
  const records =
    collection && typeof collection === "object" && !Array.isArray(collection)
      ? (collection as Record<string, Record<string, unknown>>)
      : {};
  const counts: Record<string, number> = {};
  for (const value of Object.values(records)) {
    const status =
      typeof value?.status === "string" && value.status.trim()
        ? value.status.trim()
        : "pending";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return { stateExists: true, counts };
}

function durableLoopLiveness(
  config: WatchdogConfig,
  tree: TaskTree,
): DurableLoopLiveness[] {
  const definitions = [
    {
      taskId: "aks-spec-verification-loop",
      action: "spec-loop",
      statePath: config.specLoopStatePath,
      collectionKey: "specs" as const,
      doneStatuses: ["pass", "done"],
    },
    {
      taskId: "aks-feature-reference-loop",
      action: "feature-reference-loop",
      statePath: config.featureReferenceLoopStatePath,
      collectionKey: "features" as const,
      doneStatuses: ["done"],
    },
    {
      taskId: "aks-feature-compact-loop",
      action: "feature-compact-loop",
      statePath: config.featureCompactLoopStatePath,
      collectionKey: "features" as const,
      doneStatuses: ["done"],
    },
  ];

  return definitions.map((definition) => {
    const task = tree.tasks[definition.taskId];
    const counts = loopStatusCounts(definition);
    const done = new Set(definition.doneStatuses);
    const nonTerminalCount = Object.entries(counts.counts).reduce(
      (sum, [status, count]) => sum + (done.has(status) ? 0 : count),
      0,
    );
    const progress = taskWorkflowProgress(task);
    const ready = taskCompletionReady(task);
    const exactBlockedWaitStewardship =
      exactBlockedWaitStewardshipProgress(progress);
    const activeExternalRunWait = activeExternalRunWaitProgress(progress);
    const unrepresentedNonTerminalCount =
      progressNumber(progress, "unrepresentedNonTerminalCount") ??
      (nonTerminalCount > 0 ? nonTerminalCount : 0);
    return {
      taskId: definition.taskId,
      action: definition.action,
      statePath: definition.statePath,
      stateExists: counts.stateExists,
      taskStatus: task ? String(task.status ?? task.state ?? "backlog") : null,
      completionReady: ready,
      statusCounts: counts.counts,
      nonTerminalCount,
      unrepresentedNonTerminalCount,
      exactBlockedWaitStewardship,
      activeExternalRunWait,
      needsAttention:
        ready === false &&
        (unrepresentedNonTerminalCount > 0 ||
          (!exactBlockedWaitStewardship && !activeExternalRunWait)),
    };
  });
}

function activeProjectNeedsRefill(tree: TaskTree): boolean {
  return tree.project_lifecycle !== "closed" && !hasOpenWork(tree);
}

function sessionRestartReasonFromRow(
  row: Record<string, unknown> | null,
  staleNoActivityMs: number,
): string | null {
  if (!row) return "session-not-running";
  if (row.status !== "running") return "session-not-running";
  if (row.outcome === "error" || row.outcome === "interrupted")
    return `session-${row.outcome}`;

  const startedAt =
    typeof row.startedAt === "number" && Number.isFinite(row.startedAt)
      ? row.startedAt
      : null;
  const lastActivityAt =
    typeof row.lastActivityAt === "number" &&
    Number.isFinite(row.lastActivityAt)
      ? row.lastActivityAt
      : startedAt;
  const staleSince = lastActivityAt ?? startedAt;
  if (staleSince !== null && Date.now() - staleSince > staleNoActivityMs) {
    return "session-no-activity";
  }

  return null;
}

function openSessionLifecycleStart(
  db: Database,
  sessionId: string,
): number | null {
  try {
    const rows = db
      .query(
        `
      select event_type, data, timestamp
      from events
      where data like ?
        and event_type in ('session.start', 'session.end')
      order by timestamp desc
      limit 20
    `,
      )
      .all(`%"sessionId":"${sessionId}"%`) as Array<{
      event_type?: unknown;
      data?: unknown;
      timestamp?: unknown;
    }>;
    let latestStartAt: number | null = null;
    let latestTerminalAt: number | null = null;
    for (const row of rows) {
      if (
        typeof row.timestamp !== "number" ||
        !Number.isFinite(row.timestamp)
      ) {
        continue;
      }
      if (typeof row.data !== "string") continue;
      try {
        const payload = JSON.parse(row.data) as Record<string, unknown>;
        if (payload.sessionId !== sessionId) continue;
      } catch {
        continue;
      }
      if (row.event_type === "session.start") {
        latestStartAt = Math.max(latestStartAt ?? row.timestamp, row.timestamp);
        continue;
      }
      if (row.event_type === "session.end") {
        latestTerminalAt = Math.max(
          latestTerminalAt ?? row.timestamp,
          row.timestamp,
        );
      }
    }
    if (latestStartAt === null) return null;
    if (
      latestTerminalAt !== null &&
      Number.isFinite(latestTerminalAt) &&
      latestTerminalAt >= latestStartAt
    ) {
      return null;
    }
    return latestStartAt;
  } catch {
    return null;
  }
}

function sessionRestartReason(
  dbPath: string,
  sessionId: string,
  staleNoActivityMs: number,
): string | null {
  if (!existsSync(dbPath)) return "session-not-running";
  const db = new Database(dbPath, { readonly: true });
  try {
    let row: Record<string, unknown> | null = null;
    try {
      row = db
        .query(
          `
        select status, outcome, opCount, startedAt, lastActivityAt
        from sessions
        where sessionId = ?
        limit 1
      `,
        )
        .get(sessionId) as Record<string, unknown> | null;
    } catch {
      row = db
        .query(
          `
        select status
        from sessions
        where sessionId = ?
        limit 1
      `,
        )
        .get(sessionId) as Record<string, unknown> | null;
    }
    const rowReason = sessionRestartReasonFromRow(row, staleNoActivityMs);
    if (rowReason !== "session-not-running") {
      return rowReason;
    }
    if (row) {
      return rowReason;
    }
    const openLifecycleStartAt = openSessionLifecycleStart(db, sessionId);
    if (openLifecycleStartAt === null) {
      return rowReason;
    }
    return Date.now() - openLifecycleStartAt > staleNoActivityMs
      ? "session-no-activity"
      : null;
  } finally {
    db.close();
  }
}

function restartReasonForSession(
  dbPath: string,
  sessionId: string,
  staleNoActivityMs: number,
): string | null {
  try {
    return sessionRestartReason(dbPath, sessionId, staleNoActivityMs);
  } catch {
    return "session-not-running";
  }
}

function activeTaskFutureWindowGateAt(task: TaskNode): string | undefined {
  for (const value of [
    blockerStringField(task.blocker, ["resumeAt", "resume_at"]),
    blockerStringField(task.blocker, ["nextCheckAt", "next_check_at"]),
  ]) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  const goal = typeof task.goal === "string" ? task.goal.trim() : "";
  const match = goal.match(/^At or after\s+([^,;]+?)(?:,|\s|$)/i);
  if (!match) return undefined;
  const parsed = Date.parse(match[1].trim());
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function activeTaskIsWithinStartGrace(
  config: WatchdogConfig,
  task: ActiveTaskSnapshot,
): boolean {
  for (const value of [task.assignedAt, task.workerStartedAt]) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (
      Number.isFinite(parsed) &&
      Date.now() - parsed <= config.sessionStartGraceMs
    ) {
      return true;
    }
  }
  return false;
}

function activeTaskFutureWindowStillClosed(task: ActiveTaskSnapshot): boolean {
  if (!task.futureWindowGateAt) return false;
  const parsed = Date.parse(task.futureWindowGateAt);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function activeTaskRestartReason(
  config: WatchdogConfig,
  task: ActiveTaskSnapshot,
): string | null {
  if (task.workflow === "single-spec-verifier" && task.verifierLiveness) {
    const sameAttempt =
      !!task.currentAttemptId &&
      task.verifierLiveness.activeAttemptId === task.currentAttemptId;
    if (sameAttempt) {
      const heartbeatMs = task.verifierLiveness.heartbeatAt
        ? Date.parse(task.verifierLiveness.heartbeatAt)
        : Number.NaN;
      if (
        Number.isFinite(heartbeatMs) &&
        Date.now() - heartbeatMs <= config.staleNoActivityMs
      ) {
        return null;
      }
      return "verifier-no-heartbeat";
    }
  }

  if (task.workflow === "feature-compact-planner" && task.compactLiveness) {
    const sameAttempt =
      !!task.currentAttemptId &&
      task.compactLiveness.activeAttemptId === task.currentAttemptId;
    if (sameAttempt) {
      const heartbeatMs = task.compactLiveness.heartbeatAt
        ? Date.parse(task.compactLiveness.heartbeatAt)
        : Number.NaN;
      if (
        Number.isFinite(heartbeatMs) &&
        Date.now() - heartbeatMs <= config.staleNoActivityMs
      ) {
        return null;
      }
      return "compact-no-heartbeat";
    }
  }

  if (!task.sessionId) {
    return activeTaskIsWithinStartGrace(config, task)
      ? null
      : "missing-session";
  }
  const reason = restartReasonForSession(
    config.stateDbPath,
    task.sessionId,
    config.staleNoActivityMs,
  );
  if (
    reason === "session-not-running" &&
    activeTaskIsWithinStartGrace(config, task)
  ) {
    return null;
  }
  if (
    reason === "session-no-activity" &&
    activeTaskFutureWindowStillClosed(task)
  ) {
    return null;
  }
  return reason;
}

function staleActiveTasks(
  config: WatchdogConfig,
  tasks: ActiveTaskSnapshot[],
): Array<{ taskId: string; reason: string }> {
  const stale: Array<{ taskId: string; reason: string }> = [];
  for (const task of tasks) {
    const reason = activeTaskRestartReason(config, task);
    if (reason) stale.push({ taskId: task.taskId, reason });
  }
  return stale.sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function terminalDoneSessionRecovery(
  dbPath: string,
  sessionId: string,
): TerminalSessionRecovery | null {
  if (!sessionId || !existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  try {
    const session = db
      .query(
        `
        select *
        from sessions
        where sessionId = ?
        limit 1
      `,
      )
      .get(sessionId) as Record<string, unknown> | null;
    if (!session) return null;
    const status = typeof session.status === "string" ? session.status : "";
    const outcome = typeof session.outcome === "string" ? session.outcome : "";
    const error = typeof session.error === "string" ? session.error : "";
    if (
      error ||
      (!["done", "success"].includes(status) &&
        !["done", "success"].includes(outcome))
    ) {
      return null;
    }

    let summary = `Recovered completed worker session ${sessionId}.`;
    const evidence: string[] = [];
    let actionable = false;
    try {
      const endRows = db
        .query(
          `
          select event_type, data
          from events
          where data like ?
            and event_type = 'session.end'
          order by timestamp desc
          limit 10
        `,
        )
        .all(`%"sessionId":"${sessionId}"%`) as Array<{
        event_type?: unknown;
        data?: unknown;
      }>;
      for (const row of endRows) {
        const parsed =
          typeof row.data === "string"
            ? (JSON.parse(row.data) as Record<string, unknown>)
            : null;
        if (!parsed) continue;
        const finishParams =
          parsed.finishParams &&
          typeof parsed.finishParams === "object" &&
          !Array.isArray(parsed.finishParams)
            ? (parsed.finishParams as Record<string, unknown>)
            : null;
        const deliverables = Array.isArray(finishParams?.deliverables)
          ? finishParams.deliverables
          : [];
        const verification = Array.isArray(finishParams?.verification_evidence)
          ? finishParams.verification_evidence
          : [];
        if (
          !actionable &&
          (deliverables.length > 0 ||
            verification.length > 0 ||
            (typeof parsed.summary === "string" &&
              parsed.summary.trim() &&
              !parsed.summary.startsWith("Recovered completed worker session")))
        ) {
          actionable = true;
        }
        if (typeof parsed.summary === "string" && parsed.summary.trim()) {
          summary = parsed.summary.trim();
        }
        for (const ref of verification) {
          if (typeof ref === "string" && ref.trim()) evidence.push(ref.trim());
        }
        for (const deliverable of deliverables) {
          if (
            deliverable &&
            typeof deliverable === "object" &&
            !Array.isArray(deliverable) &&
            typeof (deliverable as Record<string, unknown>).path === "string"
          ) {
            evidence.push(
              ((deliverable as Record<string, string>).path ?? "").trim(),
            );
          }
        }
      }
    } catch {
      // Missing events table or malformed historical payloads should not block
      // recovering the task state from the terminal session row.
    }

    return { sessionId, summary, evidence: [...new Set(evidence)], actionable };
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function recoverTerminalDoneActiveTasks(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  treeConfig: TaskTreeConfig,
  tasks: ActiveTaskSnapshot[],
): string[] {
  const recovered: string[] = [];
  for (const task of tasks) {
    if (!task.taskId || !task.currentAttemptId || !task.sessionId) continue;
    const recovery = terminalDoneSessionRecovery(
      config.stateDbPath,
      task.sessionId,
    );
    if (!recovery || !recovery.actionable) continue;
    const completion = completeStartedAttempt(treeConfig, {
      taskId: task.taskId,
      taskRevision: task.taskRevision,
      attemptId: task.currentAttemptId,
      claim: "done",
      summary: recovery.summary,
      evidence: recovery.evidence,
    });
    if (!completion.ok) continue;
    emitTaskCompleted(ctx, completion.task, {
      taskRevision: task.taskRevision,
      attemptId: task.currentAttemptId,
      result: "done",
      summary: recovery.summary,
      evidence: recovery.evidence,
      review: {
        required: true,
        reason: "watchdog-recovered-terminal-worker-session",
      },
    });
    recovered.push(task.taskId);
  }
  if (recovered.length > 0) {
    try {
      syncProjectReadout(treeConfig);
    } catch {
      // Recovery already updated the durable task tree; readout can catch up.
    }
  }
  return recovered;
}

function observeTerminalAttemptSupervisorShadowV2(
  config: WatchdogConfig,
  treeConfig: TaskTreeConfig,
): void {
  if (config.supervisorAttemptV2 !== "shadow") return;
  const captured = captureRuntimeProjectSnapshotV2({
    appDir: config.appDir,
    treePath: config.treePath,
    stateDbPath: config.stateDbPath,
    projectId: "aks-rp-e2e",
    sessionStartGraceMs: config.sessionStartGraceMs,
    staleNoActivityMs: config.staleNoActivityMs,
  });
  if (!captured) return;
  const terminalAttempts = captured.snapshot.attempts.filter(
    (attempt) =>
      attempt.controlPlaneVersion === 2 &&
      attempt.taskRevision > 0 &&
      attempt.runtimeState === "terminal" &&
      Boolean(attempt.attemptId) &&
      Boolean(attempt.sessionId),
  );
  const candidates = terminalAttemptRecoveryCandidatesV2(captured.snapshot);
  const actionable = candidates.filter(
    (candidate) =>
      terminalDoneSessionRecovery(config.stateDbPath, candidate.sessionId)
        ?.actionable,
  );
  const legacyRevisionedActionable = captured.snapshot.attempts
    .filter(
      (attempt) =>
        attempt.controlPlaneVersion === 2 &&
        attempt.taskRevision > 0 &&
        attempt.runtimeState === "terminal" &&
        Boolean(attempt.sessionId),
    )
    .filter(
      (attempt) =>
        terminalDoneSessionRecovery(config.stateDbPath, attempt.sessionId!)
          ?.actionable,
    )
    .map((attempt) => attempt.taskId)
    .sort((left, right) => left.localeCompare(right));
  const v2Actionable = actionable
    .map((candidate) => candidate.taskId)
    .sort((left, right) => left.localeCompare(right));
  const matches =
    v2Actionable.length === legacyRevisionedActionable.length &&
    v2Actionable.every(
      (taskId, index) => taskId === legacyRevisionedActionable[index],
    );
  const candidateKeys = new Set(
    candidates.map(
      (candidate) =>
        `${candidate.taskId}:${candidate.taskRevision}:${candidate.attemptId}`,
    ),
  );
  const actionableKeys = new Set(
    actionable.map(
      (candidate) =>
        `${candidate.taskId}:${candidate.taskRevision}:${candidate.attemptId}`,
    ),
  );
  const terminalClassifications = terminalAttempts.map((attempt) => {
    const key = `${attempt.taskId}:${attempt.taskRevision}:${attempt.attemptId}`;
    const status = attempt.sessionStatus?.toLowerCase() ?? "unknown";
    const outcome = attempt.sessionOutcome?.toLowerCase() ?? "unknown";
    const providerError =
      Boolean(attempt.sessionError) ||
      ["error", "failed", "failure", "interrupted"].includes(status) ||
      ["error", "failed", "failure", "interrupted"].includes(outcome);
    const outcomeClass = providerError
      ? "terminal-provider-error"
      : actionableKeys.has(key)
        ? "terminal-success-actionable"
        : candidateKeys.has(key)
          ? "terminal-success-nonactionable"
          : "terminal-other";
    return {
      task_id: attempt.taskId,
      task_revision: attempt.taskRevision,
      attempt_id: attempt.attemptId,
      session_id: attempt.sessionId,
      session_status: attempt.sessionStatus,
      session_outcome: attempt.sessionOutcome,
      has_session_error: Boolean(attempt.sessionError),
      outcome_class: outcomeClass,
    };
  });
  if (
    terminalClassifications.length === 0 &&
    legacyRevisionedActionable.length === 0
  ) {
    return;
  }
  appendToolJournal(treeConfig, {
    kind: "project_supervisor_terminal_attempt_shadow_v2",
    tree_updated_at: captured.snapshot.treeUpdatedAt,
    candidate_task_ids: candidates.map((candidate) => candidate.taskId),
    actionable_task_ids: v2Actionable,
    legacy_revisioned_actionable_task_ids: legacyRevisionedActionable,
    terminal_attempt_classifications: terminalClassifications,
    matches,
    reason:
      "Shadow-only comparison; the existing terminal-session recovery remains the sole writer.",
  });
}

function emitOwnerRequested(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  reason: string,
  details: Record<string, unknown> = {},
): boolean {
  try {
    ctx.dispatchEvent("project.owner.requested", {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      reason,
      maxConcurrent: config.maxConcurrent,
      requested_by: "project-execution-watchdog",
      ...details,
    });
    return true;
  } catch {
    // Local tests may not provide a dispatcher.
    return false;
  }
}

function emitStallReviewRequested(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  reason: string,
  details: Record<string, unknown> = {},
): void {
  try {
    ctx.dispatchEvent("project.stall.review.requested", {
      target: { project: "aks-rp-e2e" },
      project: "aks-rp-e2e",
      reason,
      maxConcurrent: config.maxConcurrent,
      requested_by: "project-execution-watchdog",
      ...details,
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
}

function emitLoopTicks(
  ctx: WorkflowContext,
  loops: DurableLoopLiveness[],
  reason: string,
): number {
  let emitted = 0;
  for (const loop of loops) {
    try {
      ctx.dispatchEvent("project.task.tick", {
        target: { project: "aks-rp-e2e", taskId: loop.taskId },
        project: "aks-rp-e2e",
        action: loop.action,
        taskId: loop.taskId,
        task_id: loop.taskId,
        reason,
        requested_by: "project-execution-watchdog",
        durableLoopLiveness: loop,
      });
      emitted += 1;
    } catch {
      // Local tests may not provide a dispatcher.
    }
  }
  return emitted;
}

function loopTickDetails(count: number): Record<string, unknown> {
  return count > 0 ? { loopTickCount: count } : {};
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const sharedConfig = buildTaskTreeConfig(config);
  try {
    syncProjectReadout(sharedConfig);
  } catch {
    // Watchdog should still observe/wake from the task tree even if compact
    // project-state summary refresh fails on this pulse.
  }
  const runnableBacklogTaskIds = listRunnableBacklogTaskIds(
    sharedConfig,
    config.maxConcurrent,
  );
  const snapshot: WatchdogTreeSnapshot | null = withTreeLock(
    sharedConfig,
    () => {
      const tree = readTree(config.treePath);
      if (!tree) return null;
      if (Object.keys(tree.tasks ?? {}).length === 0) return null;
      const verifierByTaskId = loadVerifierLivenessByTaskId(
        config.specLoopStatePath,
      );
      const compactByTaskId = loadCompactLivenessByTaskId(
        config.featureCompactLoopStatePath,
      );
      const activeTasks = activeTaskSnapshots(
        tree,
        verifierByTaskId,
        compactByTaskId,
      );
      const reviewTasks = openTaskSnapshots(tree, "review");
      const blockedTasks = openTaskSnapshots(tree, "blocked");
      const conditionOwnedBlockedTaskIds = openExactConditionSubjectIdsV2(tree);
      const conditionOwnedSet = new Set(conditionOwnedBlockedTaskIds);
      const blockedOwnerActions = overdueOwnerActions(
        tree,
        blockedTasks.filter((task) => !conditionOwnedSet.has(task.taskId)),
      );
      const waitingBacklogTasks = waitingBacklogSnapshots(tree);
      const durableLoops = durableLoopLiveness(config, tree);

      return {
        runnableBacklogTaskIds,
        runnableBacklogTreeUpdatedAt:
          typeof tree.updated_at === "string" ? tree.updated_at : undefined,
        runnableBacklogSnapshotAt: new Date().toISOString(),
        activeTasks,
        reviewTasks,
        blockedTasks,
        conditionOwnedBlockedTaskIds,
        overdueOwnerActions: blockedOwnerActions,
        waitingBacklogTasks,
        activeCount: activeTasks.length,
        hasOpenWork: hasOpenWork(tree),
        needsRefill: activeProjectNeedsRefill(tree),
        durableLoopLiveness: durableLoops,
      };
    },
  );
  if (!snapshot)
    return ctx.done("Watchdog skipped: task tree does not exist yet.");

  const recovery = {
    ...snapshot,
    staleActiveTasks: staleActiveTasks(config, snapshot.activeTasks),
  };
  const conditionOwnedBlockedTaskIds = new Set(
    recovery.conditionOwnedBlockedTaskIds,
  );
  const legacyBlockedTasks = recovery.blockedTasks.filter(
    (task) => !conditionOwnedBlockedTaskIds.has(task.taskId),
  );
  const sampledBlockedTasks = legacyBlockedTasks.slice(0, 20);
  const blockedSummary = blockedFrontierSummary(
    legacyBlockedTasks,
    sampledBlockedTasks,
  );
  const futureOnlyBlockedFrontierNoop =
    legacyBlockedTasks.length > 0 &&
    recovery.waitingBacklogTasks.length === 0 &&
    blockedSummary.overdueCount === 0 &&
    blockedSummary.missingWatchCount === 0 &&
    blockedSummary.futureWatchCount === legacyBlockedTasks.length;
  const conditionOwnedWaitNoop =
    recovery.conditionOwnedBlockedTaskIds.length > 0 &&
    legacyBlockedTasks.length === 0 &&
    recovery.waitingBacklogTasks.length === 0 &&
    recovery.runnableBacklogTaskIds.length === 0;
  const futureOnlyBlockedFrontierEarliestWatchAt = futureOnlyBlockedFrontierNoop
    ? futureBlockedFrontierEarliestWatchAt(recovery.blockedTasks)
    : null;
  observeTerminalAttemptSupervisorShadowV2(config, sharedConfig);
  const recoveredTerminalTasks = recoverTerminalDoneActiveTasks(
    ctx,
    config,
    sharedConfig,
    snapshot.activeTasks,
  );
  const recoveredTerminalSuffix =
    recoveredTerminalTasks.length > 0
      ? ` Also recovered completed active task(s): ${recoveredTerminalTasks.join(", ")}.`
      : "";
  const pipelineWaitCandidates = terminalPipelineWaitCandidates(sharedConfig);
  const pipelineCandidateTree = readTree(config.treePath);
  const pipelineObservationRequired = Boolean(
    pipelineCandidateTree &&
    pipelineWaitCandidates.some((candidate) =>
      pipelineObservationDue(
        pipelineCandidateTree,
        candidate,
        config.conditionV2,
      ),
    ),
  );
  const pipelineAccess = pipelineObservationRequired
    ? resolvePipelineClient(config.projectDir)
    : {
        client: null,
        reason:
          pipelineWaitCandidates.length > 0
            ? "exact pipeline Conditions are not due or their writer is disabled"
            : "no pipeline wait candidates",
      };
  const terminalPipelineWaitHarvest =
    pipelineWaitCandidates.length > 0
      ? harvestTerminalPipelineWaits({
          ctx,
          config: sharedConfig,
          projectDir: config.projectDir,
          client: pipelineAccess.client,
          pipelineAccessReason: pipelineAccess.reason,
          conditionV2: config.conditionV2,
          conditionAdoptionV2: config.conditionAdoptionV2,
          conditionAdoptionV2TaskId: config.conditionAdoptionV2TaskId,
          conditionAdoptionV2RunId: config.conditionAdoptionV2RunId,
          maxConcurrent: config.maxConcurrent,
        })
      : {
          adoptedTaskIds: [],
          harvestedTaskIds: [],
          refreshedTaskIds: [],
          checkedRunIds: [],
          terminalRunIds: [],
          resolvedConditionTaskIds: [],
          continuationDispatchedTaskIds: [],
          continuationDispatchFailedTaskIds: [],
          fallbackDispatchedTaskIds: [],
          fallbackDispatchFailedTaskIds: [],
        };
  if (terminalPipelineWaitHarvest.resolvedConditionTaskIds.length > 0) {
    const delivered =
      terminalPipelineWaitHarvest.continuationDispatchedTaskIds.length > 0
        ? ` Dispatched artifact-review assignment(s): ${terminalPipelineWaitHarvest.continuationDispatchedTaskIds.join(", ")}.`
        : " The durable artifact-review continuation remains pending assignment or delivery.";
    return ctx.done(
      `Watchdog resolved exact pipeline Condition(s): ${terminalPipelineWaitHarvest.resolvedConditionTaskIds.join(", ")}.${delivered}${recoveredTerminalSuffix}`,
    );
  }
  if (
    terminalPipelineWaitHarvest.continuationDispatchedTaskIds.length > 0 ||
    terminalPipelineWaitHarvest.continuationDispatchFailedTaskIds.length > 0
  ) {
    const delivered =
      terminalPipelineWaitHarvest.continuationDispatchedTaskIds.length > 0
        ? `dispatched ${terminalPipelineWaitHarvest.continuationDispatchedTaskIds.join(", ")}`
        : "";
    const retained =
      terminalPipelineWaitHarvest.continuationDispatchFailedTaskIds.length > 0
        ? `retained ${terminalPipelineWaitHarvest.continuationDispatchFailedTaskIds.join(", ")} for retry`
        : "";
    return ctx.done(
      `Watchdog processed exact Condition continuation delivery: ${[delivered, retained].filter(Boolean).join("; ")}.${recoveredTerminalSuffix}`,
    );
  }
  const recoveredTerminalReviewAssignments =
    recoverTerminalReviewAssignmentsWithoutWorker(ctx, sharedConfig);
  if (
    terminalPipelineWaitHarvest.harvestedTaskIds.length > 0 &&
    (recoveredTerminalReviewAssignments.dispatchedTaskIds.length > 0 ||
      recoveredTerminalReviewAssignments.dispatchFailedTaskIds.length > 0 ||
      recoveredTerminalReviewAssignments.retainedBacklogTaskIds.length > 0)
  ) {
    const parts = [
      `Watchdog converted terminal Azure DevOps wait(s) into worker artifact-review execution: ${terminalPipelineWaitHarvest.harvestedTaskIds.join(", ")}.`,
      recoveredTerminalReviewAssignments.dispatchedTaskIds.length > 0
        ? `Dispatched task-worker assignment(s): ${recoveredTerminalReviewAssignments.dispatchedTaskIds.join(", ")}.`
        : "",
      recoveredTerminalReviewAssignments.dispatchFailedTaskIds.length > 0
        ? `Retained assignment delivery for retry: ${recoveredTerminalReviewAssignments.dispatchFailedTaskIds.join(", ")}.`
        : "",
      recoveredTerminalReviewAssignments.retainedBacklogTaskIds.length > 0
        ? `Left runnable backlog for planner/watchdog refill: ${recoveredTerminalReviewAssignments.retainedBacklogTaskIds.join(", ")}.`
        : "",
    ].filter(Boolean);
    return ctx.done(`${parts.join(" ")}${recoveredTerminalSuffix}`);
  }
  if (terminalPipelineWaitHarvest.harvestedTaskIds.length > 0) {
    const supervisorTick = runReviewHandoffSupervisorV2(
      ctx,
      config,
      sharedConfig,
    );
    if (supervisorTick.handled) {
      return ctx.done(
        `Watchdog moved terminal Azure DevOps wait(s) to review: ${terminalPipelineWaitHarvest.harvestedTaskIds.join(", ")}. Project Supervisor V2 ${supervisorTick.message} for ${supervisorTick.taskId ?? "the review frontier"}.${recoveredTerminalSuffix}`,
      );
    }
    const recoveredReviewCompletions = recoverReviewCompletionsWithoutReviewer(
      ctx,
      config,
      sharedConfig,
      {
        v2OwnedTaskIds: new Set(
          supervisorTick.reviewsAvailable
            ? supervisorTick.correlatedTaskIds
            : [],
        ),
      },
    );
    return ctx.done(
      `Watchdog moved terminal Azure DevOps wait(s) to review: ${terminalPipelineWaitHarvest.harvestedTaskIds.join(", ")}.${
        recoveredReviewCompletions.length > 0
          ? ` Re-emitted completion for reviewer handoff: ${recoveredReviewCompletions.join(", ")}.`
          : ""
      }${recoveredTerminalSuffix}`,
    );
  }
  if (terminalPipelineWaitHarvest.refreshedTaskIds.length > 0) {
    return ctx.done(
      `Watchdog refreshed nonterminal Azure DevOps wait check(s): ${terminalPipelineWaitHarvest.refreshedTaskIds.join(", ")}.${recoveredTerminalSuffix}`,
    );
  }
  if (terminalPipelineWaitHarvest.fallbackDispatchedTaskIds.length > 0) {
    return ctx.done(
      `Watchdog dispatched exact Condition fallback(s): ${terminalPipelineWaitHarvest.fallbackDispatchedTaskIds.join(", ")}.${recoveredTerminalSuffix}`,
    );
  }
  if (terminalPipelineWaitHarvest.fallbackDispatchFailedTaskIds.length > 0) {
    return ctx.done(
      `Watchdog retained exact Condition fallback(s) for delivery retry: ${terminalPipelineWaitHarvest.fallbackDispatchFailedTaskIds.join(", ")}.${recoveredTerminalSuffix}`,
    );
  }
  if (terminalPipelineWaitHarvest.adoptedTaskIds.length > 0) {
    return ctx.done(
      `Watchdog adopted exact Azure DevOps wait(s) into Condition V2: ${terminalPipelineWaitHarvest.adoptedTaskIds.join(", ")}.${recoveredTerminalSuffix}`,
    );
  }
  if (recoveredTerminalTasks.length > 0) {
    return ctx.done(
      `Watchdog recovered completed active task(s): ${recoveredTerminalTasks.join(", ")}.`,
    );
  }
  if (
    recoveredTerminalReviewAssignments.dispatchedTaskIds.length > 0 ||
    recoveredTerminalReviewAssignments.dispatchFailedTaskIds.length > 0 ||
    recoveredTerminalReviewAssignments.retainedBacklogTaskIds.length > 0
  ) {
    const parts = [
      recoveredTerminalReviewAssignments.dispatchedTaskIds.length > 0
        ? `Watchdog requeued stale terminal-review leaf/leaves for task-worker assignment: ${recoveredTerminalReviewAssignments.dispatchedTaskIds.join(", ")}.`
        : "",
      recoveredTerminalReviewAssignments.dispatchFailedTaskIds.length > 0
        ? `Retained assignment delivery for retry: ${recoveredTerminalReviewAssignments.dispatchFailedTaskIds.join(", ")}.`
        : "",
      recoveredTerminalReviewAssignments.retainedBacklogTaskIds.length > 0
        ? `Left runnable backlog for planner/watchdog refill: ${recoveredTerminalReviewAssignments.retainedBacklogTaskIds.join(", ")}.`
        : "",
    ].filter(Boolean);
    return ctx.done(`${parts.join(" ")}${recoveredTerminalSuffix}`);
  }
  const supervisorTick = runReviewHandoffSupervisorV2(
    ctx,
    config,
    sharedConfig,
  );
  if (supervisorTick.handled) {
    return ctx.done(
      `Project Supervisor V2 ${supervisorTick.message} for ${supervisorTick.taskId ?? "the review frontier"}.`,
    );
  }
  const recoveredReviewCompletions = recoverReviewCompletionsWithoutReviewer(
    ctx,
    config,
    sharedConfig,
    {
      v2OwnedTaskIds: new Set(
        supervisorTick.reviewsAvailable ? supervisorTick.correlatedTaskIds : [],
      ),
    },
  );
  if (recoveredReviewCompletions.length > 0) {
    return ctx.done(
      `Watchdog re-emitted completion for review task(s): ${recoveredReviewCompletions.join(", ")}.`,
    );
  }
  const loopsNeedingAttention = recovery.durableLoopLiveness.filter(
    (loop) => loop.needsAttention,
  );
  const loopsNeedingPulse = loopsNeedingAttention.filter(
    (loop) => loop.taskStatus === "backlog",
  );
  const loopTickCount = emitLoopTicks(
    ctx,
    loopsNeedingPulse,
    "watchdog-durable-loop-needs-attention",
  );

  if (recovery.staleActiveTasks.length > 0) {
    const reason = "watchdog-stale-active-review";
    emitOwnerRequested(ctx, config, reason, {
      staleActiveTasks: recovery.staleActiveTasks,
      ...loopTickDetails(loopTickCount),
    });
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (recovery.overdueOwnerActions.length > 0) {
    const reason = "watchdog-blocked-frontier-review";
    emitOwnerRequested(ctx, config, reason, {
      blockedTasks: sampledBlockedTasks,
      blockedCount: legacyBlockedTasks.length,
      conditionOwnedBlockedCount: recovery.conditionOwnedBlockedTaskIds.length,
      blockedOverdueCount: blockedSummary.overdueCount,
      blockedFutureWatchCount: blockedSummary.futureWatchCount,
      blockedMissingWatchCount: blockedSummary.missingWatchCount,
      blockedFrontierSummary: blockedSummary,
      overdueOwnerActions: recovery.overdueOwnerActions.slice(0, 20),
      overdueOwnerActionCount: recovery.overdueOwnerActions.length,
      reviewCount: recovery.reviewTasks.length,
      runnableBacklogTaskIds: recovery.runnableBacklogTaskIds.slice(0, 20),
      runnableBacklogCount: recovery.runnableBacklogTaskIds.length,
      ...loopTickDetails(loopTickCount),
      instruction:
        "A blocked wait passed its next-check/resume/fallback window without active/review recovery or handoff work. Treat this before ordinary review/backlog refill: verify the wait, create recovery/handoff/escalation work, refresh it with new evidence and next check, or close a stale holder.",
    });
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  const supervisorOwnedReviewTaskIds = new Set(
    supervisorTick.reviewsAvailable ? supervisorTick.correlatedTaskIds : [],
  );
  const overdueReviewTasks = recovery.reviewTasks.filter(
    (task) =>
      !supervisorOwnedReviewTaskIds.has(task.taskId) &&
      reviewSnapshotRecoveryDue(task),
  );
  if (overdueReviewTasks.length > 0) {
    const reason = "watchdog-review-pending";
    emitOwnerRequested(ctx, config, reason, {
      reviewTasks: overdueReviewTasks.slice(0, 20),
      reviewCount: overdueReviewTasks.length,
      ...loopTickDetails(loopTickCount),
    });
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (recovery.runnableBacklogTaskIds.length > 0) {
    const reason = "watchdog-runnable-backlog";
    emitOwnerRequested(ctx, config, reason, {
      runnableBacklogTaskIds: recovery.runnableBacklogTaskIds,
      runnableBacklogTreeUpdatedAt: recovery.runnableBacklogTreeUpdatedAt,
      runnableBacklogSnapshotAt: recovery.runnableBacklogSnapshotAt,
      ...loopTickDetails(loopTickCount),
    });
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (
    loopsNeedingAttention.length > 0 &&
    recovery.activeCount === 0 &&
    recovery.reviewTasks.length === 0
  ) {
    const reason = "watchdog-durable-loop-stall";
    emitStallReviewRequested(ctx, config, reason, {
      mode: "fallback",
      durableLoopLiveness: loopsNeedingAttention,
      blockedCount: recovery.blockedTasks.length,
      waitingBacklogCount: recovery.waitingBacklogTasks.length,
      ...loopTickDetails(loopTickCount),
      instruction:
        "Collect the project liveness packet and ask the owner agent to judge why durable loop state still has unfinished work but the normal frontier is not producing motion.",
    });
    return ctx.done(
      `Watchdog emitted project.stall.review.requested: ${reason}.`,
    );
  }

  if (
    (legacyBlockedTasks.length > 0 ||
      recovery.waitingBacklogTasks.length > 0) &&
    recovery.activeCount < config.maxConcurrent &&
    !futureOnlyBlockedFrontierNoop
  ) {
    const reason = "watchdog-blocked-frontier-review";
    const waitingBacklogDetails =
      recovery.waitingBacklogTasks.length > 0
        ? {
            waitingBacklogTasks: recovery.waitingBacklogTasks.slice(0, 20),
            waitingBacklogCount: recovery.waitingBacklogTasks.length,
          }
        : {};
    emitOwnerRequested(ctx, config, reason, {
      blockedTasks: sampledBlockedTasks,
      blockedCount: legacyBlockedTasks.length,
      conditionOwnedBlockedCount: recovery.conditionOwnedBlockedTaskIds.length,
      blockedOverdueCount: blockedSummary.overdueCount,
      blockedFutureWatchCount: blockedSummary.futureWatchCount,
      blockedMissingWatchCount: blockedSummary.missingWatchCount,
      blockedFrontierSummary: blockedSummary,
      overdueOwnerActions: recovery.overdueOwnerActions.slice(0, 20),
      overdueOwnerActionCount: recovery.overdueOwnerActions.length,
      ...loopTickDetails(loopTickCount),
      ...waitingBacklogDetails,
      instruction:
        "Review blocked and dependency-waiting tasks before treating underfilled capacity as idle. The blockedTasks sample is ordered by actionability: expired next-check/resume/fallback windows first, malformed waits next, future waits last. overdueOwnerActions names waits whose next-check/resume/fallback window passed without active/review recovery or handoff work; owner=human is not enough by itself. Push expired or malformed blockers toward done, rework, a visible problem task, or a refreshed exact external ask/resume condition; do not retry an unchanged blocked leaf.",
    });
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (futureOnlyBlockedFrontierNoop) {
    const earliestWatchAt =
      futureOnlyBlockedFrontierEarliestWatchAt ?? "<missing-future-watch>";
    if (
      recovery.activeCount > 0 &&
      recovery.activeCount < config.maxConcurrent
    ) {
      return ctx.done(
        `Watchdog skipped: ${recovery.activeCount} active task(s) still have running attempts, and the remaining frontier is entirely future-dated exact waits until ${earliestWatchAt}.`,
      );
    }
    if (recovery.activeCount === 0) {
      return ctx.done(
        `Watchdog skipped: blocked frontier is entirely future-dated exact waits until ${earliestWatchAt}.`,
      );
    }
  }

  if (conditionOwnedWaitNoop) {
    return ctx.done(
      `Watchdog skipped: ${recovery.conditionOwnedBlockedTaskIds.length} blocked task(s) are owned by open exact Conditions.`,
    );
  }

  if (recovery.activeCount > 0 && recovery.activeCount < config.maxConcurrent) {
    const reason = "watchdog-capacity-underfilled";
    emitOwnerRequested(ctx, config, reason, loopTickDetails(loopTickCount));
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (recovery.activeCount > 0) {
    return ctx.done(
      `Watchdog skipped: ${recovery.activeCount} active task(s) still have running attempts.`,
    );
  }

  if (
    recovery.reviewTasks.length > 0 &&
    overdueReviewTasks.length === 0 &&
    recovery.runnableBacklogTaskIds.length === 0 &&
    recovery.blockedTasks.length === 0 &&
    recovery.waitingBacklogTasks.length === 0
  ) {
    return ctx.done(
      `Watchdog skipped: ${recovery.reviewTasks.length} review task(s) are within the reviewer recovery window.`,
    );
  }

  if (recovery.needsRefill || recovery.hasOpenWork) {
    const reason = recovery.needsRefill
      ? "watchdog-settled-active-project-refill"
      : "watchdog-open-work-reconcile";
    emitOwnerRequested(ctx, config, reason, loopTickDetails(loopTickCount));
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  return ctx.done(
    "Watchdog skipped: project is closed and no open work remains.",
  );
}

if (import.meta.main) {
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nmaxAttempts: 3",
    agent: "aks-explorer",
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as unknown as WorkflowContext);
  console.log(JSON.stringify(result));
}
