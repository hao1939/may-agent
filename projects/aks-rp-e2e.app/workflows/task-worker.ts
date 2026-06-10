/**
 * task-worker — task pickup/execution loop for aks-rp-e2e.
 *
 * Handles two events:
 * - project.tasks.ready: lease ready leaves and dispatch task execution events.
 * - project.task.execution.requested: execute exactly one leased leaf.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import { execute as executeEngine } from "./project-execution-engine.ts";

export const name = "task-worker";
export const description =
  "Pick ready aks-rp-e2e leaves or execute one leased task event.";

function field(raw: string, name: string): string | undefined {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : undefined;
}

type TriggerEvent = {
  type?: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

type TaskNode = {
  id: string;
  parent_id?: string | null;
  status: string;
  kind?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  owner?: string;
  workflow?: string;
  session_id?: string;
  session_history?: string[];
  claimed_by?: string;
  lease_expires_at?: string;
  conflict_scope?: string[] | string;
  gate_status?: string;
  goal?: string;
  children?: string[];
  outputs?: string[];
  acceptance?: string[];
  gates?: string[];
  blocker?: string;
  verification?: unknown;
  trace?: Record<string, unknown>;
};

type TaskTree = {
  updated_at?: string;
  active_task_id?: string | null;
  active_task_ids?: string[];
  tasks: Record<string, TaskNode>;
};

type PickupConfig = {
  appDir: string;
  projectDir: string;
  treePath: string;
  journalPath: string;
  worker: string;
  maxConcurrent: number;
  requestedReadyTaskIds: string[];
  abandonedActiveTaskIds: Set<string>;
};

type LeasedTask = {
  id: string;
  lease_expires_at?: string;
  session_id?: string;
};

function parseTriggerEvent(raw: string): TriggerEvent | null {
  const match = raw.match(/## Trigger Event\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as TriggerEvent;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function triggerNumber(
  event: TriggerEvent | null,
  key: string,
): number | undefined {
  const value =
    event?.data && typeof event.data === "object" && key in event.data
      ? event.data[key]
      : event?.params && typeof event.params === "object" && key in event.params
        ? event.params[key]
        : event?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function triggerStringArray(event: TriggerEvent | null, key: string): string[] {
  const value =
    event?.data && typeof event.data === "object" && key in event.data
      ? event.data[key]
      : event?.params && typeof event.params === "object" && key in event.params
        ? event.params[key]
        : event?.[key];
  if (Array.isArray(value))
    return value.filter(
      (item): item is string => typeof item === "string" && Boolean(item),
    );
  if (typeof value === "string" && value.trim())
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
}

function maxConcurrent(raw: string, trigger: TriggerEvent | null): number {
  const fromTask = Number.parseInt(field(raw, "maxConcurrent") ?? "", 10);
  return Math.max(1, triggerNumber(trigger, "maxConcurrent") || fromTask || 3);
}

function abandonedActiveTaskIds(
  raw: string,
  trigger: TriggerEvent | null,
): Set<string> {
  const fromTask =
    field(raw, "abandonedActiveTaskIds")
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  return new Set([
    ...fromTask,
    ...triggerStringArray(trigger, "abandonedActiveTaskIds"),
  ]);
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is string => typeof item === "string" && Boolean(item),
    );
  if (typeof value === "string" && value) return [value];
  return [];
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withTreeLock<T>(config: PickupConfig, operation: () => T): T {
  const lockPath = `${config.treePath}.lock`;
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > 10 * 60_000) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Retry until the deadline.
      }
      if (Date.now() > deadline)
        throw new Error(`Timed out waiting for task tree lock: ${lockPath}`);
      sleepSync(50);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function readTree(config: PickupConfig): TaskTree {
  return JSON.parse(readFileSync(config.treePath, "utf-8")) as TaskTree;
}

function saveTree(config: PickupConfig, tree: TaskTree): void {
  tree.updated_at = new Date().toISOString();
  ensureDir(dirname(config.treePath));
  const tempPath = `${config.treePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(tree, null, 2)}\n`, "utf-8");
  renameSync(tempPath, config.treePath);
}

function appendJournal(
  config: PickupConfig,
  entry: Record<string, unknown>,
): void {
  ensureDir(dirname(config.journalPath));
  appendFileSync(
    config.journalPath,
    `${JSON.stringify({
      ts: new Date().toISOString(),
      actor: "task-worker",
      ...entry,
    })}\n`,
  );
}

function isLeaf(task: TaskNode): boolean {
  return normalizeStringArray(task.children).length === 0;
}

function priorityRank(priority?: string): number {
  return (
    ({ P0: 0, P1: 1, P2: 2, P3: 3 } as const)[
      priority as "P0" | "P1" | "P2" | "P3"
    ] ?? 3
  );
}

function depthOf(tree: TaskTree, taskId: string): number {
  let depth = 0;
  let current = tree.tasks[taskId];
  const seen = new Set<string>();
  while (
    current?.parent_id &&
    tree.tasks[current.parent_id] &&
    !seen.has(current.parent_id)
  ) {
    seen.add(current.parent_id);
    depth++;
    current = tree.tasks[current.parent_id];
  }
  return depth;
}

function activeLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(
      (task) =>
        isLeaf(task) &&
        ["active", "claimed_done"].includes(task.status) &&
        !isPlanningLoopControlTask(task),
    )
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        depthOf(tree, a.id) - depthOf(tree, b.id) ||
        a.id.localeCompare(b.id),
    );
}

function readyLeaves(tree: TaskTree): TaskNode[] {
  return Object.values(tree.tasks)
    .filter(
      (task) =>
        isLeaf(task) &&
        task.status === "ready" &&
        !isPlanningLoopControlTask(task),
    )
    .sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        depthOf(tree, a.id) - depthOf(tree, b.id) ||
        a.id.localeCompare(b.id),
    );
}

function isSerializedExecutionTask(task: TaskNode): boolean {
  return isReviewExecutionTask(task) || isGlobalSerializedExecutionTask(task);
}

function isReviewExecutionTask(task: TaskNode): boolean {
  return (
    task.kind === "blocked_review" ||
    task.kind === "parent_review" ||
    task.kind === "rework_review" ||
    task.id === "blocked-frontier-review" ||
    task.id.endsWith("-blocker-review") ||
    task.id.endsWith("-rollup-review") ||
    task.id.endsWith("-rework-review")
  );
}

function isGlobalSerializedExecutionTask(task: TaskNode): boolean {
  return (
    task.kind === "frontier_replan" ||
    task.kind === "loop_task" ||
    task.kind === "domain_planner" ||
    task.kind === "human_question" ||
    task.owner === "human" ||
    task.id.startsWith("project-frontier-replan")
  );
}

function isPlanningLoopRunTask(task: TaskNode): boolean {
  return (
    task.id === "project-planning-loop-run" ||
    /^project-planning-loop-run-\d+$/.test(task.id)
  );
}

function isPlanningLoopControlTask(task: TaskNode): boolean {
  return (
    task.id.startsWith("project-planning-loop") ||
    normalizeStringArray(task.conflict_scope).includes(
      "project-control:planning-loop",
    ) ||
    isPlanningLoopRunTask(task)
  );
}

function taskConflictScope(task: TaskNode): string[] {
  const explicit = normalizeStringArray(task.conflict_scope);
  return [
    ...new Set(explicit.length ? explicit : normalizeStringArray(task.outputs)),
  ];
}

function conflictScopesOverlap(a: TaskNode, b: TaskNode): boolean {
  const right = new Set(taskConflictScope(b));
  return taskConflictScope(a).some((item) => right.has(item));
}

function stableTaskSessionId(task: TaskNode): string {
  const slug =
    task.id
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "task";
  return `s_task_${slug}`;
}

function replacementTaskSessionId(task: TaskNode): string {
  const slug =
    task.id
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "task";
  return `s_task_${slug}_retry_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rotateAbandonedTaskSession(task: TaskNode): void {
  if (typeof task.session_id === "string" && task.session_id.trim()) {
    task.session_history = [
      ...new Set([...(task.session_history ?? []), task.session_id.trim()]),
    ];
  }
  task.session_id = replacementTaskSessionId(task);
  task.session_history = [
    ...new Set([...(task.session_history ?? []), task.session_id]),
  ];
  task.trace = {
    ...(task.trace ?? {}),
    abandoned_session_replaced_at: new Date().toISOString(),
    last_session: task.session_id,
  };
}

function ensureTaskSession(task: TaskNode): void {
  if (task.workflow === "spec-runner") return;
  const sessionId =
    typeof task.session_id === "string" && task.session_id.trim()
      ? task.session_id.trim()
      : stableTaskSessionId(task);
  task.session_id = sessionId;
  task.session_history = [
    ...new Set([...(task.session_history ?? []), sessionId]),
  ];
  task.trace = {
    ...(task.trace ?? {}),
    last_session: sessionId,
  };
}

function isClearEnough(task: TaskNode): boolean {
  return (
    Boolean((task.goal ?? "").trim()) &&
    normalizeStringArray(task.acceptance).length > 0 &&
    normalizeStringArray(task.outputs).length > 0
  );
}

function dependencyGateTaskId(gate: string): string | null {
  const match = gate.trim().match(/^([A-Za-z0-9_.:-]+)\s+accepted$/);
  return match?.[1] ?? null;
}

function isNonBlockingSafetyGate(gate: string): boolean {
  const text = gate.trim();
  return (
    /^no\s+(?:cloud|live)\s+mutation\b/i.test(text) ||
    /^no\s+kubectl\b/i.test(text) ||
    /^--check\s+only\b/i.test(text) ||
    /^local\s+(?:check|preflight)\s+only\b/i.test(text) ||
    /^do not run (?:cloud|live|staging|kubectl)\b/i.test(text)
  );
}

function isBlockingGate(gate: string): boolean {
  return Boolean(gate.trim()) && !isNonBlockingSafetyGate(gate);
}

function dependencyGatesAreSatisfied(tree: TaskTree, task: TaskNode): boolean {
  const gates = normalizeStringArray(task.gates).filter(isBlockingGate);
  if (gates.length === 0) return false;
  const dependencyIds = gates.map(dependencyGateTaskId);
  return dependencyIds.every(
    (id) => id && tree.tasks[id]?.status === "accepted",
  );
}

function hasClosedGate(tree: TaskTree, task: TaskNode): boolean {
  const gates = normalizeStringArray(task.gates).filter(isBlockingGate);
  return (
    gates.length > 0 &&
    task.gate_status !== "satisfied" &&
    !dependencyGatesAreSatisfied(tree, task)
  );
}

function activeLeaseRecoveryReason(
  config: PickupConfig,
  task: TaskNode,
): string | null {
  if (task.status !== "active") return null;
  if (config.abandonedActiveTaskIds.has(task.id))
    return "zero-op-worker-session-abandoned";
  if (!task.lease_expires_at) return "missing-or-expired-active-lease";
  const expires = Date.parse(task.lease_expires_at);
  return !Number.isFinite(expires) || expires <= Date.now()
    ? "missing-or-expired-active-lease"
    : null;
}

function requeueStaleActiveLeaves(
  ctx: WorkflowContext,
  tree: TaskTree,
  config: PickupConfig,
): string[] {
  const requeued: string[] = [];
  for (const task of Object.values(tree.tasks)) {
    if (!isLeaf(task)) continue;
    const reason = activeLeaseRecoveryReason(config, task);
    if (!reason) continue;
    if (isPlanningLoopControlTask(task)) {
      task.status = "superseded";
      task.blocker =
        reason === "zero-op-worker-session-abandoned"
          ? "Superseded after watchdog abandoned a stale zero-op planning-loop worker session; planner recovery will continue from the control loop."
          : "Superseded stale legacy planning-control task; planning now runs in the project-planner control loop and is not worker-dispatchable.";
      task.verification = {
        ts: new Date().toISOString(),
        verifier: "task-worker",
        verdict: "accepted",
        reason: task.blocker,
        criteria: normalizeStringArray(task.acceptance).map((item) => ({
          item,
          result: "not_proven",
        })),
      };
    } else {
      task.status = "ready";
    }
    task.claimed_by = undefined;
    task.lease_expires_at = undefined;
    if (reason === "zero-op-worker-session-abandoned") {
      rotateAbandonedTaskSession(task);
    }
    requeued.push(task.id);
    try {
      ctx.dispatchEvent("task.requeued", {
        projectId: "aks-rp-e2e",
        taskId: task.id,
        status: task.status,
        reason,
        session_id: task.session_id,
      });
    } catch {
      // Local test contexts may not provide a real dispatcher.
    }
  }
  return requeued;
}

function selectDispatchableLeaves(
  tree: TaskTree,
  max: number,
  requestedReadyTaskIds: string[] = [],
  excludedIds = new Set<string>(),
): TaskNode[] {
  const active = activeLeaves(tree);
  if (active.some(isGlobalSerializedExecutionTask)) return [];
  const capacity = Math.max(0, max - active.length);
  if (capacity <= 0) return [];

  const selected: TaskNode[] = [];
  const requestedOrder = new Map(
    requestedReadyTaskIds.map((id, index) => [id, index]),
  );
  const ready =
    requestedOrder.size > 0
      ? readyLeaves(tree)
          .filter((task) => requestedOrder.has(task.id))
          .sort((a, b) => requestedOrder.get(a.id)! - requestedOrder.get(b.id)!)
      : readyLeaves(tree);
  for (const candidate of ready) {
    if (selected.length >= capacity) break;
    if (excludedIds.has(candidate.id)) continue;
    if (!isClearEnough(candidate) || hasClosedGate(tree, candidate)) continue;
    if (isGlobalSerializedExecutionTask(candidate)) {
      if (active.length === 0 && selected.length === 0) {
        selected.push(candidate);
        break;
      }
      continue;
    }
    if (isReviewExecutionTask(candidate)) {
      if (
        [...active, ...selected].some((other) =>
          conflictScopesOverlap(other, candidate),
        )
      )
        continue;
      selected.push(candidate);
      continue;
    }
    if (
      [...active, ...selected].some((other) =>
        conflictScopesOverlap(other, candidate),
      )
    )
      continue;
    selected.push(candidate);
  }
  return selected;
}

function leaseTask(task: TaskNode, worker: string): void {
  task.status = "active";
  task.claimed_by = worker;
  task.lease_expires_at = new Date(Date.now() + 30 * 60_000).toISOString();
  ensureTaskSession(task);
}

function normalizeActiveTaskPointer(tree: TaskTree): void {
  const activeIds = activeLeaves(tree).map((task) => task.id);
  tree.active_task_ids = activeIds;
  tree.active_task_id = activeIds[0] ?? readyLeaves(tree)[0]?.id ?? null;
}

function leaseDispatchableTasks(
  config: PickupConfig,
  tree: TaskTree,
  selected: TaskNode[],
): LeasedTask[] {
  for (const task of selected) {
    leaseTask(task, config.worker);
  }
  normalizeActiveTaskPointer(tree);
  return selected.map((task) => ({
    id: task.id,
    lease_expires_at: task.lease_expires_at,
    session_id: task.session_id,
  }));
}

function emitTaskExecutionEvents(
  ctx: WorkflowContext,
  config: PickupConfig,
  leased: LeasedTask[],
): void {
  for (const task of leased) {
    try {
      ctx.dispatchEvent("task.started", {
        projectId: "aks-rp-e2e",
        taskId: task.id,
        status: "active",
        mode: "event-dispatch",
        claimed_by: config.worker,
        lease_expires_at: task.lease_expires_at,
        session_id: task.session_id,
      });
      ctx.dispatchEvent("project.task.execution.requested", {
        project: "aks-rp-e2e",
        taskId: task.id,
        worker: config.worker,
        lease_expires_at: task.lease_expires_at,
        session_id: task.session_id,
        requested_by: "task-worker",
      });
    } catch {
      // Local test contexts may not provide a real dispatcher.
    }
  }
}

function pickupReadyTasks(
  ctx: WorkflowContext,
  config: PickupConfig,
): LeasedTask[] {
  return withTreeLock(config, () => {
    const tree = readTree(config);
    const requeued = requeueStaleActiveLeaves(ctx, tree, config);
    if (requeued.length > 0) {
      appendJournal(config, {
        kind: "stale_active_tasks_requeued",
        status: "ready",
        summary:
          "Requeued active leaf tasks whose execution lease was missing or expired before worker pickup.",
        task_ids: requeued,
      });
    }

    const selected = selectDispatchableLeaves(
      tree,
      config.maxConcurrent,
      config.requestedReadyTaskIds,
    );
    const leased = leaseDispatchableTasks(config, tree, selected);
    if (leased.length > 0) {
      appendJournal(config, {
        kind: "task_execution_events_dispatched",
        status: "active",
        summary:
          "Leased ready leaf tasks and dispatched event-native task execution requests.",
        task_ids: leased.map((task) => task.id),
        max_concurrent: config.maxConcurrent,
      });
    }
    saveTree(config, tree);
    return leased;
  });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const embeddedProjectPath = join(projectDir, ".app", "project.json");
  const legacyRootTaskDir = join(projectDir, "tasks");
  const defaultAppDir =
    existsSync(embeddedProjectPath) && existsSync(legacyRootTaskDir)
      ? projectDir
      : existsSync(embeddedProjectPath)
        ? join(projectDir, ".app")
        : new URL("..", import.meta.url).pathname;
  const appDir = field(ctx.task, "app") ?? defaultAppDir;
  const trigger = parseTriggerEvent(ctx.task);
  const triggerType = trigger?.type ?? "";
  const configuredMaxConcurrent = maxConcurrent(ctx.task, trigger);
  if (triggerType !== "project.task.execution.requested") {
    const config: PickupConfig = {
      appDir,
      projectDir,
      treePath: join(appDir, "tasks", "tree.json"),
      journalPath: join(appDir, ".state", "journal.jsonl"),
      worker:
        field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent,
      maxConcurrent: configuredMaxConcurrent,
      requestedReadyTaskIds: triggerStringArray(trigger, "readyTaskIds"),
      abandonedActiveTaskIds: abandonedActiveTaskIds(ctx.task, trigger),
    };
    const leased = pickupReadyTasks(ctx, config);
    emitTaskExecutionEvents(ctx, config, leased);
    return ctx.done(
      leased.length > 0
        ? `Dispatched ${leased.length} task execution event(s): ${leased.map((task) => task.id).join(", ")}.`
        : "No dispatchable ready task found; worker pickup left the task tree unchanged except stale lease recovery.",
    );
  }

  const taskLines = [
    `app: ${appDir}`,
    `project: ${projectDir}`,
    `agent: ${field(ctx.task, "agent") ?? ctx.agent}`,
    `owner: ${field(ctx.task, "owner") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    `worker: ${field(ctx.task, "worker") ?? field(ctx.task, "agent") ?? ctx.agent}`,
    "maxAttempts: 1",
    `maxConcurrent: ${configuredMaxConcurrent}`,
    "role: task-worker",
  ];

  const triggerBlock = ctx.task.match(/## Trigger Event[\s\S]*$/)?.[0] ?? "";

  const result = await executeEngine({
    ...ctx,
    task: `${taskLines.join("\n")}\n\n${triggerBlock}`,
    done: (message: string) =>
      ({ status: "done", message }) as unknown as WorkflowResult,
    escalate: (message: string) =>
      ({ status: "escalated", message }) as unknown as WorkflowResult,
  } as unknown as WorkflowContext);

  const message =
    (result as { message?: string; summary?: string }).message ??
    (result as { message?: string; summary?: string }).summary ??
    JSON.stringify(result);
  return ctx.done(`Task worker loop advanced: ${message}`);
}

if (import.meta.main) {
  if (process.env.MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT !== "1") {
    console.error(
      "Direct workflow entrypoint is disabled by default. Set MAY_AGENT_RUN_WORKFLOW_ENTRYPOINT=1 to run it.",
    );
    process.exit(0);
  }
  const result = await execute({
    task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nagent: aks-explorer\nmaxConcurrent: 3",
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
