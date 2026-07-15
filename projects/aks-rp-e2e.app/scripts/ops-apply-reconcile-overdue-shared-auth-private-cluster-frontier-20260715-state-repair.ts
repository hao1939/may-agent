import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  refreshBlockedWait,
  taskTreeConfig,
  updateTaskText,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, type TaskNode } from "../workflows/lib/task-tree-store.ts";
import {
  defaultSpecLoopStatePath,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

type MutableRecord = Record<string, unknown>;

type BlockerRecord = {
  condition?: string;
  category?: string;
  owner?: string;
  waiting_for?: Record<string, unknown>;
  observed_by?: Record<string, unknown>;
  observation_method?: string;
  next_check_at?: string;
  fallback_at?: string;
  fallback_action?: string;
  resume_condition?: string;
  resume_at?: string;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const worker = process.env.WORKER ?? "app-ops";
const attemptId =
  "a_ops-apply-reconcile-overdue-shared-auth-private-cluster-frontier-20260715-state-repair_20260715040814";
const reviewMemoPath =
  "evidence/archive/ops-reconcile-overdue-shared-auth-private-cluster-frontier-20260715.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-overdue-shared-auth-private-cluster-frontier-20260715-state-repair.md";
const featureKey = "private-cluster";
const sharedWaitTaskId =
  "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704";
const compactHolderTaskId =
  "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix";
const sharedAuthCarrierTaskId =
  "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714";
const governingTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const retiredSharedAuthTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const sharedAuthPathId = "shared-authenticated-artifact-result-recovery-family-20260712";
const sharedAuthApprovalId =
  "aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const sharedAuthWaitId =
  "wait:aks-rp-e2e:approval:shared-authenticated-artifact-result-recovery-family-20260712:evidence-archive-ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const sharedAuthPacketPath =
  "evidence/archive/ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md";
const nextCheckAt = "2026-07-15T22:00:00Z";
const fallbackAt = "2026-07-16T04:00:00Z";
const exactFrontierTaskIds = [
  "hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707",
  "wait-private-cluster-jumpbox-key-execution-surface-return-20260704",
  sharedAuthCarrierTaskId,
  "hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707",
] as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

function blockerOf(task: TaskNode, taskId: string): BlockerRecord {
  if (!task.blocker || typeof task.blocker !== "object") {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker as BlockerRecord;
}

function summarizeTask(task: TaskNode, taskId: string) {
  const blocker = blockerOf(task, taskId);
  return {
    id: task.id,
    state: task.state ?? task.status ?? null,
    result: (task as TaskNode & { result?: string }).result ?? null,
    blocker: {
      condition: blocker.condition ?? null,
      waiting_for: blocker.waiting_for ?? null,
      observation_method: blocker.observation_method ?? null,
      next_check_at: blocker.next_check_at ?? null,
      resume_at: blocker.resume_at ?? null,
      fallback_at: blocker.fallback_at ?? null,
      resume_condition: blocker.resume_condition ?? null,
      fallback_action: blocker.fallback_action ?? null,
    },
  };
}

function featureSnapshot(item: FeatureCompactItemState | undefined) {
  if (!item) return null;
  return {
    taskId: item.taskId ?? null,
    frontierTaskIds: item.frontierTaskIds ?? null,
    waitingFor: item.waitingFor ?? null,
    waitingCondition: item.waitingCondition ?? null,
    observationMethod: item.observationMethod ?? null,
    nextCheckAt: item.nextCheckAt ?? null,
    fallbackAt: item.fallbackAt ?? null,
    reviewEvidencePath: item.reviewEvidencePath ?? null,
    lastCheckedAt: item.lastCheckedAt ?? null,
    updatedAt: item.updatedAt,
  };
}

const treeBefore = readTaskTree(config);
const sharedWaitBefore = treeBefore.tasks[sharedWaitTaskId];
const compactHolderBefore = treeBefore.tasks[compactHolderTaskId];
const sharedAuthCarrier = treeBefore.tasks[sharedAuthCarrierTaskId];
if (!sharedWaitBefore) throw new Error(`Missing task ${sharedWaitTaskId}`);
if (!compactHolderBefore) throw new Error(`Missing task ${compactHolderTaskId}`);
if (!sharedAuthCarrier) throw new Error(`Missing task ${sharedAuthCarrierTaskId}`);

const sharedWaitBlockerBefore = blockerOf(sharedWaitBefore, sharedWaitTaskId);
const compactHolderBlockerBefore = blockerOf(compactHolderBefore, compactHolderTaskId);
const sharedAuthCarrierBlocker = blockerOf(sharedAuthCarrier, sharedAuthCarrierTaskId);
if (
  asString(asRecord(sharedAuthCarrierBlocker.waiting_for).approvalId) !==
  sharedAuthApprovalId
) {
  throw new Error(
    `Expected ${sharedAuthCarrierTaskId} to carry approvalId ${sharedAuthApprovalId}`,
  );
}

const sharedWaitCondition =
  `2026-07-15 overdue shared-auth/private-cluster repair (${reviewMemoPath}) revalidated that this remains the single truthful shared GitHub auth-preflight 401 family carrier under pathId ${sharedAuthPathId}: no controller-visible project.approval.submitted decision, telegram.reply, human.input.received event, or reviewed same-lineage auth-recovery proof has changed the exact defender-profile plus repaired Windows rerun surface, so preserve this family wait in place and align it to the current shared-auth approval review window.`;
const sharedWaitSummary =
  `${attemptId}: confirmed ${sharedWaitTaskId} remains the single truthful shared GitHub auth-preflight 401 family carrier and refreshed resume_at/next_check_at to ${nextCheckAt} with fallback_at ${fallbackAt} without creating a duplicate family wait.`;
const sharedWaitResumeCondition =
  asString(sharedWaitBlockerBefore.resume_condition).trim() ||
  `Resume only when project.approval.submitted returns one bounded approve/adjust/hold/decline/reroute decision for the preserved approvalId/waitId on ${sharedAuthPathId}, or reviewed same-lineage auth recovery materially changes the exact 401 rerun surface carried here; then replace this wait with the exact changed family carrier.`;
const sharedWaitObservationMethod =
  asString(sharedWaitBlockerBefore.observation_method).trim() ||
  "Planner/app-ops should reconcile the returned combined approval decision or equivalent reviewed same-lineage recovery evidence into the shared GitHub auth-preflight 401 family before any rerun is reconsidered.";
const sharedWaitFallbackAction =
  asString(sharedWaitBlockerBefore.fallback_action).trim() ||
  "If the shared 401 family still holds at fallback, refresh only this exact family evidence or replace it with one sharper same-lineage recovery/owner-return carrier; do not add another family wait or reopen unchanged reruns.";

refreshBlockedWait(config, {
  taskId: sharedWaitTaskId,
  condition: sharedWaitCondition,
  resumeCondition: sharedWaitResumeCondition,
  summary: sharedWaitSummary,
  category: asString(sharedWaitBlockerBefore.category) || "external-wait",
  owner: asString(sharedWaitBlockerBefore.owner) || "human",
  observationMethod: sharedWaitObservationMethod,
  nextCheckAt,
  fallbackAt,
  fallbackAction: sharedWaitFallbackAction,
});
updateTaskText(config, {
  taskId: sharedWaitTaskId,
  resumeAt: nextCheckAt,
  nextCheckAt,
  fallbackAt,
});

const holderWaitingFor = {
  type: "frontier.changed",
  taskId: sharedAuthCarrierTaskId,
  pathId: sharedAuthPathId,
  featureKey,
  scope: "mixed-frontier",
  approvalId: sharedAuthApprovalId,
  waitId: sharedAuthWaitId,
  packetPath: sharedAuthPacketPath,
  governingTaskId,
};
const compactHolderCondition =
  `2026-07-15 overdue shared-auth/private-cluster repair (${reviewMemoPath}) revalidated that private-cluster compact remains the same represented mixed frontier. Keep this compact-facing holder linked only to the exact surviving represented branches: ${exactFrontierTaskIds[0]} for spec.private-cluster.egress-outboundtype, ${exactFrontierTaskIds[1]} for spec.private-cluster.privatelink-create.k8s-validation, ${sharedAuthCarrierTaskId} for the shared-auth same-run pair represented inside the consolidated family carrier, and ${exactFrontierTaskIds[3]} as intentional nonlive/source-grounded residue. Superseded rows spec.private-cluster.dns-zone-none and spec.private-cluster.dns-zone-system remain historical residue only. No downstream branch materially resolved, so do not reopen a broad unchanged compact rerun or restore retired umbrella wording.`;
const compactHolderResumeCondition =
  asString(compactHolderBlockerBefore.resume_condition).trim() ||
  `Resume only when one exact represented downstream carrier materially changes: the BYO UDR prerequisite carrier resolves or is reclassified for spec.private-cluster.egress-outboundtype; the jumpbox-key execution surface returns, is equivalently replaced, or receives a reviewed decline/reroute for spec.private-cluster.privatelink-create.k8s-validation; ${sharedAuthCarrierTaskId} resolves, narrows to a private-cluster-only replacement, or yields a reviewed same-lineage split-back-out for the shared-auth same-run pair; an owner-approved bounded reopen changes the nonlive contract for spec.private-cluster.vnet-integration-update-private-second-hop; or superseded dns-zone-none/dns-zone-system residue is intentionally removed or rehomed. Do not resume based on historical run 28700532873.`;
const compactHolderObservationMethod =
  `Scheduled blocked-frontier app-ops review checks the represented downstream waits, including ${sharedAuthCarrierTaskId} for the shared-auth same-run pair, and must unblock, replace, escalate, or keep the wait with fresh evidence.`;
const compactHolderFallbackAction =
  asString(compactHolderBlockerBefore.fallback_action).trim() ||
  "If the same represented mixed frontier still holds at the shared-auth governed review window, refresh only this same compact holder against the exact surviving represented branches and the consolidated shared-auth family evidence; do not retry unchanged or restore retired umbrella wording.";
const compactHolderSummary =
  `${attemptId}: repaired ${compactHolderTaskId} to point blocker.waiting_for at ${sharedAuthCarrierTaskId}, refreshed resume_at/next_check_at to ${nextCheckAt} with fallback_at ${fallbackAt}, removed stale shared-auth observation wording, and preserved the exact mixed-frontier branches without reopening unchanged reruns.`;

refreshBlockedWait(config, {
  taskId: compactHolderTaskId,
  condition: compactHolderCondition,
  resumeCondition: compactHolderResumeCondition,
  summary: compactHolderSummary,
  category: asString(compactHolderBlockerBefore.category) || "external-wait",
  owner: asString(compactHolderBlockerBefore.owner) || compactHolderBefore.owner || "product-owner",
  waitingFor: holderWaitingFor,
  observedBy:
    (compactHolderBlockerBefore.observed_by as Record<string, unknown> | undefined) ?? {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
  observationMethod: compactHolderObservationMethod,
  nextCheckAt,
  fallbackAt,
  fallbackAction: compactHolderFallbackAction,
});
updateTaskText(config, {
  taskId: compactHolderTaskId,
  resumeAt: nextCheckAt,
  nextCheckAt,
  fallbackAt,
});

const repairedAt = new Date().toISOString();
const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  statePath: compactStatePath,
  refreshFromProject: false,
});
const compactFeatureBefore = compactLoaded.state.features[featureKey];
if (!compactFeatureBefore) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

const waitingCondition =
  `Resume only when one exact represented downstream carrier materially changes: the BYO UDR prerequisite carrier resolves or is reclassified for spec.private-cluster.egress-outboundtype; the jumpbox-key execution surface returns, is equivalently replaced, or receives a reviewed decline/reroute for spec.private-cluster.privatelink-create.k8s-validation; ${sharedAuthCarrierTaskId} resolves, narrows to a private-cluster-only replacement, or yields a reviewed same-lineage split-back-out for the shared-auth same-run pair; an owner-approved bounded reopen changes the nonlive contract for spec.private-cluster.vnet-integration-update-private-second-hop; or superseded dns-zone-none/dns-zone-system residue is intentionally removed or rehomed. Earliest next review follows ${sharedAuthCarrierTaskId} at ${nextCheckAt}; later same-frontier checks remain the 2026-07-15T18:00:00Z BYO UDR, jumpbox-key, and update-private-second-hop windows. Do not resume based on historical run 28700532873.`;
const compactSummary =
  `Synchronized the private-cluster compact mixed-frontier row to ${compactHolderTaskId}: blocker.waitingFor now follows ${sharedAuthCarrierTaskId} with the shared-auth approval tuple, frontierTaskIds include the live jumpbox-key carrier, and the watch window aligns to ${nextCheckAt} / ${fallbackAt} without reopening unchanged reruns.`;

updateFeatureCompactItem(compactLoaded.state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: compactHolderTaskId,
  frontierTaskIds: [...exactFrontierTaskIds],
  waitingFor: holderWaitingFor,
  waitingCondition,
  observedBy:
    compactFeatureBefore.observedBy ??
    ((compactHolderBlockerBefore.observed_by as Record<string, unknown> | undefined) ?? null),
  observationMethod: compactHolderObservationMethod,
  nextCheckAt,
  blockerOwner:
    (compactFeatureBefore.blockerOwner ??
      asString(compactHolderBlockerBefore.owner)) ||
    "product-owner",
  fallbackAt,
  fallbackAction:
    compactFeatureBefore.fallbackAction ?? compactHolderFallbackAction,
  resumeCondition:
    compactFeatureBefore.resumeCondition ?? compactHolderResumeCondition,
  blockedReason:
    compactFeatureBefore.blockedReason ?? compactHolderCondition,
  reviewEvidencePath: appMemoPath,
  evidencePaths: unique([...(compactFeatureBefore.evidencePaths ?? []), appMemoPath]),
  summary: compactSummary,
  lastCheckedAt: repairedAt,
});
saveFeatureCompactLoopState(compactStatePath, compactLoaded.state);

const specLoopState = JSON.parse(
  readFileSync(defaultSpecLoopStatePath(appDir), "utf-8"),
) as SpecLoopState;
const staleSpecLoopReferences = Object.entries(specLoopState.specs ?? {})
  .filter(([, spec]) => spec?.taskId === retiredSharedAuthTaskId)
  .map(([specId]) => specId)
  .sort((a, b) => a.localeCompare(b));

const treeAfter = readTaskTree(config);
const sharedWaitAfter = treeAfter.tasks[sharedWaitTaskId];
const compactHolderAfter = treeAfter.tasks[compactHolderTaskId];
if (!sharedWaitAfter) throw new Error(`Missing task ${sharedWaitTaskId} after repair`);
if (!compactHolderAfter) throw new Error(`Missing task ${compactHolderTaskId} after repair`);
const sharedWaitAfterBlocker = blockerOf(sharedWaitAfter, sharedWaitTaskId);
const compactHolderAfterBlocker = blockerOf(compactHolderAfter, compactHolderTaskId);

const compactStateAfter = JSON.parse(
  readFileSync(compactStatePath, "utf-8"),
) as { features?: Record<string, FeatureCompactItemState> };
const compactFeatureAfter = compactStateAfter.features?.[featureKey];
if (!compactFeatureAfter) {
  throw new Error(`Missing compact feature state for ${featureKey} after repair`);
}

if (sharedWaitAfterBlocker.next_check_at !== nextCheckAt) {
  throw new Error(
    `${sharedWaitTaskId} next_check_at=${sharedWaitAfterBlocker.next_check_at} (expected ${nextCheckAt})`,
  );
}
if (sharedWaitAfterBlocker.fallback_at !== fallbackAt) {
  throw new Error(
    `${sharedWaitTaskId} fallback_at=${sharedWaitAfterBlocker.fallback_at} (expected ${fallbackAt})`,
  );
}
if (sharedWaitAfterBlocker.resume_at !== nextCheckAt) {
  throw new Error(
    `${sharedWaitTaskId} resume_at=${sharedWaitAfterBlocker.resume_at} (expected ${nextCheckAt})`,
  );
}
if (asString(asRecord(compactHolderAfterBlocker.waiting_for).taskId) !== sharedAuthCarrierTaskId) {
  throw new Error(
    `${compactHolderTaskId} waiting_for.taskId=${asString(asRecord(compactHolderAfterBlocker.waiting_for).taskId)} (expected ${sharedAuthCarrierTaskId})`,
  );
}
if (
  asString(asRecord(compactHolderAfterBlocker.waiting_for).approvalId) !==
  sharedAuthApprovalId
) {
  throw new Error(`Missing shared-auth approvalId on ${compactHolderTaskId}`);
}
if (
  compactHolderAfterBlocker.next_check_at !== nextCheckAt ||
  compactHolderAfterBlocker.fallback_at !== fallbackAt ||
  compactHolderAfterBlocker.resume_at !== nextCheckAt
) {
  throw new Error(
    `${compactHolderTaskId} cadence mismatch after repair: ${JSON.stringify({
      next_check_at: compactHolderAfterBlocker.next_check_at ?? null,
      fallback_at: compactHolderAfterBlocker.fallback_at ?? null,
      resume_at: compactHolderAfterBlocker.resume_at ?? null,
    })}`,
  );
}
if (compactHolderAfterBlocker.observation_method?.includes("hold-spec-private-cluster-shared-auth-run-pair-family-20260714")) {
  throw new Error(`Stale observation wording remains on ${compactHolderTaskId}`);
}
if (asString(asRecord(compactFeatureAfter.waitingFor).taskId) !== sharedAuthCarrierTaskId) {
  throw new Error(
    `${featureKey} compact waitingFor.taskId=${asString(asRecord(compactFeatureAfter.waitingFor).taskId)} (expected ${sharedAuthCarrierTaskId})`,
  );
}
if ((compactFeatureAfter.waitingCondition ?? "").includes(retiredSharedAuthTaskId)) {
  throw new Error(`Retired shared-auth wait id remains in ${featureKey}.waitingCondition`);
}
for (const taskId of exactFrontierTaskIds) {
  if (!asStringArray(compactFeatureAfter.frontierTaskIds).includes(taskId)) {
    throw new Error(`Missing ${taskId} from ${featureKey}.frontierTaskIds after repair`);
  }
}
if (compactFeatureAfter.nextCheckAt !== nextCheckAt) {
  throw new Error(
    `${featureKey}.nextCheckAt=${compactFeatureAfter.nextCheckAt} (expected ${nextCheckAt})`,
  );
}
if (compactFeatureAfter.fallbackAt !== fallbackAt) {
  throw new Error(
    `${featureKey}.fallbackAt=${compactFeatureAfter.fallbackAt} (expected ${fallbackAt})`,
  );
}

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      reviewMemoPath,
      repairedAt,
      specLoopStaleRetiredWaitReferences: staleSpecLoopReferences,
      sharedWait: {
        before: summarizeTask(sharedWaitBefore, sharedWaitTaskId),
        after: summarizeTask(sharedWaitAfter, sharedWaitTaskId),
      },
      compactHolder: {
        before: summarizeTask(compactHolderBefore, compactHolderTaskId),
        after: summarizeTask(compactHolderAfter, compactHolderTaskId),
      },
      compactFeature: {
        before: featureSnapshot(compactFeatureBefore),
        after: featureSnapshot(compactFeatureAfter),
      },
    },
    null,
    2,
  ),
);
