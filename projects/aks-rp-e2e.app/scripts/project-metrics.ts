#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import { projectRuntimePaths, readTaskState } from "@may-agent/sdk/legacy";
import {
  parseTriggerEvent,
  triggerString,
} from "../agents/app-ops/workflows/lib/workflow-input.ts";
import { loadSpecs } from "../agents/app-ops/workflows/lib/spec-loop-store.ts";

type TaskNode = Record<string, any>;
type TaskAttempt = {
  metadata?: { id?: string };
  taskId?: string;
  state?: string;
  handler?: string;
  startedAt?: string;
  sessionId?: string;
  lease?: { expiresAt?: string; sessionId?: string };
};
type TaskTree = {
  root_task_id?: string;
  active_task_ids?: string[];
  tasks?: Record<string, TaskNode>;
  attempts?: Record<string, TaskAttempt>;
  [key: string]: any;
};

type TaskTreeConfigLike = {
  appDir: string;
  projectDir: string;
  worker: string;
  maxConcurrent: number;
  statePath: string;
  journalPath: string;
  treePath: string;
};

function taskTreeConfig(input: {
  appDir: string;
  projectDir: string;
  worker: string;
  maxConcurrent: number;
}): TaskTreeConfigLike {
  const paths = projectRuntimePaths(input.appDir);
  return {
    ...input,
    statePath: paths.taskStatePath,
    journalPath: paths.journalPath,
    treePath: paths.taskTreePath,
  };
}

function readTaskTree(config: TaskTreeConfigLike): TaskTree {
  return readTaskState(config as any) as TaskTree;
}

function readTaskTreeProjection(config: TaskTreeConfigLike): TaskTree {
  return JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
}

function projectionLeafEntries(tree: TaskTree): Array<[string, TaskNode]> {
  return Object.entries(tree.tasks ?? {}).filter(
    ([taskId, task]) =>
      taskId !== tree.root_task_id &&
      !String(taskId).startsWith("runtime/") &&
      Array.isArray(task?.children) &&
      task.children.length === 0,
  ) as Array<[string, TaskNode]>;
}

function projectionPhase(task: TaskNode): string {
  return String(task?.phase ?? task?.state ?? task?.status ?? "");
}

export function liveTaskMetricFrontier(tree: TaskTree): {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  readySatisfiedWaitHolders: string[];
} {
  const leaves = projectionLeafEntries(tree);
  const leafIds = new Set(leaves.map(([taskId]) => taskId));
  const active = [
    ...new Set([
      ...((tree.active_task_ids ?? []) as string[]).filter((taskId) => {
        if (!leafIds.has(taskId) || String(taskId).startsWith("runtime/")) {
          return false;
        }
        const task = tree.tasks?.[taskId];
        return ["running", "active"].includes(projectionPhase(task));
      }),
      ...leaves
        .filter(([, task]) =>
          ["running", "active"].includes(projectionPhase(task)),
        )
        .map(([taskId]) => taskId),
    ]),
  ].sort();
  const review = leaves
    .filter(([, task]) =>
      ["attention", "review"].includes(projectionPhase(task)),
    )
    .map(([taskId]) => taskId)
    .sort();
  const waiting = leaves
    .filter(([, task]) => projectionPhase(task) === "waiting")
    .map(([taskId]) => taskId)
    .sort();
  const readyLeaves = leaves.filter(
    ([, task]) =>
      String(task?.readiness?.state ?? "") === "ready" &&
      String(task?.readiness?.reason ?? "") !== "dependency-blocked",
  );
  const runnable = readyLeaves
    .filter(([, task]) => projectionPhase(task) === "pending")
    .map(([taskId]) => taskId)
    .sort();
  const readySatisfiedWaitHolders = readyLeaves
    .filter(([, task]) => projectionPhase(task) === "waiting")
    .map(([taskId]) => taskId)
    .sort();
  return { active, review, waiting, runnable, readySatisfiedWaitHolders };
}

function listRunnableBacklogTaskIds(
  config: TaskTreeConfigLike,
  limit = 200,
): string[] {
  const tree = readTaskTreeProjection(config);
  return liveTaskMetricFrontier(tree).runnable.slice(0, limit);
}

export function activeTaskAssignments(tree: TaskTree): Array<{
  taskId: string;
  attemptId: string;
  assignedAt: string;
  sessionId?: string;
}> {
  return Object.values(tree.attempts ?? {}).flatMap((attempt) => {
    const taskId =
      typeof attempt.taskId === "string" ? attempt.taskId.trim() : "";
    const attemptId =
      typeof attempt.metadata?.id === "string"
        ? attempt.metadata.id.trim()
        : "";
    const assignedAt =
      typeof attempt.startedAt === "string" ? attempt.startedAt.trim() : "";
    if (attempt.state !== "running" || !taskId || !attemptId || !assignedAt) {
      return [];
    }
    const sessionId =
      typeof attempt.sessionId === "string" ? attempt.sessionId.trim() : "";
    return [
      { taskId, attemptId, assignedAt, ...(sessionId ? { sessionId } : {}) },
    ];
  });
}

function peekTaskAssignments(
  config: TaskTreeConfigLike,
): ReturnType<typeof activeTaskAssignments> {
  return activeTaskAssignments(readTaskTree(config));
}

function planningPacket(config: TaskTreeConfigLike): Record<string, unknown> {
  const tree = readTaskTree(config);
  const leaves = Object.entries(tree.tasks ?? {}).filter(
    ([taskId, task]) =>
      taskId !== tree.root_task_id &&
      !String(taskId).startsWith("runtime/") &&
      Array.isArray(task?.children) &&
      task.children.length === 0,
  );
  const phaseOf = (task) =>
    String((task && (task.phase ?? task.state ?? task.status ?? "")) || "");
  const waiting = leaves
    .filter(([, task]) => phaseOf(task) === "waiting")
    .map(([taskId]) => taskId);
  const active = [
    ...new Set([
      ...(tree.active_task_ids ?? []),
      ...leaves
        .filter(([, task]) => ["running", "active"].includes(phaseOf(task)))
        .map(([taskId]) => taskId),
    ]),
  ];
  const review = leaves
    .filter(([, task]) => ["attention", "review"].includes(phaseOf(task)))
    .map(([taskId]) => taskId);
  const parentGroups = new Map();
  for (const [taskId, task] of leaves) {
    if (!waiting.includes(taskId)) continue;
    const parentId = typeof task.parent_id === "string" ? task.parent_id : "";
    if (!parentId) continue;
    const entry = parentGroups.get(parentId) || {
      parent_id: parentId,
      blocked_leaf_count: 0,
      sample_blocked_leaf_ids: [],
    };
    entry.blocked_leaf_count += 1;
    if (entry.sample_blocked_leaf_ids.length < 5)
      entry.sample_blocked_leaf_ids.push(taskId);
    parentGroups.set(parentId, entry);
  }
  return {
    blocked_frontier_summary: {
      blocked_leaf_count: waiting.length,
      parent_groups: [...parentGroups.values()],
      repeated_blocker_groups: [],
    },
    blocked_action_warnings: [],
    frontier: { active, review },
  };
}

function buildProjectSnapshotV2(input: {
  tree: TaskTree;
  nowMs: number;
  projectId: string;
}): {
  frontier: {
    active: string[];
    review: string[];
    blocked: string[];
    counts: {
      active: number;
      review: number;
      blocked: number;
      runnable: number;
    };
  };
  conditions: Array<{
    source: string;
    subject: { id: string; revision: number };
  }>;
} {
  const tree = input.tree;
  const leaves = Object.entries(tree.tasks ?? {}).filter(
    ([taskId, task]) =>
      taskId !== tree.root_task_id &&
      !String(taskId).startsWith("runtime/") &&
      Array.isArray(task?.children) &&
      task.children.length === 0,
  );
  const phaseOf = (task: Record<string, any>) =>
    String(task?.phase ?? task?.state ?? task?.status ?? "");
  const active = [
    ...new Set([
      ...(tree.active_task_ids ?? []),
      ...leaves
        .filter(([, task]) => ["running", "active"].includes(phaseOf(task)))
        .map(([taskId]) => taskId),
    ]),
  ];
  const review = leaves
    .filter(([, task]) => ["attention", "review"].includes(phaseOf(task)))
    .map(([taskId]) => taskId);
  const blocked = leaves
    .filter(([, task]) => phaseOf(task) === "waiting")
    .map(([taskId]) => taskId);
  const runnable = leaves
    .filter(
      ([, task]) =>
        String(task?.readiness?.state ?? "") === "ready" &&
        String(task?.readiness?.reason ?? "") !== "dependency-blocked",
    )
    .map(([taskId]) => taskId);
  return {
    frontier: {
      active,
      review,
      blocked,
      counts: {
        active: active.length,
        review: review.length,
        blocked: blocked.length,
        runnable: runnable.length,
      },
    },
    conditions: [],
  };
}

function specStateSelfRepresentsExactFrontier(
  spec: Record<string, unknown>,
): boolean {
  return (
    spec?.terminalDisposition === true ||
    typeof spec?.resumeCondition === "string" ||
    typeof spec?.successorDisposition === "string"
  );
}

type ModelStatus = {
  features?: {
    total?: number;
    byStatus?: Record<string, number>;
  };
  paths?: {
    total?: number;
    byStatus?: Record<string, number>;
  };
};

type RunResult = {
  status?: string;
  mode?: string;
  dryRun?: boolean;
  startedAt?: string;
  completedAt?: string;
  endedAt?: string;
  probeEvidence?: {
    mode?: string;
    status?: string;
  } | null;
};

type PlannerRun = {
  kind?: string;
  status?: string;
  ran_agent?: boolean;
  steps?: string[];
  ts?: string;
  durationMs?: number;
  result?: string;
};

type SpecIndexEntry = {
  id?: string;
  status?: string;
  specState?: string;
  terminalDisposition?: boolean;
};

type SpecMetrics = {
  total: number;
  verified: number;
  reviewedException: number;
  unverified: number;
  failed: number;
  blocked: number;
  ready: number;
  draft: number;
  unknown: number;
};

export type MetricSampleOutput = {
  value: number;
  sampleSize?: number;
  measuredAt?: number;
  note?: unknown;
  treePath?: string;
};

type BlockedFrontierParentGroupSummary = {
  parentId: string;
  blockedLeafCount: number;
  sampleBlockedLeafIds: string[];
};

type BlockedFrontierActionability = {
  blockedLeafCount: number;
  durableExactHolderCount: number;
  actionableCount: number;
  actionableWarningTaskIds: string[];
  repeatedBlockerGroupKeys: string[];
  parentGroups: BlockedFrontierParentGroupSummary[];
  motionStarved: boolean;
};

type ApprovalGatedBlockedDisposition = {
  covered: boolean;
  focusTaskIds: string[];
  governingWaitTaskIds: string[];
};

type StaleActiveTaskInfo = {
  taskId: string;
  sessionId: string | null;
  restartReason: string;
};

type StaleWorkflowRunInfo = {
  runId: string;
  workflow: string;
  restartReason: string;
};

type AssignmentStateMismatchInfo = {
  correlationKey: string;
  taskId: string;
  attemptId: string | null;
  taskState: string | null;
  reason: "task-missing" | "task-not-active";
  sessionId: string | null;
  sessionStatus: string | null;
  sessionOutcome: string | null;
  sessionStartedAt: number | null;
  sessionLastActivityAt: number | null;
  sessionEndedAt: number | null;
};

type SpecLoopState = {
  loopTaskId?: string;
  specs?: Record<
    string,
    {
      status?: string;
      attempts?: number;
      lastRunUrl?: string | null;
      taskId?: string | null;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      heartbeatAt?: string | null;
      successorDisposition?: string | null;
      resumeCondition?: string | null;
      review?: Record<string, unknown> | null;
    }
  >;
};

type FeatureCompactLoopState = {
  features?: Record<
    string,
    {
      status?: string;
      taskId?: string | null;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
      activeWorkflowRunId?: string | null;
      heartbeatAt?: string | null;
    }
  >;
};

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const effectiveAppDir = resolve(process.env.AKS_RP_E2E_APP_DIR ?? appDir);
const projectDir = resolve(
  process.env.PROJECT_DIR ?? join(effectiveAppDir, "..", "aks-rp-e2e"),
);
const stateDbPath = resolve(
  process.env.MAY_DB_PATH ??
    join(effectiveAppDir, "..", "..", ".state", "may.db"),
);
const sessionsDirPath = resolve(
  process.env.MAY_SESSIONS_DIR ??
    join(effectiveAppDir, "..", "..", ".state", "sessions"),
);
const desiredParallelism = Number.parseInt(
  process.env.AKS_RP_E2E_DESIRED_PARALLELISM ?? "1",
  10,
);
const staleActiveNoActivityMs = Number.parseInt(
  process.env.AKS_RP_E2E_STALE_ACTIVE_MS ?? "600000",
  10,
);
const sessionStartGraceMs = Number.parseInt(
  process.env.AKS_RP_E2E_SESSION_START_GRACE_MS ?? "300000",
  10,
);
// handler.workflow_dispatched(status=started) is emitted before runWorkflowDirect()
// inserts the workflow_runs row. Recent AKS reproductions showed healthy queue
// latency of ~8.5-10.2 minutes before the first workflow start became visible,
// so this grace covers queued handoff latency without suppressing genuinely
// stale unconsumed assignments indefinitely.
const workflowDispatchStartGraceMs = Number.parseInt(
  process.env.AKS_RP_E2E_WORKFLOW_DISPATCH_START_GRACE_MS ?? "900000",
  10,
);
const terminalSessionCompletionGraceMs = Number.parseInt(
  process.env.AKS_RP_E2E_TERMINAL_SESSION_GRACE_MS ?? "600000",
  10,
);
const now = Date.now();
const dayAgo = now - 24 * 60 * 60 * 1000;

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

function listFiles(
  root: string,
  predicate: (path: string) => boolean,
): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const path = join(dir, entry);
      let stat;
      try {
        stat = statSync(path);
      } catch {
        continue;
      }
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile() && predicate(path)) out.push(path);
    }
  };
  visit(root);
  return out;
}

function timestampOf(task: TaskNode): number | null {
  const taskRecord = task as TaskNode & { updated_at?: string };
  const candidates = [
    taskRecord.updated_at,
    typeof task.trace?.rolled_up_at === "string"
      ? task.trace.rolled_up_at
      : undefined,
    typeof task.trace?.completed_at === "string"
      ? task.trace.completed_at
      : undefined,
    typeof task.trace?.created_at === "string"
      ? task.trace.created_at
      : undefined,
  ].filter((value): value is string => Boolean(value));
  for (const value of candidates) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function runtimeTaskTreeConfig() {
  return taskTreeConfig({
    appDir: effectiveAppDir,
    projectDir,
    worker: "aks-explorer",
    maxConcurrent: desiredParallelism,
  });
}

function loadTaskTree(): TaskTree {
  return readTaskTree(runtimeTaskTreeConfig());
}

function taskState(task: TaskNode): string {
  const raw = task.state ?? task.status ?? "backlog";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  if (raw === "waiting") return "blocked";
  if (raw === "attention") return "review";
  if (raw === "running") return "active";
  return raw;
}

function isLeaf(task: TaskNode): boolean {
  return (task.children ?? []).length === 0;
}

function runtimeTreeTaskIds(tree: TaskTree): Set<string> {
  const taskMap = tree.tasks ?? {};
  const rootId =
    typeof tree.root_task_id === "string" ? tree.root_task_id.trim() : "";
  const taskIds = Object.values(taskMap)
    .map((task) => (typeof task.id === "string" ? task.id.trim() : ""))
    .filter(Boolean);
  if (!rootId || !taskMap[rootId]) {
    return new Set(taskIds);
  }

  const childrenByParent = new Map<string, string[]>();
  for (const task of Object.values(taskMap)) {
    const parentId =
      typeof task.parent_id === "string" ? task.parent_id.trim() : "";
    const taskId = typeof task.id === "string" ? task.id.trim() : "";
    if (!parentId || !taskId) continue;
    const existing = childrenByParent.get(parentId) ?? [];
    existing.push(taskId);
    childrenByParent.set(parentId, existing);
  }

  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId || seen.has(taskId) || !taskMap[taskId]) continue;
    seen.add(taskId);
    const task = taskMap[taskId];
    for (const childId of task.children ?? []) {
      if (typeof childId === "string" && childId.trim()) {
        queue.push(childId.trim());
      }
    }
    for (const childId of childrenByParent.get(taskId) ?? []) {
      queue.push(childId);
    }
  }
  return seen;
}

function runtimeTreeTasks(tree: TaskTree): TaskNode[] {
  const taskMap = tree.tasks ?? {};
  const connectedTaskIds = runtimeTreeTaskIds(tree);
  return Object.values(taskMap).filter((task) => {
    const taskId = typeof task.id === "string" ? task.id.trim() : "";
    return taskId ? connectedTaskIds.has(taskId) : false;
  });
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringRecordField(
  record: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function objectRecordField(
  record: Record<string, unknown> | null,
  keys: string[],
): Record<string, unknown> | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    const nested = recordValue(value);
    if (nested) return nested;
  }
  return null;
}

function numberRecordField(
  record: Record<string, unknown> | null,
  keys: string[],
): number {
  if (!record) return 0;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function stringArrayField(
  record: Record<string, unknown> | null,
  key: string,
): string[] {
  if (!record || !Array.isArray(record[key])) return [];
  return (record[key] as unknown[])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

export function representedWaitCoveredFrontierDisposition(input: {
  projectClosed: boolean;
  runnable: number;
  healthyActive: number;
  review: number;
  openGaps: number;
  loopUnrepresentedCount: number;
  loopAuthorityObservationCount: number;
  waitingTaskIds: string[];
}): { covered: boolean; note?: string } {
  const waitingTaskIds = input.waitingTaskIds.filter(
    (taskId) => typeof taskId === "string" && taskId.trim().length > 0,
  );
  const covered =
    !input.projectClosed &&
    input.runnable === 0 &&
    input.healthyActive === 0 &&
    input.review === 0 &&
    input.openGaps > 0 &&
    input.loopUnrepresentedCount === 0 &&
    input.loopAuthorityObservationCount > 0 &&
    waitingTaskIds.length > 0;
  if (!covered) return { covered: false };
  return {
    covered: true,
    note: JSON.stringify({
      disposition: "represented-wait-covered-frontier",
      waitingTaskCount: waitingTaskIds.length,
      waitingTaskIds: waitingTaskIds.slice(0, 10),
      openGapCount: input.openGaps,
      loopUnrepresentedCount: input.loopUnrepresentedCount,
      loopAuthorityObservationCount: input.loopAuthorityObservationCount,
    }),
  };
}

function loopUnrepresentedRecordDetails(): {
  value: number;
  authorityObservationCount: number;
  taskIds: string[];
  records: Record<string, unknown>[];
} {
  const tree = loadTaskTree();
  const projectionTree = readTaskTreeProjection(runtimeTaskTreeConfig());
  let value = 0;
  let authorityObservationCount = 0;
  const taskIds: string[] = [];
  const records: Record<string, unknown>[] = [];
  const authorityTaskIds = new Set<string>();
  for (const task of Object.values(tree.tasks ?? {})) {
    const context = recordValue(task.context);
    const progress = objectRecordField(context, ["workflowProgress"]);
    const rawCount = progress?.unrepresentedNonTerminalCount;
    const count =
      typeof rawCount === "number" && Number.isFinite(rawCount)
        ? rawCount
        : typeof rawCount === "string" && rawCount.trim()
          ? Number.parseInt(rawCount.trim(), 10)
          : Number.NaN;
    if (!Number.isFinite(count)) continue;
    authorityObservationCount += 1;
    if (typeof task.id === "string" && task.id.trim()) {
      authorityTaskIds.add(task.id.trim());
    }
    if (count <= 0) continue;
    value += count;
    if (typeof task.id === "string" && task.id.trim()) {
      taskIds.push(task.id.trim());
      records.push({
        taskId: task.id.trim(),
        unrepresentedNonTerminalCount: count,
        unrepresentedNonTerminalFeatureKeys: stringArrayField(
          progress,
          "unrepresentedNonTerminalFeatureKeys",
        ),
        unrepresentedBlockedFeatureKeys: stringArrayField(
          progress,
          "unrepresentedBlockedFeatureKeys",
        ),
        unrepresentedErrorFeatureKeys: stringArrayField(
          progress,
          "unrepresentedErrorFeatureKeys",
        ),
        unrepresentedRunningFeatureKeys: stringArrayField(
          progress,
          "unrepresentedRunningFeatureKeys",
        ),
        unrepresentedPendingFeatureKeys: stringArrayField(
          progress,
          "unrepresentedPendingFeatureKeys",
        ),
      });
    }
  }

  const specLoopState = loadSpecLoopState();
  const specLoopTaskId = specLoopState.loopTaskId || "aks-spec-verification-loop";
  if (!authorityTaskIds.has(specLoopTaskId)) {
    const fallback = specLoopRepresentationAuthority({
      tree: projectionTree,
      state: specLoopState,
    });
    if (fallback.authorityObserved) {
      authorityObservationCount += 1;
      value += fallback.unrepresentedNonTerminalCount;
      taskIds.push(specLoopTaskId);
      records.push({
        taskId: specLoopTaskId,
        source: "spec-loop-state-fallback",
        nonTerminalSpecCount: fallback.nonTerminalSpecCount,
        representedSpecCount: fallback.representedSpecIds.length,
        unrepresentedNonTerminalCount: fallback.unrepresentedNonTerminalCount,
        waitingTaskIds: fallback.waitingTaskIds,
        unrepresentedSpecIds: fallback.unrepresentedSpecIds,
      });
    }
  }

  return { value, authorityObservationCount, taskIds, records };
}

function blockedOverdueScope(parentId: unknown): string {
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

function blockedWaitLineageKeys(task: TaskNode): string[] {
  const blocker = recordValue(task.blocker);
  const waitingFor = recordValue(blocker.waiting_for);
  return [
    stringRecordField(waitingFor, ["pathId", "path_id"]),
    stringRecordField(waitingFor, ["approvalPathId", "approval_path_id"]),
  ].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function blockedWaitSpecConflictScopes(task: TaskNode): string[] {
  const blocker = recordValue(task.blocker);
  const waitingFor = recordValue(blocker.waiting_for);
  const scopes = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    scopes.add(trimmed.startsWith("spec:") ? trimmed : `spec:${trimmed}`);
  };

  collect(stringRecordField(waitingFor, ["specId", "spec_id"]));
  const specIds = waitingFor.specIds ?? waitingFor.spec_ids;
  if (Array.isArray(specIds)) {
    for (const specId of specIds) collect(specId);
  }
  return [...scopes];
}

function taskCoversBlockedOverdueWait(
  candidate: TaskNode,
  blockedTask: TaskNode,
): boolean {
  if (candidate.id === blockedTask.id) return false;
  if (
    typeof candidate.id === "string" &&
    typeof blockedTask.parent_id === "string" &&
    candidate.id === blockedTask.parent_id
  ) {
    return false;
  }
  const blockedTaskId =
    typeof blockedTask.id === "string" ? blockedTask.id.trim() : "";
  if (
    blockedTaskId &&
    structuredBlockedTaskIds(candidate).includes(blockedTaskId)
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

  const scope = blockedOverdueScope(blockedTask.parent_id);
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
      blockedTaskId &&
      normalizedScope === `ops:blocked-overdue:project:${blockedTaskId}`
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

function isWorkerExecutableBacklogLeaf(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  if (taskState(task) !== "backlog") return false;
  if (
    task.kind === "frontier_replan" ||
    task.kind === "domain_planner" ||
    task.kind === "loop_task" ||
    task.kind === "work" ||
    task.kind === "focus_plan"
  )
    return false;
  return true;
}

function archivedCompletedTaskIds24h(): Set<string> {
  const archiveDir = join(effectiveAppDir, ".state", "tasks", "archive");
  const completed = new Set<string>();
  for (const path of listFiles(
    archiveDir,
    (candidate) =>
      extname(candidate) === ".json" && candidate.includes("done-leaves-"),
  )) {
    const archive = readJson<{ tasks?: TaskNode[] }>(path, {});
    for (const [index, task] of (archive.tasks ?? []).entries()) {
      if (taskState(task) !== "done") continue;
      const ts = timestampOf(task);
      if (ts == null || ts < dayAgo) continue;
      completed.add(task.id ?? `${path}#${index}`);
    }
  }
  return completed;
}

function blockedFrontierActionability(): BlockedFrontierActionability {
  try {
    const packet = planningPacket(runtimeTaskTreeConfig()) as {
      blocked_frontier_summary?: {
        blocked_leaf_count?: unknown;
        parent_groups?: Array<{
          parent_id?: unknown;
          blocked_leaf_count?: unknown;
          sample_blocked_leaf_ids?: unknown;
        }>;
        repeated_blocker_groups?: Array<{
          blocker_group_key?: unknown;
          key?: unknown;
        }>;
      };
      blocked_action_warnings?: Array<{
        taskId?: unknown;
      }>;
      frontier?: {
        active?: unknown;
        review?: unknown;
      };
    };
    const summary = packet.blocked_frontier_summary;
    const warnings = Array.isArray(packet.blocked_action_warnings)
      ? packet.blocked_action_warnings
      : [];
    const blockedLeafCount =
      typeof summary?.blocked_leaf_count === "number" &&
      Number.isFinite(summary.blocked_leaf_count)
        ? summary.blocked_leaf_count
        : 0;
    const parentGroups = Array.isArray(summary?.parent_groups)
      ? summary.parent_groups
          .map((group) => ({
            parentId:
              typeof group.parent_id === "string" ? group.parent_id : "",
            blockedLeafCount:
              typeof group.blocked_leaf_count === "number" &&
              Number.isFinite(group.blocked_leaf_count)
                ? group.blocked_leaf_count
                : 0,
            sampleBlockedLeafIds: Array.isArray(group.sample_blocked_leaf_ids)
              ? group.sample_blocked_leaf_ids.filter(
                  (value): value is string => typeof value === "string",
                )
              : [],
          }))
          .filter((group) => group.parentId)
      : [];
    const actionableWarningTaskIds = warnings
      .map((warning) =>
        typeof warning.taskId === "string" ? warning.taskId.trim() : "",
      )
      .filter(Boolean);
    const repeatedBlockerGroupKeys = Array.isArray(
      summary?.repeated_blocker_groups,
    )
      ? summary.repeated_blocker_groups
          .map((group) => {
            if (typeof group.blocker_group_key === "string") {
              return group.blocker_group_key.trim();
            }
            if (typeof group.key === "string") return group.key.trim();
            return "";
          })
          .filter(Boolean)
      : [];
    const actionableCount = Math.max(
      actionableWarningTaskIds.length,
      repeatedBlockerGroupKeys.length,
    );
    const durableExactHolderCount = Math.max(
      0,
      blockedLeafCount - actionableCount,
    );
    const activeCount = Array.isArray(packet.frontier?.active)
      ? packet.frontier?.active.length
      : 0;
    const reviewCount = Array.isArray(packet.frontier?.review)
      ? packet.frontier?.review.length
      : 0;
    return {
      blockedLeafCount,
      durableExactHolderCount,
      actionableCount,
      actionableWarningTaskIds,
      repeatedBlockerGroupKeys,
      parentGroups,
      motionStarved: activeCount + reviewCount === 0,
    };
  } catch {
    return {
      blockedLeafCount: 0,
      durableExactHolderCount: 0,
      actionableCount: 0,
      actionableWarningTaskIds: [],
      repeatedBlockerGroupKeys: [],
      parentGroups: [],
      motionStarved: false,
    };
  }
}

function approvalGatedBlockedDisposition(
  tree: TaskTree,
  runtimeTasks = runtimeTreeTasks(tree),
): ApprovalGatedBlockedDisposition {
  const blockedLeaves = runtimeTasks
    .filter((task) => isLeaf(task) && taskState(task) === "blocked")
    .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
  const focusTaskIds = new Set<string>();
  const governingWaitTaskIds = new Set<string>();

  for (const task of blockedLeaves) {
    if (task.kind !== "focus_plan") continue;
    const context = taskContext(task);
    if (context.needs_approval !== true) continue;

    const observations = objectRecordField(context, ["observations"]);
    const blockedOnlyFrontier = [
      numberRecordField(observations, ["frontier_active_leaf_count"]),
      numberRecordField(observations, ["frontier_review_leaf_count"]),
      numberRecordField(observations, ["frontier_waiting_leaf_count"]),
      numberRecordField(observations, ["frontier_runnable_leaf_count"]),
    ].every((value) => value === 0);
    if (!blockedOnlyFrontier) continue;

    const progressReview = objectRecordField(context, [
      "progress_review",
      "progressReview",
    ]);
    const progressStatus = stringRecordField(progressReview, ["status"]);
    if (progressStatus && progressStatus !== "needs_approval") continue;

    const blocker = recordValue(task.blocker);
    if (
      stringRecordField(blocker, ["category"]).toLowerCase() !==
        "external-wait" ||
      stringRecordField(blocker, ["owner"]).toLowerCase() !== "human"
    ) {
      continue;
    }

    const waitingFor = objectRecordField(blocker, [
      "waiting_for",
      "waitingFor",
    ]);
    if (
      stringRecordField(waitingFor, ["type"]).toLowerCase() !== "owner.decision"
    ) {
      continue;
    }

    const governingWaitTaskId = stringRecordField(waitingFor, [
      "governingWaitTaskId",
      "governing_wait_task_id",
      "taskId",
      "task_id",
    ]);
    if (!governingWaitTaskId) continue;

    const governingTask = tree.tasks?.[governingWaitTaskId];
    if (!governingTask || !isLeaf(governingTask)) continue;
    if (taskState(governingTask) !== "blocked") continue;

    const governingBlocker = recordValue(governingTask.blocker);
    if (
      stringRecordField(governingBlocker, ["category"]).toLowerCase() !==
        "external-wait" ||
      stringRecordField(governingBlocker, ["owner"]).toLowerCase() !== "human"
    ) {
      continue;
    }

    const governingWaitingFor = objectRecordField(governingBlocker, [
      "waiting_for",
      "waitingFor",
    ]);
    if (
      stringRecordField(governingWaitingFor, ["type"]).toLowerCase() !==
      "project.approval.submitted"
    ) {
      continue;
    }

    if (typeof task.id === "string" && task.id.trim()) {
      focusTaskIds.add(task.id.trim());
    }
    governingWaitTaskIds.add(governingWaitTaskId);
  }

  return {
    covered: focusTaskIds.size > 0 && governingWaitTaskIds.size > 0,
    focusTaskIds: [...focusTaskIds].sort((a, b) => a.localeCompare(b)),
    governingWaitTaskIds: [...governingWaitTaskIds].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

function isOpsTaskId(taskId: string): boolean {
  return (
    taskId === "ops" || taskId.startsWith("ops/") || taskId.startsWith("ops-")
  );
}

function isOpsTask(tree: TaskTree, taskId: string): boolean {
  const visited = new Set<string>();
  let currentId: string | undefined = taskId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    if (isOpsTaskId(currentId)) return true;
    const task = tree.tasks?.[currentId];
    if (typeof task?.owner === "string" && task.owner === "app-ops") {
      return true;
    }
    currentId =
      typeof task?.parent_id === "string" && task.parent_id.trim()
        ? task.parent_id.trim()
        : undefined;
  }
  return false;
}

function taskCounts() {
  const tree = loadTaskTree();
  const projectionTree = readTaskTreeProjection(runtimeTaskTreeConfig());
  const liveFrontier = liveTaskMetricFrontier(projectionTree);
  const taskMap = tree.tasks ?? {};
  const tasks = Object.values(tree.tasks ?? {});
  const runtimeTasks = runtimeTreeTasks(tree);
  const taskIdOrFallback = (task: TaskNode, index: number): string =>
    typeof task.id === "string" && task.id.trim()
      ? task.id.trim()
      : `blocked-leaf#${index}`;
  const projectSnapshot = buildProjectSnapshotV2({
    projectId: "aks-rp-e2e",
    tree,
    nowMs: now,
  });
  const frontier = projectSnapshot.frontier;
  const byStatus = new Map<string, number>();
  for (const task of tasks) {
    const status = taskState(task);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  const completed24hTaskIds = archivedCompletedTaskIds24h();
  for (const [index, task] of tasks.entries()) {
    if (taskState(task) !== "done") continue;
    const ts = timestampOf(task);
    if (ts == null || ts < dayAgo) continue;
    completed24hTaskIds.add(task.id ?? `tree#${index}`);
  }
  const completed24h = completed24hTaskIds.size;
  const activeStale = staleActiveTaskCount();
  const activeRunning = runningActiveTaskCount();
  const activeTaskIds = liveFrontier.active;
  const activeOpsTaskIds = activeTaskIds.filter((taskId) =>
    isOpsTask(tree, taskId),
  );
  const activeDomainTaskIds = activeTaskIds.filter(
    (taskId) => !isOpsTask(tree, taskId),
  );
  const assignmentStateMismatch = openTaskAssignmentStateMismatchCount(tree);
  const blockedLeafTasks = frontier.blocked.flatMap((taskId) => {
    const task = tree.tasks[taskId];
    return task ? [task] : [];
  });
  const blockedLeaves = frontier.counts.blocked;
  const approvalBlockedDisposition = approvalGatedBlockedDisposition(
    tree,
    runtimeTasks,
  );
  const blockedMissingWaitingForTaskIds = blockedLeafTasks.flatMap(
    (task, index) => {
      const blocker = recordValue(task.blocker);
      return objectRecordField(blocker, ["waiting_for", "waitingFor"])
        ? []
        : [taskIdOrFallback(task, index)];
    },
  );
  const blockedMissingObserverTaskIds = blockedLeafTasks.flatMap(
    (task, index) => {
      const blocker = recordValue(task.blocker);
      return !objectRecordField(blocker, ["observed_by", "observedBy"]) ||
        !stringRecordField(blocker, [
          "observation_method",
          "observationMethod",
        ]) ||
        !stringRecordField(blocker, ["next_check_at", "nextCheckAt"])
        ? [taskIdOrFallback(task, index)]
        : [];
    },
  );
  const blockedMissingResumeConditionTaskIds = blockedLeafTasks.flatMap(
    (task, index) => {
      const blocker = recordValue(task.blocker);
      return !stringRecordField(blocker, [
        "resume_condition",
        "resumeCondition",
        "waitingCondition",
      ])
        ? [taskIdOrFallback(task, index)]
        : [];
    },
  );
  const blockedMissingOwnerTaskIds = blockedLeafTasks.flatMap((task, index) => {
    const blocker = recordValue(task.blocker);
    return !stringRecordField(blocker, ["owner"])
      ? [taskIdOrFallback(task, index)]
      : [];
  });
  const blockedMissingFallbackTaskIds = blockedLeafTasks.flatMap(
    (task, index) => {
      const blocker = recordValue(task.blocker);
      return !stringRecordField(blocker, ["fallback_at", "fallbackAt"]) ||
        !stringRecordField(blocker, ["fallback_action", "fallbackAction"])
        ? [taskIdOrFallback(task, index)]
        : [];
    },
  );
  const blockedMissingWaitingFor = blockedMissingWaitingForTaskIds.length;
  const blockedMissingObserver = blockedMissingObserverTaskIds.length;
  const blockedMissingResumeCondition =
    blockedMissingResumeConditionTaskIds.length;
  const blockedMissingOwner = blockedMissingOwnerTaskIds.length;
  const blockedMissingFallback = blockedMissingFallbackTaskIds.length;
  const activeOrReviewTasks = tasks.filter((task) =>
    ["active", "review"].includes(taskState(task)),
  );
  const registeredConditionSubjects = new Set(
    projectSnapshot.conditions
      .filter((condition) => condition.source === "registry")
      .map(
        (condition) => `${condition.subject.id}:${condition.subject.revision}`,
      ),
  );
  const blockedOverdueUnworkedTaskIds = blockedLeafTasks.flatMap(
    (task, index) => {
      const taskIdValue = typeof task.id === "string" ? task.id : "";
      const taskRevision =
        typeof task.revision === "number" && Number.isInteger(task.revision)
          ? task.revision
          : 0;
      // Registry-owned Conditions have their own due observation, fallback,
      // delivery acknowledgement, and resolved-still-blocking invariants.
      // Keeping them in this compatibility metric gives the planner a second
      // recovery authority over the same wait.
      if (
        taskIdValue &&
        registeredConditionSubjects.has(`${taskIdValue}:${taskRevision}`)
      ) {
        return [];
      }
      const blocker = recordValue(task.blocker);
      const fallbackAt = Date.parse(
        stringRecordField(blocker, ["fallback_at", "fallbackAt"]),
      );
      const resumeAt = Date.parse(
        stringRecordField(blocker, ["resume_at", "resumeAt"]),
      );
      const overdueAt = Number.isFinite(fallbackAt) ? fallbackAt : resumeAt;
      if (!Number.isFinite(overdueAt) || overdueAt > now) {
        return [];
      }
      const taskId = taskIdValue.toLowerCase();
      const hasActiveRecovery =
        taskId &&
        activeOrReviewTasks.some((candidate) =>
          taskCoversBlockedOverdueWait(candidate, task),
        );
      return hasActiveRecovery ? [] : [taskIdOrFallback(task, index)];
    },
  );
  const blockedOverdueUnworked = blockedOverdueUnworkedTaskIds.length;
  const childRefs = new Set<string>();
  for (const task of Object.values(taskMap)) {
    for (const childId of task.children ?? []) childRefs.add(childId);
  }
  const roots = tasks.filter(
    (task) => task.id && !childRefs.has(task.id),
  ).length;
  return {
    total: tasks.length,
    runnable: liveFrontier.runnable.length,
    active: liveFrontier.active.length,
    activeTaskIds,
    activeOpsTaskIds,
    activeDomainTaskIds,
    waiting: liveFrontier.waiting.length,
    waitingTaskIds: liveFrontier.waiting,
    readySatisfiedWaitHolderIds: liveFrontier.readySatisfiedWaitHolders,
    activeRunning,
    activeStale,
    assignmentStateMismatch,
    review: liveFrontier.review.length,
    backlog: byStatus.get("backlog") ?? 0,
    blocked: blockedLeaves,
    blockedMissingWaitingFor,
    blockedMissingWaitingForTaskIds,
    blockedMissingObserver,
    blockedMissingObserverTaskIds,
    blockedMissingResumeCondition,
    blockedMissingResumeConditionTaskIds,
    blockedMissingOwner,
    blockedMissingOwnerTaskIds,
    blockedMissingFallback,
    blockedMissingFallbackTaskIds,
    blockedOverdueUnworked,
    blockedOverdueUnworkedTaskIds,
    done: byStatus.get("done") ?? 0,
    completed24h,
    taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch,
    projectClosed: tree.project_lifecycle === "closed",
    approvalBlockedDisposition,
  };
}

function archivedTaskAttemptId(task: TaskNode): string {
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? (task.trace as Record<string, unknown>)
      : null;
  for (const key of [
    "current_attempt_id",
    "worker_started_attempt_id",
    "previous_attempt_id",
  ]) {
    const attemptId = trace?.[key];
    if (typeof attemptId === "string" && attemptId.trim()) {
      return attemptId.trim();
    }
  }
  return "";
}

function archivedDoneTaskForAttempt(
  taskId: string,
  attemptId: string | null,
  sessionId: string | null,
): TaskNode | null {
  if (!taskId || (!attemptId && !sessionId)) return null;
  const archiveDir = join(effectiveAppDir, ".state", "tasks", "archive");
  const archiveFiles = listFiles(
    archiveDir,
    (candidate) =>
      extname(candidate) === ".json" && candidate.includes("done-leaves-"),
  ).sort((left, right) => right.localeCompare(left));
  for (const path of archiveFiles) {
    const archive = readJson<{ tasks?: TaskNode[] }>(path, {});
    for (const task of archive.tasks ?? []) {
      if (task.id !== taskId) continue;
      if (taskState(task) !== "done") continue;
      const archivedAttemptId = archivedTaskAttemptId(task);
      const archivedSessionId =
        typeof task.session_id === "string" ? task.session_id.trim() : "";
      if (attemptId && archivedAttemptId === attemptId) return task;
      if (sessionId && archivedSessionId === sessionId) return task;
    }
  }
  return null;
}

function terminalTaskWorkerWorkflowRunForAttempt(
  taskId: string,
  attemptId: string | null,
  sessionId: string | null,
): {
  runId: string;
  status: string;
  sessionId: string | null;
} | null {
  if (!taskId || (!attemptId && !sessionId) || !existsSync(stateDbPath)) {
    return null;
  }
  const db = new Database(stateDbPath, { readonly: true });
  try {
    if (!sqliteTableExists(db, "workflow_runs")) return null;
    const rows = db
      .query(
        `
        select runId, status, task, startedAt
        from workflow_runs
        where workflow = 'task-worker'
          and projectId = ?
        order by startedAt desc
        limit 200
      `,
      )
      .all("aks-rp-e2e") as Array<Record<string, unknown>>;
    for (const row of rows) {
      const status = typeof row.status === "string" ? row.status.trim() : "";
      if (!status || status === "running") continue;
      const taskText = typeof row.task === "string" ? row.task : "";
      const trigger = parseTriggerEvent(taskText);
      const triggerTaskId =
        triggerString(trigger, "taskId") || triggerString(trigger, "task_id");
      if (triggerTaskId !== taskId) continue;
      const triggerAttemptId =
        triggerString(trigger, "attemptId") ||
        triggerString(trigger, "attempt_id");
      if (attemptId && triggerAttemptId !== attemptId) continue;
      const triggerSessionId =
        triggerString(trigger, "sessionId") ||
        triggerString(trigger, "session_id");
      if (sessionId && triggerSessionId && triggerSessionId !== sessionId) {
        continue;
      }
      const runId = typeof row.runId === "string" ? row.runId.trim() : "";
      if (!runId) continue;
      return {
        runId,
        status,
        sessionId: triggerSessionId || null,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function representedArchivedDoneAssignmentMismatch(
  taskId: string,
  attemptId: string | null,
  sessionInfo: Pick<
    AssignmentStateMismatchInfo,
    | "sessionId"
    | "sessionStatus"
    | "sessionOutcome"
    | "sessionStartedAt"
    | "sessionLastActivityAt"
    | "sessionEndedAt"
  >,
): boolean {
  const archivedTask = archivedDoneTaskForAttempt(
    taskId,
    attemptId,
    sessionInfo.sessionId,
  );
  if (!archivedTask) return false;
  const archivedSessionId =
    typeof archivedTask.session_id === "string"
      ? archivedTask.session_id.trim()
      : "";
  if (
    sessionInfo.sessionStatus === "done" &&
    sessionInfo.sessionOutcome === "done" &&
    sessionInfo.sessionEndedAt != null
  ) {
    if (
      archivedSessionId &&
      sessionInfo.sessionId &&
      archivedSessionId !== sessionInfo.sessionId
    ) {
      return false;
    }
    return true;
  }
  const workflowRun = terminalTaskWorkerWorkflowRunForAttempt(
    taskId,
    attemptId,
    sessionInfo.sessionId || archivedSessionId || null,
  );
  if (!workflowRun) return false;
  if (
    archivedSessionId &&
    workflowRun.sessionId &&
    archivedSessionId !== workflowRun.sessionId
  ) {
    return false;
  }
  return true;
}

function openTaskAssignmentStateMismatchDetails(
  tree: TaskTree,
): AssignmentStateMismatchInfo[] {
  if (!existsSync(stateDbPath)) return [];
  const db = new Database(stateDbPath, { readonly: true });
  try {
    const rows = db
      .query(
        `
        select correlation_key
        from event_pair_runs
        where pair_name = 'project.task'
          and status in ('open', 'orphan')
      `,
      )
      .all() as Array<{ correlation_key?: unknown }>;
    const mismatches: AssignmentStateMismatchInfo[] = [];
    for (const row of rows) {
      const key =
        typeof row.correlation_key === "string" ? row.correlation_key : "";
      const taskId = key.split(":")[0]?.trim();
      const attemptId = key.includes(":")
        ? key.slice(key.indexOf(":") + 1).trim() || null
        : null;
      if (!taskId) continue;
      const task = tree.tasks?.[taskId];
      const currentTaskState = task ? taskState(task) : null;
      if (!task || currentTaskState !== "active") {
        const sessionInfo = assignmentStateMismatchSessionInfo(
          taskId,
          attemptId,
          typeof task?.session_id === "string" ? task.session_id : null,
        );
        const reason = task ? "task-not-active" : "task-missing";
        if (
          reason === "task-missing" &&
          representedArchivedDoneAssignmentMismatch(
            taskId,
            attemptId,
            sessionInfo,
          )
        ) {
          continue;
        }
        mismatches.push({
          correlationKey: key,
          taskId,
          attemptId,
          taskState: currentTaskState,
          reason,
          ...sessionInfo,
        });
      }
    }
    return mismatches;
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function openTaskAssignmentStateMismatchCount(tree: TaskTree): number {
  return openTaskAssignmentStateMismatchDetails(tree).length;
}

function loadModelStatus(): ModelStatus {
  return readJson<ModelStatus>(
    join(projectDir, ".state", "model-status.json"),
    {},
  );
}

function computeModelStatus(): ModelStatus {
  const modelPath = join(projectDir, "model", "knowledge-map", "model.json");
  const model = readJson<{
    features?: Array<{ status?: string }>;
    featurePaths?: Array<{ status?: string }>;
    scenarios?: unknown[];
    evidence?: unknown[];
  }>(modelPath, {});

  const countByStatus = (items: Array<{ status?: string }> = []) => {
    const byStatus: Record<string, number> = {};
    for (const item of items) {
      const status = item.status ?? "unknown";
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }
    return { total: items.length, byStatus };
  };

  return {
    features: countByStatus(model.features),
    paths: countByStatus(model.featurePaths),
  };
}

function modelStatus(): ModelStatus {
  const cached = loadModelStatus();
  if (cached.features || cached.paths) return cached;
  return computeModelStatus();
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function pathGapCount(): number {
  // Read model directly to check both status and terminal flag per path.
  // Terminal paths (externally blocked, product-gap, etc.) are not actionable
  // gaps — they should not trigger capacity/starvation alerts.
  const modelPath = join(projectDir, "model", "knowledge-map", "model.json");
  const model = readJson<{
    featurePaths?: Array<{ status?: string; terminal?: boolean }>;
  }>(modelPath, {});
  const paths = model.featurePaths ?? [];
  return paths.filter(
    (p) =>
      !["pass", "staging-pass"].includes(p.status ?? "unknown") &&
      p.terminal !== true,
  ).length;
}

function blockedPathCount(): number {
  // This metric is meant to surface blocked paths that still need actionable
  // closure work. Paths that already carry an accepted terminal disposition or
  // an exact resume/retest condition are represented elsewhere and should not
  // keep the blocked-path alert open by themselves.
  const modelPath = join(projectDir, "model", "knowledge-map", "model.json");
  const model = readJson<{
    featurePaths?: Array<{
      status?: string;
      terminal?: boolean;
      remediationStatus?: string | null;
      resumeCondition?: string | null;
      retestCondition?: string | null;
    }>;
  }>(modelPath, {});
  const paths = model.featurePaths ?? [];
  return paths.filter((path) => {
    if (path.status !== "blocked") return false;
    if (path.terminal === true) return false;
    if (
      path.remediationStatus === "terminal" ||
      path.remediationStatus === "awaiting-external"
    ) {
      return false;
    }
    if (hasText(path.resumeCondition) || hasText(path.retestCondition)) {
      return false;
    }
    return true;
  }).length;
}

function countSpecs(): number {
  return specMetrics().total;
}

function normalizeSpecStatus(value: string | undefined): string {
  return (value ?? "unknown").trim().toLowerCase().replace(/_/g, "-");
}

function isVerifiedSpec(spec: SpecIndexEntry): boolean {
  const status = normalizeSpecStatus(spec.status);
  const state = normalizeSpecStatus(spec.specState);
  return (
    status === "pass" &&
    ["verified", "validated", "resolved", "pass"].includes(state)
  );
}

function isReviewedExceptionSpec(spec: SpecIndexEntry): boolean {
  if (spec.terminalDisposition === true) return true;
  const statuses = [
    normalizeSpecStatus(spec.status),
    normalizeSpecStatus(spec.specState),
  ];
  return statuses.some((status) =>
    [
      "product-gap",
      "product-constraint",
      "environment",
      "environment-blocked",
      "blocked-infra",
      "deprecated",
      "product-deprecated",
      "reviewed-exception",
      "superseded",
      "out-of-scope",
    ].includes(status),
  );
}

function specMetrics(): SpecMetrics {
  // Keep observability on the same catalog as the execution loop. The domain
  // workspace now owns specs under features/*/specs, with a legacy index only
  // when one is still present.
  const specs = loadSpecs(projectDir);
  const loopSpecs = loadSpecLoopState().specs ?? {};
  const metrics: SpecMetrics = {
    total: specs.length,
    verified: 0,
    reviewedException: 0,
    unverified: 0,
    failed: 0,
    blocked: 0,
    ready: 0,
    draft: 0,
    unknown: 0,
  };

  for (const spec of specs) {
    const loopStatus = loopSpecs[spec.id]?.status;
    const status = normalizeSpecStatus(spec.status);
    const state = normalizeSpecStatus(spec.specState);
    const values = new Set([status, state]);
    if (loopStatus) values.add(normalizeSpecStatus(loopStatus));
    const verified = loopStatus === "pass" || isVerifiedSpec(spec);
    const reviewedException = !verified && isReviewedExceptionSpec(spec);

    if (verified) metrics.verified++;
    if (reviewedException) metrics.reviewedException++;
    if (!verified && !reviewedException) metrics.unverified++;
    // Keep failed-spec inventory aligned with actual spec failure verdicts.
    // Loop `error` is a broader fix-forward holding state and includes
    // pipeline/artifact-routing gaps that the design explicitly treats as ops
    // problems, not trustworthy spec failures.
    if ([...values].some((value) => value.startsWith("fail"))) metrics.failed++;
    if ([...values].some((value) => value.startsWith("blocked")))
      metrics.blocked++;
    if (values.has("ready")) metrics.ready++;
    if (values.has("draft")) metrics.draft++;
    if (values.has("unknown")) metrics.unknown++;
  }

  return metrics;
}

function hasOpenSpecVerificationWork(
  tasks: ReturnType<typeof taskCounts>,
): boolean {
  const tree = loadTaskTree();
  return (
    Object.values(tree.tasks ?? {}).some((task) => {
      const id = task.id ?? "";
      const state = taskState(task);
      return (
        (id.includes("spec-verification") ||
          id.includes("all-spec-verification") ||
          id.includes("ready-spec-execution") ||
          id.includes("draft-spec-readiness") ||
          (id.includes("failed") && id.includes("spec"))) &&
        ["backlog", "active", "review", "blocked"].includes(state)
      );
    }) ||
    tasks.runnable > 0 ||
    tasks.activeRunning > 0 ||
    tasks.review > 0
  );
}

function loadSpecLoopState(): SpecLoopState {
  return readJson<SpecLoopState>(
    join(effectiveAppDir, ".state", "spec-loop", "state.json"),
    { specs: {} },
  );
}

function loadFeatureCompactLoopState(): FeatureCompactLoopState {
  return readJson<FeatureCompactLoopState>(
    join(effectiveAppDir, ".state", "feature-compact-loop", "state.json"),
    { features: {} },
  );
}

function taskContext(task: TaskNode | undefined): Record<string, unknown> {
  return task?.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
    ? task.context
    : {};
}

function taskConflictScopes(task: TaskNode | undefined): string[] {
  const scopes = (task as { conflict_scope?: unknown } | undefined)
    ?.conflict_scope;
  return Array.isArray(scopes)
    ? scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
}

function structuredBlockedTaskIds(task: TaskNode | undefined): string[] {
  const context = taskContext(task);
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      ids.add(value.trim());
      return;
    }
    const record = recordValue(value);
    const id = stringRecordField(record, ["taskId", "task_id", "id"]);
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

function specFamily(specId: string): string {
  return (
    specId
      .replace(/^spec\./, "")
      .split(".")[0]
      ?.trim() || "unknown"
  );
}

function specLoopTask(
  tree: TaskTree,
  state: SpecLoopState,
): TaskNode | undefined {
  const taskId = state.loopTaskId || "aks-spec-verification-loop";
  return tree.tasks?.[taskId];
}

function specLoopMaxDirectAttempts(
  tree: TaskTree,
  state: SpecLoopState,
): number {
  const task = specLoopTask(tree, state);
  const value = taskContext(task).maxDirectAttemptsPerSpec;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 3;
}

function canDirectlyRunSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  if (spec.status === "pending" || spec.status === "done") {
    return !spec.lastRunUrl || (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
  }
  if (spec.status !== "error" && spec.status !== "fail") return false;
  return (spec.attempts ?? 0) < maxDirectAttemptsPerSpec;
}

function isRetryExhaustedSpec(
  state: SpecLoopState,
  specId: string,
  maxDirectAttemptsPerSpec: number,
): boolean {
  const spec = state.specs?.[specId];
  if (!spec) return false;
  const status = spec.status || "pending";
  if (status === "pending") {
    return !canDirectlyRunSpec(state, specId, maxDirectAttemptsPerSpec);
  }
  if (status !== "error" && status !== "fail") return false;
  return (spec.attempts ?? 0) >= maxDirectAttemptsPerSpec;
}

function specLoopFollowupGroupKeys(task: TaskNode | undefined): Set<string> {
  const keys = new Set<string>();
  if (!task) return keys;
  const context = taskContext(task);
  if (context.specLoopFollowup === true) {
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

function representedSpecLoopFollowupGroups(tree: TaskTree): Set<string> {
  const represented = new Set<string>();
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  for (const task of Object.values(tree.tasks ?? {})) {
    if (!representingStates.has(taskState(task))) continue;
    for (const key of specLoopFollowupGroupKeys(task)) {
      represented.add(key);
    }
  }
  return represented;
}

function taskHasStructuredBlocker(task: TaskNode | undefined): boolean {
  return !!task?.blocker && typeof task.blocker === "object";
}

function taskTextMentionsSpecId(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!task) return false;
  const taskRecord = task as TaskNode & {
    acceptance?: unknown;
    inputs?: unknown;
  };
  const haystack = JSON.stringify({
    goal: task.goal,
    acceptance: taskRecord.acceptance,
    inputs: taskRecord.inputs,
    context: task.context,
    blocker: task.blocker,
  }).toLowerCase();
  return haystack.includes(specId.toLowerCase());
}

function taskTextMentionsSpecFamily(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!task) return false;
  const family = specFamily(specId).trim().toLowerCase();
  if (!family) return false;
  const taskRecord = task as TaskNode & {
    acceptance?: unknown;
    inputs?: unknown;
  };
  const haystack = JSON.stringify({
    goal: task.goal,
    acceptance: taskRecord.acceptance,
    inputs: taskRecord.inputs,
    context: task.context,
    blocker: task.blocker,
  }).toLowerCase();
  return haystack.includes(family);
}

function taskTextMentionCountsAsSpecOwner(
  task: TaskNode | undefined,
  specId: string,
): boolean {
  if (!taskTextMentionsSpecId(task, specId)) return false;
  return taskState(task) !== "blocked" || taskHasStructuredBlocker(task);
}

function specLoopSpecHasStructuredSuccessor(
  spec: NonNullable<SpecLoopState["specs"]>[string] | undefined,
): boolean {
  if (!spec) return false;
  if (
    typeof spec.successorDisposition === "string" &&
    spec.successorDisposition.trim()
  ) {
    return true;
  }
  if (typeof spec.resumeCondition === "string" && spec.resumeCondition.trim()) {
    return true;
  }
  return !!spec.review && typeof spec.review === "object";
}

function exactSpecLoopOwnerTaskId(input: {
  tree: TaskTree;
  state: SpecLoopState;
  specId: string;
}): string | null {
  const spec = input.state.specs?.[input.specId];
  const representingStates = new Set([
    "active",
    "backlog",
    "review",
    "waiting",
    "blocked",
  ]);
  const isRepresenting = (task: TaskNode | undefined): task is TaskNode =>
    !!task && representingStates.has(taskState(task));
  const exactDirectProjectedHolderTaskId = (): string | null => {
    const loopTaskId = input.state.loopTaskId || "aks-spec-verification-loop";
    const representingProjectionPhases = new Set([
      "pending",
      "running",
      "waiting",
    ]);
    for (const [taskId, task] of Object.entries(input.tree.tasks ?? {})) {
      const taskInput = recordValue(task.input) ?? recordValue(task.inputs);
      if (
        task.parent_id === loopTaskId &&
        representingProjectionPhases.has(projectionPhase(task)) &&
        stringRecordField(taskInput, ["specId", "spec_id"]) === input.specId
      ) {
        return taskId;
      }
    }
    return null;
  };

  const candidateSpecTaskId =
    typeof spec?.taskId === "string" && spec.taskId.trim()
      ? spec.taskId.trim()
      : null;

  const taskIds = new Set<string>();
  if (candidateSpecTaskId) {
    taskIds.add(candidateSpecTaskId);
  }
  for (const task of Object.values(input.tree.tasks ?? {})) {
    if (!isRepresenting(task)) continue;
    if (taskConflictScopes(task).includes(`spec:${input.specId}`)) {
      taskIds.add(task.id ?? "");
      continue;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      taskIds.add(task.id ?? "");
      continue;
    }
    if (taskTextMentionsSpecFamily(task, input.specId)) {
      taskIds.add(task.id ?? "");
    }
  }

  const orderedTaskIds = [...taskIds].sort((leftId, rightId) => {
    const left = input.tree.tasks?.[leftId];
    const right = input.tree.tasks?.[rightId];
    const leftExact = left
      ? taskConflictScopes(left).includes(`spec:${input.specId}`) ||
        taskTextMentionCountsAsSpecOwner(left, input.specId)
      : false;
    const rightExact = right
      ? taskConflictScopes(right).includes(`spec:${input.specId}`) ||
        taskTextMentionCountsAsSpecOwner(right, input.specId)
      : false;
    if (leftExact !== rightExact) return leftExact ? -1 : 1;
    const leftStructured = left
      ? taskHasStructuredBlocker(left) ||
        specLoopFollowupGroupKeys(left).size > 0
      : false;
    const rightStructured = right
      ? taskHasStructuredBlocker(right) ||
        specLoopFollowupGroupKeys(right).size > 0
      : false;
    if (leftStructured !== rightStructured) return leftStructured ? -1 : 1;
    if (leftId === candidateSpecTaskId && rightId !== candidateSpecTaskId)
      return 1;
    if (rightId === candidateSpecTaskId && leftId !== candidateSpecTaskId)
      return -1;
    return leftId.localeCompare(rightId);
  });

  for (const taskId of orderedTaskIds) {
    const task = input.tree.tasks?.[taskId];
    if (!isRepresenting(task)) continue;
    if (taskConflictScopes(task).includes(`spec:${input.specId}`)) {
      return taskId;
    }
    if (taskTextMentionCountsAsSpecOwner(task, input.specId)) {
      return taskId;
    }
    if (specLoopFollowupGroupKeys(task).size > 0) return taskId;
    if (
      taskHasStructuredBlocker(task) &&
      taskTextMentionsSpecFamily(task, input.specId)
    ) {
      return taskId;
    }
    if (
      spec?.taskId === taskId &&
      specLoopSpecHasStructuredSuccessor(spec) &&
      taskHasStructuredBlocker(task)
    ) {
      return taskId;
    }
  }

  return exactDirectProjectedHolderTaskId();
}

export function specLoopRepresentationAuthority(input: {
  tree: TaskTree;
  state: SpecLoopState;
}): {
  authorityObserved: boolean;
  nonTerminalSpecCount: number;
  unrepresentedNonTerminalCount: number;
  representedSpecIds: string[];
  unrepresentedSpecIds: string[];
  waitingTaskIds: string[];
} {
  let nonTerminalSpecCount = 0;
  const representedSpecIds: string[] = [];
  const unrepresentedSpecIds: string[] = [];
  const waitingTaskIds = new Set<string>();

  for (const [specId, spec] of Object.entries(input.state.specs ?? {})) {
    const status = normalizeSpecStatus(spec.status);
    if (status === "pass" || status === "done") continue;

    nonTerminalSpecCount += 1;
    const taskId = exactSpecLoopOwnerTaskId({
      tree: input.tree,
      state: input.state,
      specId,
    });
    const selfRepresented = specStateSelfRepresentsExactFrontier(
      spec as Parameters<typeof specStateSelfRepresentsExactFrontier>[0],
    );

    if (!taskId && !selfRepresented) {
      unrepresentedSpecIds.push(specId);
      continue;
    }

    representedSpecIds.push(specId);
    const task = taskId ? input.tree.tasks?.[taskId] : null;
    if (taskId && task && projectionPhase(task) === "waiting") {
      waitingTaskIds.add(taskId);
    }
  }

  return {
    authorityObserved: nonTerminalSpecCount > 0,
    nonTerminalSpecCount,
    unrepresentedNonTerminalCount: unrepresentedSpecIds.length,
    representedSpecIds,
    unrepresentedSpecIds,
    waitingTaskIds: [...waitingTaskIds].sort((a, b) => a.localeCompare(b)),
  };
}

function specLoopRecoveryStats(): {
  retryExhausted: number;
  recoveryUnowned: number;
  recoveryUnownedSpecIds: string[];
} {
  const state = loadSpecLoopState();
  const tree = loadTaskTree();
  const maxDirectAttempts = specLoopMaxDirectAttempts(tree, state);
  const represented = representedSpecLoopFollowupGroups(tree);
  let retryExhausted = 0;
  let recoveryUnowned = 0;
  const recoveryUnownedSpecIds: string[] = [];
  for (const [specId, spec] of Object.entries(state.specs ?? {})) {
    if (!isRetryExhaustedSpec(state, specId, maxDirectAttempts)) continue;
    retryExhausted += 1;
    const status = spec.status || "pending";
    const groupStatus = status === "pending" ? "pending" : status;
    if (
      !represented.has(`${groupStatus}:${specFamily(specId)}`) &&
      !exactSpecLoopOwnerTaskId({ tree, state, specId }) &&
      !specStateSelfRepresentsExactFrontier(
        spec as Parameters<typeof specStateSelfRepresentsExactFrontier>[0],
      )
    ) {
      recoveryUnowned += 1;
      recoveryUnownedSpecIds.push(specId);
    }
  }
  return { retryExhausted, recoveryUnowned, recoveryUnownedSpecIds };
}

function gitStdout(repoDir: string, args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd: repoDir,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

function gitStatusEntryCount(repoDir: string): number {
  const stdout = gitStdout(repoDir, ["status", "--porcelain=v1"]);
  if (stdout == null) return 0;
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean).length;
}

function gitAheadOfUpstreamCount(repoDir: string): number {
  const stdout = gitStdout(repoDir, ["status", "--porcelain=v1", "--branch"]);
  if (stdout == null) return 0;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("## ")) continue;
    const ahead = line.match(/\[ahead (\d+)/);
    if (ahead) return Number.parseInt(ahead[1], 10) || 0;
    return 0;
  }
  return 0;
}

function gitOriginLocalOnlyCommitCount(repoDir: string): number {
  const remoteRefs = gitStdout(repoDir, [
    "for-each-ref",
    "--format=%(refname)",
    "refs/remotes/origin",
  ]);
  if (remoteRefs == null) return gitAheadOfUpstreamCount(repoDir);
  if (
    remoteRefs
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length === 0
  ) {
    return gitAheadOfUpstreamCount(repoDir);
  }

  const localOnly = gitStdout(repoDir, [
    "rev-list",
    "--count",
    "HEAD",
    "--not",
    "--remotes=origin",
  ]);
  if (localOnly == null) return gitAheadOfUpstreamCount(repoDir);
  const parsed = Number.parseInt(localOnly.trim(), 10);
  return Number.isFinite(parsed) ? parsed : gitAheadOfUpstreamCount(repoDir);
}

function unpublishedGitChangeCount(repoDir: string): number {
  return gitStatusEntryCount(repoDir) + gitOriginLocalOnlyCommitCount(repoDir);
}

function normalizeProcessText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sessionTranscriptPath(sessionId: string): string | null {
  const livePath = join(sessionsDirPath, sessionId, "session.jsonl");
  if (existsSync(livePath)) return livePath;
  const historyPath = join(
    sessionsDirPath,
    "history",
    sessionId,
    "session.jsonl",
  );
  return existsSync(historyPath) ? historyPath : null;
}

function unresolvedBashToolCommands(sessionId: string): string[] {
  const transcriptPath = sessionTranscriptPath(sessionId);
  if (!transcriptPath) return [];
  const entries = readJsonl<Record<string, unknown>>(transcriptPath);
  const unresolved = new Map<string, string>();

  for (const entry of entries) {
    const resolvedToolCallId =
      typeof entry.toolCallId === "string" ? entry.toolCallId.trim() : "";
    if (resolvedToolCallId) unresolved.delete(resolvedToolCallId);

    if (!Array.isArray(entry.content)) continue;
    for (const chunk of entry.content) {
      if (!chunk || typeof chunk !== "object") continue;
      const part = chunk as Record<string, unknown>;
      if (part.type !== "toolCall") continue;
      const toolName = typeof part.name === "string" ? part.name.trim() : "";
      const toolCallId = typeof part.id === "string" ? part.id.trim() : "";
      const command =
        typeof (part.arguments as Record<string, unknown> | undefined)
          ?.command === "string"
          ? (
              (part.arguments as Record<string, unknown>).command as string
            ).trim()
          : "";
      if (!toolCallId || toolName !== "bash" || !command) continue;
      unresolved.set(toolCallId, command);
    }
  }

  return [...unresolved.values()];
}

function toolCommandNeedles(command: string): string[] {
  const normalized = normalizeProcessText(command);
  if (!normalized) return [];

  const needles = new Set<string>();
  if (normalized.length <= 220) needles.add(normalized);
  else {
    needles.add(normalized.slice(0, 220));
    needles.add(normalized.slice(-220));
  }

  for (const match of normalized.matchAll(
    /(?:^|[\s=])(\/[^\s"'`|;&()<>]+|\.\.?\/[^\s"'`|;&()<>]+)/g,
  )) {
    const token = match[1]?.trim();
    if (token && token.length >= 16) needles.add(token);
  }

  for (const match of normalized.matchAll(/\b[A-Za-z0-9._-]{8,}\b/g)) {
    const token = match[0];
    if (/^\d+$/.test(token) ? token.length >= 6 : token.length >= 12) {
      needles.add(token);
    }
  }

  return [...needles]
    .sort((left, right) => right.length - left.length)
    .slice(0, 8);
}

function sessionHasLiveBashToolProcess(sessionId: string): boolean {
  const commands = unresolvedBashToolCommands(sessionId);
  if (commands.length === 0) return false;

  let psOutput = "";
  try {
    const result = spawnSync("ps", ["-ww", "-eo", "args="], {
      encoding: "utf-8",
    });
    if (result.status !== 0) return false;
    psOutput = result.stdout;
  } catch {
    return false;
  }

  const processes = psOutput
    .split(/\r?\n/)
    .map((line) => normalizeProcessText(line))
    .filter(Boolean);

  return commands.some((command) => {
    const normalizedCommand = normalizeProcessText(command);
    if (!normalizedCommand) return false;
    const needles = toolCommandNeedles(normalizedCommand);

    return processes.some((processArgs) => {
      if (!processArgs || processArgs === normalizedCommand) return false;
      if (processArgs.includes(normalizedCommand)) return true;

      let matchCount = 0;
      for (const needle of needles) {
        if (!processArgs.includes(needle)) continue;
        matchCount++;
        if (needle.length >= 48 || matchCount >= 2) return true;
      }
      return false;
    });
  });
}

function countReplays(): number {
  return listFiles(join(projectDir, "replays"), (path) => {
    const rel = path.slice(join(projectDir, "replays").length + 1);
    return extname(path) === ".ts" && !rel.startsWith("lib/");
  }).length;
}

function sessionRestartReasonFromRow(
  row: Record<string, unknown> | null,
  sessionIdOverride?: string | null,
): string | null {
  if (!row) return "session-not-running";
  if (row.status !== "running") return "session-not-running";
  if (row.outcome === "error" || row.outcome === "interrupted")
    return `session-${row.outcome}`;

  const sessionId =
    typeof sessionIdOverride === "string" && sessionIdOverride.trim()
      ? sessionIdOverride.trim()
      : typeof row.sessionId === "string" && row.sessionId.trim()
        ? row.sessionId.trim()
        : "";
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
  if (
    staleSince !== null &&
    Date.now() - staleSince > staleActiveNoActivityMs
  ) {
    if (sessionId && sessionHasLiveBashToolProcess(sessionId)) return null;
    return "session-no-activity";
  }

  return null;
}

export function terminalSessionCompletionGapLooksHealthy(input: {
  sessionStatus?: string | null;
  lastSessionEndedAt?: number | null;
  lastSessionLastActivityAt?: number | null;
  lastSessionStartedAt?: number | null;
  nowMs?: number;
  gapGraceMs?: number;
}): boolean {
  if (!input || input.sessionStatus === "running") return false;
  const lastObservedAt =
    recentTerminalSessionObservedAtMs(input) ??
    (typeof input.lastSessionStartedAt === "number" &&
    Number.isFinite(input.lastSessionStartedAt)
      ? input.lastSessionStartedAt
      : null);
  if (lastObservedAt === null) return false;
  const nowMs = input.nowMs ?? Date.now();
  const gapGraceMs = input.gapGraceMs ?? terminalSessionCompletionGraceMs;
  return nowMs >= lastObservedAt && nowMs - lastObservedAt <= gapGraceMs;
}

function sessionFinishedWithinTerminalCompletionGrace(
  row: Record<string, unknown> | null,
): boolean {
  return terminalSessionCompletionGapLooksHealthy({
    sessionStatus: typeof row?.status === "string" ? row.status : null,
    lastSessionEndedAt:
      typeof row?.endedAt === "number" && Number.isFinite(row.endedAt)
        ? row.endedAt
        : null,
    lastSessionLastActivityAt:
      typeof row?.lastActivityAt === "number" &&
      Number.isFinite(row.lastActivityAt)
        ? row.lastActivityAt
        : null,
    lastSessionStartedAt:
      typeof row?.startedAt === "number" && Number.isFinite(row.startedAt)
        ? row.startedAt
        : null,
  });
}

function persistedSessionStatus(sessionId: string): string | null {
  if (!existsSync(stateDbPath)) return null;
  const db = new Database(stateDbPath, { readonly: true });
  try {
    const row = db.query("select status from sessions where sessionId = ? limit 1").get(sessionId) as
      | { status?: unknown }
      | null;
    return typeof row?.status === "string" ? row.status : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function sessionRestartReason(sessionId: string): string | null {
  if (!existsSync(stateDbPath)) return "session-not-running";
  const db = new Database(stateDbPath, { readonly: true });
  try {
    const row = db
      .query(
        `
      select status, outcome, opCount, startedAt, lastActivityAt, endedAt
      from sessions
      where sessionId = ?
      limit 1
    `,
      )
      .get(sessionId) as Record<string, unknown> | null;
    if (sessionFinishedWithinTerminalCompletionGrace(row)) return null;
    return sessionRestartReasonFromRow(row, sessionId);
  } catch {
    try {
      const row = db
        .query(
          `
        select status, startedAt, lastActivityAt, endedAt
        from sessions
        where sessionId = ?
        limit 1
      `,
        )
        .get(sessionId) as Record<string, unknown> | null;
      if (sessionFinishedWithinTerminalCompletionGrace(row)) return null;
      return sessionRestartReasonFromRow(row, sessionId);
    } catch {
      return "session-not-running";
    }
  } finally {
    db.close();
  }
}

function sqliteTableExists(db: Database, tableName: string): boolean {
  const row = db
    .query(
      `
      select name
      from sqlite_master
      where type = 'table' and name = ?
      limit 1
    `,
    )
    .get(tableName);
  return Boolean(row);
}

function workflowRunReferencedTaskId(
  row: Record<string, unknown>,
): string | null {
  const taskText = typeof row.task === "string" ? row.task : "";
  const trigger = parseTriggerEvent(taskText);
  const triggerTaskId =
    triggerString(trigger, "taskId") || triggerString(trigger, "task_id");
  if (triggerTaskId) return triggerTaskId;
  const promptMatch = taskText.match(/"(?:taskId|task_id)"\s*:\s*"([^"]+)"/);
  return promptMatch?.[1]?.trim() || null;
}

export function workflowRunWithoutSessionLooksHealthy(input: {
  workflowTask?: string | null;
  activeTaskState?: string | null;
  activeTaskRestartReason?: string | null;
}): boolean {
  const taskText =
    typeof input.workflowTask === "string" ? input.workflowTask : "";
  if (!taskText.trim()) return false;
  const taskId = workflowRunReferencedTaskId({ task: taskText });
  if (!taskId) return false;
  return (
    input.activeTaskState === "active" && input.activeTaskRestartReason === null
  );
}

function workflowRunClaimsHealthyTaskOwnership(
  row: Record<string, unknown>,
): boolean {
  const taskId = workflowRunReferencedTaskId(row);
  if (!taskId) return false;
  const tree = loadTaskTree();
  const task = tree.tasks[taskId];
  if (!task) return false;
  return workflowRunWithoutSessionLooksHealthy({
    workflowTask: typeof row.task === "string" ? row.task : "",
    activeTaskState: taskState(task),
    activeTaskRestartReason: activeTaskRestartReason(task),
  });
}

function staleRunningWorkflowRunDetails(): StaleWorkflowRunInfo[] {
  if (!existsSync(stateDbPath)) return [];
  const db = new Database(stateDbPath, { readonly: true });
  try {
    if (!sqliteTableExists(db, "workflow_runs")) return [];
    const hasSessions = sqliteTableExists(db, "sessions");
    const rows = hasSessions
      ? (db
          .query(
            `
            select
              w.runId as runId,
              w.workflow as workflow,
              w.task as task,
              w.startedAt as startedAt,
              count(s.sessionId) as sessionCount,
              sum(case when s.status = 'running' then 1 else 0 end) as runningSessionCount,
              max(coalesce(s.lastActivityAt, s.startedAt)) as lastSessionActivityAt
            from workflow_runs w
            left join sessions s on s.workflowRunId = w.runId
            where w.projectId = ? and w.status = 'running'
            group by w.runId, w.workflow, w.task, w.startedAt
          `,
          )
          .all("aks-rp-e2e") as Array<Record<string, unknown>>)
      : (db
          .query(
            `
            select
              runId,
              workflow,
              task,
              startedAt,
              0 as sessionCount,
              0 as runningSessionCount,
              null as lastSessionActivityAt
            from workflow_runs
            where projectId = ? and status = 'running'
          `,
          )
          .all("aks-rp-e2e") as Array<Record<string, unknown>>);

    return rows.flatMap((row) => {
      const runId = typeof row.runId === "string" ? row.runId.trim() : "";
      const workflow =
        typeof row.workflow === "string" ? row.workflow.trim() : "";
      const startedAt =
        typeof row.startedAt === "number" && Number.isFinite(row.startedAt)
          ? row.startedAt
          : null;
      const lastSessionActivityAt =
        typeof row.lastSessionActivityAt === "number" &&
        Number.isFinite(row.lastSessionActivityAt)
          ? row.lastSessionActivityAt
          : startedAt;
      const sessionCount =
        typeof row.sessionCount === "number" &&
        Number.isFinite(row.sessionCount)
          ? row.sessionCount
          : 0;
      const runningSessionCount =
        typeof row.runningSessionCount === "number" &&
        Number.isFinite(row.runningSessionCount)
          ? row.runningSessionCount
          : 0;
      if (!runId || !workflow || startedAt == null) return [];
      if (Date.now() - startedAt <= sessionStartGraceMs) return [];
      if (workflowRunClaimsHealthyTaskOwnership(row)) return [];
      if (sessionCount === 0) {
        return [{ runId, workflow, restartReason: "workflow-no-session" }];
      }
      if (
        runningSessionCount === 0 &&
        lastSessionActivityAt != null &&
        Date.now() - lastSessionActivityAt > sessionStartGraceMs
      ) {
        return [
          { runId, workflow, restartReason: "workflow-no-running-session" },
        ];
      }
      return [];
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

function activeTaskWorkerSessionRow(
  taskId: string,
  currentAttemptId?: string | null,
  currentSessionId?: string | null,
): Record<string, unknown> | null {
  if (!existsSync(stateDbPath)) return null;
  const db = new Database(stateDbPath, { readonly: true });
  const taskIdPattern = new RegExp(
    String.raw`"(?:taskId|id)"\s*:\s*"${taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
  );
  const attemptId =
    typeof currentAttemptId === "string" && currentAttemptId.trim()
      ? currentAttemptId.trim()
      : "";
  const sessionId =
    typeof currentSessionId === "string" && currentSessionId.trim()
      ? currentSessionId.trim()
      : "";
  try {
    const rows = db
      .query(
        `
      select sessionId, status, outcome, opCount, startedAt, lastActivityAt, endedAt, task
      from sessions
      where source = 'workflow:task-worker'
      order by startedAt desc
      limit 200
    `,
      )
      .all() as Array<Record<string, unknown>>;
    let firstTaskMatch: Record<string, unknown> | null = null;
    for (const row of rows) {
      const rowSessionId =
        typeof row.sessionId === "string" ? row.sessionId.trim() : "";
      if (sessionId && rowSessionId === sessionId) return row;

      const taskText = typeof row.task === "string" ? row.task : "";
      if (!taskIdPattern.test(taskText)) continue;
      firstTaskMatch ??= row;
      if (!attemptId) continue;
      if (
        taskText.includes(`Attempt: ${attemptId}`) ||
        taskText.includes(`attemptId: ${attemptId}`)
      ) {
        return row;
      }
    }
    return attemptId ? null : firstTaskMatch;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function assignmentStateMismatchSessionInfo(
  taskId: string,
  attemptId: string | null,
  sessionId?: string | null,
): Pick<
  AssignmentStateMismatchInfo,
  | "sessionId"
  | "sessionStatus"
  | "sessionOutcome"
  | "sessionStartedAt"
  | "sessionLastActivityAt"
  | "sessionEndedAt"
> {
  const row = activeTaskWorkerSessionRow(taskId, attemptId, sessionId);
  const numberField = (key: string): number | null => {
    const value = row?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const stringField = (key: string): string | null => {
    const value = row?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return {
    sessionId: stringField("sessionId"),
    sessionStatus: stringField("status"),
    sessionOutcome: stringField("outcome"),
    sessionStartedAt: numberField("startedAt"),
    sessionLastActivityAt: numberField("lastActivityAt"),
    sessionEndedAt: numberField("endedAt"),
  };
}

function activeTaskFeatureReferenceSessionRow(
  task: TaskNode,
): Record<string, unknown> | null {
  const featureKey =
    typeof task.context?.featureKey === "string"
      ? task.context.featureKey.trim()
      : "";
  if (!featureKey || !existsSync(stateDbPath)) return null;
  const db = new Database(stateDbPath, { readonly: true });
  const featurePattern = new RegExp(
    String.raw`feature\s+${featureKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\.|\n|\r|\s)`,
    "i",
  );
  try {
    const rows = db
      .query(
        `
      select status, outcome, opCount, startedAt, lastActivityAt, task
      from sessions
      where source = 'workflow:feature-reference-collector'
      order by startedAt desc
      limit 200
    `,
      )
      .all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const taskText = typeof row.task === "string" ? row.task : "";
      if (featurePattern.test(taskText)) return row;
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function loadVerifierLivenessByTaskId(): Map<
  string,
  {
    specId: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    heartbeatAt?: string | null;
  }
> {
  const state = readJson<SpecLoopState | null>(
    join(effectiveAppDir, ".state", "spec-loop", "state.json"),
    null,
  );
  const byTaskId = new Map<
    string,
    {
      specId: string;
      activeAttemptId?: string | null;
      activeTaskSessionId?: string | null;
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
      heartbeatAt:
        typeof spec.heartbeatAt === "string" ? spec.heartbeatAt : null,
    });
  }
  return byTaskId;
}

function featureCompactLoopByTaskId(): Map<
  string,
  {
    featureKey: string;
    activeAttemptId?: string | null;
    activeTaskSessionId?: string | null;
    activeWorkflowRunId?: string | null;
    heartbeatAt?: string | null;
  }
> {
  const state = loadFeatureCompactLoopState();
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
  const features = state.features ?? {};
  for (const [featureKey, feature] of Object.entries(features)) {
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

function countsAsExecutableActiveLeaf(task: TaskNode): boolean {
  if (!isLeaf(task)) return false;
  if (taskState(task) !== "active") return false;
  if (task.kind === "focus_plan") return false;
  return true;
}

function activeLeafTasks(): TaskNode[] {
  const tree = loadTaskTree();
  return Object.values(tree.tasks ?? {}).filter((task) =>
    countsAsExecutableActiveLeaf(task),
  );
}

function activeTaskResource(task: TaskNode): Record<string, unknown> | null {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  if (!taskId) return null;
  return recordValue(loadTaskTree().resources?.[taskId] ?? null);
}

function activeTaskAttemptId(task: TaskNode): string {
  const trace = recordValue(task.trace);
  for (const key of [
    "current_attempt_id",
    "worker_started_attempt_id",
    "previous_attempt_id",
  ]) {
    const value = trace?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const activeAttempt = recordValue(task.active_attempt);
  if (typeof activeAttempt?.id === "string" && activeAttempt.id.trim()) {
    return activeAttempt.id.trim();
  }
  const resource = activeTaskResource(task);
  const status = recordValue(resource?.status);
  if (
    typeof status?.currentAttemptId === "string" &&
    status.currentAttemptId.trim()
  ) {
    return status.currentAttemptId.trim();
  }
  return "";
}

export function terminalOwnerAttemptHasExpiredLease(
  attempt: TaskAttempt | null | undefined,
  sessionStatus: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (
    attempt?.state !== "running" ||
    !attempt.handler?.startsWith("owner:") ||
    !attempt.sessionId ||
    attempt.lease?.sessionId !== attempt.sessionId ||
    sessionStatus === "running" ||
    sessionStatus === "idle"
  ) {
    return false;
  }
  const expiresAt = Date.parse(attempt.lease?.expiresAt ?? "");
  return Number.isFinite(expiresAt) && expiresAt <= nowMs;
}

export function activeTaskSessionId(task: TaskNode, tree = loadTaskTree()): string {
  if (typeof task.session_id === "string" && task.session_id.trim()) {
    return task.session_id.trim();
  }
  const trace = recordValue(task.trace);
  const reconciliation = recordValue(trace?.reconciliation);
  const trigger = recordValue(reconciliation?.trigger);
  const triggerData = recordValue(trigger?.data) ?? trigger;
  for (const key of ["sessionId", "session_id"]) {
    const value = triggerData?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const resource = taskId ? recordValue(tree.resources?.[taskId]) : null;
  const status = recordValue(resource?.status);
  const attemptId =
    typeof status?.currentAttemptId === "string"
      ? status.currentAttemptId.trim()
      : "";
  const attempt = attemptId ? recordValue(tree.attempts?.[attemptId]) : null;
  if (typeof attempt?.sessionId === "string" && attempt.sessionId.trim()) {
    return attempt.sessionId.trim();
  }
  return "";
}

function activeTaskQueuedAssignmentMatches(task: TaskNode): boolean {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  if (!taskId) return false;
  const attemptId = activeTaskAttemptId(task);
  if (!attemptId) return false;
  return peekTaskAssignments(runtimeTaskTreeConfig()).some(
    (assignment) =>
      assignment.taskId === taskId && assignment.attemptId === attemptId,
  );
}

function queuedAssignmentTimestampMs(assignment: {
  assignedAt?: unknown;
}): number | null {
  const raw =
    typeof assignment.assignedAt === "string"
      ? assignment.assignedAt.trim()
      : "";
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function recentTerminalSessionObservedAtMs(input: {
  lastSessionEndedAt?: number | null;
  lastSessionLastActivityAt?: number | null;
}): number | null {
  return typeof input.lastSessionEndedAt === "number" &&
    Number.isFinite(input.lastSessionEndedAt)
    ? input.lastSessionEndedAt
    : typeof input.lastSessionLastActivityAt === "number" &&
          Number.isFinite(input.lastSessionLastActivityAt)
      ? input.lastSessionLastActivityAt
      : null;
}

export function ownerSessionRecentCompletionGapLooksHealthy(input: {
  sessionStatus?: string | null;
  sessionOutcome?: string | null;
  lastSessionEndedAt?: number | null;
  lastSessionLastActivityAt?: number | null;
  nowMs?: number;
  gapGraceMs?: number;
}): boolean {
  if (input.sessionStatus !== "done") return false;
  if (input.sessionOutcome === "error" || input.sessionOutcome === "interrupted") {
    return false;
  }
  const lastObservedAt = recentTerminalSessionObservedAtMs(input);
  if (lastObservedAt === null) return false;
  const nowMs = input.nowMs ?? Date.now();
  const gapGraceMs = input.gapGraceMs ?? sessionStartGraceMs;
  return nowMs >= lastObservedAt && nowMs - lastObservedAt <= gapGraceMs;
}

function ownerSessionRecentCompletionGapLooksHealthyFromRow(
  row: Record<string, unknown> | null,
): boolean {
  return ownerSessionRecentCompletionGapLooksHealthy({
    sessionStatus: typeof row?.status === "string" ? row.status : null,
    sessionOutcome: typeof row?.outcome === "string" ? row.outcome : null,
    lastSessionEndedAt:
      typeof row?.endedAt === "number" && Number.isFinite(row.endedAt)
        ? row.endedAt
        : null,
    lastSessionLastActivityAt:
      typeof row?.lastActivityAt === "number" &&
      Number.isFinite(row.lastActivityAt)
        ? row.lastActivityAt
        : null,
  });
}

export function workflowRunRecentSessionGapLooksHealthy(input: {
  workflowStatus?: string | null;
  workflowEndedAt?: number | null;
  sessionStatus?: string | null;
  lastSessionEndedAt?: number | null;
  lastSessionLastActivityAt?: number | null;
  nowMs?: number;
  gapGraceMs?: number;
}): boolean {
  if (input.workflowStatus !== "running" && input.workflowStatus !== "done") {
    return false;
  }
  if (input.sessionStatus === "running") return false;
  if (
    input.sessionStatus === "error" ||
    input.sessionStatus === "interrupted"
  ) {
    return false;
  }
  const sessionObservedAt = recentTerminalSessionObservedAtMs(input);
  const workflowEndedAt =
    typeof input.workflowEndedAt === "number" &&
    Number.isFinite(input.workflowEndedAt)
      ? input.workflowEndedAt
      : null;
  const lastObservedAt =
    sessionObservedAt === null
      ? workflowEndedAt
      : workflowEndedAt === null
        ? sessionObservedAt
        : Math.max(sessionObservedAt, workflowEndedAt);
  if (lastObservedAt === null) return false;
  const nowMs = input.nowMs ?? Date.now();
  const gapGraceMs = input.gapGraceMs ?? sessionStartGraceMs;
  return nowMs >= lastObservedAt && nowMs - lastObservedAt <= gapGraceMs;
}

function workflowRunRecentSessionGapLooksHealthyFromRow(
  row: Record<string, unknown> | null,
): boolean {
  return workflowRunRecentSessionGapLooksHealthy({
    workflowStatus:
      typeof row?.workflowStatus === "string" ? row.workflowStatus : null,
    workflowEndedAt:
      typeof row?.workflowEndedAt === "number" &&
      Number.isFinite(row.workflowEndedAt)
        ? row.workflowEndedAt
        : null,
    sessionStatus: typeof row?.status === "string" ? row.status : null,
    lastSessionEndedAt:
      typeof row?.endedAt === "number" && Number.isFinite(row.endedAt)
        ? row.endedAt
        : null,
    lastSessionLastActivityAt:
      typeof row?.lastActivityAt === "number" &&
      Number.isFinite(row.lastActivityAt)
        ? row.lastActivityAt
        : null,
  });
}

export function workflowDispatchRecentStartLooksHealthy(input: {
  dispatchStatus?: string | null;
  dispatchTimestamp?: number | null;
  nowMs?: number;
  gapGraceMs?: number;
}): boolean {
  if (
    input.dispatchStatus !== "started" &&
    input.dispatchStatus !== "done"
  ) {
    return false;
  }
  const dispatchTimestamp =
    typeof input.dispatchTimestamp === "number" &&
    Number.isFinite(input.dispatchTimestamp)
      ? input.dispatchTimestamp
      : null;
  if (dispatchTimestamp === null) return false;
  const nowMs = input.nowMs ?? Date.now();
  const gapGraceMs =
    input.gapGraceMs ?? workflowDispatchStartGraceMs;
  return (
    nowMs >= dispatchTimestamp && nowMs - dispatchTimestamp <= gapGraceMs
  );
}

function workflowDispatchRecentStartLooksHealthyFromRow(
  row: Record<string, unknown> | null,
): boolean {
  return workflowDispatchRecentStartLooksHealthy({
    dispatchStatus:
      typeof row?.dispatchStatus === "string" ? row.dispatchStatus : null,
    dispatchTimestamp:
      typeof row?.dispatchTimestamp === "number" &&
      Number.isFinite(row.dispatchTimestamp)
        ? row.dispatchTimestamp
        : null,
  });
}

export function assignmentStillLooksUnconsumed(input: {
  taskState: string | null;
  currentAttemptId: string | null;
  assignmentAttemptId: string;
  workerStartedAttemptId?: string | null;
  hasHealthyWorkerSession?: boolean;
  hasHealthyOwnerSession?: boolean;
  hasHealthyOwnerGap?: boolean;
  hasHealthyWorkflowSession?: boolean;
  hasHealthyWorkflowGap?: boolean;
  hasHealthyDispatchStartGap?: boolean;
}): boolean {
  if (
    input.taskState !== "active" ||
    input.currentAttemptId !== input.assignmentAttemptId
  ) {
    return true;
  }
  if (input.workerStartedAttemptId === input.assignmentAttemptId) return false;
  if (input.hasHealthyWorkerSession) return false;
  if (input.hasHealthyOwnerSession) return false;
  if (input.hasHealthyOwnerGap) return false;
  if (input.hasHealthyWorkflowSession) return false;
  if (input.hasHealthyWorkflowGap) return false;
  if (input.hasHealthyDispatchStartGap) return false;
  return true;
}

function assignmentNotConsumedDetails(): Array<{
  taskId: string;
  attemptId: string;
  assignedAt: string;
  taskState: string | null;
}> {
  const tree = loadTaskTree();
  return peekTaskAssignments(runtimeTaskTreeConfig()).flatMap((assignment) => {
    const taskId = assignment.taskId.trim();
    const attemptId = assignment.attemptId.trim();
    const assignedAt = assignment.assignedAt.trim();
    if (!taskId || !attemptId) return [];

    const assignedMs = queuedAssignmentTimestampMs(assignment);
    if (assignedMs != null && Date.now() - assignedMs <= sessionStartGraceMs) {
      return [];
    }

    const task = tree.tasks?.[taskId];
    const state = task ? taskState(task) : null;
    const trace = task?.trace ?? {};
    const currentAttempt = activeTaskAttemptId(task);
    const startedAttempt =
      typeof trace.worker_started_attempt_id === "string"
        ? trace.worker_started_attempt_id.trim()
        : "";
    const sessionId =
      typeof task?.session_id === "string" && task.session_id.trim()
        ? task.session_id.trim()
        : typeof assignment.sessionId === "string" &&
            assignment.sessionId.trim()
          ? assignment.sessionId.trim()
          : null;
    const workerRow = activeTaskWorkerSessionRow(taskId, attemptId, sessionId);
    const ownerRow = task ? activeOwnerTaskSessionRow(task) : null;
    const workflowRow = task ? activeWorkflowTaskSessionRow(task) : null;
    const dispatchRow = task
      ? activeWorkflowDispatchEventRow(task, assignedMs)
      : null;

    if (
      !assignmentStillLooksUnconsumed({
        taskState: state,
        currentAttemptId: currentAttempt,
        assignmentAttemptId: attemptId,
        workerStartedAttemptId: startedAttempt,
        hasHealthyWorkerSession:
          sessionRestartReasonFromRow(workerRow) === null,
        hasHealthyOwnerSession: sessionRestartReasonFromRow(ownerRow) === null,
        hasHealthyOwnerGap:
          ownerSessionRecentCompletionGapLooksHealthyFromRow(ownerRow),
        hasHealthyWorkflowSession:
          sessionRestartReasonFromRow(workflowRow) === null,
        hasHealthyWorkflowGap:
          workflowRunRecentSessionGapLooksHealthyFromRow(workflowRow),
        hasHealthyDispatchStartGap:
          workflowDispatchRecentStartLooksHealthyFromRow(dispatchRow),
      })
    ) {
      return [];
    }

    return [{ taskId, attemptId, assignedAt, taskState: state }];
  });
}

function activeTaskIsWithinStartGrace(task: TaskNode): boolean {
  const trace = recordValue(task.trace);
  const activeAttempt = recordValue(task.active_attempt);
  const reconciliation = recordValue(trace?.reconciliation);
  const trigger = recordValue(reconciliation?.trigger);
  const triggerData = recordValue(trigger?.data) ?? trigger;
  const resource = activeTaskResource(task);
  const status = recordValue(resource?.status);
  const candidates = [
    typeof trace?.assigned_at === "string" ? trace.assigned_at : undefined,
    typeof trace?.worker_started_at === "string"
      ? trace.worker_started_at
      : undefined,
    typeof activeAttempt?.started_at === "string"
      ? activeAttempt.started_at
      : undefined,
    typeof status?.updatedAt === "string" ? status.updatedAt : undefined,
    typeof triggerData?.assignedAt === "string"
      ? triggerData.assignedAt
      : undefined,
    typeof triggerData?.assigned_at === "string"
      ? triggerData.assigned_at
      : undefined,
  ].filter((value): value is string => Boolean(value));
  for (const value of candidates) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && Date.now() - parsed <= sessionStartGraceMs) {
      return true;
    }
  }
  return false;
}

export function ownerTaskSessionMatchesTaskId(input: {
  taskId?: string | null;
  sessionTask?: string | null;
}): boolean {
  const taskId =
    typeof input.taskId === "string" ? input.taskId.trim() : "";
  const sessionTask =
    typeof input.sessionTask === "string" ? input.sessionTask : "";
  if (!taskId || !sessionTask) return false;
  return [
    `"taskId": "${taskId}"`,
    `"taskId":"${taskId}"`,
    `"task_id": "${taskId}"`,
    `"task_id":"${taskId}"`,
  ].some((needle) => sessionTask.includes(needle));
}

const ownerTaskSessionPromptCache = new Map<string, string | null>();

function ownerTaskSessionPromptFromRef(taskRef: string): string | null {
  const normalizedRef = taskRef.trim();
  if (!normalizedRef) return null;
  if (ownerTaskSessionPromptCache.has(normalizedRef)) {
    return ownerTaskSessionPromptCache.get(normalizedRef) ?? null;
  }
  const meta = readJson<{ task?: unknown }>(
    resolve(sessionsDirPath, "..", normalizedRef),
    {},
  );
  const task = typeof meta.task === "string" ? meta.task : null;
  ownerTaskSessionPromptCache.set(normalizedRef, task);
  return task;
}

function ownerTaskSessionRowMatchesTaskId(
  row: Record<string, unknown>,
  taskId: string,
): boolean {
  const inlineTask = typeof row.task === "string" ? row.task : null;
  if (ownerTaskSessionMatchesTaskId({ taskId, sessionTask: inlineTask })) {
    return true;
  }
  const taskRef =
    typeof row.task_ref === "string" ? row.task_ref.trim() : "";
  if (!taskRef) return false;
  return ownerTaskSessionMatchesTaskId({
    taskId,
    sessionTask: ownerTaskSessionPromptFromRef(taskRef),
  });
}

function activeOwnerTaskSessionRow(
  task: TaskNode,
): Record<string, unknown> | null {
  if (!existsSync(stateDbPath)) return null;
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const activeAttempt = recordValue(task.active_attempt);
  const resource = activeTaskResource(task);
  const resourceSpec = recordValue(resource?.spec);
  const resourceStatus = recordValue(resource?.status);
  const handler =
    typeof activeAttempt?.handler === "string"
      ? activeAttempt.handler.trim()
      : typeof resourceSpec?.owner === "string" && resourceSpec.owner.trim()
        ? `owner:${resourceSpec.owner.trim()}`
        : "";
  if (!taskId || !handler.startsWith("owner:")) return null;
  const agent = handler.slice("owner:".length).trim();
  const startedAtText =
    typeof activeAttempt?.started_at === "string"
      ? activeAttempt.started_at.trim()
      : typeof resourceStatus?.updatedAt === "string"
        ? resourceStatus.updatedAt.trim()
        : "";
  const startedAt = startedAtText ? Date.parse(startedAtText) : Number.NaN;
  if (!agent || !Number.isFinite(startedAt)) return null;

  const db = new Database(stateDbPath, { readonly: true });
  try {
    const rows = db
      .query(
        `
        select
          sessionId,
          status,
          outcome,
          startedAt,
          lastActivityAt,
          endedAt,
          task,
          task_ref
        from sessions
        where projectId = ?
          and source = 'project-app-task-owner'
          and agent = ?
          and startedAt between ? and ?
        order by
          case
            when status = 'running' then 0
            when status = 'done' then 1
            else 2
          end,
          abs(startedAt - ?) asc,
          startedAt desc
        limit 10
      `,
      )
      .all(
        "aks-rp-e2e",
        agent,
        startedAt - 60000,
        startedAt + 60000,
        startedAt,
      ) as Array<Record<string, unknown>>;
    for (const row of rows) {
      if (ownerTaskSessionRowMatchesTaskId(row, taskId)) return row;
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function normalizeWorkflowTaskLivenessRow(
  workflowRow: Record<string, unknown>,
  sessionRow: Record<string, unknown> | null,
): Record<string, unknown> {
  if (sessionRow) return { ...workflowRow, ...sessionRow };

  const workflowStatus =
    typeof workflowRow.workflowStatus === "string"
      ? workflowRow.workflowStatus.trim()
      : "";
  const workflowStartedAt =
    typeof workflowRow.workflowStartedAt === "number" &&
    Number.isFinite(workflowRow.workflowStartedAt)
      ? workflowRow.workflowStartedAt
      : null;
  const workflowEndedAt =
    typeof workflowRow.workflowEndedAt === "number" &&
    Number.isFinite(workflowRow.workflowEndedAt)
      ? workflowRow.workflowEndedAt
      : null;
  const workflowRunId =
    typeof workflowRow.workflowRunId === "string"
      ? workflowRow.workflowRunId.trim()
      : "";

  if (!workflowStatus) return workflowRow;

  return {
    ...workflowRow,
    sessionId: workflowRunId || undefined,
    status: workflowStatus,
    startedAt: workflowStartedAt,
    lastActivityAt: workflowEndedAt ?? workflowStartedAt,
    endedAt: workflowEndedAt,
  };
}

function activeWorkflowTaskSessionRow(
  task: TaskNode,
): Record<string, unknown> | null {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const resource = activeTaskResource(task);
  const resourceSpec = recordValue(resource?.spec);
  const workflow =
    typeof task.workflow === "string" && task.workflow.trim()
      ? task.workflow.trim()
      : typeof resourceSpec?.workflow === "string" &&
          resourceSpec.workflow.trim()
        ? resourceSpec.workflow.trim()
        : "";
  if (!taskId || !workflow || !existsSync(stateDbPath)) return null;
  const taskIdPattern = new RegExp(
    String.raw`"(?:taskId|id)"\s*:\s*"${taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
  );
  const db = new Database(stateDbPath, { readonly: true });
  try {
    if (!sqliteTableExists(db, "workflow_runs")) {
      return null;
    }
    const workflowRows = db
      .query(
        `
        select
          w.runId as workflowRunId,
          w.status as workflowStatus,
          w.startedAt as workflowStartedAt,
          w.endedAt as workflowEndedAt,
          w.task as workflowTask
        from workflow_runs w
        where w.projectId = ?
          and w.workflow = ?
          and w.status in ('running', 'done')
        order by
          case
            when w.status = 'running' then 0
            when w.status = 'done' then 1
            else 2
          end,
          coalesce(w.endedAt, w.startedAt) desc
        limit 200
      `,
      )
      .all("aks-rp-e2e", workflow) as Array<Record<string, unknown>>;
    const hasSessions = sqliteTableExists(db, "sessions");
    for (const workflowRow of workflowRows) {
      const taskText =
        typeof workflowRow.workflowTask === "string"
          ? workflowRow.workflowTask
          : "";
      if (!taskIdPattern.test(taskText)) continue;
      if (!hasSessions) return normalizeWorkflowTaskLivenessRow(workflowRow, null);
      const workflowRunId =
        typeof workflowRow.workflowRunId === "string"
          ? workflowRow.workflowRunId.trim()
          : "";
      if (!workflowRunId) {
        return normalizeWorkflowTaskLivenessRow(workflowRow, null);
      }
      const sessionRow = db
        .query(
          `
          select sessionId, status, outcome, startedAt, lastActivityAt, endedAt
          from sessions
          where workflowRunId = ?
          order by case when status = 'running' then 0 else 1 end, startedAt desc
          limit 1
        `,
        )
        .get(workflowRunId) as Record<string, unknown> | null;
      return normalizeWorkflowTaskLivenessRow(workflowRow, sessionRow);
    }
    return null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function activeWorkflowDispatchEventRow(
  task: TaskNode,
  earliestTimestampMs?: number | null,
): Record<string, unknown> | null {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const resource = activeTaskResource(task);
  const resourceSpec = recordValue(resource?.spec);
  const workflow =
    typeof task.workflow === "string" && task.workflow.trim()
      ? task.workflow.trim()
      : typeof resourceSpec?.workflow === "string" &&
          resourceSpec.workflow.trim()
        ? resourceSpec.workflow.trim()
        : "";
  if (!taskId || !workflow || !existsSync(stateDbPath)) return null;
  const minTimestampMs =
    typeof earliestTimestampMs === "number" &&
    Number.isFinite(earliestTimestampMs)
      ? earliestTimestampMs
      : 0;
  const db = new Database(stateDbPath, { readonly: true });
  try {
    if (!sqliteTableExists(db, "events")) return null;
    return db
      .query(
        `
        select
          subject_status as dispatchStatus,
          timestamp as dispatchTimestamp,
          workflow_run_id as workflowRunId
        from events
        where project_id = ?
          and task_id = ?
          and event_type = 'handler.workflow_dispatched'
          and timestamp >= ?
        order by timestamp desc
        limit 1
      `,
      )
      .get("aks-rp-e2e", taskId, minTimestampMs) as Record<string, unknown> | null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

function activeTaskHasFreshGitHubRun(task: TaskNode): boolean {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  if (!taskId) return false;
  const workspaceDir = join(projectDir, "workspace", taskId);
  const runStatusFiles = listFiles(
    workspaceDir,
    (path) =>
      extname(path) === ".json" &&
      path.split("/").pop()?.startsWith("run-status") === true,
  );
  if (runStatusFiles.length === 0) return false;

  let freshestMs = Number.NEGATIVE_INFINITY;
  let freshestStatus = "";
  for (const path of runStatusFiles) {
    const payload = readJson<Record<string, unknown>>(path, {});
    const nested = recordValue(payload.json) ?? payload;
    const status =
      typeof nested.status === "string"
        ? nested.status.trim().toLowerCase()
        : "";
    const updatedAt =
      typeof nested.updated_at === "string"
        ? nested.updated_at
        : typeof nested.run_started_at === "string"
          ? nested.run_started_at
          : "";
    const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    if (!Number.isFinite(updatedMs) || updatedMs < freshestMs) continue;
    freshestMs = updatedMs;
    freshestStatus = status;
  }

  if (!Number.isFinite(freshestMs)) return false;
  if (
    !["queued", "pending", "waiting", "requested", "in_progress"].includes(
      freshestStatus,
    )
  ) {
    return false;
  }
  return Date.now() - freshestMs <= staleActiveNoActivityMs;
}

function activeTaskRestartReason(task: TaskNode): string | null {
  const taskId = typeof task.id === "string" ? task.id.trim() : "";
  const sessionId = activeTaskSessionId(task);
  const verifierByTaskId = loadVerifierLivenessByTaskId();
  const verifier = taskId ? verifierByTaskId.get(taskId) : undefined;
  const featureCompactByTaskId = featureCompactLoopByTaskId();
  const featureCompact = taskId
    ? featureCompactByTaskId.get(taskId)
    : undefined;
  const currentAttemptId = activeTaskAttemptId(task) || null;
  const canonicalTree = loadTaskTree();
  const currentAttempt = currentAttemptId ? canonicalTree.attempts?.[currentAttemptId] : null;
  if (
    terminalOwnerAttemptHasExpiredLease(
      currentAttempt,
      currentAttempt?.sessionId ? persistedSessionStatus(currentAttempt.sessionId) : null,
    )
  ) {
    return "terminal-owner-session-expired-lease";
  }

  if (
    task.workflow === "single-spec-verifier" &&
    verifier &&
    verifier.activeAttemptId === currentAttemptId
  ) {
    const heartbeatMs = verifier.heartbeatAt
      ? Date.parse(verifier.heartbeatAt)
      : Number.NaN;
    if (
      Number.isFinite(heartbeatMs) &&
      Date.now() - heartbeatMs <= staleActiveNoActivityMs
    ) {
      return null;
    }
    return "verifier-no-heartbeat";
  }

  if (task.workflow === "feature-compact-planner" && featureCompact) {
    const heartbeatMs = featureCompact.heartbeatAt
      ? Date.parse(featureCompact.heartbeatAt)
      : Number.NaN;
    const compactAttemptMatches =
      featureCompact.activeAttemptId != null &&
      currentAttemptId != null &&
      featureCompact.activeAttemptId === currentAttemptId;
    if (
      Number.isFinite(heartbeatMs) &&
      Date.now() - heartbeatMs <= staleActiveNoActivityMs
    ) {
      return null;
    }
    if (featureCompact.activeWorkflowRunId) return null;
    if (compactAttemptMatches) return "feature-compact-no-heartbeat";
  }

  if (!sessionId) {
    if (
      activeTaskIsWithinStartGrace(task) ||
      activeTaskQueuedAssignmentMatches(task)
    ) {
      return null;
    }
    const workerRow = taskId
      ? activeTaskWorkerSessionRow(taskId, currentAttemptId, null)
      : null;
    if (sessionFinishedWithinTerminalCompletionGrace(workerRow)) return null;
    if (sessionRestartReasonFromRow(workerRow) === null) return null;
    const ownerRow = activeOwnerTaskSessionRow(task);
    if (sessionRestartReasonFromRow(ownerRow) === null) return null;
    if (ownerSessionRecentCompletionGapLooksHealthyFromRow(ownerRow)) {
      return null;
    }
    const workflowRow = activeWorkflowTaskSessionRow(task);
    if (sessionRestartReasonFromRow(workflowRow) === null) return null;
    if (workflowRunRecentSessionGapLooksHealthyFromRow(workflowRow)) {
      return null;
    }
    const dispatchRow = activeWorkflowDispatchEventRow(task);
    if (workflowDispatchRecentStartLooksHealthyFromRow(dispatchRow)) {
      return null;
    }
    return "missing-session";
  }
  const reason = sessionRestartReason(sessionId);
  if (
    reason === "session-not-running" &&
    (activeTaskIsWithinStartGrace(task) ||
      activeTaskQueuedAssignmentMatches(task))
  ) {
    return null;
  }
  if (
    reason === "session-not-running" &&
    sessionId.startsWith("s_task_") &&
    taskId
  ) {
    const workerRow = activeTaskWorkerSessionRow(
      taskId,
      currentAttemptId,
      sessionId,
    );
    if (sessionFinishedWithinTerminalCompletionGrace(workerRow)) return null;
    const workerReason = sessionRestartReasonFromRow(workerRow);
    if (workerReason === null) return null;
    if (workerReason !== "session-not-running") return workerReason;

    if (
      task.workflow === "feature-compact-planner" &&
      featureCompact &&
      featureCompact.activeWorkflowRunId
    ) {
      return null;
    }

    const featureRow = activeTaskFeatureReferenceSessionRow(task);
    if (sessionFinishedWithinTerminalCompletionGrace(featureRow)) return null;
    const featureReason = sessionRestartReasonFromRow(featureRow);
    if (featureReason === null) return null;
    if (featureReason !== "session-not-running") return featureReason;

    if (activeTaskHasFreshGitHubRun(task)) return null;
  }
  return reason;
}

function staleActiveTaskDetails(): StaleActiveTaskInfo[] {
  return activeLeafTasks().flatMap((task) => {
    const restartReason = activeTaskRestartReason(task);
    const taskId = typeof task.id === "string" ? task.id.trim() : "";
    const currentAttemptId = activeTaskAttemptId(task) || null;
    const workerRow = taskId
      ? activeTaskWorkerSessionRow(taskId, currentAttemptId, null)
      : null;
    const ownerRow = activeOwnerTaskSessionRow(task);
    const workflowRow = activeWorkflowTaskSessionRow(task);
    const sessionId =
      activeTaskSessionId(task) ||
      (typeof ownerRow?.sessionId === "string"
        ? ownerRow.sessionId.trim()
        : "") ||
      (typeof workflowRow?.sessionId === "string"
        ? workflowRow.sessionId.trim()
        : "") ||
      (typeof workerRow?.sessionId === "string"
        ? workerRow.sessionId.trim()
        : "") ||
      null;
    if (!restartReason || !taskId) return [];
    return [{ taskId, sessionId, restartReason }];
  });
}

function staleActiveTaskCount(): number {
  return staleActiveTaskDetails().length;
}

function runningActiveTaskCount(): number {
  return activeLeafTasks().filter((task) => !activeTaskRestartReason(task))
    .length;
}

function hasLiveExecutionRunnableBacklog(): boolean {
  return listRunnableBacklogTaskIds(
    taskTreeConfig({
      appDir: effectiveAppDir,
      projectDir,
      worker: "aks-explorer",
      maxConcurrent: desiredParallelism,
    }),
    200,
  ).some((taskId) => {
    const haystack = taskId.toLowerCase();
    return [
      "staging",
      "execute",
      "execution",
      "verify",
      "verification",
      "frontier",
      "spec-runner",
      "ready-spec-execution",
      "live",
    ].some((signal) => haystack.includes(signal));
  });
}

function runResults(): RunResult[] {
  return listFiles(join(projectDir, "runs", "executions"), (path) =>
    path.endsWith("/result.json"),
  ).map((path) => readJson<RunResult>(path, {}));
}

function isLiveRun(run: RunResult): boolean {
  return (
    run.dryRun === false ||
    run.mode === "execute" ||
    run.mode === "executing" ||
    run.probeEvidence?.mode === "execute" ||
    run.probeEvidence?.mode === "executing" ||
    run.probeEvidence?.mode === "cloud-execution"
  );
}

function runTime(run: RunResult): number | null {
  for (const value of [run.completedAt, run.endedAt, run.startedAt]) {
    if (!value) continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function liveRuns24h(): RunResult[] {
  return runResults().filter((run) => {
    if (!isLiveRun(run)) return false;
    const ts = runTime(run);
    return ts != null && ts >= dayAgo;
  });
}

function duplicateArtifactCount(): number {
  const archiveDir = join(projectDir, "evidence", "archive");
  const groups = new Map<string, number>();
  for (const path of listFiles(
    archiveDir,
    (item) => extname(item) === ".json" || extname(item) === ".md",
  )) {
    const base = path.split("/").pop() ?? "";
    // Metric-alert/admin evidence is required workflow bookkeeping, not AKS
    // feature/run evidence. Counting repeated alert-note families here creates a
    // self-breaching hygiene loop where alert triage artifacts inflate the
    // duplicate-artifact metric themselves.
    if (
      base.startsWith("metric-alert-") ||
      base.startsWith("artifact-duplicate-group-count-")
    ) {
      continue;
    }
    const key = base
      .replace(/-\d{8}T\d{6}Z(?=-|\.|$)/g, "")
      .replace(/-\d{8,}(?=-|\.|$)/g, "")
      .replace(/-iteration\d+(?=-|\.|$)/g, "")
      .replace(/--+/g, "-")
      .replace(/-\./g, ".");
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.values()].filter((count) => count > 3).length;
}

function plannerRuns(): PlannerRun[] {
  const plannerRunsPath = join(effectiveAppDir, ".state", "planner-runs.jsonl");
  if (!existsSync(plannerRunsPath)) return [];
  try {
    return readFileSync(plannerRunsPath, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PlannerRun)
      .filter((row) => row.kind === "planner_wake");
  } catch {
    return [];
  }
}

function plannerRunTimestamp(run: PlannerRun): number | null {
  const parsed = typeof run.ts === "string" ? Date.parse(run.ts) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function recentPlannerRuns(hours: number): PlannerRun[] {
  const since = now - hours * 60 * 60 * 1000;
  return plannerRuns().filter((run) => {
    const ts = plannerRunTimestamp(run);
    return ts != null && ts >= since;
  });
}

function plannerTimedOut(run: PlannerRun): boolean {
  const result = (run.result ?? "").toLowerCase();
  return result.includes("timed out after");
}

function plannerTouchesOwnerSteps(run: PlannerRun): boolean {
  return (
    run.steps?.includes("event-review") ||
    run.steps?.includes("planning-update") ||
    false
  );
}

function plannerTimeoutCount24h(runs: PlannerRun[]): number {
  return runs.filter(
    (run) => plannerTouchesOwnerSteps(run) && plannerTimedOut(run),
  ).length;
}

function isSlowPlannerRun(run: PlannerRun): boolean {
  if (!plannerTouchesOwnerSteps(run) || plannerTimedOut(run)) {
    return false;
  }
  if (typeof run.durationMs === "number" && Number.isFinite(run.durationMs)) {
    return run.durationMs >= 180_000;
  }
  const status = (run.status ?? "").toLowerCase();
  return status === "interrupted" || status === "cancelled";
}

export function metricSampleOutputsFor(
  metricIds: string[],
): Record<string, MetricSampleOutput> {
  const tasks = taskCounts();
  const model = modelStatus();
  const pathStatus = model.paths?.byStatus ?? {};
  const featureStatus = model.features?.byStatus ?? {};
  const pathGaps = pathGapCount();
  const specs = specMetrics();
  const specRecovery = specLoopRecoveryStats();
  const openGaps = pathGaps + specs.unverified;
  const live = liveRuns24h();
  const plannerRecent = recentPlannerRuns(24);
  const healthyActive =
    tasks.activeRunning > 0
      ? tasks.activeRunning
      : Math.max(0, tasks.active - tasks.activeStale);
  const blockedActionability = blockedFrontierActionability();
  const loopUnrepresented = loopUnrepresentedRecordDetails();
  const assignmentMismatches =
    openTaskAssignmentStateMismatchDetails(loadTaskTree());
  const assignmentNotConsumed = assignmentNotConsumedDetails();
  const approvalBlockedSuppression =
    !tasks.projectClosed &&
    tasks.runnable === 0 &&
    healthyActive === 0 &&
    tasks.review === 0 &&
    openGaps > 0 &&
    tasks.approvalBlockedDisposition.covered;
  const approvalBlockedNote = approvalBlockedSuppression
    ? JSON.stringify({
        disposition: "approval-gated-blocked-only",
        focusTaskIds: tasks.approvalBlockedDisposition.focusTaskIds,
        governingWaitTaskIds:
          tasks.approvalBlockedDisposition.governingWaitTaskIds,
      })
    : undefined;
  const waitCoveredFrontier = representedWaitCoveredFrontierDisposition({
    projectClosed: tasks.projectClosed,
    runnable: tasks.runnable,
    healthyActive,
    review: tasks.review,
    openGaps,
    loopUnrepresentedCount: loopUnrepresented.value,
    loopAuthorityObservationCount: loopUnrepresented.authorityObservationCount,
    waitingTaskIds: tasks.waitingTaskIds,
  });
  const waitCoveredSuppression =
    !approvalBlockedSuppression && waitCoveredFrontier.covered;
  const fragileActiveOnlyRecovery =
    !approvalBlockedSuppression &&
    !waitCoveredSuppression &&
    !tasks.projectClosed &&
    tasks.runnable === 0 &&
    tasks.review === 0 &&
    healthyActive > 0 &&
    openGaps > 0 &&
    tasks.blocked > 0 &&
    tasks.activeDomainTaskIds.length === 0 &&
    tasks.activeOpsTaskIds.length === tasks.activeTaskIds.length &&
    tasks.activeOpsTaskIds.length > 0;
  const fragileActiveOnlyRecoveryNote = fragileActiveOnlyRecovery
    ? JSON.stringify({
        disposition: "fragile-active-only-recovery",
        activeTaskIds: tasks.activeTaskIds,
        activeOpsTaskIds: tasks.activeOpsTaskIds,
        activeDomainTaskIds: tasks.activeDomainTaskIds,
        blockedLeafCount: tasks.blocked,
        openGapCount: openGaps,
        healthyActiveCount: healthyActive,
      })
    : undefined;

  const values: Record<string, () => MetricSampleOutput> = {
    "aks-rp-e2e.task.ready-count": () => ({
      value: tasks.runnable,
      sampleSize: tasks.runnable,
      note: JSON.stringify({
        taskIds: listRunnableBacklogTaskIds(runtimeTaskTreeConfig(), 200),
        readySatisfiedWaitHolderIds: tasks.readySatisfiedWaitHolderIds,
      }),
    }),
    "aks-rp-e2e.task.active-count": () => ({
      value: tasks.active,
      sampleSize: tasks.activeTaskIds.length,
      note: JSON.stringify({
        taskIds: tasks.activeTaskIds,
      }),
    }),
    "aks-rp-e2e.task.stale-active-count": () => ({ value: tasks.activeStale }),
    "aks-rp-e2e.task.blocked-count": () => ({ value: tasks.blocked }),
    "aks-rp-e2e.task.blocked-actionable-count": () => ({
      value: blockedActionability.actionableCount,
      sampleSize: blockedActionability.actionableWarningTaskIds.length,
      note: JSON.stringify({
        blockedLeafCount: blockedActionability.blockedLeafCount,
        durableExactHolderCount: blockedActionability.durableExactHolderCount,
        actionableWarningTaskIds: blockedActionability.actionableWarningTaskIds,
        repeatedBlockerGroupKeys: blockedActionability.repeatedBlockerGroupKeys,
        motionStarved: blockedActionability.motionStarved,
        parentGroups: blockedActionability.parentGroups,
      }),
    }),
    "aks-rp-e2e.task.completed-24h": () => ({ value: tasks.completed24h }),
    "aks-rp-e2e.task.no-work-with-gaps": () => ({
      value:
        !approvalBlockedSuppression &&
        !waitCoveredSuppression &&
        !tasks.projectClosed &&
        tasks.runnable === 0 &&
        healthyActive === 0 &&
        openGaps > 0
          ? 1
          : 0,
      sampleSize: approvalBlockedSuppression
        ? tasks.approvalBlockedDisposition.focusTaskIds.length +
          tasks.approvalBlockedDisposition.governingWaitTaskIds.length
        : waitCoveredSuppression
          ? tasks.waitingTaskIds.length
          : fragileActiveOnlyRecovery
            ? tasks.activeTaskIds.length
            : undefined,
      note:
        approvalBlockedNote ??
        waitCoveredFrontier.note ??
        fragileActiveOnlyRecoveryNote,
    }),
    "aks-rp-e2e.task.ready-starvation-with-gaps": () => ({
      value:
        !approvalBlockedSuppression &&
        !waitCoveredSuppression &&
        !tasks.projectClosed &&
        tasks.runnable === 0 &&
        healthyActive === 0 &&
        tasks.review === 0 &&
        openGaps > 0
          ? 1
          : 0,
      sampleSize: approvalBlockedSuppression
        ? tasks.approvalBlockedDisposition.focusTaskIds.length +
          tasks.approvalBlockedDisposition.governingWaitTaskIds.length
        : waitCoveredSuppression
          ? tasks.waitingTaskIds.length
          : fragileActiveOnlyRecovery
            ? tasks.activeTaskIds.length
            : undefined,
      note:
        approvalBlockedNote ??
        waitCoveredFrontier.note ??
        fragileActiveOnlyRecoveryNote,
    }),
    "aks-rp-e2e.task.capacity-underfilled-with-gaps": () => ({
      value:
        !tasks.projectClosed &&
        tasks.runnable + tasks.activeRunning <
          Math.max(1, desiredParallelism) &&
        openGaps > 0
          ? 1
          : 0,
    }),
    "aks-rp-e2e.task.stale-active-with-gaps": () => ({
      value:
        !tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0,
    }),
    "aks-rp-e2e.process.unowned-work-count": () => {
      const staleActiveTasks = staleActiveTaskDetails();
      const staleWorkflowRuns = staleRunningWorkflowRunDetails();
      const value = tasks.projectClosed
        ? 0
        : staleActiveTasks.length +
          staleWorkflowRuns.length +
          assignmentMismatches.length +
          specRecovery.recoveryUnowned;
      return {
        value,
        sampleSize:
          staleActiveTasks.length +
          staleWorkflowRuns.length +
          assignmentMismatches.length +
          specRecovery.recoveryUnownedSpecIds.length,
        note: JSON.stringify({
          sampledAt: new Date().toISOString(),
          staleActiveTaskIds: staleActiveTasks.map((task) => task.taskId),
          staleActiveTaskSessions: staleActiveTasks.map((task) => ({
            taskId: task.taskId,
            sessionId: task.sessionId,
            restartReason: task.restartReason,
          })),
          staleWorkflowRuns,
          assignmentMismatchKeys: assignmentMismatches.map(
            (mismatch) => mismatch.correlationKey,
          ),
          assignmentMismatchTasks: assignmentMismatches,
          recoveryUnownedSpecIds: specRecovery.recoveryUnownedSpecIds,
        }),
      };
    },
    "aks-rp-e2e.process.assignment-state-mismatch-count": () => ({
      value: tasks.projectClosed ? 0 : tasks.assignmentStateMismatch,
      sampleSize: tasks.projectClosed ? 0 : assignmentMismatches.length,
      note: JSON.stringify({
        mismatches: tasks.projectClosed ? [] : assignmentMismatches,
      }),
    }),
    "aks-rp-e2e.process.assignment.not-consumed-count": () => ({
      value: tasks.projectClosed ? 0 : assignmentNotConsumed.length,
      sampleSize: assignmentNotConsumed.length,
      note: JSON.stringify({
        assignments: assignmentNotConsumed,
      }),
    }),
    "aks-rp-e2e.process.unpublished-change-count": () => ({
      value: unpublishedGitChangeCount(projectDir),
    }),
    "aks-rp-e2e.process.loop.unrepresented-record-count": () => ({
      value: loopUnrepresented.value,
      sampleSize: loopUnrepresented.taskIds.length,
      note: JSON.stringify({
        authorityObservationCount: loopUnrepresented.authorityObservationCount,
        taskIds: loopUnrepresented.taskIds,
        records: loopUnrepresented.records,
      }),
    }),
    "aks-rp-e2e.process.integrity.task-tree-problem-count": () => ({
      value: tasks.taskTreeProblemCount,
    }),
    "aks-rp-e2e.process.blocked.missing-waiting-for-count": () => ({
      value: tasks.blockedMissingWaitingFor,
      sampleSize: tasks.blockedMissingWaitingForTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedMissingWaitingForTaskIds,
      }),
    }),
    "aks-rp-e2e.process.blocked.missing-observer-count": () => ({
      value: tasks.blockedMissingObserver,
      sampleSize: tasks.blockedMissingObserverTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedMissingObserverTaskIds,
      }),
    }),
    "aks-rp-e2e.process.blocked.missing-resume-condition": () => ({
      value: tasks.blockedMissingResumeCondition,
      sampleSize: tasks.blockedMissingResumeConditionTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedMissingResumeConditionTaskIds,
      }),
    }),
    "aks-rp-e2e.process.blocked.missing-owner-count": () => ({
      value: tasks.blockedMissingOwner,
      sampleSize: tasks.blockedMissingOwnerTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedMissingOwnerTaskIds,
      }),
    }),
    "aks-rp-e2e.process.blocked.missing-fallback-count": () => ({
      value: tasks.blockedMissingFallback,
      sampleSize: tasks.blockedMissingFallbackTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedMissingFallbackTaskIds,
      }),
    }),
    "aks-rp-e2e.process.blocked.overdue-unworked-count": () => ({
      value: tasks.blockedOverdueUnworked,
      sampleSize: tasks.blockedOverdueUnworkedTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedOverdueUnworkedTaskIds,
      }),
    }),
    "aks-rp-e2e.process.blocked.overdue-nonhuman-unworked-count": () => ({
      value: tasks.blockedOverdueUnworked,
      sampleSize: tasks.blockedOverdueUnworkedTaskIds.length,
      note: JSON.stringify({
        offenderTaskIds: tasks.blockedOverdueUnworkedTaskIds,
        compatibilityAliasFor:
          "aks-rp-e2e.process.blocked.overdue-unworked-count",
      }),
    }),
    "aks-rp-e2e.model.unknown-path-count": () => ({
      value: (pathStatus.unknown ?? 0) + (pathStatus["source-enumerated"] ?? 0),
    }),
    "aks-rp-e2e.model.failed-path-count": () => ({
      value: pathStatus.fail ?? 0,
    }),
    "aks-rp-e2e.model.blocked-path-count": () => ({
      value: blockedPathCount(),
    }),
    "aks-rp-e2e.feature.unknown-count": () => ({
      value: (featureStatus.unknown ?? 0) + (featureStatus.partial ?? 0),
    }),
    "aks-rp-e2e.spec.total-count": () => ({ value: countSpecs() }),
    "aks-rp-e2e.spec.verified-count": () => ({ value: specs.verified }),
    "aks-rp-e2e.spec.reviewed-exception-count": () => ({
      value: specs.reviewedException,
    }),
    "aks-rp-e2e.spec.unverified-count": () => ({ value: specs.unverified }),
    "aks-rp-e2e.spec.failed-count": () => ({ value: specs.failed }),
    "aks-rp-e2e.spec.blocked-count": () => ({ value: specs.blocked }),
    "aks-rp-e2e.spec.ready-count": () => ({ value: specs.ready }),
    "aks-rp-e2e.spec.draft-count": () => ({ value: specs.draft }),
    "aks-rp-e2e.spec.retry-exhausted-count": () => ({
      value: specRecovery.retryExhausted,
    }),
    "aks-rp-e2e.spec.recovery-unowned-count": () => ({
      value: specRecovery.recoveryUnowned,
    }),
    "aks-rp-e2e.spec.unverified-without-work": () => ({
      value:
        !tasks.projectClosed &&
        specs.unverified > 0 &&
        !hasOpenSpecVerificationWork(tasks)
          ? 1
          : 0,
    }),
    "aks-rp-e2e.replay.script-count": () => ({ value: countReplays() }),
    "aks-rp-e2e.run.live-started-24h": () => ({ value: live.length }),
    "aks-rp-e2e.run.live-succeeded-24h": () => ({
      value: live.filter((run) =>
        ["pass", "passed", "success", "succeeded"].includes(run.status ?? ""),
      ).length,
    }),
    "aks-rp-e2e.run.live-failed-24h": () => ({
      value: live.filter((run) =>
        ["fail", "failed", "infra_failed", "blocked"].includes(
          run.status ?? "",
        ),
      ).length,
    }),
    "aks-rp-e2e.run.live-idle-with-runnable-work": () => ({
      value:
        !tasks.projectClosed &&
        countReplays() > 0 &&
        specs.unverified > 0 &&
        hasLiveExecutionRunnableBacklog() &&
        live.length === 0
          ? 1
          : 0,
    }),
    "aks-rp-e2e.planner.timeout-24h": () => ({
      value: plannerTimeoutCount24h(plannerRecent),
    }),
    "aks-rp-e2e.planner.slow-count-24h": () => ({
      value: plannerRecent.filter((run) => isSlowPlannerRun(run)).length,
    }),
    "aks-rp-e2e.artifact.duplicate-group-count": () => ({
      value: duplicateArtifactCount(),
    }),
  };

  const measuredAt = Date.now();
  const treePath = runtimeTaskTreeConfig().treePath;
  return Object.fromEntries(
    metricIds.map((metricId) => {
      const compute = values[metricId];
      if (!compute) {
        throw new Error(`Unknown metric id: ${metricId}`);
      }
      return [metricId, { measuredAt, treePath, ...compute() }];
    }),
  );
}

export function metricSampleOutputFor(metricId: string): MetricSampleOutput {
  return metricSampleOutputsFor([metricId])[metricId]!;
}

if (import.meta.main) {
  const batchIndex = process.argv.indexOf("--batch-json");
  if (batchIndex >= 0) {
    const metricIds = process.argv.slice(batchIndex + 1).filter(Boolean);
    if (metricIds.length === 0) {
      console.error(
        "Usage: bun run metrics:sample --batch-json <metric-id> [metric-id ...]",
      );
      process.exit(2);
    }
    console.log(JSON.stringify(metricSampleOutputsFor(metricIds)));
    process.exit(0);
  }
  const metricId = process.argv[2];
  if (!metricId || metricId === "--help" || metricId === "-h") {
    console.error("Usage: bun run metrics:sample <metric-id> [--json]");
    process.exit(2);
  }

  const asJson = process.argv.includes("--json");
  const sample = metricSampleOutputFor(metricId);
  if (asJson) {
    console.log(JSON.stringify(sample));
  } else {
    console.log(sample.value);
  }
}
