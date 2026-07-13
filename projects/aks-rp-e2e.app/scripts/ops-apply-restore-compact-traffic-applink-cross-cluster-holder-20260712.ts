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
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const loopTaskId = "aks-feature-compact-loop";
const featureKey = "traffic-applink";
const holderTaskId =
  "hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707";
const upgradeTaskId =
  "hold-compact-traffic-applink-upgrade-survival-contract-mismatch-frontier-20260707";
const memoPath =
  "evidence/archive/ops-apply-restore-compact-traffic-applink-cross-cluster-holder-app-ops-20260712.md";
const checkedAt = new Date().toISOString();

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

const holderBlocker = blocker(holderTaskId);
const upgradeBlocker = blocker(upgradeTaskId);

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const before = state.features[featureKey];
if (!before) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

const evidencePaths = Array.from(
  new Set(
    [
      memoPath,
      "../aks-rp-e2e/evidence/archive/author-compact-traffic-applink-cross-cluster-discovery-self-contained-carrier-20260709.md",
      "../aks-rp-e2e/evidence/archive/author-compact-traffic-applink-cross-cluster-discovery-self-contained-live-carrier-20260709.md",
      "../aks-rp-e2e/evidence/archive/reconcile-compact-loop-package-partial-task-a_reconcile-compact-loop-package-partial-202607090423_20260709042308-worker.md",
      ...(before.evidencePaths ?? []),
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ),
);

const resumeCondition =
  holderBlocker.resume_condition ??
  before.resumeCondition ??
  "Resume only when a self-contained live-admissible carrier exists for spec.traffic-applink.cross-cluster-discovery or accepted authority changes the exact compact branch boundary.";

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId, upgradeTaskId],
  retryReason: resumeCondition,
  blockedReason:
    "Do not rerun unchanged; the compact package remains partial on an exact split frontier: " +
    "spec.traffic-applink.cross-cluster-discovery stays on compact holder " +
    `${holderTaskId} for the missing self-contained second-cluster/AppLink-member carrier, ` +
    "spec.traffic-applink.upgrade-survival stays on compact holder " +
    `${upgradeTaskId} for the checked-in cluster-upgrade-vs-member-upgrade contract ceiling, ` +
    "and spec.traffic-applink.register-lifecycle remains superseded historical lineage only.",
  waitingFor: {
    type: "frontier.changed",
    featureKey,
    target: "staging",
    errorClass: before.errorClass ?? "package-partial",
    scope: "feature-compact",
    taskIds: [holderTaskId, upgradeTaskId],
    source: "ops-apply-restore-compact-traffic-applink-cross-cluster-holder-app-ops-20260712",
  },
  waitingCondition: resumeCondition,
  observedBy: (holderBlocker.observed_by ?? before.observedBy ?? null) as
    | Record<string, unknown>
    | null,
  observationMethod:
    holderBlocker.observation_method ?? before.observationMethod ?? null,
  nextCheckAt: holderBlocker.next_check_at ?? before.nextCheckAt ?? null,
  blockerOwner: holderBlocker.owner ?? before.blockerOwner ?? null,
  fallbackAt: holderBlocker.fallback_at ?? before.fallbackAt ?? null,
  fallbackAction: holderBlocker.fallback_action ?? before.fallbackAction ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary:
    `Restored compact split-frontier representation for traffic-applink: ${holderTaskId} now carries only spec.traffic-applink.cross-cluster-discovery, ${upgradeTaskId} remains the separate upgrade-survival holder, and no unchanged compact rerun is truthful.`,
  lastCheckedAt: checkedAt,
  blockedAt: holderBlocker.next_check_at ? before.blockedAt ?? checkedAt : before.blockedAt ?? checkedAt,
  ownerReason:
    "All active feature-owned specs remain selected into the compact package, so traffic-applink is truthfully represented only as a split frontier: one compact blocked holder for the cross-cluster self-contained carrier gap plus one separate compact blocked holder for the upgrade-survival contract ceiling.",
  verificationBlocker:
    "Do not rerun unchanged. spec.traffic-applink.cross-cluster-discovery still lacks a truthful self-contained live-admissible carrier, while spec.traffic-applink.upgrade-survival remains on its separate contract-mismatch ceiling.",
});

saveFeatureCompactLoopState(path, state);

const after = state.features[featureKey];
console.log(
  JSON.stringify(
    {
      featureKey,
      statePath: path,
      holderTaskId,
      upgradeTaskId,
      before: {
        taskId: before.taskId ?? null,
        frontierTaskIds: before.frontierTaskIds ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
        nextCheckAt: before.nextCheckAt ?? null,
        fallbackAt: before.fallbackAt ?? null,
      },
      after: {
        taskId: after.taskId ?? null,
        frontierTaskIds: after.frontierTaskIds ?? null,
        reviewEvidencePath: after.reviewEvidencePath ?? null,
        waitingFor: after.waitingFor ?? null,
        nextCheckAt: after.nextCheckAt ?? null,
        fallbackAt: after.fallbackAt ?? null,
        updatedAt: after.updatedAt ?? null,
      },
      holderBlocker: {
        condition: holderBlocker.condition ?? null,
        resumeCondition: holderBlocker.resume_condition ?? null,
        nextCheckAt: holderBlocker.next_check_at ?? null,
        fallbackAt: holderBlocker.fallback_at ?? null,
      },
      upgradeBlocker: {
        condition: upgradeBlocker.condition ?? null,
        resumeCondition: upgradeBlocker.resume_condition ?? null,
      },
    },
    null,
    2,
  ),
);
