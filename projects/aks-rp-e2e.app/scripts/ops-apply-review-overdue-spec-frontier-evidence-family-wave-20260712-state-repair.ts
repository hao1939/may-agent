import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

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
  context?: Record<string, unknown>;
};

type TaskTree = {
  tasks: Record<string, TaskNode>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const attemptId =
  "a_ops-apply-review-overdue-spec-frontier-evidence-family-wave-20260712-sta_20260712190236";
const checkedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-apply-review-overdue-spec-frontier-evidence-family-wave-20260712-state-repair.md";
const reviewMemoPath =
  "evidence/archive/domain-review-overdue-spec-frontier-evidence-family-wave-20260712.md";

const storageTaskId =
  "wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702";
const secureTlsTaskId =
  "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708";

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  ].sort((a, b) => a.localeCompare(b));
}

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;

const specRepairs = [
  {
    specId: "spec.storage-csi.mcr-mirror-monitor",
    taskId: storageTaskId,
    successorRunId: null,
    successorEvidencePath:
      "/app/projects/aks-rp-e2e/evidence/archive/reconcile-spec-storage-csi-source-grounded-nonlive-frontier-20260708.md",
    successorDisposition: "direct_registry_environment_wait_nonlive_monitor",
    stateReason:
      "Accepted 2026-07-12 review keeps this exact non-cluster monitor on the narrower direct-registry frontier: the maintained bounded pull-sequence-equivalent helper already exists, mirror-site HTTP succeeds, and the remaining blocker is GET mcr.azk8s.cn/v2/ -> HTTP 403 before manifest or blob fetches.",
    reviewClassification: "direct_registry_environment_wait_nonlive_monitor",
    reviewRootCause:
      "The exact active wait is now the direct-registry frontier only. Accepted repair evidence already proves the maintained bounded pull-sequence-equivalent helper exists; the surviving blocker is the mcr.azk8s.cn/v2/ HTTP 403 environment surface for this non-cluster monitor path.",
    reviewAction:
      "Keep pending under the exact direct-registry-access wait holder and updated review memo. Do not reopen unchanged standalone live execution. Resume only if the direct registry path becomes reachable enough to progress past /v2/ or an owner-reviewed terminal decision replaces the current frontier.",
  },
  {
    specId: "spec.secure-tls-bootstrap.network-isolated",
    taskId: secureTlsTaskId,
    successorRunId: "28721673014",
    successorEvidencePath:
      "/app/projects/aks-rp-e2e/evidence/archive/domain-review-overdue-spec-frontier-evidence-family-wave-20260712.md",
    successorDisposition: "same-path-environment-blocker-reviewed-from-rerun",
    stateReason:
      "Accepted 2026-07-12 review moves the controlling same-path row-43 frontier to reviewed live run 28721673014 / plan_20260704222857560_ebjqox. The exact remaining frontier is still image pull validation failing with ImagePullBackOff after the disable-network-isolated transition.",
    reviewClassification: "same-path-environment-blocker-reviewed-from-rerun",
    reviewRootCause:
      "The current checked-in spec and compact surfaces now anchor row 43 on reviewed live run 28721673014 / plan_20260704222857560_ebjqox with the same surviving ImagePullBackOff failure after the disable-network-isolated transition.",
    reviewAction:
      "Keep the spec blocked on the exact same-path image-pull-after-disable frontier anchored to run 28721673014. Do not queue another unchanged rerun unless the same-surface failure materially changes or an owner-approved execution surface changes.",
  },
] as const;

const specResults = specRepairs.map((repair) => {
  const current = specState.specs[repair.specId];
  if (!current) {
    throw new Error(`Missing spec state for ${repair.specId}`);
  }
  const liveBlocker = blocker(repair.taskId);
  const review = asRecord(current.review) ?? {};

  updateSpecLoopSpec(specState, repair.specId, {
    taskId: repair.taskId,
    resumeCondition:
      liveBlocker.resume_condition ?? current.resumeCondition ?? undefined,
    successorDisposition: repair.successorDisposition,
    successorEvidencePath: repair.successorEvidencePath,
    successorStateReason: repair.stateReason,
    ...(repair.successorRunId ? { successorRunId: repair.successorRunId } : {}),
    review: {
      ...review,
      classification: repair.reviewClassification,
      lastRootCause: repair.reviewRootCause,
      lastAction: repair.reviewAction,
      reviewedAt: checkedAt,
      pendingReviewTaskId: repair.taskId,
      ...(repair.successorRunId
        ? {
            pendingReviewRunId: repair.successorRunId,
            pendingReviewObservedAt: checkedAt,
          }
        : {}),
    },
  });

  const after = specState.specs[repair.specId];
  const afterReview = asRecord(after?.review) ?? {};
  return {
    specId: repair.specId,
    taskId: repair.taskId,
    after: {
      taskId: after?.taskId ?? null,
      resumeCondition: after?.resumeCondition ?? null,
      successorDisposition: after?.successorDisposition ?? null,
      successorRunId: asString((after as Record<string, unknown> | undefined)?.successorRunId) ?? null,
      successorEvidencePath: after?.successorEvidencePath ?? null,
      reviewClassification: asString(afterReview.classification) ?? null,
      pendingReviewTaskId: asString(afterReview.pendingReviewTaskId) ?? null,
      pendingReviewRunId: asString(afterReview.pendingReviewRunId) ?? null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});

saveSpecLoopState(specStatePath, specState);

const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const compactState = JSON.parse(
  readFileSync(compactStatePath, "utf-8"),
) as FeatureCompactLoopState;

const compactRepairs = [
  {
    featureKey: "storage-csi",
    taskId: compactState.features["storage-csi"]?.taskId ?? storageTaskId,
    reviewEvidencePath:
      "evidence/archive/ops-apply-recover-overdue-compact-storage-csi-holder-app-ops-20260712.md",
  },
  {
    featureKey: "secure-tls-bootstrap",
    taskId: compactState.features["secure-tls-bootstrap"]?.taskId ?? secureTlsTaskId,
    reviewEvidencePath: memoPath,
  },
] as const;

const compactResults = compactRepairs.map((repair) => {
  const current = compactState.features[repair.featureKey];
  if (!current) {
    throw new Error(`Missing compact feature state for ${repair.featureKey}`);
  }

  if (repair.featureKey === "secure-tls-bootstrap") {
    const liveBlocker = blocker(secureTlsTaskId);
    updateFeatureCompactItem(compactState, repair.featureKey, {
      status: "blocked",
      taskId: current.taskId ?? repair.taskId,
      frontierTaskIds: current.frontierTaskIds ?? [secureTlsTaskId],
      retryable: false,
      retryReason: liveBlocker.resume_condition ?? current.retryReason ?? null,
      blockedReason: liveBlocker.condition ?? current.blockedReason ?? null,
      waitingFor:
        (liveBlocker.waiting_for as Record<string, unknown> | undefined) ??
        current.waitingFor ??
        null,
      waitingCondition:
        liveBlocker.resume_condition ?? current.waitingCondition ?? null,
      observedBy:
        (liveBlocker.observed_by as Record<string, unknown> | undefined) ??
        current.observedBy ??
        null,
      observationMethod:
        liveBlocker.observation_method ?? current.observationMethod ?? null,
      nextCheckAt: liveBlocker.next_check_at ?? current.nextCheckAt ?? null,
      blockerOwner: liveBlocker.owner ?? current.blockerOwner ?? null,
      fallbackAt: liveBlocker.fallback_at ?? current.fallbackAt ?? null,
      fallbackAction:
        liveBlocker.fallback_action ?? current.fallbackAction ?? null,
      reviewEvidencePath: repair.reviewEvidencePath,
      lastCheckedAt: checkedAt,
      evidencePaths: unique([
        ...(current.evidencePaths ?? []),
        reviewMemoPath,
        memoPath,
      ]),
      summary:
        `${attemptId}: refreshed secure-tls-bootstrap compact-facing frontier evidence anchor to reviewed run 28721673014 while preserving the same exact row-43 image-pull-after-disable holder.`,
      attemptedFixes: unique([
        ...(current.attemptedFixes ?? []),
        `${attemptId}: synchronized secure-tls-bootstrap controller-visible compact review metadata to the reviewed run 28721673014 row-43 frontier without reopening an unchanged rerun.`,
      ]),
    });
  }

  const after = compactState.features[repair.featureKey];
  return {
    featureKey: repair.featureKey,
    taskId: after?.taskId ?? null,
    reviewEvidencePath: after?.reviewEvidencePath ?? null,
    nextCheckAt: after?.nextCheckAt ?? null,
    fallbackAt: after?.fallbackAt ?? null,
    updatedAt: after?.updatedAt ?? null,
  };
});

saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      memoPath,
      reviewMemoPath,
      specStatePath,
      compactStatePath,
      specResults,
      compactResults,
    },
    null,
    2,
  ),
);
