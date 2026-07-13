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
const activeTaskId =
  "ops-apply-ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runti";
const memoPath =
  "evidence/archive/ops-apply-ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runti-20260712.md";
const priorMemoPath =
  "evidence/archive/ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runtime-or-alte-20260712.md";
const priorActiveTaskId =
  "ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runtime-or-alte";
const attemptId =
  "a_ops-apply-ops-apply-diagnose-rp-cluster-lifecycle-publication-auth-runti_20260712202551";
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
const priorReviewEvidencePath = feature.reviewEvidencePath ?? null;
const nextFrontier = unique(
  [...(feature.frontierTaskIds ?? []), activeTaskId].filter(
    (taskId) => taskId !== priorActiveTaskId,
  ),
);

updateFeatureCompactItem(state, featureKey, {
  taskId: feature.taskId ?? null,
  frontierTaskIds: nextFrontier,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(feature.evidencePaths ?? []),
    priorMemoPath,
    memoPath,
    feature.lastSummaryPath,
    feature.lastDiagnosticsPath,
  ]),
  reviewEvidencePath: memoPath,
  summary:
    "2026-07-12 app repair routed the rp-cluster-lifecycle compact-facing publication frontier to the current active exact eight-file publication-preflight/publication task and refreshed fresh PATH-based ls-remote/dry-run evidence without reabsorbing stop-start artifact recovery or rp-operation-status-polling residue.",
  attemptedFixes: unique([
    ...(feature.attemptedFixes ?? []),
    `${attemptId}: refreshed compact-facing rp-cluster-lifecycle reviewEvidencePath to ${memoPath} and reaffirmed frontierTaskIds includes active task ${activeTaskId} after fresh PATH=\"/app/.state/.local/bin:$PATH\" git ls-remote --heads origin HEAD plus git push --dry-run origin dev evidence for the exact eight-file publication-preflight/publication slice.`,
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
        reviewEvidencePath: priorReviewEvidencePath,
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
