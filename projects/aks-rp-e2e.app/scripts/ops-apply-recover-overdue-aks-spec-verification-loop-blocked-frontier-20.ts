import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

type ReviewRecord = Record<string, unknown>;

type Repair = {
  specId: string;
  fromTaskId: string;
  toTaskId: string;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const statePath = defaultSpecLoopStatePath(appDir);
const state = JSON.parse(readFileSync(statePath, "utf-8")) as SpecLoopState;

const repairs: Repair[] = [
  {
    specId: "spec.rp-nodepool-lifecycle.rollback",
    fromTaskId:
      "hold-spec-rp-nodepool-lifecycle-rollback-reviewed-no-history-frontier-20260707b",
    toTaskId: "hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707",
  },
  {
    specId: "spec.workload-autoscaler.keda-upgrade-survival",
    fromTaskId:
      "hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707g",
    toTaskId:
      "hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h",
  },
];

const results = repairs.map((repair) => {
  const current = state.specs[repair.specId];
  if (!current) {
    throw new Error(`Spec not found in state: ${repair.specId}`);
  }

  const review: ReviewRecord =
    current.review && typeof current.review === "object" && !Array.isArray(current.review)
      ? { ...(current.review as ReviewRecord) }
      : {};

  const before = {
    taskId: current.taskId ?? null,
    pendingReviewTaskId:
      typeof review.pendingReviewTaskId === "string"
        ? review.pendingReviewTaskId
        : null,
  };

  if (before.taskId !== repair.fromTaskId) {
    throw new Error(
      `Unexpected current taskId for ${repair.specId}: ${before.taskId} (expected ${repair.fromTaskId})`,
    );
  }
  if (before.pendingReviewTaskId !== repair.fromTaskId) {
    throw new Error(
      `Unexpected current review.pendingReviewTaskId for ${repair.specId}: ${before.pendingReviewTaskId} (expected ${repair.fromTaskId})`,
    );
  }

  review.pendingReviewTaskId = repair.toTaskId;

  updateSpecLoopSpec(state, repair.specId, {
    taskId: repair.toTaskId,
    review,
  });

  const after = state.specs[repair.specId];
  return {
    specId: repair.specId,
    expectedFromTaskId: repair.fromTaskId,
    targetTaskId: repair.toTaskId,
    before,
    after: {
      taskId: after?.taskId ?? null,
      pendingReviewTaskId:
        after?.review &&
        typeof after.review === "object" &&
        !Array.isArray(after.review) &&
        typeof (after.review as ReviewRecord).pendingReviewTaskId === "string"
          ? ((after.review as ReviewRecord).pendingReviewTaskId as string)
          : null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});

saveSpecLoopState(statePath, state);

console.log(
  JSON.stringify(
    {
      attempt:
        "a_ops-apply-recover-overdue-aks-spec-verification-loop-blocked-frontier-20_20260711143754",
      statePath,
      repairs: results,
    },
    null,
    2,
  ),
);
