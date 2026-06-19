/**
 * project-execution-watchdog — liveness observer for aks-rp-e2e.
 *
 * The project owner owns tasks/tree.json. This workflow only observes runtime
 * sessions and wakes the owner when review is needed.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  normalizeTaskTreeInPlace,
  withTreeLock,
  type TaskTreeConfig,
  type TaskTree,
} from "./lib/task-tree-store.ts";
import { listRunnableBacklogTaskIds } from "./lib/task-tree-tools.ts";
import { field, readJson, resolveAppDir } from "./lib/workflow-input.ts";

export const name = "project-execution-watchdog";
export const description =
  "Observe aks-rp-e2e task/session liveness and wake the project owner when review is needed.";

type WatchdogConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  stateDbPath: string;
  agent: string;
  maxConcurrent: number;
  staleNoActivityMs: number;
  sessionStartGraceMs: number;
};

type ActiveTaskSnapshot = {
  taskId: string;
  sessionId?: string;
  assignedAt?: string;
  workerStartedAt?: string;
};

type WatchdogTreeSnapshot = {
  runnableBacklogTaskIds: string[];
  runnableBacklogTreeUpdatedAt?: string;
  runnableBacklogSnapshotAt: string;
  activeTasks: ActiveTaskSnapshot[];
  activeCount: number;
  hasOpenWork: boolean;
  needsRefill: boolean;
};

function parseInput(raw: string, defaultAgent: string): WatchdogConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(raw, "app"));

  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    stateDbPath: field(raw, "stateDb") ?? "/app/.state/may.db",
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

function activeTaskSnapshots(tree: TaskTree): ActiveTaskSnapshot[] {
  return activeLeaves(tree)
    .map((task) => ({
      taskId: task.id,
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
    }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function hasOpenWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(
    (task) => !["done"].includes(task.status ?? "backlog"),
  );
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

  const opCount =
    typeof row.opCount === "number" && Number.isFinite(row.opCount)
      ? row.opCount
      : null;
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
    opCount === 0 &&
    staleSince !== null &&
    Date.now() - staleSince > staleNoActivityMs
  ) {
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
    ctx.dispatchEvent("project.owner.requested", {
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
  const runnableBacklogTaskIds = listRunnableBacklogTaskIds(
    sharedConfig,
    config.maxConcurrent,
  );
  const snapshot: WatchdogTreeSnapshot | null = withTreeLock(
    sharedConfig,
    () => {
      const tree = readTree(config.treePath);
      if (!tree) return null;
      const activeTasks = activeTaskSnapshots(tree);

      return {
        runnableBacklogTaskIds,
        runnableBacklogTreeUpdatedAt:
          typeof tree.updated_at === "string" ? tree.updated_at : undefined,
        runnableBacklogSnapshotAt: new Date().toISOString(),
        activeTasks,
        activeCount: activeTasks.length,
        hasOpenWork: hasOpenWork(tree),
        needsRefill: activeProjectNeedsRefill(tree),
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
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (recovery.runnableBacklogTaskIds.length > 0) {
    const reason = "watchdog-runnable-backlog";
    emitOwnerRequested(ctx, config, reason, {
      runnableBacklogTaskIds: recovery.runnableBacklogTaskIds,
      runnableBacklogTreeUpdatedAt: recovery.runnableBacklogTreeUpdatedAt,
      runnableBacklogSnapshotAt: recovery.runnableBacklogSnapshotAt,
    });
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
  }

  if (recovery.activeCount > 0 && recovery.activeCount < config.maxConcurrent) {
    const reason = "watchdog-capacity-underfilled";
    emitOwnerRequested(ctx, config, reason);
    return ctx.done(`Watchdog emitted project.owner.requested: ${reason}.`);
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
