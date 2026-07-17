import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { readTask, taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

type HolderBlocker = {
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

type HolderTask = {
  blocker?: HolderBlocker;
  result?: string;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-recover-ccp-underlay-vpa-compact-placement-holder-20260716-state-repair_20260716215547";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const featureKey = "ccp-underlay-vpa";
const holderTaskId =
  "hold-compact-ccp-underlay-vpa-reviewed-exception-placement-frontier-20260710";
const memoPath =
  "evidence/archive/ops-apply-recover-ccp-underlay-vpa-compact-placement-holder-20260716-state-repair.md";
const domainMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/recover-ccp-underlay-vpa-compact-placement-holder-20260716.md";
const priorAppMemoPath =
  "evidence/archive/ops-apply-reconcile-compact-ccp-underlay-vpa-placement-holder-20260713-state-repair.md";
const priorAppReviewMemoPath =
  "evidence/archive/ops-reconcile-compact-ccp-underlay-vpa-placement-holder-20260713.md";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const task = readTask(config, holderTaskId) as HolderTask | null;
if (!task?.blocker) {
  throw new Error(`Missing live holder blocker for ${holderTaskId}`);
}

const { state, path: statePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const existing = state.features[featureKey];
if (!existing) {
  throw new Error(`Missing compact feature row for ${featureKey}`);
}

const existingEvidencePaths = Array.isArray(existing.evidencePaths)
  ? existing.evidencePaths.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
  : [];
const evidencePaths = Array.from(
  new Set([
    memoPath,
    domainMemoPath,
    priorAppMemoPath,
    priorAppReviewMemoPath,
    ...existingEvidencePaths,
  ]),
);

const lastSummary =
  "ccp-underlay-vpa remains outside default compact live because its only compact member, spec.ccp-underlay-vpa.component-lifecycle, remains status=environment and specState=reviewed-exception on the unchanged control-plane underlay VPA path. Current compact artifacts still read 1 selected / 0 live-ready / 1 quarantined because default compact live intentionally excludes reviewed-exception members; resume only after accepted same-path reclassification, intentional compact-policy admission, or a reviewed equivalent compact-frontier replacement.";
const ownerReason =
  "The feature has one selected carrier and no live-ready members because default compact live intentionally excludes reviewed-exception compact members until accepted same-path reclassification, intentional compact-policy admission, or a reviewed equivalent compact-frontier replacement materially changes compact eligibility.";
const summary =
  `Attempt ${attemptId} synchronized the app-owned ccp-underlay-vpa compact projection to the refreshed 2026-07-16 same-path placement holder: preserve the exact reviewed-exception compact frontier, refresh the 2026-07-17/2026-07-18 watch window, and point the feature row at current repair evidence without widening lineage or reopening a broad rerun.`;

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  errorClass: "reviewed-exception",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [],
  retryReason: task.blocker.resume_condition ?? null,
  lastSummary,
  rootCauseClassification: "repo-local-live-ready-filter",
  ownerReason,
  nextStepClassification: "exact-wait",
  resumeCondition: task.blocker.resume_condition ?? null,
  blockedReason: task.blocker.condition ?? null,
  waitingFor:
    (task.blocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: task.blocker.resume_condition ?? null,
  observedBy:
    (task.blocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: task.blocker.observation_method ?? null,
  nextCheckAt: task.blocker.next_check_at ?? null,
  blockerOwner: task.blocker.owner ?? null,
  fallbackAt: task.blocker.fallback_at ?? null,
  fallbackAction: task.blocker.fallback_action ?? null,
  resumeAction:
    "Reset this feature compact record to pending only after the named wait condition changes.",
  lastCheckedAt: new Date().toISOString(),
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary,
});

saveFeatureCompactLoopState(statePath, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      featureKey,
      holderTaskId,
      before: {
        blockedReason: existing.blockedReason ?? null,
        nextCheckAt: existing.nextCheckAt ?? null,
        fallbackAt: existing.fallbackAt ?? null,
        reviewEvidencePath: existing.reviewEvidencePath ?? null,
        summary: existing.summary ?? null,
      },
      after: {
        blockedReason: task.blocker.condition ?? null,
        nextCheckAt: task.blocker.next_check_at ?? null,
        fallbackAt: task.blocker.fallback_at ?? null,
        reviewEvidencePath: memoPath,
        summary,
      },
      statePath,
    },
    null,
    2,
  ),
);
