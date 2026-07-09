/**
 * project-execution-watchdog — liveness observer for aks-rp-e2e.
 *
 * The planner owns task-tree decisions. This workflow only observes runtime
 * sessions and wakes app-ops when review is needed.
 */

import { existsSync } from "node:fs";
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
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  normalizeTaskTreeInPlace,
  withTreeLock,
  type TaskTreeConfig,
  type TaskTree,
} from "./lib/task-tree-store.ts";
import {
  listRunnableBacklogTaskIds,
  saveTaskTreeWithKanbanSnapshot,
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
import { syncProjectReadout } from "./lib/project-readout-sync.ts";
import {
  activeExternalRunWaitProgress,
  exactBlockedWaitStewardshipProgress,
} from "./lib/durable-loop-wait-stewardship.ts";
import { field, readJson, resolveAppDir } from "./lib/workflow-input.ts";

export const name = "project-execution-watchdog";
export const description =
  "Observe aks-rp-e2e task/session liveness and wake app-ops when review is needed.";

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
};

type ActiveTaskSnapshot = {
  taskId: string;
  currentAttemptId?: string;
  sessionId?: string;
  assignedAt?: string;
  workerStartedAt?: string;
  workflow?: string;
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
  resumeAt?: string;
  resumeCondition?: string;
  fallbackAt?: string;
  fallbackAction?: string;
  reasons?: string[];
};

type OverdueOwnerAction = {
  taskId: string;
  owner: string;
  watchAt: string;
  resumeAt?: string;
  fallbackAt?: string;
  fallbackAction?: string;
  recoveryRequired: string;
};

type TerminalSessionRecovery = {
  sessionId: string;
  summary: string;
  evidence: string[];
};

type WatchdogTreeSnapshot = {
  runnableBacklogTaskIds: string[];
  runnableBacklogTreeUpdatedAt?: string;
  runnableBacklogSnapshotAt: string;
  activeTasks: ActiveTaskSnapshot[];
  reviewTasks: OpenTaskSnapshot[];
  blockedTasks: OpenTaskSnapshot[];
  overdueOwnerActions: OverdueOwnerAction[];
  waitingBacklogTasks: OpenTaskSnapshot[];
  activeCount: number;
  hasOpenWork: boolean;
  needsRefill: boolean;
  durableLoopLiveness: DurableLoopLiveness[];
};

type TerminalPipelineWaitHarvest = {
  harvestedTaskIds: string[];
  checkedRunIds: string[];
  terminalRunIds: string[];
};

type TerminalPipelineWaitCandidate = {
  taskId: string;
  runId: string;
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

function taskSearchText(task: TaskTree["tasks"][string]): string {
  return JSON.stringify({
    id: task.id,
    goal: task.goal,
    inputs: task.inputs,
    outputs: task.outputs,
    acceptance: task.acceptance,
    conflict_scope: task.conflict_scope,
    depends_on: task.depends_on,
    context: task.context,
    blocker: task.blocker,
    trace: task.trace,
    result: task.result,
  }).toLowerCase();
}

function taskConflictScopes(task: TaskTree["tasks"][string]): string[] {
  return Array.isArray(task.conflict_scope)
    ? task.conflict_scope.filter(
        (scope): scope is string => typeof scope === "string",
      )
    : [];
}

function blockedOverdueScope(parentId: string | null | undefined): string {
  if (parentId === "aks-spec-verification-loop") return "spec-loop";
  if (parentId === "aks-feature-compact-loop") return "compact-loop";
  if (parentId === "project") return "project";
  return "";
}

function taskCoversBlockedOverdueWait(
  candidate: TaskTree["tasks"][string],
  blockedTask: OpenTaskSnapshot,
): boolean {
  if (candidate.id === blockedTask.taskId) return false;
  if (candidate.id === blockedTask.parentId) return false;
  const needle = blockedTask.taskId.toLowerCase();
  if (taskSearchText(candidate).includes(needle)) return true;

  const scope = blockedOverdueScope(blockedTask.parentId);
  if (!scope) return false;
  return taskConflictScopes(candidate).some(
    (conflictScope) =>
      conflictScope === `ops:blocked-overdue:${scope}` ||
      conflictScope.startsWith(`ops:blocked-overdue:${scope}:`),
  );
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

function runIdFromPipelineWaitTask(
  task: TaskTree["tasks"][string],
): string {
  const blocker = blockerRecord(task.blocker);
  const waitingFor =
    blocker && typeof blocker.waiting_for === "object"
      ? (blocker.waiting_for as Record<string, unknown>)
      : null;
  const context = taskRecord(task.context);
  const trace = taskRecord(task.trace);
  for (const source of [waitingFor, context, trace]) {
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

  const haystack = JSON.stringify({
    id: task.id,
    goal: task.goal,
    result: task.result,
    context: task.context,
    blocker: task.blocker,
    trace: task.trace,
  });
  const match =
    haystack.match(/\b(?:ado run|ado-run|buildId=|pipeline run|run)\s*[`"']?(\d{6,})\b/i) ??
    haystack.match(/\b(?:adoRunId|runId|workflowRunId)["':\s]+(\d{6,})\b/i);
  return match?.[1] ?? "";
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
  return snapshot === null
    ? []
    : leafTasksByStatus(snapshot, "blocked")
        .concat(leafTasksByStatus(snapshot, "waiting"))
        .map((task) => ({
          taskId: task.id,
          runId: runIdFromPipelineWaitTask(task),
        }))
        .filter((candidate) => candidate.runId)
        .slice(0, limit);
}

function harvestTerminalPipelineWaits(input: {
  config: TaskTreeConfig;
  projectDir: string;
  client: PipelineClient;
  limit?: number;
}): TerminalPipelineWaitHarvest {
  const candidates = terminalPipelineWaitCandidates(
    input.config,
    input.limit ?? 50,
  );

  const checkedRunIds: string[] = [];
  const terminalByTaskId = new Map<string, PipelineRun>();
  for (const candidate of candidates) {
    checkedRunIds.push(candidate.runId);
    const run = getWorkflowRun({
      client: input.client,
      projectDir: input.projectDir,
      runId: candidate.runId,
    });
    if (run?.status === "completed") {
      terminalByTaskId.set(candidate.taskId, run);
    }
  }

  const harvestedTaskIds: string[] = [];
  const terminalRunIds: string[] = [];
  if (terminalByTaskId.size === 0) {
    return { harvestedTaskIds, checkedRunIds, terminalRunIds };
  }

  withTreeLock(input.config, () => {
    const tree = readTree(input.config.treePath);
    if (!tree) return;
    const now = new Date().toISOString();
    for (const candidate of candidates) {
      const run = terminalByTaskId.get(candidate.taskId);
      if (!run) continue;
      const task = tree.tasks[candidate.taskId];
      if (!task) continue;
      const state = task.status ?? task.state ?? "backlog";
      if (state !== "blocked" && state !== "waiting") continue;
      if (runIdFromPipelineWaitTask(task) !== candidate.runId) continue;
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
    if (harvestedTaskIds.length > 0) {
      saveTaskTreeWithKanbanSnapshot(input.config, tree);
    }
  });

  return { harvestedTaskIds, checkedRunIds, terminalRunIds };
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
          ...(task.resumeAt ? { resumeAt: task.resumeAt } : {}),
          ...(task.fallbackAt ? { fallbackAt: task.fallbackAt } : {}),
          ...(task.fallbackAction
            ? { fallbackAction: task.fallbackAction }
            : {}),
          recoveryRequired:
            watch.kind === "resume"
              ? "Resume window passed without active/review recovery work."
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

function sessionRestartReason(
  dbPath: string,
  sessionId: string,
  staleNoActivityMs: number,
): string | null {
  if (!existsSync(dbPath)) return "session-not-running";
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .query(
        `
      select status, outcome, opCount, startedAt, lastActivityAt
      from sessions
      where sessionId = ?
      limit 1
    `,
      )
      .get(sessionId) as Record<string, unknown> | null;
    return sessionRestartReasonFromRow(row, staleNoActivityMs);
  } catch {
    const row = db
      .query(
        `
      select status
      from sessions
      where sessionId = ?
      limit 1
    `,
      )
      .get(sessionId) as Record<string, unknown> | null;
    return sessionRestartReasonFromRow(row, staleNoActivityMs);
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
    try {
      const endRows = db
        .query(
          `
          select event_type, data
          from events
          where data like ?
            and event_type in ('session.end', 'session.receipt')
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
        if (
          !summary.startsWith("Recovered completed worker session") &&
          row.event_type !== "session.receipt"
        ) {
          continue;
        }
        if (typeof parsed.summary === "string" && parsed.summary.trim()) {
          summary = parsed.summary.trim();
        }
        const refs = Array.isArray(parsed.evidence) ? parsed.evidence : [];
        for (const ref of refs) {
          if (
            ref &&
            typeof ref === "object" &&
            !Array.isArray(ref) &&
            typeof (ref as Record<string, unknown>).ref === "string"
          ) {
            evidence.push((ref as Record<string, string>).ref);
          }
        }
      }
    } catch {
      // Missing events table or malformed historical payloads should not block
      // recovering the task state from the terminal session row.
    }

    return { sessionId, summary, evidence: [...new Set(evidence)] };
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
    if (!recovery) continue;
    const completion = completeStartedAttempt(treeConfig, {
      taskId: task.taskId,
      attemptId: task.currentAttemptId,
      claim: "done",
      summary: recovery.summary,
      evidence: recovery.evidence,
    });
    if (!completion.ok) continue;
    emitTaskCompleted(ctx, completion.task, {
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

function emitOwnerRequested(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  reason: string,
  details: Record<string, unknown> = {},
): void {
  try {
    ctx.dispatchEvent("project.planning.requested", {
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
      const blockedOwnerActions = overdueOwnerActions(tree, blockedTasks);
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
  const recoveredTerminalTasks = recoverTerminalDoneActiveTasks(
    ctx,
    config,
    sharedConfig,
    snapshot.activeTasks,
  );
  if (recoveredTerminalTasks.length > 0) {
    return ctx.done(
      `Watchdog recovered completed active task(s): ${recoveredTerminalTasks.join(", ")}.`,
    );
  }
  const pipelineWaitCandidates = terminalPipelineWaitCandidates(sharedConfig);
  const pipelineAccess =
    pipelineWaitCandidates.length > 0
      ? resolvePipelineClient(config.projectDir)
      : { client: null };
  const terminalPipelineWaitHarvest = pipelineAccess.client
    ? harvestTerminalPipelineWaits({
        config: sharedConfig,
        projectDir: config.projectDir,
        client: pipelineAccess.client,
      })
    : { harvestedTaskIds: [], checkedRunIds: [], terminalRunIds: [] };
  if (terminalPipelineWaitHarvest.harvestedTaskIds.length > 0) {
    return ctx.done(
      `Watchdog moved terminal Azure DevOps wait(s) to review: ${terminalPipelineWaitHarvest.harvestedTaskIds.join(", ")}.`,
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
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.overdueOwnerActions.length > 0) {
    const reason = "watchdog-blocked-frontier-review";
    const sampledBlockedTasks = recovery.blockedTasks.slice(0, 20);
    const blockedSummary = blockedFrontierSummary(
      recovery.blockedTasks,
      sampledBlockedTasks,
    );
    emitOwnerRequested(ctx, config, reason, {
      blockedTasks: sampledBlockedTasks,
      blockedCount: recovery.blockedTasks.length,
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
        "A blocked wait passed its resume/fallback window without active/review recovery or handoff work. Treat this before ordinary review/backlog refill: verify the wait, create recovery/handoff/escalation work, refresh it with new evidence and next check, or close a stale holder.",
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.reviewTasks.length > 0) {
    const reason = "watchdog-review-pending";
    emitOwnerRequested(ctx, config, reason, {
      reviewTasks: recovery.reviewTasks.slice(0, 20),
      reviewCount: recovery.reviewTasks.length,
      ...loopTickDetails(loopTickCount),
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.runnableBacklogTaskIds.length > 0) {
    const reason = "watchdog-runnable-backlog";
    emitOwnerRequested(ctx, config, reason, {
      runnableBacklogTaskIds: recovery.runnableBacklogTaskIds,
      runnableBacklogTreeUpdatedAt: recovery.runnableBacklogTreeUpdatedAt,
      runnableBacklogSnapshotAt: recovery.runnableBacklogSnapshotAt,
      ...loopTickDetails(loopTickCount),
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
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
    (recovery.blockedTasks.length > 0 ||
      recovery.waitingBacklogTasks.length > 0) &&
    recovery.activeCount < config.maxConcurrent
  ) {
    const reason = "watchdog-blocked-frontier-review";
    const sampledBlockedTasks = recovery.blockedTasks.slice(0, 20);
    const blockedSummary = blockedFrontierSummary(
      recovery.blockedTasks,
      sampledBlockedTasks,
    );
    const waitingBacklogDetails =
      recovery.waitingBacklogTasks.length > 0
        ? {
            waitingBacklogTasks: recovery.waitingBacklogTasks.slice(0, 20),
            waitingBacklogCount: recovery.waitingBacklogTasks.length,
          }
        : {};
    emitOwnerRequested(ctx, config, reason, {
      blockedTasks: sampledBlockedTasks,
      blockedCount: recovery.blockedTasks.length,
      blockedOverdueCount: blockedSummary.overdueCount,
      blockedFutureWatchCount: blockedSummary.futureWatchCount,
      blockedMissingWatchCount: blockedSummary.missingWatchCount,
      blockedFrontierSummary: blockedSummary,
      overdueOwnerActions: recovery.overdueOwnerActions.slice(0, 20),
      overdueOwnerActionCount: recovery.overdueOwnerActions.length,
      ...loopTickDetails(loopTickCount),
      ...waitingBacklogDetails,
      instruction:
        "Review blocked and dependency-waiting tasks before treating underfilled capacity as idle. The blockedTasks sample is ordered by actionability: expired resume/fallback windows first, malformed waits next, future waits last. overdueOwnerActions names waits whose resume/fallback window passed without active/review recovery or handoff work; owner=human is not enough by itself. Push expired or malformed blockers toward done, rework, a visible problem task, or a refreshed exact external ask/resume condition; do not retry an unchanged blocked leaf.",
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.activeCount > 0 && recovery.activeCount < config.maxConcurrent) {
    const reason = "watchdog-capacity-underfilled";
    emitOwnerRequested(ctx, config, reason, loopTickDetails(loopTickCount));
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.activeCount > 0) {
    return ctx.done(
      `Watchdog skipped: ${recovery.activeCount} active task(s) still have running attempts.`,
    );
  }

  if (recovery.needsRefill || recovery.hasOpenWork) {
    const reason = recovery.needsRefill
      ? "watchdog-settled-active-project-refill"
      : "watchdog-open-work-reconcile";
    emitOwnerRequested(ctx, config, reason, loopTickDetails(loopTickCount));
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
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
