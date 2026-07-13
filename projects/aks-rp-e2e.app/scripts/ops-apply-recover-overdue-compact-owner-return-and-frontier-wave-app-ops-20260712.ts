import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "remediator-node-not-ready-restart";
const waitTaskId =
  "ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized";
const supersededTaskId =
  "ops/wait-compact-remediator-runtime-owner-review-return-20260709";
const reviewMemoPath =
  "evidence/archive/ops-recover-overdue-compact-owner-return-and-frontier-wave-app-ops-20260712c.md";
const applyMemoPath =
  "evidence/archive/ops-apply-recover-overdue-compact-owner-return-and-frontier-wave-app-ops-20260712.md";
const attemptId =
  "a_ops-apply-recover-overdue-compact-owner-return-and-frontier-wave-app-ops_20260712184838";
const checkedAt = new Date().toISOString();
const nextCheckAt = "2026-07-13T18:00:00Z";
const fallbackAt = "2026-07-14T18:00:00Z";

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const feature = state.features[featureKey];
if (!feature) {
  throw new Error(`Compact feature not found: ${featureKey}`);
}

const priorFrontier = [...(feature.frontierTaskIds ?? [])];
const nextFrontier = unique([
  waitTaskId,
  ...priorFrontier.filter(
    (taskId) => taskId !== waitTaskId && taskId !== supersededTaskId,
  ),
]);

const blockedReason =
  "Fresh 2026-07-12 app-ops overdue compact review revalidated that the strongest reviewed same-path remediator witness still reached the row-163 product surface, restored both nodes to Ready, observed NodeRebootStart and NodeRebootEnd, and still did not produce NodeReimageStart and NodeReimageEnd within the preserved window. Current-head source/spec/carrier still preserve the exact remediator contract, so no unchanged rerun, generic westus2 capacity classification, or sharper same-lineage replacement is truthful. Preserve the normalized owner/runtime wait keyed to run 28587390517 rather than the stale pre-normalized task id or mixed capacity wording.";
const resumeCondition =
  "Resume only when a returned owner/runtime verdict on the row-163 reimage-event contract, an accepted same-path contract reclassification, or another material remediator runtime/product change alters the expected outcome.";
const fallbackAction =
  "If the same owner/runtime wait still holds at fallback, refresh or resend one exact owner/runtime escalation centered on run 28587390517 and the row-163 NodeReimageStart/NodeReimageEnd contract instead of classifying this family as generic westus2 capacity or retrying unchanged.";

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  errorClass: "runtime-product-lineage",
  retryable: false,
  taskId: waitTaskId,
  frontierTaskIds: nextFrontier,
  retryReason: resumeCondition,
  rootCauseClassification:
    feature.rootCauseClassification ?? "runtime-product-lineage-owner-return-wait",
  ownerReason:
    "The truthful compact-visible carrier is the normalized returned owner/runtime wait for remediator row-163 on run 28587390517, not the stale pre-normalized task id and not a generic capacity preflight posture.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `${attemptId}: repaired remediator compact loop-state drift to point at ${waitTaskId}, removed the stale pre-normalized task id ${supersededTaskId}, and refreshed the owner/runtime review window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z using ${reviewMemoPath}.`,
  ]),
  nextStepClassification:
    "preserve one exact remediator owner/runtime wait centered on run 28587390517 until returned review or same-path contract change lands; do not reopen an unchanged compact rerun",
  resumeCondition,
  blockedAt: feature.blockedAt ?? "2026-07-09T14:06:28.034Z",
  blockedReason,
  waitingFor: {
    type: "owner.decision",
    taskId: waitTaskId,
    featureKey,
    scope: "feature-compact",
    runId: "28587390517",
    contract: "row-163 NodeReimageStart/NodeReimageEnd",
  },
  waitingCondition: resumeCondition,
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this compact-visible remediator wait while the exact normalized owner/runtime review task remains unresolved; only return the feature to runnable work when the named review condition changes.",
  nextCheckAt,
  blockerOwner: "human",
  fallbackAt,
  fallbackAction,
  resumeAction:
    "Reset this feature compact record to pending only after the normalized remediator owner/runtime wait materially changes or a sharper accepted same-lineage successor replaces it.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "runtime-product-lineage",
    target: "staging",
    branch: "dev",
    featureKey,
    specId: "spec.remediator.node-not-ready-restart",
    waitTaskId,
  },
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(feature.evidencePaths ?? []),
    reviewMemoPath,
    applyMemoPath,
    feature.lastSummaryPath,
    feature.lastDiagnosticsPath,
    feature.lastResultPath,
  ]),
  reviewEvidencePath: applyMemoPath,
  verificationBlocker:
    "Do not rerun unchanged. This branch remains truthfully represented only by the normalized returned owner/runtime wait until a bounded returned verdict or stronger same-lineage evidence changes the row-163 reimage-event contract.",
  summary:
    "2026-07-12 apply repair refreshed the normalized remediator owner/runtime wait window to 2026-07-13T18:00:00Z / 2026-07-14T18:00:00Z and repaired compact loop-state drift so remediator-node-not-ready-restart now points at ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized instead of the stale pre-normalized id and mixed capacity wording.",
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      applyMemoPath,
      reviewMemoPath,
      path,
      featureKey,
      before: {
        taskId: feature.taskId ?? null,
        frontierTaskIds: priorFrontier,
        waitingFor: feature.waitingFor ?? null,
        nextCheckAt: feature.nextCheckAt ?? null,
        fallbackAt: feature.fallbackAt ?? null,
        reviewEvidencePath: feature.reviewEvidencePath ?? null,
      },
      after: {
        taskId: state.features[featureKey]?.taskId ?? null,
        frontierTaskIds: state.features[featureKey]?.frontierTaskIds ?? null,
        waitingFor: state.features[featureKey]?.waitingFor ?? null,
        nextCheckAt: state.features[featureKey]?.nextCheckAt ?? null,
        fallbackAt: state.features[featureKey]?.fallbackAt ?? null,
        reviewEvidencePath: state.features[featureKey]?.reviewEvidencePath ?? null,
      },
    },
    null,
    2,
  ),
);
