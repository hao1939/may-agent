import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";

type TaskTree = {
  tasks: Record<
    string,
    {
      blocker?: {
        condition?: string;
        category?: string;
        owner?: string;
        blocked_at?: string;
        waiting_for?: Record<string, unknown>;
        observed_by?: Record<string, unknown>;
        observation_method?: string;
        next_check_at?: string;
        resume_condition?: string;
        resume_at?: string;
        fallback_at?: string;
        fallback_action?: string;
      };
      goal?: string;
      acceptance?: string[];
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
const checkedAt = new Date().toISOString();
const evidencePath =
  "evidence/archive/ops-apply-recover-overdue-upgrade-underlay-prereq-holder-20260711-state-repair.md";
const holderTaskId =
  "hold-compact-rp-cluster-lifecycle-execute-ready-octet-frontier-20260710";
const sharedWaitId =
  "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708";
const specId = "spec.upgrade.vm-prerelease-deprecated-api-detection";
const featureKey = "upgrade";

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
  const blocker = tree.tasks[taskId]?.blocker;
  if (!blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return blocker;
}

const holderBlocker = blockerFor(holderTaskId);
const sharedWaitBlocker = blockerFor(sharedWaitId);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const compactFeature = compactState.features[featureKey];
if (!compactFeature) {
  throw new Error(`Compact feature not found: ${featureKey}`);
}

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "reviewed-exception",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [sharedWaitId],
  retryReason:
    holderBlocker.resume_condition ??
    compactFeature.retryReason ??
    "Resume only when the shared underlay/runtime-input family returns the exact inputs needed by the unchanged deprecated-api carrier, or when the carrier is intentionally reclassified.",
  rootCauseClassification:
    compactFeature.rootCauseClassification ??
    "reviewed-live-run-environment-underlay-control-plane-prerequisite-wait",
  ownerReason:
    "The published-wave live rerun already proved that spec.upgrade.vm-prerelease-blocking-pdb and spec.upgrade.vm-prerelease-max-unavailable pass. The only remaining blocker is environment/prerequisite supply for spec.upgrade.vm-prerelease-deprecated-api-detection, which is now explicitly represented by the shared underlay/runtime-input family wait wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708.",
  nextStepClassification:
    "preserve compact projection of the shared underlay/runtime-input family until returned inputs or explicit reclassification materially change the deprecated-api carrier frontier",
  resumeCondition:
    holderBlocker.resume_condition ?? compactFeature.resumeCondition ?? null,
  blockedAt: holderBlocker.blocked_at ?? compactFeature.blockedAt ?? null,
  blockedReason: holderBlocker.condition ?? compactFeature.blockedReason ?? null,
  waitingFor:
    (holderBlocker.waiting_for ?? compactFeature.waitingFor ?? null) as
      | Record<string, unknown>
      | null,
  waitingCondition:
    holderBlocker.resume_condition ?? compactFeature.waitingCondition ?? null,
  observedBy:
    (holderBlocker.observed_by ?? compactFeature.observedBy ?? null) as
      | Record<string, unknown>
      | null,
  observationMethod:
    holderBlocker.observation_method ?? compactFeature.observationMethod ?? null,
  nextCheckAt: holderBlocker.next_check_at ?? compactFeature.nextCheckAt ?? null,
  blockerOwner: holderBlocker.owner ?? compactFeature.blockerOwner ?? null,
  fallbackAt: holderBlocker.fallback_at ?? compactFeature.fallbackAt ?? null,
  fallbackAction:
    holderBlocker.fallback_action ?? compactFeature.fallbackAction ?? null,
  resumeAction:
    "Reset this feature compact record to pending only after the named wait condition changes.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "reviewed-exception",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(compactFeature.evidencePaths ?? []),
    evidencePath,
    compactFeature.lastResultPath,
    compactFeature.lastDiagnosticsPath,
    compactFeature.lastSummaryPath,
  ]),
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    "Do not rerun unchanged: the remaining unresolved compact carrier is represented by the shared underlay/runtime-input family wait, so another broad upgrade rerun would stop on the same missing runtime inputs instead of adding product evidence.",
  summary:
    "Rebound the upgrade compact holder to shared wait wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708 and retired the stale wait-compact-upgrade-underlay-control-plane-prereqs-20260703 reference in controller-visible state.",
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 1,
});

const existingSpec = specState.specs[specId];
if (!existingSpec) {
  throw new Error(`Spec state not found: ${specId}`);
}

const existingReview = asRecord(existingSpec.review);
const patchedReview: Record<string, unknown> = {
  ...existingReview,
  pendingReviewTaskId: sharedWaitId,
};
if (!patchedReview.pendingReviewReason) {
  patchedReview.pendingReviewReason = "shared underlay/runtime-input family wait";
}

updateSpecLoopSpec(specState, specId, {
  taskId: sharedWaitId,
  successorDisposition: "shared-underlay-runtime-input-wait",
  successorEvidencePath: evidencePath,
  successorStateReason:
    "The stale compact-only holder reference was retired. The remaining truthful next step for spec.upgrade.vm-prerelease-deprecated-api-detection is the shared underlay/runtime-input family wait wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708, because the carrier still needs returned AKS_RP_E2E_UNDERLAY_KUBECONFIG and AKS_RP_E2E_CONTROL_PLANE_ID before one bounded same-path rerun becomes truthful again.",
  review: patchedReview as SpecLoopSpecState["review"],
  resumeCondition:
    existingSpec.resumeCondition ??
    sharedWaitBlocker.resume_condition ??
    null,
});

saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      compactStatePath,
      specStatePath,
      repaired: {
        holderTaskId,
        sharedWaitId,
        featureKey,
        compactTaskId: compactState.features[featureKey]?.taskId ?? null,
        compactFrontierTaskIds:
          compactState.features[featureKey]?.frontierTaskIds ?? null,
        specId,
        specTaskId: specState.specs[specId]?.taskId ?? null,
        specPendingReviewTaskId: asRecord(specState.specs[specId]?.review)
          .pendingReviewTaskId ?? null,
      },
    },
    null,
    2,
  ),
);
