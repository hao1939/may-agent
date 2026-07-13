import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type TaskNode = {
  blocker?: Record<string, unknown>;
};

type TaskTree = {
  tasks: Record<string, TaskNode>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const evidencePath =
  "evidence/archive/ops-apply-execute-shared-underlay-runtime-input-family-review-wave-app-ops-20260712.md";
const reviewedMemoPath =
  "evidence/archive/ops-execute-shared-underlay-runtime-input-family-review-wave-app-ops-20260712b.md";
const attemptId =
  "a_ops-apply-execute-shared-underlay-runtime-input-family-review-wave-app-o_20260712154200";
const checkedAt = "2026-07-12T15:43:41Z";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function blocker(taskId: string): Record<string, unknown> {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return asRecord(task.blocker);
}

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const schedulerTaskId = "hold-compact-serverless-schedulerctrl-live-workflow-frontier";
const schedulerBlocker = blocker(schedulerTaskId);
const schedulerFeature = state.features["serverless-schedulerctrl"];
if (!schedulerFeature) throw new Error("Missing feature state for serverless-schedulerctrl");
updateFeatureCompactItem(state, "serverless-schedulerctrl", {
  status: "blocked",
  taskId: schedulerTaskId,
  frontierTaskIds: ["hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708"],
  retryable: false,
  retryReason: stringValue(schedulerBlocker.resume_condition),
  blockedAt:
    stringValue(schedulerBlocker.blocked_at) ?? schedulerFeature.blockedAt ?? checkedAt,
  blockedReason: stringValue(schedulerBlocker.condition),
  waitingFor: asRecord(schedulerBlocker.waiting_for),
  waitingCondition: stringValue(schedulerBlocker.resume_condition),
  observedBy: asRecord(schedulerBlocker.observed_by),
  observationMethod: stringValue(schedulerBlocker.observation_method),
  nextCheckAt: stringValue(schedulerBlocker.next_check_at),
  blockerOwner: stringValue(schedulerBlocker.owner),
  fallbackAt: stringValue(schedulerBlocker.fallback_at),
  fallbackAction: stringValue(schedulerBlocker.fallback_action),
  reviewEvidencePath: evidencePath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(schedulerFeature.evidencePaths ?? []),
    evidencePath,
    reviewedMemoPath,
    ".state/feature-compact-loop/artifacts/28656258055/aks-rp-e2e-28656258055-test-results/test-results/feature-compact-serverless-schedulerctrl-staging_117688/result.json",
  ]),
  summary:
    "2026-07-12 app-state repair preserved serverless-schedulerctrl only as the compact-facing projection of the unchanged shared underlay/runtime-input family and moved the watch window to the 2026-07-13T15:30:00Z review boundary.",
  attemptedFixes: unique([
    ...(schedulerFeature.attemptedFixes ?? []),
    `${attemptId}: refreshed the compact-facing serverless-schedulerctrl holder/state from the unchanged-family review memo and aligned nextCheckAt/fallbackAt to the preserved shared underlay/runtime-input family window.`,
  ]),
});

const costTaskId = "hold-compact-cost-analysis-reviewed-exception-frontier";
const costBlocker = blocker(costTaskId);
const costFeature = state.features["cost-analysis"];
if (!costFeature) throw new Error("Missing feature state for cost-analysis");
updateFeatureCompactItem(state, "cost-analysis", {
  status: "blocked",
  taskId: costTaskId,
  frontierTaskIds: [],
  retryable: false,
  retryReason: stringValue(costBlocker.resume_condition),
  blockedAt: stringValue(costBlocker.blocked_at) ?? costFeature.blockedAt ?? checkedAt,
  blockedReason: stringValue(costBlocker.condition),
  waitingFor: asRecord(costBlocker.waiting_for),
  waitingCondition: stringValue(costBlocker.resume_condition),
  observedBy: asRecord(costBlocker.observed_by),
  observationMethod: stringValue(costBlocker.observation_method),
  nextCheckAt: stringValue(costBlocker.next_check_at),
  blockerOwner: stringValue(costBlocker.owner),
  fallbackAt: stringValue(costBlocker.fallback_at),
  fallbackAction: stringValue(costBlocker.fallback_action),
  reviewEvidencePath: evidencePath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(costFeature.evidencePaths ?? []),
    evidencePath,
    reviewedMemoPath,
  ]),
  nextStepClassification:
    "preserve the compact-facing cost-analysis projection of the unchanged shared underlay/runtime-input family until returned inputs or explicit reclassification materially change the same carrier frontier",
  resumeCondition: stringValue(costBlocker.resume_condition),
  summary:
    "2026-07-12 app-state repair preserved cost-analysis only as the compact-facing projection of the unchanged shared underlay/runtime-input family and aligned its review window to 2026-07-13T15:30:00Z.",
  attemptedFixes: unique([
    ...(costFeature.attemptedFixes ?? []),
    `${attemptId}: refreshed the compact-facing cost-analysis holder/state from the unchanged-family review memo and replaced stale feature-local wait wording with the preserved shared family projection.`,
  ]),
});

const upgradeTaskId = "hold-compact-upgrade-underlay-runtime-input-frontier-20260712";
const upgradeBlocker = blocker(upgradeTaskId);
const upgradeFeature = state.features["upgrade"];
if (!upgradeFeature) throw new Error("Missing feature state for upgrade");
updateFeatureCompactItem(state, "upgrade", {
  status: "blocked",
  taskId: upgradeTaskId,
  frontierTaskIds: [],
  retryable: false,
  retryReason: stringValue(upgradeBlocker.resume_condition),
  blockedAt:
    stringValue(upgradeBlocker.blocked_at) ?? upgradeFeature.blockedAt ?? checkedAt,
  blockedReason: stringValue(upgradeBlocker.condition),
  waitingFor: asRecord(upgradeBlocker.waiting_for),
  waitingCondition: stringValue(upgradeBlocker.resume_condition),
  observedBy: asRecord(upgradeBlocker.observed_by),
  observationMethod: stringValue(upgradeBlocker.observation_method),
  nextCheckAt: stringValue(upgradeBlocker.next_check_at),
  blockerOwner: stringValue(upgradeBlocker.owner),
  fallbackAt: stringValue(upgradeBlocker.fallback_at),
  fallbackAction: stringValue(upgradeBlocker.fallback_action),
  reviewEvidencePath: evidencePath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(upgradeFeature.evidencePaths ?? []),
    evidencePath,
    reviewedMemoPath,
    "evidence/archive/hold-compact-upgrade-underlay-runtime-input-frontier-20260712.md",
  ]),
  summary:
    "2026-07-12 app-state repair preserved upgrade only as the compact-facing projection of the unchanged shared underlay/runtime-input family and moved its review window to 2026-07-13T15:30:00Z.",
  attemptedFixes: unique([
    ...(upgradeFeature.attemptedFixes ?? []),
    `${attemptId}: refreshed the compact-facing upgrade holder/state from the unchanged-family review memo and aligned nextCheckAt/fallbackAt to the preserved shared underlay/runtime-input family window.`,
  ]),
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      reviewedMemoPath,
      compactStatePath: path,
      refreshedFeatures: {
        "serverless-schedulerctrl": {
          taskId: state.features["serverless-schedulerctrl"]?.taskId ?? null,
          nextCheckAt: state.features["serverless-schedulerctrl"]?.nextCheckAt ?? null,
          fallbackAt: state.features["serverless-schedulerctrl"]?.fallbackAt ?? null,
          reviewEvidencePath:
            state.features["serverless-schedulerctrl"]?.reviewEvidencePath ?? null,
        },
        "cost-analysis": {
          taskId: state.features["cost-analysis"]?.taskId ?? null,
          nextCheckAt: state.features["cost-analysis"]?.nextCheckAt ?? null,
          fallbackAt: state.features["cost-analysis"]?.fallbackAt ?? null,
          reviewEvidencePath: state.features["cost-analysis"]?.reviewEvidencePath ?? null,
        },
        upgrade: {
          taskId: state.features["upgrade"]?.taskId ?? null,
          nextCheckAt: state.features["upgrade"]?.nextCheckAt ?? null,
          fallbackAt: state.features["upgrade"]?.fallbackAt ?? null,
          reviewEvidencePath: state.features["upgrade"]?.reviewEvidencePath ?? null,
        },
      },
    },
    null,
    2,
  ),
);
