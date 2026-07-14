import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type TaskTree = {
  tasks: Record<
    string,
    {
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
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const memoPath =
  "evidence/archive/ops-apply-reconcile-compact-ccp-underlay-vpa-placement-holder-20260713-state-repair.md";
const featureKey = "ccp-underlay-vpa";
const holderTaskId =
  "hold-compact-ccp-underlay-vpa-reviewed-exception-placement-frontier-20260710";

const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
const holderTask = tree.tasks[holderTaskId];
if (!holderTask?.blocker) {
  throw new Error(`Missing blocker for ${holderTaskId}`);
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
    "evidence/archive/ops-reconcile-compact-ccp-underlay-vpa-placement-holder-20260713.md",
    "/app/projects/aks-rp-e2e/evidence/archive/domain-ccp-underlay-vpa-compact-placement-reclassification-20260711.md",
    ...existingEvidencePaths,
  ]),
);

const reviewSummary =
  "Projection parity repair aligned the app-owned ccp-underlay-vpa compact state with the live reviewed-exception placement holder: keep the feature blocked behind the exact compact-placement frontier, refresh the 2026-07-14/2026-07-15 watch window, and point the feature row at current app evidence rather than stale environment-wait metadata.";

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  retryable: false,
  retryReason: holderTask.blocker.resume_condition ?? null,
  lastSummary:
    "ccp-underlay-vpa remains outside default compact live because its only compact member, spec.ccp-underlay-vpa.component-lifecycle, is still the accepted reviewed-exception carrier. Current compact artifacts remain 1 selected / 0 live-ready / 1 quarantined; resume only after accepted same-path reclassification, intentional compact-policy admission, or a reviewed equivalent compact-frontier replacement.",
  rootCauseClassification: "repo-local-live-ready-filter",
  ownerReason:
    "The feature has one selected carrier and no live-ready members because reviewed-exception compact members are intentionally excluded from default live dispatch until accepted same-path reclassification or intentional policy change lands.",
  nextStepClassification: "exact-wait",
  resumeCondition: holderTask.blocker.resume_condition ?? null,
  blockedReason: holderTask.blocker.condition ?? null,
  waitingFor: (holderTask.blocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: holderTask.blocker.resume_condition ?? null,
  observedBy: (holderTask.blocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: holderTask.blocker.observation_method ?? null,
  nextCheckAt: holderTask.blocker.next_check_at ?? null,
  blockerOwner: holderTask.blocker.owner ?? null,
  fallbackAt: holderTask.blocker.fallback_at ?? null,
  fallbackAction: holderTask.blocker.fallback_action ?? null,
  resumeAction:
    "Reset this feature compact record to pending only after the named wait condition changes.",
  lastCheckedAt: new Date().toISOString(),
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary: reviewSummary,
});

saveFeatureCompactLoopState(statePath, state);

console.log(
  JSON.stringify(
    {
      memoPath,
      feature: {
        featureKey,
        taskId: holderTaskId,
        before: {
          waitingFor: existing.waitingFor ?? null,
          nextCheckAt: existing.nextCheckAt ?? null,
          fallbackAt: existing.fallbackAt ?? null,
          reviewEvidencePath: existing.reviewEvidencePath ?? null,
          blockerOwner: existing.blockerOwner ?? null,
        },
        after: {
          waitingFor: holderTask.blocker.waiting_for ?? null,
          nextCheckAt: holderTask.blocker.next_check_at ?? null,
          fallbackAt: holderTask.blocker.fallback_at ?? null,
          reviewEvidencePath: memoPath,
          blockerOwner: holderTask.blocker.owner ?? null,
        },
      },
      paths: {
        treePath,
        statePath,
      },
    },
    null,
    2,
  ),
);
