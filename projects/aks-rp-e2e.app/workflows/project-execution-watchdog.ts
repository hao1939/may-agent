/**
 * project-execution-watchdog — liveness observer for aks-rp-e2e.
 *
 * The project owner owns tasks/tree.json. This workflow only observes runtime
 * sessions and wakes the owner when review is needed.
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
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  normalizeTaskTreeInPlace,
  withTreeLock,
  type TaskTreeConfig,
  type TaskTree,
} from "./lib/task-tree-store.ts";
import {
  listRunnableBacklogTaskIds,
  waitingBacklogTaskSnapshots,
} from "./lib/task-tree-tools.ts";
import { syncProjectReadout } from "./lib/project-readout-sync.ts";
import { exactBlockedWaitStewardshipProgress } from "./lib/durable-loop-wait-stewardship.ts";
import { field, readJson, resolveAppDir } from "./lib/workflow-input.ts";

export const name = "project-execution-watchdog";
export const description =
  "Observe aks-rp-e2e task/session liveness and wake the project owner when review is needed.";

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
};

type OpenTaskSnapshot = {
  taskId: string;
  updatedAt?: string;
  blocker?: unknown;
  resumeAt?: string;
  resumeCondition?: string;
  reasons?: string[];
};

type WatchdogTreeSnapshot = {
  runnableBacklogTaskIds: string[];
  runnableBacklogTreeUpdatedAt?: string;
  runnableBacklogSnapshotAt: string;
  activeTasks: ActiveTaskSnapshot[];
  reviewTasks: OpenTaskSnapshot[];
  blockedTasks: OpenTaskSnapshot[];
  waitingBacklogTasks: OpenTaskSnapshot[];
  activeCount: number;
  hasOpenWork: boolean;
  needsRefill: boolean;
  durableLoopLiveness: DurableLoopLiveness[];
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
  needsAttention: boolean;
};

function parseInput(raw: string, defaultAgent: string): WatchdogConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(raw, "app"));

  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
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

function activeLeaves(tree: TaskTree): Array<TaskTree["tasks"][string]> {
  return Object.values(tree.tasks).filter(
    (task) => isLeaf(task) && task.status === "active",
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

function openTaskSnapshots(
  tree: TaskTree,
  state: "review" | "blocked",
): OpenTaskSnapshot[] {
  return leafTasksByStatus(tree, state)
    .map((task) => ({
      taskId: task.id,
      ...(taskUpdatedAt(task) ? { updatedAt: taskUpdatedAt(task) } : {}),
      ...(task.blocker !== undefined ? { blocker: task.blocker } : {}),
      ...(blockerStringField(task.blocker, ["resumeAt", "resume_at"])
        ? {
            resumeAt: blockerStringField(task.blocker, [
              "resumeAt",
              "resume_at",
            ]),
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
    }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
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
      needsAttention:
        ready === false &&
        (unrepresentedNonTerminalCount > 0 || !exactBlockedWaitStewardship),
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
    const sameSession =
      task.verifierLiveness.activeTaskSessionId === task.sessionId;
    const sameAttempt =
      !!task.currentAttemptId &&
      task.verifierLiveness.activeAttemptId === task.currentAttemptId;
    if (sameSession && sameAttempt) {
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

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const sharedConfig = buildTaskTreeConfig(config);
  try {
    syncProjectReadout(sharedConfig);
  } catch {
    // Watchdog should still observe/wake from tasks/tree.json even if compact
    // project.json summary refresh fails on this pulse.
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
      const verifierByTaskId = loadVerifierLivenessByTaskId(
        config.specLoopStatePath,
      );
      const activeTasks = activeTaskSnapshots(tree, verifierByTaskId);
      const reviewTasks = openTaskSnapshots(tree, "review");
      const blockedTasks = openTaskSnapshots(tree, "blocked");
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

  if (recovery.staleActiveTasks.length > 0) {
    const reason = "watchdog-stale-active-review";
    emitOwnerRequested(ctx, config, reason, {
      staleActiveTasks: recovery.staleActiveTasks,
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.reviewTasks.length > 0) {
    const reason = "watchdog-review-pending";
    emitOwnerRequested(ctx, config, reason, {
      reviewTasks: recovery.reviewTasks.slice(0, 20),
      reviewCount: recovery.reviewTasks.length,
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.runnableBacklogTaskIds.length > 0) {
    const reason = "watchdog-runnable-backlog";
    emitOwnerRequested(ctx, config, reason, {
      runnableBacklogTaskIds: recovery.runnableBacklogTaskIds,
      runnableBacklogTreeUpdatedAt: recovery.runnableBacklogTreeUpdatedAt,
      runnableBacklogSnapshotAt: recovery.runnableBacklogSnapshotAt,
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  const stalledLoops = recovery.durableLoopLiveness.filter(
    (loop) => loop.needsAttention,
  );
  if (
    stalledLoops.length > 0 &&
    recovery.activeCount === 0 &&
    recovery.reviewTasks.length === 0
  ) {
    const reason = "watchdog-durable-loop-stall";
    emitStallReviewRequested(ctx, config, reason, {
      mode: "fallback",
      durableLoopLiveness: stalledLoops,
      blockedCount: recovery.blockedTasks.length,
      waitingBacklogCount: recovery.waitingBacklogTasks.length,
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
    const waitingBacklogDetails =
      recovery.waitingBacklogTasks.length > 0
        ? {
            waitingBacklogTasks: recovery.waitingBacklogTasks.slice(0, 20),
            waitingBacklogCount: recovery.waitingBacklogTasks.length,
          }
        : {};
    emitOwnerRequested(ctx, config, reason, {
      blockedTasks: recovery.blockedTasks.slice(0, 20),
      blockedCount: recovery.blockedTasks.length,
      ...waitingBacklogDetails,
      instruction:
        "Review blocked and dependency-waiting tasks before treating underfilled capacity as idle. Push sampled blockers toward done, rework, a visible problem task, or an exact external ask/resume condition.",
    });
    return ctx.done(`Watchdog emitted project.planning.requested: ${reason}.`);
  }

  if (recovery.activeCount > 0 && recovery.activeCount < config.maxConcurrent) {
    const reason = "watchdog-capacity-underfilled";
    emitOwnerRequested(ctx, config, reason);
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
    emitOwnerRequested(ctx, config, reason);
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
