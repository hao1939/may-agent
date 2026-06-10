/**
 * project-execution-watchdog — simple liveness guard for aks-rp-e2e.
 *
 * Source of truth: tasks/tree.json.
 * Runtime sessions are disposable attempts attached to tasks. If an active leaf
 * has no healthy runtime attempt, put the task back to ready and let the normal
 * worker picker start it again.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  readDispatchableReadyTaskIds,
  withTreeLock,
  type PickupConfig,
  type TaskTree,
} from "./lib/task-pickup.ts";

export const name = "project-execution-watchdog";
export const description =
  "Repair stale aks-rp-e2e task leases and emit the normal planner/worker events.";

type WatchdogConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  stateDbPath: string;
  agent: string;
  maxConcurrent: number;
};

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function parseInput(raw: string, defaultAgent: string): WatchdogConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const explicitAppDir = field(raw, "app");
  const embeddedProjectPath = join(projectDir, ".app", "project.json");
  const legacyRootTaskDir = join(projectDir, "tasks");
  const appDir =
    explicitAppDir ??
    (existsSync(embeddedProjectPath) && existsSync(legacyRootTaskDir)
      ? projectDir
      : existsSync(embeddedProjectPath)
        ? join(projectDir, ".app")
        : new URL("..", import.meta.url).pathname);

  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    stateDbPath: field(raw, "stateDb") ?? "/app/.state/may.db",
    agent: field(raw, "agent") ?? defaultAgent,
    maxConcurrent: Number(field(raw, "maxConcurrent") ?? 3),
  };
}

function pickupConfig(config: WatchdogConfig): PickupConfig {
  return {
    appDir: config.appDir,
    projectDir: config.projectDir,
    treePath: config.treePath,
    journalPath: join(config.appDir, ".state", "journal.jsonl"),
    worker: config.agent,
    maxConcurrent: config.maxConcurrent,
    requestedReadyTaskIds: [],
    abandonedActiveTaskIds: new Set(),
  };
}

function readTree(path: string): TaskTree | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as TaskTree;
}

function saveTree(config: WatchdogConfig, tree: TaskTree): void {
  tree.updated_at = new Date().toISOString();
  const tempPath = `${config.treePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(tree, null, 2)}\n`, "utf-8");
  renameSync(tempPath, config.treePath);
}

function appendJournal(
  config: WatchdogConfig,
  entry: Record<string, unknown>,
): void {
  const journalDir = join(config.appDir, ".state");
  if (!existsSync(journalDir)) mkdirSync(journalDir, { recursive: true });
  appendFileSync(
    join(journalDir, "journal.jsonl"),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      actor: "project-execution-watchdog",
      ...entry,
    })}\n`,
  );
}

function isLeaf(task: TaskTree["tasks"][string]): boolean {
  return (task.children ?? []).length === 0;
}

function readyLeaves(tree: TaskTree): Array<TaskTree["tasks"][string]> {
  return Object.values(tree.tasks).filter(
    (task) => isLeaf(task) && task.status === "ready",
  );
}

function activeLeaves(tree: TaskTree): Array<TaskTree["tasks"][string]> {
  return Object.values(tree.tasks).filter(
    (task) => isLeaf(task) && task.status === "active",
  );
}

function hasOpenWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(
    (task) => !["accepted", "superseded"].includes(task.status),
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

function activeTaskShouldRestart(
  config: WatchdogConfig,
  task: TaskTree["tasks"][string],
): boolean {
  if (
    !task.session_id ||
    !sessionIsRunning(config.stateDbPath, task.session_id)
  )
    return true;
  if (!task.lease_expires_at) return true;
  const expiresAt = Date.parse(task.lease_expires_at);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function normalizeActivePointers(tree: TaskTree): void {
  const activeIds = activeLeaves(tree)
    .map((task) => task.id)
    .sort();
  tree.active_task_ids = activeIds;
  tree.active_task_id = activeIds[0] ?? readyLeaves(tree)[0]?.id ?? null;
}

function restartAbandonedActiveTasks(
  config: WatchdogConfig,
  tree: TaskTree,
): string[] {
  const restarted: string[] = [];
  for (const task of activeLeaves(tree)) {
    if (!activeTaskShouldRestart(config, task)) continue;
    task.status = "ready";
    task.claimed_by = undefined;
    task.lease_expires_at = undefined;
    restarted.push(task.id);
  }
  if (restarted.length > 0) normalizeActivePointers(tree);
  return restarted.sort();
}

function emitTaskExecutionRequests(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  taskIds: string[],
  reason: string,
): void {
  for (const taskId of taskIds) {
    try {
      ctx.dispatchEvent("project.task.execution.requested", {
        project: "aks-rp-e2e",
        reason,
        taskId,
        worker: config.agent,
        maxConcurrent: config.maxConcurrent,
        requested_by: "project-execution-watchdog",
      });
    } catch {
      // Local tests may not provide a dispatcher.
    }
  }
}

function emitPlanningRequested(
  ctx: WorkflowContext,
  config: WatchdogConfig,
  reason: string,
): void {
  try {
    ctx.dispatchEvent("project.planning.requested", {
      project: "aks-rp-e2e",
      reason,
      maxConcurrent: config.maxConcurrent,
      requested_by: "project-execution-watchdog",
    });
  } catch {
    // Local tests may not provide a dispatcher.
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task, ctx.agent);
  const sharedConfig = pickupConfig(config);
  const recovery = withTreeLock(sharedConfig, () => {
    const tree = readTree(config.treePath);
    if (!tree) return null;

    const restarted = restartAbandonedActiveTasks(config, tree);
    if (restarted.length > 0) {
      saveTree(config, tree);
      appendJournal(config, {
        kind: "active_tasks_restarted_from_task_tree",
        status: "ready",
        summary:
          "Reset active leaves with missing/expired runtime attempts back to ready.",
        task_ids: restarted,
      });
    }

    return {
      restarted,
      activeCount: activeLeaves(tree).length,
      hasOpenWork: hasOpenWork(tree),
      needsRefill: activeProjectNeedsRefill(tree),
    };
  });
  if (!recovery)
    return ctx.done("Watchdog skipped: task tree does not exist yet.");

  const readyTaskIds = readDispatchableReadyTaskIds(sharedConfig);
  if (readyTaskIds.length > 0) {
    const reason =
      recovery.restarted.length > 0
        ? "watchdog-restarted-active-tasks"
        : "watchdog-ready-resume";
    emitTaskExecutionRequests(ctx, config, readyTaskIds, reason);
    return ctx.done(
      `Watchdog requested execution for ${readyTaskIds.length} dispatchable ready task(s): ${readyTaskIds.slice(0, 8).join(", ")}.`,
    );
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
    emitPlanningRequested(ctx, config, reason);
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
