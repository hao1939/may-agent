/**
 * project-execution-watchdog — simple liveness guard for aks-rp-e2e.
 *
 * Source of truth: tasks/tree.json.
 * Runtime sessions are disposable attempts attached to tasks. If an active leaf
 * has no healthy runtime attempt, put the task back to ready and let the normal
 * worker picker start it again.
 */

import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executePlanner } from "./project-planner.ts";
import { execute as executeTaskWorker } from "./task-worker.ts";

export const name = "project-execution-watchdog";
export const description = "Resume aks-rp-e2e from the task tree: restart stale active leaves, run ready leaves, or ask the planner to refill.";

type WatchdogConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  stateDbPath: string;
  maxAttempts: number;
  maxConcurrent: number;
};

type TaskNode = {
  id: string;
  status: string;
  children?: string[];
  session_id?: string;
  claimed_by?: string;
  lease_expires_at?: string;
};

type TaskTree = {
  active_task_id?: string | null;
  active_task_ids?: string[];
  project_lifecycle?: string;
  updated_at?: string;
  tasks: Record<string, TaskNode>;
};

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function parseInput(raw: string): WatchdogConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const explicitAppDir = field(raw, "app");
  const embeddedProjectPath = join(projectDir, ".app", "project.json");
  const legacyRootTaskDir = join(projectDir, "tasks");
  const appDir = explicitAppDir
    ?? (existsSync(embeddedProjectPath) && existsSync(legacyRootTaskDir)
      ? projectDir
      : existsSync(embeddedProjectPath)
      ? join(projectDir, ".app")
      : new URL("..", import.meta.url).pathname);

  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    stateDbPath: field(raw, "stateDb") ?? "/app/.state/may.db",
    maxAttempts: Number(field(raw, "maxAttempts") ?? 3),
    maxConcurrent: Number(field(raw, "maxConcurrent") ?? 3),
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

function appendJournal(config: WatchdogConfig, entry: Record<string, unknown>): void {
  appendFileSync(join(config.appDir, "journal.jsonl"), `${JSON.stringify({
    ts: new Date().toISOString(),
    actor: "project-execution-watchdog",
    ...entry,
  })}\n`);
}

function isLeaf(task: TaskNode): boolean {
  return (task.children ?? []).length === 0;
}

function readyLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks).filter(task => isLeaf(task) && task.status === "ready");
}

function activeLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks).filter(task => isLeaf(task) && task.status === "active");
}

function hasOpenWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(task => !["accepted", "superseded"].includes(task.status));
}

function activeProjectNeedsRefill(tree: TaskTree): boolean {
  return tree.project_lifecycle !== "closed" && !hasOpenWork(tree);
}

function sessionIsRunning(dbPath: string, sessionId: string): boolean {
  if (!existsSync(dbPath)) return false;
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.query(`
      select 1
      from sessions
      where sessionId = ? and status = 'running'
      limit 1
    `).get(sessionId);
    return Boolean(row);
  } catch {
    return false;
  } finally {
    db.close();
  }
}

function activeTaskShouldRestart(config: WatchdogConfig, task: TaskNode): boolean {
  if (!task.session_id || !sessionIsRunning(config.stateDbPath, task.session_id)) return true;
  if (!task.lease_expires_at) return true;
  const expiresAt = Date.parse(task.lease_expires_at);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

function normalizeActivePointers(tree: TaskTree): void {
  const activeIds = activeLeaves(tree).map(task => task.id).sort();
  tree.active_task_ids = activeIds;
  tree.active_task_id = activeIds[0] ?? readyLeaves(tree)[0]?.id ?? null;
}

function restartAbandonedActiveTasks(config: WatchdogConfig, tree: TaskTree): string[] {
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

function buildLoopTask(config: WatchdogConfig, eventData: Record<string, unknown>, reason: string): string {
  return [
    `app: ${config.appDir}`,
    `project: ${config.projectDir}`,
    "agent: aks-explorer",
    "owner: aks-explorer",
    "worker: aks-explorer",
    `maxAttempts: ${config.maxAttempts}`,
    `maxConcurrent: ${config.maxConcurrent}`,
    `reason: ${reason}`,
    "",
    "## Trigger Event",
    "```json",
    JSON.stringify(eventData, null, 2),
    "```",
  ].join("\n");
}

async function runWorker(ctx: WorkflowContext, config: WatchdogConfig, readyTaskIds: string[], reason: string): Promise<WorkflowResult> {
  return executeTaskWorker({
    ...ctx,
    task: buildLoopTask(config, {
      type: "project.tasks.ready",
      data: {
        project: "aks-rp-e2e",
        reason,
        readyTaskIds,
        maxConcurrent: config.maxConcurrent,
      },
    }, reason),
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
  } as WorkflowContext);
}

async function runPlanner(ctx: WorkflowContext, config: WatchdogConfig, reason: string): Promise<WorkflowResult> {
  return executePlanner({
    ...ctx,
    task: buildLoopTask(config, {
      type: "project.execution.requested",
      data: {
        project: "aks-rp-e2e",
        reason,
        maxConcurrent: config.maxConcurrent,
      },
    }, reason),
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
  } as WorkflowContext);
}

function resultMessage(result: WorkflowResult): string {
  return (result as { message?: string; summary?: string }).message
    ?? (result as { message?: string; summary?: string }).summary
    ?? JSON.stringify(result);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task);
  const tree = readTree(config.treePath);
  if (!tree) return ctx.done("Watchdog skipped: task tree does not exist yet.");

  const restarted = restartAbandonedActiveTasks(config, tree);
  if (restarted.length > 0) {
    saveTree(config, tree);
    appendJournal(config, {
      kind: "active_tasks_restarted_from_task_tree",
      status: "ready",
      summary: "Reset active leaves with missing/expired runtime attempts back to ready.",
      task_ids: restarted,
    });
  }

  const readyTaskIds = readyLeaves(tree).map(task => task.id).sort();
  if (readyTaskIds.length > 0) {
    const result = await runWorker(ctx, config, readyTaskIds, restarted.length > 0 ? "watchdog-restarted-active-tasks" : "watchdog-ready-resume");
    return ctx.done(`Watchdog ran worker for ${readyTaskIds.length} ready task(s): ${readyTaskIds.slice(0, 8).join(", ")}. Worker result: ${resultMessage(result)}`);
  }

  if (activeLeaves(tree).length > 0) {
    return ctx.done(`Watchdog skipped: ${activeLeaves(tree).length} active task(s) still have running attempts.`);
  }

  if (activeProjectNeedsRefill(tree) || hasOpenWork(tree)) {
    const result = await runPlanner(ctx, config, activeProjectNeedsRefill(tree) ? "watchdog-settled-active-project-refill" : "watchdog-open-work-reconcile");
    return ctx.done(`Watchdog ran planner. Planner result: ${resultMessage(result)}`);
  }

  return ctx.done("Watchdog skipped: project is closed and no open work remains.");
}

if (import.meta.main) {
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nmaxAttempts: 3",
    agent: "aks-explorer",
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
    emit() {},
    dispatchEvent() {},
    runAgent: async () => ({ status: "error", lastAssistantText: "" }),
    summarize: () => "",
  } as WorkflowContext);
  console.log(JSON.stringify(result));
}
