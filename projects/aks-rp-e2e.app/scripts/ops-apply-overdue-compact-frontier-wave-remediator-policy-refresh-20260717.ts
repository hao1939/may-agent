import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const attemptId =
  "a_ops_apply-overdue-compact-frontier-wave-remediator-policy-refresh-20260717_20260717021003";
const reviewMemoPath =
  "evidence/archive/ops-recover-overdue-compact-frontier-wave-remediator-policy-20260717.md";
const applyMemoPath =
  "evidence/archive/ops-apply-overdue-compact-frontier-wave-remediator-policy-refresh-20260717.md";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-18T00:30:00Z";
const fallbackAt = "2026-07-18T18:30:00Z";

const remediatorFeatureKey = "remediator-node-not-ready-restart";
const remediatorWaitTaskId =
  "ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized";
const ccpCorednsFeatureKey = "ccp-coredns";
const familyWaitTaskId =
  "wait-compact-reviewed-exception-live-ready-policy-family-20260702";

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const remediatorFeature = state.features[remediatorFeatureKey] as
  | FeatureCompactItemState
  | undefined;
const ccpCorednsFeature = state.features[ccpCorednsFeatureKey] as
  | FeatureCompactItemState
  | undefined;

if (!remediatorFeature) {
  throw new Error(`Compact feature not found: ${remediatorFeatureKey}`);
}
if (!ccpCorednsFeature) {
  throw new Error(`Compact feature not found: ${ccpCorednsFeatureKey}`);
}

const remediatorBefore = {
  status: remediatorFeature.status ?? null,
  taskId: remediatorFeature.taskId ?? null,
  frontierTaskIds: [...(remediatorFeature.frontierTaskIds ?? [])],
  waitingFor: remediatorFeature.waitingFor ?? null,
  nextCheckAt: remediatorFeature.nextCheckAt ?? null,
  fallbackAt: remediatorFeature.fallbackAt ?? null,
  reviewEvidencePath: remediatorFeature.reviewEvidencePath ?? null,
};

const ccpCorednsBefore = {
  status: ccpCorednsFeature.status ?? null,
  taskId: ccpCorednsFeature.taskId ?? null,
  frontierTaskIds: [...(ccpCorednsFeature.frontierTaskIds ?? [])],
  waitingFor: ccpCorednsFeature.waitingFor ?? null,
  nextCheckAt: ccpCorednsFeature.nextCheckAt ?? null,
  fallbackAt: ccpCorednsFeature.fallbackAt ?? null,
  reviewEvidencePath: ccpCorednsFeature.reviewEvidencePath ?? null,
};

updateFeatureCompactItem(state, remediatorFeatureKey, {
  status: "blocked",
  errorClass: "runtime-product-lineage",
  retryable: false,
  taskId: remediatorWaitTaskId,
  frontierTaskIds: [remediatorWaitTaskId],
  retryReason:
    "Resume only when the row-163 owner/runtime verdict returns, an accepted same-path contract reclassification lands, or another material remediator runtime/product change alters the expected outcome.",
  rootCauseClassification:
    remediatorFeature.rootCauseClassification ??
    "runtime-product-lineage-owner-return-wait",
  ownerReason:
    "The truthful compact-visible carrier remains the exact returned owner/runtime wait for remediator row-163 on run 28587390517; later run 28589232919 failed earlier at shared westus2 capacity preflight and does not supersede that stronger same-path nonpass lineage.",
  attemptedFixes: unique([
    ...(remediatorFeature.attemptedFixes ?? []),
    `${attemptId}: restored remediator-node-not-ready-restart to the exact owner/runtime wait ${remediatorWaitTaskId}, removed the misleading done/taskId:null projection, and refreshed the controller-visible watch window to 2026-07-18T00:30:00Z / 2026-07-18T18:30:00Z using ${reviewMemoPath}.`,
  ]),
  nextStepClassification:
    "Preserve one exact remediator owner/runtime wait centered on run 28587390517 until returned review, accepted same-path contract change, or stronger same-path runtime/product evidence lands; do not reopen an unchanged compact rerun.",
  resumeCondition:
    "Resume only when the row-163 owner/runtime verdict returns, an accepted same-path contract reclassification lands, or another material remediator runtime/product change alters the expected outcome.",
  blockedAt: remediatorFeature.blockedAt ?? "2026-07-09T14:06:28.034Z",
  blockedReason:
    "Do not rerun unchanged. Fresh 2026-07-17 apply repair revalidated that run 28587390517 is still the strongest same-path remediator witness: both nodes recovered Ready, NodeRebootStart and NodeRebootEnd were observed, and only NodeReimageStart/NodeReimageEnd remain absent within the preserved event window. Later run 28589232919 failed earlier at shared westus2 capacity preflight and does not supersede the exact owner/runtime wait.",
  waitingFor: {
    type: "owner.decision",
    taskId: remediatorWaitTaskId,
    featureKey: remediatorFeatureKey,
    scope: "feature-compact",
    runId: "28587390517",
    contract: "row-163 NodeReimageStart/NodeReimageEnd",
  },
  waitingCondition:
    "Resume only when the row-163 owner/runtime verdict returns, an accepted same-path contract reclassification lands, or another material remediator runtime/product change alters the expected outcome.",
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this compact-visible remediator wait while the exact owner/runtime review task remains unresolved; only return the feature to runnable work when the named review condition changes.",
  nextCheckAt,
  blockerOwner: "human",
  fallbackAt,
  fallbackAction:
    "If the same owner/runtime wait still holds at fallback, resend or refresh one exact owner/runtime escalation centered on run 28587390517 and the row-163 NodeReimageStart/NodeReimageEnd contract instead of classifying this family as generic westus2 capacity or retrying unchanged.",
  resumeAction:
    "Reset this feature compact record to pending only after the exact remediator owner/runtime wait materially changes or a sharper accepted same-lineage successor replaces it.",
  blockedScope: {
    kind: "feature",
    ids: [remediatorFeatureKey],
  },
  blockedFingerprint: {
    errorClass: "runtime-product-lineage",
    target: "staging",
    branch: "dev",
    featureKey: remediatorFeatureKey,
    specId: "spec.remediator.node-not-ready-restart",
    waitTaskId: remediatorWaitTaskId,
  },
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(remediatorFeature.evidencePaths ?? []),
    reviewMemoPath,
    applyMemoPath,
    remediatorFeature.lastSummaryPath ?? null,
    remediatorFeature.lastDiagnosticsPath ?? null,
    remediatorFeature.lastResultPath ?? null,
  ]),
  reviewEvidencePath: applyMemoPath,
  verificationBlocker:
    "Do not rerun unchanged. This branch remains truthfully represented only by the exact returned owner/runtime wait until a returned verdict or stronger same-path evidence changes the row-163 remediator contract.",
  summary:
    "2026-07-17 apply repair restored remediator-node-not-ready-restart from misleading done/taskId:null state back to the exact owner/runtime wait ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized with a refreshed 2026-07-18 review window centered on run 28587390517.",
});

updateFeatureCompactItem(state, ccpCorednsFeatureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: familyWaitTaskId,
  frontierTaskIds: [familyWaitTaskId],
  retryReason:
    "Resume only on accepted reviewed-exception member reclassification or an intentional compact live-ready policy change; do not broad-rerun unchanged features.",
  rootCauseClassification:
    ccpCorednsFeature.rootCauseClassification ?? "repo-local-live-ready-filter",
  ownerReason:
    "All 6 feature-owned specs remain selected into the compact package, but the residual live-ready residue is still governed only by the shared reviewed-exception/live-ready policy family because spec.ccp-coredns.pdb-disruption-budget and spec.ccp-coredns.upgrade-survival remain intentionally quarantined for live dispatch.",
  attemptedFixes: unique([
    ...(ccpCorednsFeature.attemptedFixes ?? []),
    `${attemptId}: rebound ccp-coredns from stale/nonexistent task id ${String(ccpCorednsFeature.taskId ?? "null")} to the exact shared reviewed-exception/live-ready policy family wait ${familyWaitTaskId} and refreshed the controller-visible watch window to 2026-07-18T00:30:00Z / 2026-07-18T18:30:00Z using ${reviewMemoPath}.`,
  ]),
  nextStepClassification:
    "Preserve the shared reviewed-exception/live-ready policy family until accepted member reclassification or a compact live-ready policy change lands; do not create a duplicate ccp-coredns carrier or rerun compact unchanged.",
  resumeCondition:
    "Resume only on accepted reviewed-exception member reclassification or an intentional compact live-ready policy change; do not broad-rerun unchanged features.",
  blockedAt: ccpCorednsFeature.blockedAt ?? "2026-07-02T11:25:54.530Z",
  blockedReason:
    "Do not rerun unchanged. Fresh 2026-07-17 apply repair revalidated that ccp-coredns remains compact-partial only because spec.ccp-coredns.pdb-disruption-budget and spec.ccp-coredns.upgrade-survival remain reviewed-exception members intentionally excluded by the default live-ready filter. The exact compact-visible carrier is the shared reviewed-exception/live-ready policy family wait, not the stale nonexistent feature-local task id.",
  waitingFor: {
    type: "compact.live-ready.policy",
    taskId: familyWaitTaskId,
    featureKey: ccpCorednsFeatureKey,
    target: "staging",
    scope: "reviewed-exception-live-ready-family",
  },
  waitingCondition:
    "Resume only on accepted reviewed-exception member reclassification or an intentional compact live-ready policy change; do not broad-rerun unchanged features.",
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this shared reviewed-exception family binding while the default compact live-ready policy still excludes the listed ccp-coredns members.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction:
    "If this shared reviewed-exception/live-ready policy wait is still true at fallback, refresh the family evidence or replace only ccp-coredns with one sharper exact successor rather than reopening an unchanged rerun or creating a duplicate family carrier.",
  resumeAction:
    "Reset this feature compact record to pending only after the shared reviewed-exception family materially changes or a sharper accepted ccp-coredns successor replaces it.",
  blockedScope: {
    kind: "feature",
    ids: [ccpCorednsFeatureKey],
  },
  blockedFingerprint: {
    errorClass: "package-partial",
    target: "staging",
    branch: "dev",
    featureKey: ccpCorednsFeatureKey,
    waitTaskId: familyWaitTaskId,
  },
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(ccpCorednsFeature.evidencePaths ?? []),
    reviewMemoPath,
    applyMemoPath,
    ccpCorednsFeature.lastSummaryPath ?? null,
    ccpCorednsFeature.lastDiagnosticsPath ?? null,
    ccpCorednsFeature.lastResultPath ?? null,
  ]),
  reviewEvidencePath: applyMemoPath,
  verificationBlocker:
    "Do not rerun unchanged. The truthful remaining compact blocker is only the shared reviewed-exception/live-ready policy wait until accepted member reclassification or compact policy change occurs.",
  summary:
    "2026-07-17 apply repair rebound ccp-coredns to wait-compact-reviewed-exception-live-ready-policy-family-20260702 with a refreshed 2026-07-18 family review window and removed the stale nonexistent feature-local carrier from controller-visible state.",
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      applyMemoPath,
      reviewMemoPath,
      path,
      checkedAt,
      remediator: {
        before: remediatorBefore,
        after: {
          status: state.features[remediatorFeatureKey]?.status ?? null,
          taskId: state.features[remediatorFeatureKey]?.taskId ?? null,
          frontierTaskIds:
            state.features[remediatorFeatureKey]?.frontierTaskIds ?? null,
          waitingFor: state.features[remediatorFeatureKey]?.waitingFor ?? null,
          nextCheckAt: state.features[remediatorFeatureKey]?.nextCheckAt ?? null,
          fallbackAt: state.features[remediatorFeatureKey]?.fallbackAt ?? null,
          reviewEvidencePath:
            state.features[remediatorFeatureKey]?.reviewEvidencePath ?? null,
        },
      },
      ccpCoredns: {
        before: ccpCorednsBefore,
        after: {
          status: state.features[ccpCorednsFeatureKey]?.status ?? null,
          taskId: state.features[ccpCorednsFeatureKey]?.taskId ?? null,
          frontierTaskIds:
            state.features[ccpCorednsFeatureKey]?.frontierTaskIds ?? null,
          waitingFor: state.features[ccpCorednsFeatureKey]?.waitingFor ?? null,
          nextCheckAt: state.features[ccpCorednsFeatureKey]?.nextCheckAt ?? null,
          fallbackAt: state.features[ccpCorednsFeatureKey]?.fallbackAt ?? null,
          reviewEvidencePath:
            state.features[ccpCorednsFeatureKey]?.reviewEvidencePath ?? null,
        },
      },
    },
    null,
    2,
  ),
);
