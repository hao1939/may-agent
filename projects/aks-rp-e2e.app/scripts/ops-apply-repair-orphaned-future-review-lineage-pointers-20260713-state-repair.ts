import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const workerTaskId =
  "ops-apply-repair-orphaned-future-review-lineage-pointers-20260713-state-";
const waitTaskId =
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708";
const oldReviewTaskId =
  "ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713";
const newReviewTaskId =
  "ops/review-1530-shared-underlay-runtime-input-family-lineage-20260713b";
const attemptId =
  "a_ops-apply-repair-orphaned-future-review-lineage-pointers-20260713-state-_20260713020916";
const evidencePath =
  "evidence/archive/ops-apply-repair-orphaned-future-review-lineage-pointers-20260713-state-repair.md";
const checkedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function replaceLineagePointerText(value: unknown): unknown {
  return typeof value === "string"
    ? value.split(oldReviewTaskId).join(newReviewTaskId)
    : value;
}

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const waitTask = tree.tasks[waitTaskId];
  const liveReviewTask = tree.tasks[newReviewTaskId];

  if (!waitTask) throw new Error(`Task not found: ${waitTaskId}`);
  if (!liveReviewTask) throw new Error(`Task not found: ${newReviewTaskId}`);

  const blocker = asRecord(waitTask.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  const context = asRecord(waitTask.context);
  const normalization = asRecord(
    context.sharedUnderlayRuntimeInputFamilyWaitNormalization,
  );
  const trace = asRecord(waitTask.trace);

  const priorWaitingForTaskId = waitingFor.taskId;
  const priorFutureReviewTaskId = normalization.futureReviewTaskId;

  if (priorWaitingForTaskId !== oldReviewTaskId) {
    throw new Error(
      `Expected blocker.waiting_for.taskId to equal ${oldReviewTaskId}; found ${String(priorWaitingForTaskId)}`,
    );
  }
  if (priorFutureReviewTaskId !== oldReviewTaskId) {
    throw new Error(
      `Expected context.sharedUnderlayRuntimeInputFamilyWaitNormalization.futureReviewTaskId to equal ${oldReviewTaskId}; found ${String(priorFutureReviewTaskId)}`,
    );
  }

  blocker.waiting_for = {
    ...waitingFor,
    taskId: newReviewTaskId,
  };
  waitTask.blocker = blocker;

  context.sharedUnderlayRuntimeInputFamilyWaitNormalization = {
    ...normalization,
    futureReviewTaskId: newReviewTaskId,
    supersededFutureReviewTaskId: oldReviewTaskId,
    lineagePointerRepairedAt: checkedAt,
    lineagePointerRepairTaskId: workerTaskId,
    lineagePointerRepairAttemptId: attemptId,
    lineagePointerRepairEvidencePath: evidencePath,
  };
  waitTask.context = context;

  waitTask.result = replaceLineagePointerText(waitTask.result) as string;
  waitTask.trace = {
    ...trace,
    blocked_wait_refresh_summary: replaceLineagePointerText(
      trace.blocked_wait_refresh_summary,
    ),
    orphaned_future_review_lineage_pointer_repaired_at: checkedAt,
    orphaned_future_review_lineage_pointer_repaired_by: "app-ops-script",
    orphaned_future_review_lineage_pointer_repair_attempt_id: attemptId,
    orphaned_future_review_lineage_pointer_repair_evidence_path: evidencePath,
  };
  waitTask.outputs = Array.from(
    new Set([...(waitTask.outputs ?? []), evidencePath]),
  );

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    waitTaskId,
    oldReviewTaskId,
    newReviewTaskId,
    checkedAt,
    evidencePath,
    blockerWaitingForTaskIdBefore: priorWaitingForTaskId,
    blockerWaitingForTaskIdAfter: asRecord(waitTask.blocker).waiting_for,
    futureReviewTaskIdBefore: priorFutureReviewTaskId,
    futureReviewTaskIdAfter: asRecord(
      asRecord(waitTask.context).sharedUnderlayRuntimeInputFamilyWaitNormalization,
    ).futureReviewTaskId,
    result: waitTask.result,
    blockedWaitRefreshSummary: asRecord(waitTask.trace)
      .blocked_wait_refresh_summary,
    outputs: waitTask.outputs,
  };
});

console.log(JSON.stringify(result, null, 2));
