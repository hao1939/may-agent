import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "managedsystem-pool";
const waitTaskId =
  "wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711";
const attemptId =
  "a_ops-apply-reconcile-owner-return-wait-coverage-20260712-state-repair_20260712010800";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-owner-return-wait-coverage-20260712-state-repair.md";
const packetPath =
  "evidence/archive/managedsystem-cli-default-payload-owner-ask-20260711.md";
const sendProofPath =
  "evidence/archive/ops-send-managedsystem-cli-default-payload-owner-ask-20260711.md";
const approvalId =
  "aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md";
const waitId =
  "wait:aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md";
const checkedAt = new Date().toISOString();

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
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

const repairedWaitingFor = {
  type: "project.approval.submitted",
  featureKey,
  specId: "spec.managedsystem.cli-create-variant",
  pathId: "path.managedsystem.cli-create-default-payload",
  externalTool: "aks-preview",
  approvalId,
  waitId,
  packetPath,
  requestedBoundedOutcomes: [
    "fixed-cli-surface",
    "approved-alternate-invocation-shape",
    "explicit-retirement-rehome",
  ],
};

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const feature = compactState.features[featureKey];
if (!feature) throw new Error(`Compact feature not found: ${featureKey}`);

const taskResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const waitTask = tree.tasks[waitTaskId];
  if (!waitTask) throw new Error(`Task not found: ${waitTaskId}`);
  const task = waitTask as TaskNode;
  const blocker = asRecord(task.blocker);
  const observedBy = asRecord(blocker.observed_by);

  task.state = "blocked";
  task.status = "blocked";
  task.blocker = {
    ...blocker,
    waiting_for: repairedWaitingFor,
    observed_by: {
      workflow:
        typeof observedBy.workflow === "string" && observedBy.workflow.trim()
          ? observedBy.workflow
          : "project-planner",
      trigger: "project.approval.submitted",
      schedule:
        typeof observedBy.schedule === "string" && observedBy.schedule.trim()
          ? observedBy.schedule
          : "blocked-frontier-app-ops-review",
    },
    observation_method:
      "Planner handles the returned project.approval.submitted event for this exact approvalId/waitId/pathId lineage, and blocked-frontier reviews keep the wait fresh until a bounded returned owner decision or stronger same-lineage evidence changes the path.",
  };
  task.trace = {
    ...asRecord(task.trace),
    managedsystem_owner_return_wait_repaired_at: checkedAt,
    managedsystem_owner_return_wait_repaired_by: "app-ops-script",
    managedsystem_owner_return_wait_repair_attempt_id: attemptId,
    managedsystem_owner_return_wait_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    blocker: task.blocker,
  };
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "adjacent-cli-client-surface-external-fix-wait",
  retryable: false,
  taskId: waitTaskId,
  frontierTaskIds: [waitTaskId],
  retryReason:
    "Resume only when project.approval.submitted or equivalent reviewed owner return carries approvalId aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, waitId wait:aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, or another bounded decision for path.managedsystem.cli-create-default-payload.",
  rootCauseClassification:
    "non-canonical-adjacent-cli-client-surface-owner-decision-return-wait",
  ownerReason:
    "spec.managedsystem.cli-create-variant remains an adjacent non-canonical aks-preview CLI request-construction/default-payload carrier. Durable send proof already exists for the exact owner ask on path.managedsystem.cli-create-default-payload, so the truthful compact state is the returned owner-decision wait on that same approval lineage rather than a send-required posture.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    "Repaired the live ManagedSystem owner-return wait in place so the exact compact frontier now waits on the already-sent approval lineage (project.approval.submitted with approvalId/waitId/packetPath) instead of stale send-missing project.approval.requested metadata.",
  ]),
  nextStepClassification:
    "preserve one exact already-sent owner-decision return wait for the managedsystem CLI default-payload lineage until a bounded project.approval.submitted decision or stronger same-lineage evidence lands; do not reopen a broad compact rerun",
  resumeCondition:
    "Resume when project.approval.submitted or equivalent reviewed owner return carries approvalId aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, waitId wait:aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, or a bounded decision for path.managedsystem.cli-create-default-payload; then create exactly the approved successor or terminal reclassification.",
  blockedAt:
    typeof asRecord(taskResult.blocker).blocked_at === "string"
      ? (asRecord(taskResult.blocker).blocked_at as string)
      : feature.blockedAt ?? checkedAt,
  blockedReason:
    typeof asRecord(taskResult.blocker).condition === "string"
      ? (asRecord(taskResult.blocker).condition as string)
      : feature.blockedReason ?? null,
  waitingFor: repairedWaitingFor,
  waitingCondition:
    "Wait for project.approval.submitted or equivalent reviewed owner return on the exact already-sent ManagedSystem approval lineage keyed by the approvalId, waitId, or shared pathId.",
  observedBy: asRecord(asRecord(taskResult.blocker).observed_by),
  observationMethod:
    typeof asRecord(taskResult.blocker).observation_method === "string"
      ? (asRecord(taskResult.blocker).observation_method as string)
      : feature.observationMethod ?? null,
  nextCheckAt:
    typeof asRecord(taskResult.blocker).next_check_at === "string"
      ? (asRecord(taskResult.blocker).next_check_at as string)
      : feature.nextCheckAt ?? null,
  blockerOwner:
    typeof asRecord(taskResult.blocker).owner === "string"
      ? (asRecord(taskResult.blocker).owner as string)
      : feature.blockerOwner ?? null,
  fallbackAt:
    typeof asRecord(taskResult.blocker).fallback_at === "string"
      ? (asRecord(taskResult.blocker).fallback_at as string)
      : feature.fallbackAt ?? null,
  fallbackAction:
    typeof asRecord(taskResult.blocker).fallback_action === "string"
      ? (asRecord(taskResult.blocker).fallback_action as string)
      : feature.fallbackAction ?? null,
  resumeAction:
    "Replace this wait only after a bounded returned owner decision or stronger same-lineage evidence changes the adjacent CLI carrier.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "adjacent-cli-client-surface-external-fix-wait",
    target: "staging",
    branch: "dev",
    featureKey,
    specId: "spec.managedsystem.cli-create-variant",
    pathId: "path.managedsystem.cli-create-default-payload",
  },
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(feature.evidencePaths ?? []),
    evidencePath,
    packetPath,
    sendProofPath,
    feature.lastSummaryPath,
    feature.lastDiagnosticsPath,
  ]),
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    "Do not rerun unchanged. This branch is now truthfully represented only by the already-sent ManagedSystem approval-return wait until a bounded returned owner decision or stronger same-lineage evidence lands.",
  summary:
    "managedsystem-pool now points at the exact already-sent ManagedSystem owner-decision return wait, with frontierTaskIds and waitingFor repaired to the approval-submitted lineage instead of stale send-missing send-required posture.",
});

saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      compactStatePath,
      repaired: {
        waitTaskId,
        featureKey,
        taskWaitingFor: repairedWaitingFor,
        compactTaskId: compactState.features[featureKey]?.taskId ?? null,
        compactFrontierTaskIds:
          compactState.features[featureKey]?.frontierTaskIds ?? null,
        compactWaitingFor:
          compactState.features[featureKey]?.waitingFor ?? null,
      },
    },
    null,
    2,
  ),
);
