import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function deleteKey(record: Record<string, unknown>, key: string) {
  delete record[key];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const reviewedTaskId = "ops/repair-compact-loop-assignment-state-mismatch-20260715";
const repairTaskId =
  "ops-apply-repair-compact-loop-assignment-state-mismatch-20260715-state-repair";
const compactLoopTaskId = "aks-feature-compact-loop";
const activeChildTaskId = "reconcile-compact-loop-package-partial";
const attemptId =
  "a_ops-apply-repair-compact-loop-assignment-state-mismatch-20260715-state-repair_20260715082302";
const evidencePath =
  "evidence/archive/ops-apply-repair-compact-loop-assignment-state-mismatch-20260715-state-repair.md";
const appliedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const root = tree.tasks[compactLoopTaskId];
  if (!root) throw new Error(`Task not found: ${compactLoopTaskId}`);
  const activeChild = tree.tasks[activeChildTaskId];
  if (!activeChild) throw new Error(`Task not found: ${activeChildTaskId}`);
  const repairTask = tree.tasks[repairTaskId];
  if (!repairTask) throw new Error(`Task not found: ${repairTaskId}`);

  const trace = asRecord(root.trace);
  const context = asRecord(root.context);

  const before = {
    state: asString(root.state) ?? null,
    status: asString(root.status) ?? null,
    sessionId: asString((root as { session_id?: unknown }).session_id),
    currentAttemptId: asString(trace.current_attempt_id),
    assignedAt: asString(trace.assigned_at),
    assignedWorker: asString(trace.assigned_worker),
    lastSession: asString(trace.last_session),
    activeChildState: asString(activeChild.state) ?? asString(activeChild.status),
    activeChildSessionId: asString(
      (activeChild as { session_id?: unknown }).session_id,
    ),
    activeChildAttemptId: asString(asRecord(activeChild.trace).current_attempt_id),
  };

  delete (root as { session_id?: unknown }).session_id;
  deleteKey(trace, "current_attempt_id");
  deleteKey(trace, "assigned_at");
  deleteKey(trace, "assigned_worker");
  deleteKey(trace, "last_session");

  trace.compact_loop_assignment_state_repaired_at = appliedAt;
  trace.compact_loop_assignment_state_repaired_by = worker;
  trace.compact_loop_assignment_state_repair_attempt_id = attemptId;
  trace.compact_loop_assignment_state_repair_evidence_path = evidencePath;
  trace.compact_loop_assignment_state_repair_reviewed_task_id = reviewedTaskId;
  trace.compact_loop_assignment_state_repair_previous_session_id = before.sessionId;
  trace.compact_loop_assignment_state_repair_previous_attempt_id =
    before.currentAttemptId;
  trace.compact_loop_assignment_state_repair_previous_assigned_at =
    before.assignedAt;
  trace.compact_loop_assignment_state_repair_previous_assigned_worker =
    before.assignedWorker;
  trace.compact_loop_assignment_state_repair_previous_last_session =
    before.lastSession;
  root.trace = trace;

  context.assignmentStateRepair = {
    repairedAt: appliedAt,
    repairedBy: worker,
    attemptId,
    reviewedTaskId,
    evidencePath,
    normalizedTaskId: compactLoopTaskId,
    preservedActiveChildTaskId: activeChildTaskId,
    preservedActiveChildSessionId: before.activeChildSessionId,
    note:
      "Cleared stale root task-worker assignment metadata from the compact-loop durable root while preserving tick-driven controller behavior and the existing bounded active child.",
  };
  root.context = context;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    compactLoopTaskId,
    activeChildTaskId,
    appliedAt,
    evidencePath,
    before,
    after: {
      state: asString(root.state) ?? null,
      status: asString(root.status) ?? null,
      sessionId: asString((root as { session_id?: unknown }).session_id),
      currentAttemptId: asString(asRecord(root.trace).current_attempt_id),
      assignedAt: asString(asRecord(root.trace).assigned_at),
      assignedWorker: asString(asRecord(root.trace).assigned_worker),
      lastSession: asString(asRecord(root.trace).last_session),
      activeChildState: asString(activeChild.state) ?? asString(activeChild.status),
      activeChildSessionId: asString(
        (activeChild as { session_id?: unknown }).session_id,
      ),
      activeChildAttemptId: asString(asRecord(activeChild.trace).current_attempt_id),
    },
  };
});

console.log(JSON.stringify(result, null, 2));
