import { resolve } from "node:path";
import {
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
  "a_ops-apply-execute-1930-managedsystem-owner-return-review-wave-app-ops-20_20260712193552";
const evidencePath =
  "evidence/archive/ops-apply-execute-1930-managedsystem-owner-return-review-wave-app-ops-20-20260712.md";
const packetPath =
  "evidence/archive/managedsystem-cli-default-payload-owner-ask-20260711.md";
const sendProofPath =
  "evidence/archive/ops-send-managedsystem-cli-default-payload-owner-ask-20260711.md";
const approvalId =
  "aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md";
const waitId =
  "wait:aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-13T19:30:00Z";
const fallbackAt = "2026-07-14T19:30:00Z";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

const waitingFor = {
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

const blockerCondition =
  "2026-07-12 owner-return recheck found no controller-visible returned project.approval.submitted decision yet for the already-sent ManagedSystem aks-preview CLI default-payload packet. Durable send proof remains in evidence/archive/ops-send-managedsystem-cli-default-payload-owner-ask-20260711.md for packet evidence/archive/managedsystem-cli-default-payload-owner-ask-20260711.md, approvalId aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, and waitId wait:aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md. Keep this adjacent CLI lineage blocked on the same exact approval-return wait and do not reopen an unchanged compact rerun.";
const resumeCondition =
  "Resume when project.approval.submitted or equivalent reviewed owner return carries approvalId aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, waitId wait:aks-rp-e2e:approval:path.managedsystem.cli-create-default-payload:evidence-archive-managedsystem-cli-default-payload-owner-ask-20260711.md, or a bounded decision for path.managedsystem.cli-create-default-payload; then create exactly the approved successor or terminal reclassification.";
const fallbackAction =
  "If no owner decision is visible by fallback, refresh this same approval-response wait from the existing send proof or escalate the same owner path; do not recreate a passive send-required hold or rerun unchanged.";
const observationMethod =
  "Planner handles the returned project.approval.submitted event for this exact approvalId/waitId/pathId lineage, and blocked-frontier reviews keep the wait fresh until a bounded returned owner decision or stronger same-lineage evidence changes the path.";
const resultSummary =
  "Refreshed the exact ManagedSystem owner-decision return wait from the 2026-07-12 review using the durable send proof, preserved the same approvalId/waitId/pathId lineage, restored frontierTaskIds to the exact wait, and advanced the next check to 2026-07-13T19:30:00Z with fallback at 2026-07-14T19:30:00Z.";

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
  const blockedAt = asString(blocker.blocked_at) ?? checkedAt;

  task.state = "blocked";
  task.status = "blocked";
  task.result = resultSummary;
  task.blocker = {
    ...blocker,
    condition: blockerCondition,
    category:
      typeof blocker.category === "string" && blocker.category.trim()
        ? blocker.category
        : "external-wait",
    owner:
      typeof blocker.owner === "string" && blocker.owner.trim()
        ? blocker.owner
        : (task.owner ?? "aks-explorer"),
    blocked_at: blockedAt,
    waiting_for: waitingFor,
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
    observation_method: observationMethod,
    resume_condition: resumeCondition,
    resume_at: nextCheckAt,
    next_check_at: nextCheckAt,
    fallback_at: fallbackAt,
    fallback_action: fallbackAction,
  };
  task.trace = {
    ...asRecord(task.trace),
    blocked_wait_refreshed_at: checkedAt,
    blocked_wait_refreshed_by: "app-ops-script",
    blocked_wait_refresh_summary: resultSummary,
    managedsystem_owner_return_wait_refreshed_at: checkedAt,
    managedsystem_owner_return_wait_refreshed_by: "app-ops-script",
    managedsystem_owner_return_wait_refresh_attempt_id: attemptId,
    managedsystem_owner_return_wait_refresh_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    blocker: task.blocker,
    result: task.result,
  };
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: waitTaskId,
  frontierTaskIds: [waitTaskId],
  retryable: false,
  retryReason: resumeCondition,
  blockedAt:
    typeof asRecord(taskResult.blocker).blocked_at === "string"
      ? (asRecord(taskResult.blocker).blocked_at as string)
      : feature.blockedAt ?? checkedAt,
  blockedReason:
    typeof asRecord(taskResult.blocker).condition === "string"
      ? (asRecord(taskResult.blocker).condition as string)
      : feature.blockedReason ?? null,
  waitingFor,
  waitingCondition:
    "Wait for project.approval.submitted or equivalent reviewed owner return on the exact already-sent ManagedSystem approval lineage keyed by the approvalId, waitId, or shared pathId.",
  observedBy: asRecord(asRecord(taskResult.blocker).observed_by),
  observationMethod:
    typeof asRecord(taskResult.blocker).observation_method === "string"
      ? (asRecord(taskResult.blocker).observation_method as string)
      : feature.observationMethod ?? null,
  nextCheckAt,
  blockerOwner:
    typeof asRecord(taskResult.blocker).owner === "string"
      ? (asRecord(taskResult.blocker).owner as string)
      : feature.blockerOwner ?? null,
  fallbackAt,
  fallbackAction,
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
  summary:
    "2026-07-12 app repair refreshed managedsystem-pool to the exact already-sent ManagedSystem owner-decision return wait, restored frontierTaskIds to [wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711], and advanced the next review/fallback window without reopening an unchanged compact rerun.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `${attemptId}: refreshed the exact ManagedSystem owner-decision return wait from durable send proof, preserved the same approvalId/waitId/pathId lineage, restored frontierTaskIds to the exact wait, and advanced the review window to 2026-07-13T19:30:00Z / 2026-07-14T19:30:00Z.`,
  ]),
});

saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      compactStatePath,
      refreshed: {
        waitTaskId,
        nextCheckAt,
        fallbackAt,
        waitingFor,
        compactTaskId: compactState.features[featureKey]?.taskId ?? null,
        compactFrontierTaskIds:
          compactState.features[featureKey]?.frontierTaskIds ?? null,
      },
    },
    null,
    2,
  ),
);
