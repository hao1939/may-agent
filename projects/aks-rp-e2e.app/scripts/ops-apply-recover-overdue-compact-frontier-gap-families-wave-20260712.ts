import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

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
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const attemptId =
  "a_ops-apply-recover-overdue-compact-frontier-gap-families-wave-20260712_20260712190334";
const checkedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-apply-recover-overdue-compact-frontier-gap-families-wave-20260712.md";

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const repairs = [
  {
    featureKey: "trusted-access",
    taskId: "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705",
    frontierTaskIds: ["wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711"],
    summary:
      "2026-07-12 overdue compact frontier refresh aligned trusted-access to the same future TA gateway DNS/runtime family window while preserving the exact compact holder and shared family wait rather than restoring duplicate alias coverage.",
  },
  {
    featureKey: "workload-autoscaler",
    taskId: "hold-compact-workload-autoscaler-package-partial-frontier",
    frontierTaskIds: ["hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h"],
    summary:
      "2026-07-12 overdue compact frontier refresh kept workload-autoscaler on the same exact two-member split frontier and moved the compact holder watch window forward without recreating a generic source-proof wait or reopening an unchanged rerun.",
  },
  {
    featureKey: "workload-identity",
    taskId: "hold-compact-workload-identity-live-workflow-frontier",
    frontierTaskIds: ["wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702"],
    summary:
      "2026-07-12 overdue compact frontier refresh kept workload-identity as the compact-facing projection of the shared Automatic/ManagedSystem capacity family and aligned the holder to the represented wait's future review window.",
  },
] as const;

const results = repairs.map((repair) => {
  const item = state.features[repair.featureKey];
  if (!item) {
    throw new Error(`Missing compact feature state for ${repair.featureKey}`);
  }
  const liveBlocker = blocker(repair.taskId);
  const before = {
    taskId: item.taskId ?? null,
    frontierTaskIds: item.frontierTaskIds ?? null,
    nextCheckAt: item.nextCheckAt ?? null,
    fallbackAt: item.fallbackAt ?? null,
    reviewEvidencePath: item.reviewEvidencePath ?? null,
  };

  updateFeatureCompactItem(state, repair.featureKey, {
    status: "blocked",
    taskId: repair.taskId,
    frontierTaskIds: [...repair.frontierTaskIds],
    retryable: false,
    retryReason: liveBlocker.resume_condition ?? item.retryReason ?? null,
    blockedReason: liveBlocker.condition ?? item.blockedReason ?? null,
    waitingFor:
      (liveBlocker.waiting_for as Record<string, unknown> | undefined) ??
      item.waitingFor ??
      null,
    waitingCondition: liveBlocker.resume_condition ?? item.waitingCondition ?? null,
    observedBy:
      (liveBlocker.observed_by as Record<string, unknown> | undefined) ??
      item.observedBy ??
      null,
    observationMethod: liveBlocker.observation_method ?? item.observationMethod ?? null,
    nextCheckAt: liveBlocker.next_check_at ?? item.nextCheckAt ?? null,
    blockerOwner: liveBlocker.owner ?? item.blockerOwner ?? null,
    fallbackAt: liveBlocker.fallback_at ?? item.fallbackAt ?? null,
    fallbackAction: liveBlocker.fallback_action ?? item.fallbackAction ?? null,
    reviewEvidencePath: memoPath,
    lastCheckedAt: checkedAt,
    evidencePaths: unique([...(item.evidencePaths ?? []), memoPath]),
    summary: repair.summary,
    attemptedFixes: unique([
      ...(item.attemptedFixes ?? []),
      `${attemptId}: aligned compact-loop state for ${repair.featureKey} to live blocked holder ${repair.taskId} after the overdue compact frontier gap-family refresh.`,
    ]),
  });

  const after = state.features[repair.featureKey];
  return {
    featureKey: repair.featureKey,
    before,
    after: {
      taskId: after?.taskId ?? null,
      frontierTaskIds: after?.frontierTaskIds ?? null,
      nextCheckAt: after?.nextCheckAt ?? null,
      fallbackAt: after?.fallbackAt ?? null,
      reviewEvidencePath: after?.reviewEvidencePath ?? null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      memoPath,
      compactStatePath: path,
      results,
      note:
        "No serverless feature-level compact-state rewrite was applied here because the serverless feature record intentionally tracks the broader mixed promotion/runtime frontier; this task refreshed the exact compact multi-pod-burst runtime-readiness wait in the task tree only.",
    },
    null,
    2,
  ),
);
