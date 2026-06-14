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
  withTreeLock,
  type TaskTreeConfig,
  type TaskTree,
} from "./lib/task-tree-store.ts";
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
};

type ActiveTaskSnapshot = {
  taskId: string;
  sessionId?: string;
};

type WatchdogTreeSnapshot = {
  readyTaskIds: string[];
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
  return readJson<TaskTree | null>(path, null);
}

function isLeaf(task: TaskTree["tasks"][string]): boolean {
  return (task.children ?? []).length === 0;
}

function readyLeaves(tree: TaskTree): Array<TaskTree["tasks"][string]> {
  return Object.values(tree.tasks).filter(
    (task) =>
      isLeaf(task) && (task.status === "ready" || task.status === "backlog"),
  );
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
    }))
    .sort((a, b) => a.taskId.localeCompare(b.taskId));
}

function hasOpenWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(
    (task) =>
      !["accepted", "superseded", "decomposed"].includes(task.status),
  );
}

function activeProjectNeedsRefill(tree: TaskTree): boolean {
  return tree.project_lifecycle !== "closed" && !hasOpenWork(tree);
}

function sessionIsRunning(dbPath: string, sessionId: string): boolean {
  if (!existsSync(dbPath)) return false;
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .query(
        `
      select 1
      from sessions
      where sessionId = ? and status = 'running'
      limit 1
    `,
      )
      .get(sessionId);
    return Boolean(row);
  } catch {
    return false;
  } finally {
    db.close();
  }
}

function activeTaskRestartReason(
  config: WatchdogConfig,
  task: ActiveTaskSnapshot,
): string | null {
  if (!task.sessionId) return "missing-session";
  if (!sessionIsRunning(config.stateDbPath, task.sessionId))
    return "session-not-running";
  return null;
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
  const snapshot: WatchdogTreeSnapshot | null = withTreeLock(
    sharedConfig,
    () => {
      const tree = readTree(config.treePath);
      if (!tree) return null;
      const activeTasks = activeTaskSnapshots(tree);

      return {
        readyTaskIds: readyLeaves(tree)
          .map((task) => task.id)
          .sort(),
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

  if (recovery.readyTaskIds.length > 0) {
    const reason = "watchdog-ready-work";
    emitOwnerRequested(ctx, config, reason, {
      readyTaskIds: recovery.readyTaskIds,
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
