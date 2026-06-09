/**
 * project-execution-watchdog — 5-minute liveness guard for aks-rp-e2e.
 *
 * The main execution workflow owns task mutation. This watchdog only decides
 * whether the project appears healthy or stale, then invokes the engine when
 * there is runnable work and no recent progress signal.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executePlanner } from "./project-planner.ts";
import { execute as executeTaskWorker } from "./task-worker.ts";

export const name = "project-execution-watchdog";
export const description = "Every 5 minutes, resume aks-rp-e2e task execution when the project has runnable work but no fresh progress signal.";

type WatchdogConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  stateDbPath: string;
  staleMs: number;
  zeroOpStaleMs: number;
  controlZeroOpStaleMs: number;
  noSessionStaleMs: number;
  maxAttempts: number;
  maxConcurrent: number;
};

type TaskNode = {
  id: string;
  status: string;
  kind?: string;
  owner?: string;
  goal?: string;
  outputs?: string[];
  acceptance?: string[];
  gates?: string[];
  gate_status?: string;
  conflict_scope?: string[] | string;
  lease_expires_at?: string;
  children?: string[];
  parent_id?: string | null;
};

type TaskTree = {
  active_task_id?: string | null;
  tasks: Record<string, TaskNode>;
};

type StaleZeroOpSession = {
  taskId: string;
  sessionId: string;
};

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

function parseInput(raw: string): WatchdogConfig {
  const projectDir = field(raw, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = field(raw, "app") ?? new URL("..", import.meta.url).pathname;
  return {
    appDir,
    projectDir,
    treePath: join(appDir, "tasks", "tree.json"),
    stateDbPath: field(raw, "stateDb") ?? "/app/.state/may.db",
    staleMs: Number(field(raw, "staleMs") ?? 300_000),
    zeroOpStaleMs: Number(field(raw, "zeroOpStaleMs") ?? 600_000),
    controlZeroOpStaleMs: Number(field(raw, "controlZeroOpStaleMs") ?? 120_000),
    noSessionStaleMs: Number(field(raw, "noSessionStaleMs") ?? 120_000),
    maxAttempts: Number(field(raw, "maxAttempts") ?? 3),
    maxConcurrent: Number(field(raw, "maxConcurrent") ?? 3),
  };
}

function readTree(path: string): TaskTree | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as TaskTree;
}

function isLeaf(task: TaskNode): boolean {
  return (task.children ?? []).length === 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && Boolean(item));
  if (typeof value === "string" && value) return [value];
  return [];
}

function readyLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks).filter(task => isLeaf(task) && task.status === "ready");
}

function activeLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks).filter(task => isLeaf(task) && ["active", "claimed_done"].includes(task.status));
}

function isSerializedExecutionTask(task: TaskNode): boolean {
  return isReviewExecutionTask(task)
    || isGlobalSerializedExecutionTask(task);
}

function isReviewExecutionTask(task: TaskNode): boolean {
  return task.kind === "blocked_review"
    || task.kind === "parent_review"
    || task.kind === "rework_review"
    || task.id === "blocked-frontier-review"
    || task.id.endsWith("-blocker-review")
    || task.id.endsWith("-rollup-review")
    || task.id.endsWith("-rework-review");
}

function isGlobalSerializedExecutionTask(task: TaskNode): boolean {
  return task.kind === "frontier_replan"
    || task.kind === "loop_task"
    || task.kind === "domain_planner"
    || task.kind === "human_question"
    || task.owner === "human"
    || task.id.startsWith("project-frontier-replan");
}

function isControlLoopTask(task: TaskNode): boolean {
  const scopes = normalizeStringArray(task.conflict_scope);
  return isGlobalSerializedExecutionTask(task)
    || task.id.startsWith("project-planning-loop")
    || task.parent_id?.startsWith("project-planning-loop")
    || scopes.includes("project-control:planning-loop");
}

function zeroOpStaleMsForTask(config: WatchdogConfig, task: TaskNode): number {
  return isControlLoopTask(task) ? config.controlZeroOpStaleMs : config.zeroOpStaleMs;
}

function taskConflictScope(task: TaskNode): string[] {
  const explicit = normalizeStringArray(task.conflict_scope);
  return [...new Set(explicit.length ? explicit : normalizeStringArray(task.outputs))];
}

function conflictScopesOverlap(a: TaskNode, b: TaskNode): boolean {
  const right = new Set(taskConflictScope(b));
  return taskConflictScope(a).some(item => right.has(item));
}

function isClearEnough(task: TaskNode): boolean {
  return Boolean((task.goal ?? "").trim())
    && normalizeStringArray(task.acceptance).length > 0
    && normalizeStringArray(task.outputs).length > 0;
}

function dependencyGateTaskId(gate: string): string | null {
  const match = gate.trim().match(/^([A-Za-z0-9_.:-]+)\s+accepted$/);
  return match?.[1] ?? null;
}

function isNonBlockingSafetyGate(gate: string): boolean {
  const text = gate.trim();
  return /^no\s+(?:cloud|live)\s+mutation\b/i.test(text)
    || /^no\s+kubectl\b/i.test(text)
    || /^--check\s+only\b/i.test(text)
    || /^local\s+(?:check|preflight)\s+only\b/i.test(text)
    || /^do not run (?:cloud|live|staging|kubectl)\b/i.test(text);
}

function isBlockingGate(gate: string): boolean {
  return Boolean(gate.trim()) && !isNonBlockingSafetyGate(gate);
}

function dependencyGatesAreSatisfied(tree: TaskTree, task: TaskNode): boolean {
  const gates = normalizeStringArray(task.gates).filter(isBlockingGate);
  if (gates.length === 0) return false;
  const dependencyIds = gates.map(dependencyGateTaskId);
  return dependencyIds.every(id => id && tree.tasks[id]?.status === "accepted");
}

function hasClosedGate(tree: TaskTree, task: TaskNode): boolean {
  const gates = normalizeStringArray(task.gates).filter(isBlockingGate);
  return gates.length > 0 && task.gate_status !== "satisfied" && !dependencyGatesAreSatisfied(tree, task);
}

function hasExpiredOrMissingActiveLease(tree: TaskTree): boolean {
  return activeLeaves(tree).some(task => {
    if (!task.lease_expires_at) return true;
    const expires = Date.parse(task.lease_expires_at);
    return !Number.isFinite(expires) || expires <= Date.now();
  });
}

function hasDispatchableReadyWork(tree: TaskTree, maxConcurrent: number): boolean {
  const active = activeLeaves(tree);
  if (active.some(isGlobalSerializedExecutionTask)) return false;
  const capacity = Math.max(0, maxConcurrent - active.length);
  if (capacity <= 0) return false;

  const selected: TaskNode[] = [];
  for (const candidate of readyLeaves(tree)) {
    if (selected.length >= capacity) return true;
    if (!isClearEnough(candidate) || hasClosedGate(tree, candidate)) continue;
    if (isGlobalSerializedExecutionTask(candidate)) {
      if (active.length === 0 && selected.length === 0) return true;
      continue;
    }
    if (isReviewExecutionTask(candidate)) {
      if ([...active, ...selected].some(other => conflictScopesOverlap(other, candidate))) continue;
      return true;
    }
    if ([...active, ...selected].some(other => conflictScopesOverlap(other, candidate))) continue;
    selected.push(candidate);
  }
  return selected.length > 0;
}

function hasRunnableWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(task => isLeaf(task) && ["ready", "active", "claimed_done"].includes(task.status));
}

function hasOpenWork(tree: TaskTree): boolean {
  return Object.values(tree.tasks).some(task => !["accepted", "superseded"].includes(task.status));
}

function treeAgeMs(path: string): number {
  return Date.now() - statSync(path).mtimeMs;
}

function latestRunningSession(dbPath: string): { startedAt: number; opCount: number; status: string; taskId: string | null } | null {
  if (!existsSync(dbPath)) return null;
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.query(`
      select startedAt, opCount, status, task
      from sessions
      where projectId = 'aks-rp-e2e' and status = 'running'
      order by startedAt desc
      limit 1
    `).get() as { startedAt: number; opCount: number; status: string; task: string } | null;
    if (!row) return null;
    return { ...row, taskId: taskIdFromSessionTask(row.task) };
  } finally {
    db.close();
  }
}

function taskIdFromSessionTask(raw: string): string | null {
  return raw.match(/^id:\s*(.+)$/m)?.[1]?.trim() ?? null;
}

function staleZeroOpActiveSessions(config: WatchdogConfig, tree: TaskTree): StaleZeroOpSession[] {
  if (!existsSync(config.stateDbPath)) return [];
  const activeIds = new Set(activeLeaves(tree).filter(task => task.status === "active").map(task => task.id));
  if (activeIds.size === 0) return [];

  const db = new Database(config.stateDbPath, { readonly: true });
  try {
    const rows = db.query(`
      select sessionId, startedAt, opCount, task
      from sessions
      where projectId = 'aks-rp-e2e' and status = 'running'
      order by startedAt desc
    `).all() as Array<{ sessionId: string; startedAt: number; opCount: number; task: string }>;

    const latestByTask = new Map<string, { sessionId: string; startedAt: number; opCount: number }>();
    for (const row of rows) {
      const taskId = taskIdFromSessionTask(row.task);
      if (!taskId || !activeIds.has(taskId) || latestByTask.has(taskId)) continue;
      latestByTask.set(taskId, { sessionId: row.sessionId, startedAt: row.startedAt, opCount: row.opCount });
    }

    return [...latestByTask.entries()]
      .filter(([taskId, session]) => {
        const task = tree.tasks[taskId];
        if (!task || session.opCount !== 0) return false;
        return session.startedAt <= Date.now() - zeroOpStaleMsForTask(config, task);
      })
      .map(([taskId, session]) => ({ taskId, sessionId: session.sessionId }))
      .sort((a, b) => a.taskId.localeCompare(b.taskId));
  } finally {
    db.close();
  }
}

function leaseStartedAt(task: TaskNode): number | null {
  if (!task.lease_expires_at) return null;
  const expires = Date.parse(task.lease_expires_at);
  if (!Number.isFinite(expires)) return null;
  return expires - 30 * 60_000;
}

function activeTasksWithoutRunningSession(config: WatchdogConfig, tree: TaskTree): string[] {
  if (!existsSync(config.stateDbPath)) return [];
  const active = activeLeaves(tree).filter(task => task.status === "active");
  if (active.length === 0) return [];

  const cutoff = Date.now() - config.noSessionStaleMs;
  const candidates = active.filter(task => {
    const started = leaseStartedAt(task);
    return started !== null && started <= cutoff;
  });
  if (candidates.length === 0) return [];

  const activeIds = new Set(candidates.map(task => task.id));
  const db = new Database(config.stateDbPath, { readonly: true });
  try {
    const rows = db.query(`
      select task
      from sessions
      where projectId = 'aks-rp-e2e' and status = 'running'
    `).all() as Array<{ task: string }>;
    for (const row of rows) {
      const taskId = taskIdFromSessionTask(row.task);
      if (taskId) activeIds.delete(taskId);
    }
    return [...activeIds].sort();
  } finally {
    db.close();
  }
}

function healthy(config: WatchdogConfig, tree: TaskTree, staleZeroOpTaskIds: string[]): string | null {
  if (!hasOpenWork(tree)) return "all task-tree work is settled";

  if (staleZeroOpTaskIds.length > 0) return null;
  if (hasExpiredOrMissingActiveLease(tree)) return null;
  if (hasDispatchableReadyWork(tree, config.maxConcurrent)) return null;

  const age = treeAgeMs(config.treePath);
  if (age < config.staleMs) return `task tree updated ${Math.round(age / 1000)}s ago`;

  const running = latestRunningSession(config.stateDbPath);
  if (!running) return null;

  const runningAge = Date.now() - running.startedAt;
  const runningTask = running.taskId ? tree.tasks[running.taskId] : undefined;
  const zeroOpWindowMs = runningTask ? zeroOpStaleMsForTask(config, runningTask) : config.zeroOpStaleMs;
  if (running.opCount === 0 && runningAge < zeroOpWindowMs) {
    return isControlLoopTask(runningTask ?? { id: "", status: "active" })
      ? `running zero-op control session is within startup window (${Math.round(runningAge / 1000)}s ago)`
      : `running zero-op session is within conservative startup window (${Math.round(runningAge / 1000)}s ago)`;
  }

  if (runningAge < config.staleMs) return `running session started ${Math.round(runningAge / 1000)}s ago`;

  if (running.opCount > 0 && runningAge < config.staleMs * 3) {
    return `running session has ${running.opCount} op(s) and is within extended progress window`;
  }

  return null;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const config = parseInput(ctx.task);
  const tree = readTree(config.treePath);
  if (!tree) return ctx.done("Watchdog skipped: task tree does not exist yet.");

  if (!hasRunnableWork(tree) && !hasOpenWork(tree)) {
    return ctx.done("Watchdog skipped: no open task-tree work.");
  }

  const staleZeroOpSessions = staleZeroOpActiveSessions(config, tree);
  const staleZeroOpTaskIds = staleZeroOpSessions.map(item => item.taskId);
  const noSessionTaskIds = activeTasksWithoutRunningSession(config, tree);
  const abandonedTaskIds = [...new Set([...staleZeroOpTaskIds, ...noSessionTaskIds])].sort();
  const abandonedControlTaskIds = abandonedTaskIds
    .filter(taskId => {
      const task = tree.tasks[taskId];
      return task ? isControlLoopTask(task) : false;
    });
  const healthyReason = healthy(config, tree, abandonedTaskIds);
  if (healthyReason) return ctx.done(`Watchdog skipped: ${healthyReason}.`);

  for (const session of staleZeroOpSessions) {
    try {
      ctx.emit({
        type: "session.cancel.requested",
        sessionId: session.sessionId,
        project: "aks-rp-e2e",
        taskId: session.taskId,
        reason: "stale-zero-op-task-worker-session",
        requested_by: "project-execution-watchdog",
      });
    } catch {
      // Local test contexts may not provide a real dispatcher.
    }
  }

  const buildLoopTask = (eventData: Record<string, unknown>, reason: string) => [
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

  if (abandonedControlTaskIds.length > 0) {
    const workerEventData = {
      type: "project.tasks.ready",
      data: {
        project: "aks-rp-e2e",
        reason: "watchdog-abandoned-active-recovery",
        maxConcurrent: config.maxConcurrent,
        abandonedActiveTaskIds: abandonedTaskIds,
      },
    };
    const workerResult = await executeTaskWorker({
      ...ctx,
      task: buildLoopTask(workerEventData, "watchdog-abandoned-active-recovery"),
      done: (message: string) => ({ status: "done", message }) as WorkflowResult,
      escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
    } as WorkflowContext);

    const plannerEventData = {
      type: "project.execution.requested",
      data: {
        project: "aks-rp-e2e",
        reason: "watchdog-post-abandon-planner-resume",
        maxConcurrent: config.maxConcurrent,
      },
    };
    const plannerResult = await executePlanner({
      ...ctx,
      task: buildLoopTask(plannerEventData, "watchdog-post-abandon-planner-resume"),
      done: (message: string) => ({ status: "done", message }) as WorkflowResult,
      escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
    } as WorkflowContext);

    const workerMessage = (workerResult as { message?: string; summary?: string }).message
      ?? (workerResult as { message?: string; summary?: string }).summary
      ?? JSON.stringify(workerResult);
    const plannerMessage = (plannerResult as { message?: string; summary?: string }).message
      ?? (plannerResult as { message?: string; summary?: string }).summary
      ?? JSON.stringify(plannerResult);
    return ctx.done(`Watchdog recovered abandoned control task(s): ${abandonedControlTaskIds.join(", ")}. Worker result: ${workerMessage}. Planner result: ${plannerMessage}`);
  }

  const runnable = hasRunnableWork(tree);
  const eventData = runnable
    ? {
        type: "project.tasks.ready",
        data: {
          project: "aks-rp-e2e",
          reason: "watchdog-ready-resume",
          maxConcurrent: config.maxConcurrent,
          ...(abandonedTaskIds.length > 0 ? { abandonedActiveTaskIds: abandonedTaskIds } : {}),
        },
      }
    : {
        type: "project.execution.requested",
        data: {
          project: "aks-rp-e2e",
          reason: "watchdog-planner-resume",
          maxConcurrent: config.maxConcurrent,
        },
      };

  const result = await (runnable ? executeTaskWorker : executePlanner)({
    ...ctx,
    task: buildLoopTask(eventData, "watchdog-resume"),
    done: (message: string) => ({ status: "done", message }) as WorkflowResult,
    escalate: (message: string) => ({ status: "escalated", message }) as WorkflowResult,
  } as WorkflowContext);

  const message = (result as { message?: string; summary?: string }).message
    ?? (result as { message?: string; summary?: string }).summary
    ?? JSON.stringify(result);
  return ctx.done(`Watchdog advanced ${runnable ? "task worker" : "project planner"} loop: ${message}`);
}

if (import.meta.main) {
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nstaleMs: 300000\nmaxAttempts: 3",
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
