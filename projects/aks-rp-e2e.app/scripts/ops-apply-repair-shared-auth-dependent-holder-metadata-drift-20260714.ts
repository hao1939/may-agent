import { resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const attemptId =
  "a_ops_repair-shared-auth-dependent-holder-metadata-drift-20260714_20260714221233";
const evidencePath =
  "evidence/archive/ops-repair-shared-auth-dependent-holder-metadata-drift-20260714.md";
const repairedAt = new Date().toISOString();

const repairTaskId =
  "ops/repair-shared-auth-dependent-holder-metadata-drift-20260714";
const affectedHolderTaskId =
  "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix";
const retiredSharedAuthTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const liveSharedAuthCarrierTaskId =
  "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714";
const governingProjectWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const sharedAuthPathId = "shared-authenticated-artifact-result-recovery-family-20260712";
const sharedAuthApprovalId =
  "aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const sharedAuthWaitId =
  "wait:aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const sharedAuthPacketPath =
  "evidence/archive/ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function liveState(task: MutableRecord): string {
  const state = asString(task.state).trim();
  if (state) return state;
  return asString(task.status).trim();
}

function isNonTerminal(task: MutableRecord): boolean {
  const state = liveState(task);
  return state !== "done" && state !== "closed";
}

function blockerWaitingTaskId(task: MutableRecord): string | null {
  const blocker = asRecord(task.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  const taskId = asString(waitingFor.taskId).trim();
  return taskId || null;
}

function staleHolderInventory(tasks: Record<string, unknown>): string[] {
  return Object.entries(tasks)
    .filter(([taskId, task]) => {
      if (taskId === repairTaskId) return false;
      const record = asRecord(task);
      return (
        isNonTerminal(record) &&
        blockerWaitingTaskId(record) === retiredSharedAuthTaskId
      );
    })
    .map(([taskId]) => taskId)
    .sort((a, b) => a.localeCompare(b));
}

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const beforeInventory = staleHolderInventory(tree.tasks);
  const holder = tree.tasks[affectedHolderTaskId];
  const liveSharedAuthCarrier = tree.tasks[liveSharedAuthCarrierTaskId];
  const governingProjectWait = tree.tasks[governingProjectWaitTaskId];

  if (!holder) throw new Error(`Missing task ${affectedHolderTaskId}`);
  if (!liveSharedAuthCarrier) throw new Error(`Missing task ${liveSharedAuthCarrierTaskId}`);
  if (!governingProjectWait) throw new Error(`Missing task ${governingProjectWaitTaskId}`);
  if (!beforeInventory.includes(affectedHolderTaskId)) {
    throw new Error(
      `Expected stale-holder inventory to include ${affectedHolderTaskId}; found ${JSON.stringify(beforeInventory)}`,
    );
  }

  const holderBlocker = asRecord(holder.blocker);
  const waitingForBefore = asRecord(holderBlocker.waiting_for);
  const waitingForAfter: MutableRecord = {
    ...waitingForBefore,
    taskId: liveSharedAuthCarrierTaskId,
    pathId: sharedAuthPathId,
    approvalId: sharedAuthApprovalId,
    waitId: sharedAuthWaitId,
    packetPath: sharedAuthPacketPath,
    governingTaskId: governingProjectWaitTaskId,
  };

  holderBlocker.waiting_for = waitingForAfter;
  holder.blocker = holderBlocker;
  holder.trace = {
    ...asRecord(holder.trace),
    shared_auth_dependent_holder_repaired_at: repairedAt,
    shared_auth_dependent_holder_repaired_by: "app-ops-script",
    shared_auth_dependent_holder_repair_attempt_id: attemptId,
    shared_auth_dependent_holder_repair_evidence_path: evidencePath,
    shared_auth_dependent_holder_previous_wait_task_id: retiredSharedAuthTaskId,
    shared_auth_dependent_holder_current_wait_task_id: liveSharedAuthCarrierTaskId,
    shared_auth_dependent_holder_governing_wait_task_id:
      governingProjectWaitTaskId,
  };
  holder.result =
    `Repointed ${affectedHolderTaskId} from retired shared-auth wait ${retiredSharedAuthTaskId} to live shared-auth carrier ${liveSharedAuthCarrierTaskId} with governing approval wait ${governingProjectWaitTaskId}; blocked semantics and review cadence unchanged.`;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const treeAfter = readTaskTree(config);
  const afterInventory = staleHolderInventory(treeAfter.tasks);
  const holderAfter = asRecord(treeAfter.tasks[affectedHolderTaskId]);
  const waitingForAfterSaved = asRecord(asRecord(holderAfter.blocker).waiting_for);

  return {
    attemptId,
    repairedAt,
    affectedHolderTaskId,
    retiredSharedAuthTaskId,
    liveSharedAuthCarrierTaskId,
    governingProjectWaitTaskId,
    beforeInventory,
    afterInventory,
    holderWaitingForBefore: waitingForBefore,
    holderWaitingForAfter: waitingForAfterSaved,
  };
});

console.log(JSON.stringify(result, null, 2));
