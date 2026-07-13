import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const staleWaitTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711";
const liveWaitTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const attemptId =
  "a_ops-apply-reconcile-shared-auth-runtime-approval-wait-reference-20260712_20260712153229";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-shared-auth-runtime-approval-wait-reference-20260712-state-repair.md";
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())) )];
}

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const liveWaitTask = tree.tasks[liveWaitTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!liveWaitTask) throw new Error(`Task not found: ${liveWaitTaskId}`);

  const context = asRecord(focusTask.context);
  const observations = asRecord(context.observations);
  const linkedBlockedTaskIds = asStringArray(observations.linked_blocked_task_ids);
  const repairedLinkedBlockedTaskIds = unique([
    ...linkedBlockedTaskIds.filter((taskId) => taskId !== staleWaitTaskId),
    liveWaitTaskId,
  ]);

  observations.linked_blocked_task_ids = repairedLinkedBlockedTaskIds;
  observations.shared_auth_runtime_lineage_status =
    `Live shared auth/runtime family carrier normalized to ${liveWaitTaskId}; stale metadata reference ${staleWaitTaskId} removed from linked_blocked_task_ids on ${checkedAt}.`;
  context.observations = observations;
  focusTask.context = context;

  focusTask.trace = {
    ...asRecord(focusTask.trace),
    shared_auth_artifact_family_focus_linked_wait_id: liveWaitTaskId,
    shared_auth_artifact_family_focus_linked_wait_id_superseded:
      staleWaitTaskId,
    shared_auth_artifact_family_focus_metadata_reconciled_at: checkedAt,
    shared_auth_artifact_family_focus_metadata_reconciled_by:
      "app-ops-script",
    shared_auth_artifact_family_focus_metadata_reconcile_attempt_id: attemptId,
    shared_auth_artifact_family_focus_metadata_reconcile_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    focusTaskId,
    staleWaitTaskId,
    liveWaitTaskId,
    attemptId,
    checkedAt,
    linkedBlockedTaskIdsBefore: linkedBlockedTaskIds,
    linkedBlockedTaskIdsAfter: repairedLinkedBlockedTaskIds,
    traceLinkedWaitId:
      asRecord(focusTask.trace).shared_auth_artifact_family_focus_linked_wait_id ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
