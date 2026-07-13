import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "rp-cluster-lifecycle";
const activeTaskId = "ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runtime-or-alte";
const retiredWaitTaskId =
  "ops/wait-rp-cluster-lifecycle-eight-file-publication-auth-runtime-return-20260712";
const reviewMemoPath =
  "evidence/archive/ops-diagnose-rp-cluster-lifecycle-publication-auth-runtime-20260712.md";
const applyMemoPath =
  "evidence/archive/ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runtime-or-alte-20260712.md";
const attemptId =
  "a_ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runtime-or-alte_20260712201838";
const checkedAt = new Date().toISOString();

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
const nextFrontier = unique(
  priorFrontier.map((taskId) =>
    taskId === retiredWaitTaskId ? activeTaskId : taskId,
  ),
);

updateFeatureCompactItem(state, featureKey, {
  taskId: feature.taskId ?? null,
  frontierTaskIds: nextFrontier,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(feature.evidencePaths ?? []),
    reviewMemoPath,
    applyMemoPath,
    feature.lastSummaryPath,
    feature.lastDiagnosticsPath,
  ]),
  reviewEvidencePath: applyMemoPath,
  summary:
    "2026-07-12 app repair replaced the stale eight-file publication auth/runtime wait with the active PATH-fixed local publication-preflight/publication task, and compact-facing frontierTaskIds now point at the active task instead of the retired wait id.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `${attemptId}: replaced retired frontier wait ${retiredWaitTaskId} with active task ${activeTaskId} in compact-facing frontierTaskIds after the app state repair cleared the stale auth/runtime blocker and restored the bounded PATH-fixed publication-preflight/publication step.`,
  ]),
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      path,
      featureKey,
      before: {
        frontierTaskIds: priorFrontier,
        reviewEvidencePath: feature.reviewEvidencePath ?? null,
      },
      after: {
        frontierTaskIds: state.features[featureKey]?.frontierTaskIds ?? null,
        reviewEvidencePath: state.features[featureKey]?.reviewEvidencePath ?? null,
      },
    },
    null,
    2,
  ),
);
