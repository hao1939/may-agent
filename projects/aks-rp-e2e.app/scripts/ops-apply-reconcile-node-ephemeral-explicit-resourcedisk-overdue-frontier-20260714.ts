import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

type TaskNode = {
  blocker?: {
    condition?: string;
    owner?: string;
    waiting_for?: Record<string, unknown>;
    observed_by?: Record<string, unknown>;
    observation_method?: string;
    resume_condition?: string;
    next_check_at?: string;
    fallback_at?: string;
    fallback_action?: string;
  };
};

type TaskTree = {
  tasks: Record<string, TaskNode>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const treePath = resolve(appDir, ".state/tasks/tree.json");
const attemptId =
  "a_ops-apply-reconcile-node-ephemeral-explicit-resourcedisk-overdue-frontie_20260714204200";
const checkedAt = new Date().toISOString();
const domainMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-node-ephemeral-explicit-resourcedisk-overdue-frontier-20260714.md";
const domainCheckPath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-node-ephemeral-explicit-resourcedisk-overdue-frontier-20260714-check-node-ephemeral-disk-resource-placement.json";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-node-ephemeral-explicit-resourcedisk-overdue-frontier-20260714.md";
const specId = "spec.node-ephemeral-disk.resource-placement";
const specTaskId =
  "hold-spec-loop-pending-node-ephemeral-disk-explicit-resourcedisk-contract-20260706";
const featureKey = "node-ephemeral-os-disk";
const compactTaskId =
  "wait-compact-node-ephemeral-os-disk-resourcedisk-authority-or-reclassify-20260703";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function blockerFor(taskId: string) {
  const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
  const blocker = tree.tasks[taskId]?.blocker;
  if (!blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return blocker;
}

const specBlocker = blockerFor(specTaskId);
const compactBlocker = blockerFor(compactTaskId);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;
const currentSpec = specState.specs[specId];
if (!currentSpec) {
  throw new Error(`Missing spec-loop state for ${specId}`);
}
const currentSpecReview = asRecord(currentSpec.review);
const specBefore = {
  taskId: currentSpec.taskId ?? null,
  successorEvidencePath: currentSpec.successorEvidencePath ?? null,
  resumeCondition: currentSpec.resumeCondition ?? null,
  reviewClassification:
    typeof currentSpecReview.classification === "string"
      ? currentSpecReview.classification
      : null,
  reviewEvidencePaths: Array.isArray(currentSpecReview.currentEvidencePaths)
    ? currentSpecReview.currentEvidencePaths
    : null,
};

updateSpecLoopSpec(specState, specId, {
  taskId: specTaskId,
  successorDisposition: "same-lineage-explicit-resourcedisk-wait-refresh",
  successorEvidencePath: domainMemoPath,
  successorStateReason:
    "The explicit managed-cluster create branch that sends agentPoolProfiles[].osDiskPlacement=ResourceDisk remains blocked on the same exact lineage: mounted handwritten source still stops at Scenario_Ephemeral_Disk with CacheDisk assertions, mounted public create/model surfaces still omit osDiskPlacement, and preserved exact live artifact 28598014702 still rejects the explicit request shape with HTTP 400 / UnmarshalError / json: unknown field \"osDiskPlacement\". The omitted-field sibling remains a separate verified carrier and does not replace this explicit-input wait.",
  resumeCondition:
    specBlocker.resume_condition ?? currentSpec.resumeCondition ?? undefined,
  review: {
    ...currentSpecReview,
    classification: "same_lineage_explicit_resourcedisk_wait_refresh",
    lastRootCause:
      "Accepted 2026-07-14 same-lineage review confirmed the explicit ResourceDisk create branch is still bounded by CacheDisk-only handwritten authority plus live run 28598014702 rejecting osDiskPlacement=ResourceDisk on the managed-cluster create surface.",
    lastAction:
      "Keep the exact explicit ResourceDisk spec wait in place, refresh it from the 2026-07-14 same-lineage memo/check packet, and do not collapse it into the omitted-field sibling or reopen an unchanged rerun.",
    reviewedAt: checkedAt,
    pendingReviewTaskId: specTaskId,
    pendingReviewRunId: currentSpec.lastRunId ?? null,
    pendingReviewObservedAt: checkedAt,
    currentEvidencePaths: [domainMemoPath, domainCheckPath, appMemoPath],
  },
});
saveSpecLoopState(specStatePath, specState);

const specAfterState = specState.specs[specId];
const specAfterReview = asRecord(specAfterState.review);

const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const compactState = JSON.parse(
  readFileSync(compactStatePath, "utf-8"),
) as FeatureCompactLoopState;
const currentFeature = compactState.features[featureKey];
if (!currentFeature) {
  throw new Error(`Missing compact-loop state for ${featureKey}`);
}
const compactBefore = {
  taskId: currentFeature.taskId ?? null,
  nextCheckAt: currentFeature.nextCheckAt ?? null,
  fallbackAt: currentFeature.fallbackAt ?? null,
  blockerOwner: currentFeature.blockerOwner ?? null,
  reviewEvidencePath: currentFeature.reviewEvidencePath ?? null,
  lastCheckedAt: currentFeature.lastCheckedAt ?? null,
};

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: compactTaskId,
  frontierTaskIds: currentFeature.frontierTaskIds ?? [],
  retryable: false,
  retryReason:
    compactBlocker.resume_condition ?? currentFeature.retryReason ?? null,
  resumeCondition:
    compactBlocker.resume_condition ?? currentFeature.resumeCondition ?? null,
  blockedReason:
    compactBlocker.condition ?? currentFeature.blockedReason ?? null,
  waitingFor:
    (compactBlocker.waiting_for as Record<string, unknown> | undefined) ??
    currentFeature.waitingFor ??
    null,
  waitingCondition:
    compactBlocker.resume_condition ?? currentFeature.waitingCondition ?? null,
  observedBy:
    (compactBlocker.observed_by as Record<string, unknown> | undefined) ??
    currentFeature.observedBy ??
    null,
  observationMethod:
    compactBlocker.observation_method ?? currentFeature.observationMethod ?? null,
  nextCheckAt:
    compactBlocker.next_check_at ?? currentFeature.nextCheckAt ?? null,
  blockerOwner:
    compactBlocker.owner ?? currentFeature.blockerOwner ?? null,
  fallbackAt:
    compactBlocker.fallback_at ?? currentFeature.fallbackAt ?? null,
  fallbackAction:
    compactBlocker.fallback_action ?? currentFeature.fallbackAction ?? null,
  reviewEvidencePath: domainMemoPath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(currentFeature.evidencePaths ?? []),
    domainMemoPath,
    domainCheckPath,
    appMemoPath,
  ]),
  summary:
    `${attemptId}: refreshed node-ephemeral-os-disk compact wait metadata from live holder ${compactTaskId} and anchored controller-visible evidence to the 2026-07-14 same-lineage explicit ResourceDisk memo/check packet.`,
  attemptedFixes: unique([
    ...(currentFeature.attemptedFixes ?? []),
    `${attemptId}: aligned compact-loop nextCheckAt/fallbackAt/blockerOwner to live holder ${compactTaskId} and replaced stale 2026-07-11 repair evidence with the accepted 2026-07-14 same-lineage packet for the exact explicit ResourceDisk branch.`,
  ]),
  verificationBlocker:
    'Do not rerun unchanged: the exact explicit managed-cluster create request that sends osDiskPlacement=ResourceDisk remains blocked by live run 28598014702 (HTTP 400 / UnmarshalError / json: unknown field "osDiskPlacement") until same-lineage authority changes that explicit contract or replaces this branch.',
});
saveFeatureCompactLoopState(compactStatePath, compactState);

const compactAfter = compactState.features[featureKey];

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      spec: {
        specId,
        taskId: specTaskId,
        before: specBefore,
        after: {
          taskId: specAfterState.taskId ?? null,
          successorEvidencePath: specAfterState.successorEvidencePath ?? null,
          resumeCondition: specAfterState.resumeCondition ?? null,
          reviewClassification:
            typeof specAfterReview.classification === "string"
              ? specAfterReview.classification
              : null,
          reviewEvidencePaths: Array.isArray(specAfterReview.currentEvidencePaths)
            ? specAfterReview.currentEvidencePaths
            : null,
          updatedAt: specAfterState.updatedAt,
        },
      },
      compact: {
        featureKey,
        taskId: compactTaskId,
        before: compactBefore,
        after: {
          taskId: compactAfter.taskId ?? null,
          nextCheckAt: compactAfter.nextCheckAt ?? null,
          fallbackAt: compactAfter.fallbackAt ?? null,
          blockerOwner: compactAfter.blockerOwner ?? null,
          reviewEvidencePath: compactAfter.reviewEvidencePath ?? null,
          lastCheckedAt: compactAfter.lastCheckedAt ?? null,
          updatedAt: compactAfter.updatedAt,
        },
      },
    },
    null,
    2,
  ),
);
